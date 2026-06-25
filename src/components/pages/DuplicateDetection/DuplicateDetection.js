import React, { useState, useEffect, useMemo } from "react";
import Navigation from "../../common/Navigation/Navigation";
import Modal from "../../common/Modal/Modal";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import SimilarityHeatmap from "./SimilarityHeatmap";
import duplicateService from "../../../services/duplicateService";
import toastService from "../../../services/toastService";
import supabase from "../../../supabase";
import { formatDate } from "../../../utils/dateUtils";
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
  const [categories, setCategories] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [pairs, setPairs] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedClusters, setExpandedClusters] = useState({});
  const [showAnalysisConfig, setShowAnalysisConfig] = useState(false);
  const [organizationId, setOrganizationId] = useState(null);
  const [filterClassification, setFilterClassification] = useState("all");

  // Analysis config state
  const [analysisName, setAnalysisName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSopIds, setSelectedSopIds] = useState([]);
  const [selectAllInCategory, setSelectAllInCategory] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setOrganizationId(user.user_metadata?.organization_id || user.id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docs, cats, analysisHistory] = await Promise.all([
        duplicateService.getSOPDocuments(organizationId),
        duplicateService.getCategories(),
        duplicateService.getAnalyses(organizationId),
      ]);
      setSopDocs(docs || []);
      setCategories(cats || []);
      setAnalyses(analysisHistory || []);

      const latest = (analysisHistory || []).find((a) => a.status === "completed");
      if (latest) await loadAnalysisResults(latest);
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

  // SOPs filtered by selected category for the config dialog
  const sopsInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return sopDocs.filter(d => d.category_id === selectedCategory && d.status === "ready");
  }, [sopDocs, selectedCategory]);

  const handleOpenAnalysisConfig = () => {
    setAnalysisName("");
    setSelectedCategory("");
    setSelectedSopIds([]);
    setSelectAllInCategory(true);
    setShowAnalysisConfig(true);
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setSelectAllInCategory(true);
    const sops = sopDocs.filter(d => d.category_id === catId && d.status === "ready");
    setSelectedSopIds(sops.map(s => s.id));
  };

  const toggleSopSelection = (sopId) => {
    setSelectAllInCategory(false);
    setSelectedSopIds(prev =>
      prev.includes(sopId) ? prev.filter(id => id !== sopId) : [...prev, sopId]
    );
  };

  const toggleSelectAll = () => {
    if (selectAllInCategory) {
      setSelectedSopIds([]);
      setSelectAllInCategory(false);
    } else {
      setSelectedSopIds(sopsInCategory.map(s => s.id));
      setSelectAllInCategory(true);
    }
  };

  const handleRunAnalysis = async () => {
    if (selectedSopIds.length < 2) {
      toastService.error("Select at least 2 SOPs to analyze");
      return;
    }

    setShowAnalysisConfig(false);
    setAnalyzing(true);
    toastService.info("Duplicate analysis started in background...");

    duplicateService.runAnalysis(organizationId)
      .then((result) => {
        toastService.success(
          `Analysis complete: ${result.flagged_pairs} potential duplicates found in ${result.clusters} clusters`
        );
        fetchData();
      })
      .catch((err) => {
        toastService.error("Analysis failed: " + err.message);
      })
      .finally(() => {
        setAnalyzing(false);
      });
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

  const handleDeleteAnalysis = async (analysisId) => {
    try {
      await duplicateService.deleteAnalysis(analysisId);
      toastService.success("Analysis deleted");
      if (selectedAnalysis?.id === analysisId) {
        setSelectedAnalysis(null);
        setPairs([]);
        setClusters([]);
      }
      await fetchData();
    } catch (err) {
      toastService.error("Delete failed: " + err.message);
    }
  };

  const handleDeleteAllAnalyses = async () => {
    try {
      await duplicateService.deleteAllAnalyses(organizationId);
      toastService.success("All analyses deleted");
      setSelectedAnalysis(null);
      setPairs([]);
      setClusters([]);
      await fetchData();
    } catch (err) {
      toastService.error("Delete failed: " + err.message);
    }
  };

  const toggleCluster = (clusterId) => {
    setExpandedClusters((prev) => ({ ...prev, [clusterId]: !prev[clusterId] }));
  };

  const getScoreClass = (score) => {
    if (score >= 0.85) return "high";
    if (score >= 0.6) return "medium";
    return "low";
  };

  const pairsByCluster = useMemo(() => {
    const map = {};
    for (const cluster of clusters) {
      const clusterSopIds = new Set(cluster.sop_ids);
      map[cluster.id] = pairs.filter(
        (p) => clusterSopIds.has(p.sop_a_id) && clusterSopIds.has(p.sop_b_id)
      );
    }
    const clusteredPairIds = new Set(Object.values(map).flat().map((p) => p.id));
    const unclustered = pairs.filter((p) => !clusteredPairIds.has(p.id) && p.llm_classification !== "distinct");
    if (unclustered.length > 0) map["unclustered"] = unclustered;
    return map;
  }, [pairs, clusters]);

  const readySops = sopDocs.filter((s) => s.status === "ready").length;

  // Count SOPs per category
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const doc of sopDocs) {
      if (doc.category_id) {
        counts[doc.category_id] = (counts[doc.category_id] || 0) + 1;
      }
    }
    return counts;
  }, [sopDocs]);

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
            <p className="stat-label">{readySops} ready for analysis</p>
          </div>
          <div className="stat-card">
            <h4>Analyses Run</h4>
            <p className="stat-value">{analyses.length}</p>
          </div>
          <div className="stat-card">
            <h4>Flagged Pairs</h4>
            <p className="stat-value">{selectedAnalysis?.flagged_pairs || 0}</p>
          </div>
          <div className="stat-card">
            <h4>Clusters Found</h4>
            <p className="stat-value">{selectedAnalysis?.cluster_count || 0}</p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="action-bar">
          <div className="action-bar-left">
            <button
              className="run-analysis-btn"
              onClick={handleOpenAnalysisConfig}
              disabled={analyzing || readySops < 2}
            >
              {analyzing ? (
                <><LoadingSpinner size="small" /> Analyzing...</>
              ) : (
                "Run Duplicate Analysis"
              )}
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
              <p>Comparing SOPs within selected category...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {selectedAnalysis && selectedAnalysis.status === "completed" && (
          <div className="results-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0 }}>
                Duplicate Analysis Results
                <span style={{ fontWeight: 400, fontSize: "13px", color: "#64748b", marginLeft: "0.75rem" }}>
                  {formatDate(selectedAnalysis.completed_at)} · {selectedAnalysis.total_sops} SOPs · {selectedAnalysis.flagged_pairs} flagged
                </span>
              </h3>
              <button className="delete-analysis-btn" onClick={() => handleDeleteAnalysis(selectedAnalysis.id)}>
                Delete This Analysis
              </button>
            </div>

            {/* Similarity Heatmap */}
            <SimilarityHeatmap pairs={pairs} sopDocs={sopDocs} />

            {clusters.length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <h3>No Duplicates Flagged</h3>
                <p>No SOP pairs exceeded the duplicate threshold. Review the heatmap above for detailed similarity scores.</p>
              </div>
            ) : (
              <div className="cluster-list" style={{ marginTop: "1.5rem" }}>
                {clusters.map((cluster) => {
                  const clusterPairs = pairsByCluster[cluster.id] || [];
                  const isExpanded = expandedClusters[cluster.id];
                  const maxScore = clusterPairs.length > 0
                    ? Math.max(...clusterPairs.map((p) => p.overall_score || 0)) : 0;

                  return (
                    <div key={cluster.id} className="cluster-card">
                      <div className="cluster-header" onClick={() => toggleCluster(cluster.id)}>
                        <div className="cluster-header-left">
                          <div className={`cluster-icon ${getScoreClass(maxScore)}`}>{cluster.sop_ids.length}</div>
                          <div>
                            <div className="cluster-title">{cluster.cluster_name || `Cluster of ${cluster.sop_ids.length} SOPs`}</div>
                            <div className="cluster-meta">{clusterPairs.length} comparison{clusterPairs.length !== 1 ? "s" : ""} · Max similarity: {Math.round(maxScore * 100)}%</div>
                          </div>
                        </div>
                        <div className="cluster-header-right">
                          {cluster.recommended_action && (
                            <span className={`action-badge ${cluster.recommended_action}`}>{cluster.recommended_action.replace("_", " ")}</span>
                          )}
                          <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>▾</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="cluster-body">
                          {clusterPairs.map((pair) => (
                            <PairCard key={pair.id} pair={pair} sopDocs={sopDocs} onDecision={handleDecision} getScoreClass={getScoreClass} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* No SOPs state */}
        {sopDocs.length === 0 && !analyzing && (
          <div className="empty-state">
            <h3>No SOPs Available</h3>
            <p>Go to the SOPs tab to upload SOPs first, then come back to run duplicate analysis.</p>
          </div>
        )}

        {/* Analysis History */}
        {analyses.length > 0 && (
          <div className="analysis-history">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Analysis History</h3>
              {analyses.length > 1 && (
                <button className="clear-all-btn" onClick={handleDeleteAllAnalyses}>Clear All</button>
              )}
            </div>
            {analyses.map((analysis) => (
              <div key={analysis.id} className={`history-item ${selectedAnalysis?.id === analysis.id ? "active" : ""}`}>
                <div
                  className="history-item-main"
                  onClick={() => loadAnalysisResults(analysis)}
                  style={{ flex: 1, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div className="history-meta">
                    <span className={`status-badge ${analysis.status}`}>{STATUS_LABELS[analysis.status] || analysis.status}</span>
                    <span className="history-date">{formatDate(analysis.created_at)}</span>
                  </div>
                  <div className="history-stats">
                    <span>{analysis.total_sops} SOPs</span>
                    <span>{analysis.flagged_pairs} flagged</span>
                    <span>{analysis.cluster_count} clusters</span>
                  </div>
                </div>
                <button className="history-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteAnalysis(analysis.id); }} title="Delete">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Analysis Config Dialog */}
      <Modal isOpen={showAnalysisConfig} onClose={() => setShowAnalysisConfig(false)} closeOnOutsideClick={true}>
        <div className="analysis-config">
          <h3>Configure Duplicate Analysis</h3>

          <div className="config-field">
            <label>Analysis Name</label>
            <input
              type="text"
              value={analysisName}
              onChange={(e) => setAnalysisName(e.target.value)}
              placeholder="e.g., Equipment SOPs - June 2026"
              className="config-input"
            />
          </div>

          <div className="config-field">
            <label>SOP Category / Area</label>
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="config-select"
            >
              <option value="">Select a category...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.category_name} ({categoryCounts[cat.id] || 0} SOPs)
                </option>
              ))}
            </select>
          </div>

          {selectedCategory && sopsInCategory.length > 0 && (
            <div className="config-field">
              <div className="sop-select-header">
                <label>Select SOPs ({selectedSopIds.length} of {sopsInCategory.length} selected)</label>
                <button className="select-all-btn" onClick={toggleSelectAll}>
                  {selectAllInCategory ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="sop-select-list">
                {sopsInCategory.map((sop) => (
                  <label key={sop.id} className="sop-select-item">
                    <input
                      type="checkbox"
                      checked={selectedSopIds.includes(sop.id)}
                      onChange={() => toggleSopSelection(sop.id)}
                    />
                    <span className="sop-select-title">{sop.title}</span>
                    {sop.sop_code && <span className="sop-select-code">{sop.sop_code}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedCategory && sopsInCategory.length < 2 && (
            <div className="config-warning">
              This category has fewer than 2 ready SOPs. Upload more SOPs in this category from the SOPs tab.
            </div>
          )}

          <div className="config-actions">
            <button className="back-btn" onClick={() => setShowAnalysisConfig(false)}>Cancel</button>
            <button
              className="run-analysis-btn"
              onClick={handleRunAnalysis}
              disabled={selectedSopIds.length < 2}
            >
              Run Analysis ({selectedSopIds.length} SOPs)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Pair Card sub-component
const PairCard = ({ pair, sopDocs, onDecision, getScoreClass }) => {
  const [showSections, setShowSections] = useState(false);
  const sopA = pair.sop_a || {};
  const sopB = pair.sop_b || {};
  const sections = pair.overlapping_sections || [];

  return (
    <div className="pair-card">
      <div className="pair-sops">
        <div className="pair-sop">
          <h5>{sopA.title || "SOP A"}</h5>
          <p>{[sopA.sop_code, sopA.department, sopA.site, sopA.version && `v${sopA.version}`].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="pair-vs">vs</span>
        <div className="pair-sop">
          <h5>{sopB.title || "SOP B"}</h5>
          <p>{[sopB.sop_code, sopB.department, sopB.site, sopB.version && `v${sopB.version}`].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <div className="pair-scores">
        <div className="score-item"><span className="score-label">Title:</span><span className={`score-value ${getScoreClass(pair.metadata_score)}`}>{Math.round(pair.metadata_score * 100)}%</span></div>
        <div className="score-item"><span className="score-label">Semantic:</span><span className={`score-value ${getScoreClass(pair.semantic_score)}`}>{Math.round(pair.semantic_score * 100)}%</span></div>
        <div className="score-item"><span className="score-label">Scope:</span><span className={`score-value ${getScoreClass(pair.scope_overlap_score)}`}>{Math.round(pair.scope_overlap_score * 100)}%</span></div>
        {pair.llm_classification && (
          <div className="score-item"><span className="score-label">AI:</span><span className={`action-badge ${pair.recommended_action}`}>{pair.llm_classification.replace("_", " ")}</span></div>
        )}
      </div>

      {pair.llm_reasoning && <div className="pair-reasoning">{pair.llm_reasoning}</div>}

      {sections.length > 0 && (
        <div className="section-comparison">
          <button className="section-toggle" onClick={() => setShowSections(!showSections)}>
            {showSections ? "▾" : "▸"} Section-wise Comparison ({sections.length} sections)
          </button>
          {showSections && (
            <table className="section-table">
              <thead><tr><th>SOP A Section</th><th>SOP B Section</th><th>Similarity</th><th>Status</th></tr></thead>
              <tbody>
                {sections.map((sec, i) => (
                  <tr key={i} className={`section-row section-${sec.status}`}>
                    <td>{sec.section_a ? (<><span className="section-type-badge">{sec.section_a.type}</span><span className="section-heading">{sec.section_a.heading}</span>{sec.section_a.content_preview && <span className="section-preview">{sec.section_a.content_preview}</span>}</>) : <span className="section-missing">— Not present —</span>}</td>
                    <td>{sec.section_b ? (<><span className="section-type-badge">{sec.section_b.type}</span><span className="section-heading">{sec.section_b.heading}</span>{sec.section_b.content_preview && <span className="section-preview">{sec.section_b.content_preview}</span>}</>) : <span className="section-missing">— Not present —</span>}</td>
                    <td><span className={`score-value ${getScoreClass(sec.similarity)}`}>{Math.round(sec.similarity * 100)}%</span></td>
                    <td><span className={`section-status-badge status-${sec.status}`}>{sec.status === "identical" ? "Identical" : sec.status === "similar" ? "Similar" : sec.status === "partial" ? "Partial" : sec.status === "only_in_b" ? "Only in B" : "Different"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="pair-actions">
        <span style={{ fontSize: "12px", color: "#64748b", marginRight: "0.5rem" }}>Decision:</span>
        {["retire", "merge", "distinct"].map((decision) => (
          <button key={decision} className={`decision-btn ${decision} ${pair.user_decision === decision ? "active" : ""}`} onClick={() => onDecision(pair.id, decision)}>
            {decision.charAt(0).toUpperCase() + decision.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DuplicateDetection;
