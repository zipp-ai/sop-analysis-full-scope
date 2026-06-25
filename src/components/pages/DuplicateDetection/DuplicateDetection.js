import React, { useState, useEffect, useCallback, useMemo } from "react";
import Navigation from "../../common/Navigation/Navigation";
import Modal from "../../common/Modal/Modal";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import ConfirmationModal from "../../common/ConfirmationModal/ConfirmationModal";
import duplicateService from "../../../services/duplicateService";
import toastService from "../../../services/toastService";
import supabase from "../../../supabase";
import { formatDate } from "../../../utils/dateUtils";
import BulkUpload from "./BulkUpload";
import "./DuplicateDetection.css";

const STATUS_LABELS = {
  pending: "Pending",
  running_layer1: "Analyzing Titles...",
  running_layer2: "Comparing Embeddings...",
  running_layer3: "AI Classification...",
  completed: "Completed",
  failed: "Failed",
};

const DuplicateDetection = () => {
  const [sopDocs, setSopDocs] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sopToDelete, setSopToDelete] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [filterClassification, setFilterClassification] = useState("all");

  const [uploading, setUploading] = useState(false);

  // Get user and org info
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setOrganizationId(user.user_metadata?.organization_id || user.id);
      }
    };
    init();
  }, []);

  // Fetch data when org is available
  useEffect(() => {
    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docs, analysisHistory] = await Promise.all([
        duplicateService.getSOPDocuments(organizationId),
        duplicateService.getAnalyses(organizationId),
      ]);
      setSopDocs(docs || []);
      setAnalyses(analysisHistory || []);

      // Auto-select latest completed analysis
      const latest = (analysisHistory || []).find((a) => a.status === "completed");
      if (latest) {
        await loadAnalysisResults(latest);
      }
    } catch (err) {
      toastService.error("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisResults = async (analysis) => {
    try {
      setSelectedAnalysis(analysis);
      const [pairsData, clustersData] = await Promise.all([
        duplicateService.getPairs(analysis.id),
        duplicateService.getClusters(analysis.id),
      ]);
      setPairs(pairsData || []);
      setClusters(clustersData || []);
    } catch (err) {
      toastService.error("Failed to load results: " + err.message);
    }
  };

  const handleRunAnalysis = async () => {
    if (sopDocs.filter((s) => s.status === "ready").length < 2) {
      toastService.error("Need at least 2 processed SOPs to run analysis");
      return;
    }

    try {
      setAnalyzing(true);
      const result = await duplicateService.runAnalysis(organizationId);
      toastService.success(
        `Analysis complete: ${result.flagged_pairs} potential duplicates found in ${result.clusters} clusters`
      );
      await fetchData();
    } catch (err) {
      toastService.error("Analysis failed: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleBulkUploadComplete = async () => {
    setShowUploadModal(false);
    await fetchData();
  };

  const handleDeleteSOP = async () => {
    if (!sopToDelete) return;
    try {
      await duplicateService.deleteSOPDocument(sopToDelete.id);
      toastService.success("SOP deleted");
      setSopToDelete(null);
      setShowDeleteConfirm(false);
      await fetchData();
    } catch (err) {
      toastService.error("Delete failed: " + err.message);
    }
  };

  const handleDecision = async (pairId, decision) => {
    try {
      await duplicateService.updatePairDecision(pairId, decision);
      setPairs((prev) =>
        prev.map((p) => (p.id === pairId ? { ...p, user_decision: decision } : p))
      );
      toastService.success("Decision saved");
    } catch (err) {
      toastService.error("Failed to save decision");
    }
  };

  const toggleCluster = (clusterId) => {
    setExpandedClusters((prev) => ({
      ...prev,
      [clusterId]: !prev[clusterId],
    }));
  };

  const getScoreClass = (score) => {
    if (score >= 0.85) return "high";
    if (score >= 0.6) return "medium";
    return "low";
  };

  const filteredPairs = useMemo(() => {
    if (filterClassification === "all") return pairs;
    return pairs.filter((p) => p.llm_classification === filterClassification);
  }, [pairs, filterClassification]);

  // Group pairs by cluster
  const pairsByCluster = useMemo(() => {
    const map = {};
    for (const cluster of clusters) {
      const clusterSopIds = new Set(cluster.sop_ids);
      map[cluster.id] = pairs.filter(
        (p) => clusterSopIds.has(p.sop_a_id) && clusterSopIds.has(p.sop_b_id)
      );
    }
    // Unclustered pairs
    const clusteredPairIds = new Set(Object.values(map).flat().map((p) => p.id));
    const unclustered = pairs.filter((p) => !clusteredPairIds.has(p.id) && p.llm_classification !== "distinct");
    if (unclustered.length > 0) {
      map["unclustered"] = unclustered;
    }
    return map;
  }, [pairs, clusters]);

  const readySops = sopDocs.filter((s) => s.status === "ready").length;
  const processingSops = sopDocs.filter((s) => s.status === "processing").length;

  if (loading) {
    return (
      <div className="duplicate-detection">
        <Navigation />
        <div className="duplicate-content">
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <span className="loading-text">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="duplicate-detection">
      <Navigation />
      <div className="duplicate-content">
        <div className="page-header">
          <h2>Duplicate Detection</h2>
          <span className="subtitle">Stage 1 — Identify and resolve duplicate SOPs</span>
        </div>

        {/* Stats */}
        <div className="stats-overview">
          <div className="stat-card">
            <h4>Total SOPs</h4>
            <p className="stat-value">{sopDocs.length}</p>
            <p className="stat-label">{readySops} ready, {processingSops} processing</p>
          </div>
          <div className="stat-card">
            <h4>Analyses Run</h4>
            <p className="stat-value">{analyses.length}</p>
          </div>
          <div className="stat-card">
            <h4>Flagged Pairs</h4>
            <p className="stat-value">
              {selectedAnalysis?.flagged_pairs || 0}
            </p>
          </div>
          <div className="stat-card">
            <h4>Clusters Found</h4>
            <p className="stat-value">
              {selectedAnalysis?.cluster_count || 0}
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="action-bar">
          <div className="action-bar-left">
            <button
              className="run-analysis-btn"
              onClick={handleRunAnalysis}
              disabled={analyzing || readySops < 2}
            >
              {analyzing ? (
                <>
                  <LoadingSpinner size="small" /> Analyzing...
                </>
              ) : (
                "Run Duplicate Analysis"
              )}
            </button>
            <button
              className="upload-sop-btn"
              onClick={() => setShowUploadModal(true)}
            >
              Bulk Upload
            </button>
          </div>
          {pairs.length > 0 && (
            <select
              className="filter-select"
              value={filterClassification}
              onChange={(e) => setFilterClassification(e.target.value)}
            >
              <option value="all">All Classifications</option>
              <option value="full_duplicate">Full Duplicates</option>
              <option value="partial_overlap">Partial Overlaps</option>
              <option value="version_variant">Version Variants</option>
              <option value="distinct">Distinct</option>
            </select>
          )}
        </div>

        {/* Analysis Progress */}
        {analyzing && (
          <div className="analysis-progress">
            <div className="progress-spinner" />
            <div className="progress-info">
              <h4>Running Duplicate Detection</h4>
              <p>Comparing {readySops} SOPs across title matching, semantic similarity, and AI classification...</p>
            </div>
          </div>
        )}

        {/* SOP Documents List */}
        {sopDocs.length > 0 && (
          <div className="sop-docs-list">
            <h3>Uploaded SOPs ({sopDocs.length})</h3>
            {sopDocs.map((doc) => (
              <div key={doc.id} className="sop-doc-item">
                <div className="sop-doc-info">
                  <h4>{doc.title}</h4>
                  <p>
                    {[doc.sop_code, doc.department, doc.site, doc.version && `v${doc.version}`]
                      .filter(Boolean)
                      .join(" · ") || "No metadata"}
                  </p>
                </div>
                <div className="sop-doc-status">
                  <span className={`status-dot ${doc.status}`} />
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {doc.status}
                  </span>
                  <button
                    className="delete-btn"
                    onClick={() => {
                      setSopToDelete(doc);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {selectedAnalysis && selectedAnalysis.status === "completed" && (
          <div className="results-section">
            <h3>
              Duplicate Analysis Results
              <span style={{ fontWeight: 400, fontSize: "13px", color: "#64748b", marginLeft: "0.75rem" }}>
                {formatDate(selectedAnalysis.completed_at)} · {selectedAnalysis.total_sops} SOPs · {selectedAnalysis.flagged_pairs} flagged
              </span>
            </h3>

            {clusters.length === 0 && filteredPairs.length === 0 ? (
              <div className="empty-state">
                <h3>No Duplicates Found</h3>
                <p>All SOPs appear to be distinct. Great job keeping your SOP library clean!</p>
              </div>
            ) : (
              <div className="cluster-list">
                {clusters.map((cluster) => {
                  const clusterPairs = pairsByCluster[cluster.id] || [];
                  const isExpanded = expandedClusters[cluster.id];
                  const maxScore = clusterPairs.length > 0
                    ? Math.max(...clusterPairs.map((p) => p.overall_score || 0))
                    : 0;

                  return (
                    <div key={cluster.id} className="cluster-card">
                      <div
                        className="cluster-header"
                        onClick={() => toggleCluster(cluster.id)}
                      >
                        <div className="cluster-header-left">
                          <div className={`cluster-icon ${getScoreClass(maxScore)}`}>
                            {cluster.sop_ids.length}
                          </div>
                          <div>
                            <div className="cluster-title">
                              {cluster.cluster_name || `Cluster of ${cluster.sop_ids.length} SOPs`}
                            </div>
                            <div className="cluster-meta">
                              {clusterPairs.length} comparison{clusterPairs.length !== 1 ? "s" : ""} · Max similarity: {Math.round(maxScore * 100)}%
                            </div>
                          </div>
                        </div>
                        <div className="cluster-header-right">
                          {cluster.recommended_action && (
                            <span className={`action-badge ${cluster.recommended_action}`}>
                              {cluster.recommended_action.replace("_", " ")}
                            </span>
                          )}
                          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>
                            ▾
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="cluster-body">
                          {clusterPairs.map((pair) => (
                            <PairCard
                              key={pair.id}
                              pair={pair}
                              onDecision={handleDecision}
                              getScoreClass={getScoreClass}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Unclustered flagged pairs */}
                {pairsByCluster["unclustered"]?.length > 0 && (
                  <div className="cluster-card">
                    <div
                      className="cluster-header"
                      onClick={() => toggleCluster("unclustered")}
                    >
                      <div className="cluster-header-left">
                        <div className="cluster-icon medium">?</div>
                        <div>
                          <div className="cluster-title">Other Flagged Pairs</div>
                          <div className="cluster-meta">
                            {pairsByCluster["unclustered"].length} pair(s) not in a cluster
                          </div>
                        </div>
                      </div>
                      <span className={`expand-icon ${expandedClusters["unclustered"] ? "expanded" : ""}`}>
                        ▾
                      </span>
                    </div>
                    {expandedClusters["unclustered"] && (
                      <div className="cluster-body">
                        {pairsByCluster["unclustered"].map((pair) => (
                          <PairCard
                            key={pair.id}
                            pair={pair}
                            onDecision={handleDecision}
                            getScoreClass={getScoreClass}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No SOPs state */}
        {sopDocs.length === 0 && !analyzing && (
          <div className="empty-state">
            <h3>Get Started</h3>
            <p>Upload SOPs to begin duplicate detection. You need at least 2 SOPs to run an analysis.</p>
            <button
              className="run-analysis-btn"
              onClick={() => setShowUploadModal(true)}
            >
              Add Your First SOP
            </button>
          </div>
        )}

        {/* Analysis History */}
        {analyses.length > 1 && (
          <div className="analysis-history">
            <h3>Analysis History</h3>
            {analyses.map((analysis) => (
              <div
                key={analysis.id}
                className={`history-item ${selectedAnalysis?.id === analysis.id ? "active" : ""}`}
                onClick={() => loadAnalysisResults(analysis)}
              >
                <div className="history-meta">
                  <span className={`status-badge ${analysis.status}`}>
                    {STATUS_LABELS[analysis.status] || analysis.status}
                  </span>
                  <span className="history-date">
                    {formatDate(analysis.created_at)}
                  </span>
                </div>
                <div className="history-stats">
                  <span>{analysis.total_sops} SOPs</span>
                  <span>{analysis.flagged_pairs} flagged</span>
                  <span>{analysis.cluster_count} clusters</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        closeOnOutsideClick={false}
      >
        <BulkUpload
          organizationId={organizationId}
          userId={userId}
          onComplete={handleBulkUploadComplete}
          onClose={() => setShowUploadModal(false)}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSopToDelete(null);
        }}
        onConfirm={handleDeleteSOP}
        title="Delete SOP"
        message={`Are you sure you want to delete "${sopToDelete?.title}"? This will remove it from all analyses.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

// Sub-component for individual pair display
const PairCard = ({ pair, onDecision, getScoreClass }) => {
  const [showSections, setShowSections] = useState(false);
  const sopA = pair.sop_a || {};
  const sopB = pair.sop_b || {};
  const sections = pair.overlapping_sections || [];

  return (
    <div className="pair-card">
      <div className="pair-sops">
        <div className="pair-sop">
          <h5>{sopA.title || "SOP A"}</h5>
          <p>
            {[sopA.sop_code, sopA.department, sopA.site, sopA.version && `v${sopA.version}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="pair-vs">vs</span>
        <div className="pair-sop">
          <h5>{sopB.title || "SOP B"}</h5>
          <p>
            {[sopB.sop_code, sopB.department, sopB.site, sopB.version && `v${sopB.version}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="pair-scores">
        <div className="score-item">
          <span className="score-label">Title Match:</span>
          <span className={`score-value ${getScoreClass(pair.metadata_score)}`}>
            {Math.round(pair.metadata_score * 100)}%
          </span>
        </div>
        <div className="score-item">
          <span className="score-label">Semantic:</span>
          <span className={`score-value ${getScoreClass(pair.semantic_score)}`}>
            {Math.round(pair.semantic_score * 100)}%
          </span>
        </div>
        <div className="score-item">
          <span className="score-label">Scope Overlap:</span>
          <span className={`score-value ${getScoreClass(pair.scope_overlap_score)}`}>
            {Math.round(pair.scope_overlap_score * 100)}%
          </span>
        </div>
        {pair.llm_classification && (
          <div className="score-item">
            <span className="score-label">AI:</span>
            <span className={`action-badge ${pair.recommended_action}`}>
              {pair.llm_classification.replace("_", " ")}
            </span>
          </div>
        )}
      </div>

      {pair.llm_reasoning && (
        <div className="pair-reasoning">{pair.llm_reasoning}</div>
      )}

      {/* Section-wise comparison */}
      {sections.length > 0 && (
        <div className="section-comparison">
          <button
            className="section-toggle"
            onClick={() => setShowSections(!showSections)}
          >
            {showSections ? "▾" : "▸"} Section-wise Comparison ({sections.length} sections)
          </button>
          {showSections && (
            <table className="section-table">
              <thead>
                <tr>
                  <th>SOP A Section</th>
                  <th>SOP B Section</th>
                  <th>Similarity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((sec, i) => (
                  <tr key={i} className={`section-row section-${sec.status}`}>
                    <td>
                      {sec.section_a ? (
                        <>
                          <span className="section-type-badge">{sec.section_a.type}</span>
                          <span className="section-heading">{sec.section_a.heading}</span>
                          {sec.section_a.content_preview && (
                            <span className="section-preview">{sec.section_a.content_preview}</span>
                          )}
                        </>
                      ) : (
                        <span className="section-missing">— Not present —</span>
                      )}
                    </td>
                    <td>
                      {sec.section_b ? (
                        <>
                          <span className="section-type-badge">{sec.section_b.type}</span>
                          <span className="section-heading">{sec.section_b.heading}</span>
                          {sec.section_b.content_preview && (
                            <span className="section-preview">{sec.section_b.content_preview}</span>
                          )}
                        </>
                      ) : (
                        <span className="section-missing">— Not present —</span>
                      )}
                    </td>
                    <td>
                      <span className={`score-value ${getScoreClass(sec.similarity)}`}>
                        {Math.round(sec.similarity * 100)}%
                      </span>
                    </td>
                    <td>
                      <span className={`section-status-badge status-${sec.status}`}>
                        {sec.status === "identical" ? "Identical" :
                         sec.status === "similar" ? "Similar" :
                         sec.status === "partial" ? "Partial" :
                         sec.status === "only_in_b" ? "Only in B" :
                         "Different"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="pair-actions">
        <span style={{ fontSize: "12px", color: "#64748b", marginRight: "0.5rem" }}>
          Decision:
        </span>
        {["retire", "merge", "distinct"].map((decision) => (
          <button
            key={decision}
            className={`decision-btn ${decision} ${pair.user_decision === decision ? "active" : ""}`}
            onClick={() => onDecision(pair.id, decision)}
          >
            {decision.charAt(0).toUpperCase() + decision.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DuplicateDetection;
