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
  pending: "Pending", running_layer1: "Analyzing Titles...", running_layer2: "Comparing Embeddings...",
  running_layer3: "AI Classification...", completed: "Completed", failed: "Failed",
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

  // Analysis config
  const [analysisName, setAnalysisName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSopIds, setSelectedSopIds] = useState([]);
  const [selectAllInCategory, setSelectAllInCategory] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setOrganizationId(user.user_metadata?.organization_id || user.id);
    };
    init();
  }, []);

  useEffect(() => { if (organizationId) fetchData(); }, [organizationId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docs, cats, hist] = await Promise.all([
        duplicateService.getSOPDocuments(organizationId),
        duplicateService.getCategories(),
        duplicateService.getAnalyses(organizationId),
      ]);
      setSopDocs(docs || []); setCategories(cats || []); setAnalyses(hist || []);
    } catch (err) { toastService.error("Failed to load: " + err.message); }
    finally { setLoading(false); }
  };

  const loadAnalysisResults = async (analysis) => {
    try {
      setSelectedAnalysis(analysis);
      const [p, c] = await Promise.all([duplicateService.getPairs(analysis.id), duplicateService.getClusters(analysis.id)]);
      setPairs(p || []); setClusters(c || []);
    } catch (err) { toastService.error("Failed to load results: " + err.message); }
  };

  const handleCloseResults = () => { setSelectedAnalysis(null); setPairs([]); setClusters([]); };

  const sopsInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return sopDocs.filter(d => d.category_id === selectedCategory && d.status === "ready");
  }, [sopDocs, selectedCategory]);

  const handleOpenConfig = () => { setAnalysisName(""); setSelectedCategory(""); setSelectedSopIds([]); setSelectAllInCategory(true); setShowAnalysisConfig(true); };

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setSelectAllInCategory(true);
    setSelectedSopIds(sopDocs.filter(d => d.category_id === catId && d.status === "ready").map(s => s.id));
  };

  const toggleSop = (id) => { setSelectAllInCategory(false); setSelectedSopIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const toggleAll = () => { if (selectAllInCategory) { setSelectedSopIds([]); setSelectAllInCategory(false); } else { setSelectedSopIds(sopsInCategory.map(s => s.id)); setSelectAllInCategory(true); } };

  const handleRunAnalysis = async () => {
    if (selectedSopIds.length < 2) { toastService.error("Select at least 2 SOPs"); return; }
    setShowAnalysisConfig(false); setAnalyzing(true);
    toastService.info("Duplicate analysis started...");
    duplicateService.runAnalysis(organizationId)
      .then((r) => { toastService.success(`Analysis complete: ${r.flagged_pairs} duplicates in ${r.clusters} clusters`); fetchData(); })
      .catch((e) => toastService.error("Analysis failed: " + e.message))
      .finally(() => setAnalyzing(false));
  };

  const handleDecision = async (pairId, decision) => {
    try { await duplicateService.updatePairDecision(pairId, decision); setPairs(prev => prev.map(p => p.id === pairId ? { ...p, user_decision: decision } : p)); toastService.success("Saved"); } catch { toastService.error("Failed"); }
  };

  const handleDeleteAnalysis = async (id) => {
    try { await duplicateService.deleteAnalysis(id); toastService.success("Deleted"); if (selectedAnalysis?.id === id) handleCloseResults(); await fetchData(); } catch (e) { toastService.error("Delete failed: " + e.message); }
  };

  const handleDeleteAll = async () => {
    try { await duplicateService.deleteAllAnalyses(organizationId); toastService.success("All deleted"); handleCloseResults(); await fetchData(); } catch (e) { toastService.error(e.message); }
  };

  const toggleCluster = (id) => setExpandedClusters(prev => ({ ...prev, [id]: !prev[id] }));
  const getScoreClass = (s) => s >= 0.85 ? "high" : s >= 0.6 ? "medium" : "low";

  const categoryCounts = useMemo(() => {
    const c = {}; sopDocs.forEach(d => { if (d.category_id) c[d.category_id] = (c[d.category_id] || 0) + 1; }); return c;
  }, [sopDocs]);

  const pairsByCluster = useMemo(() => {
    const map = {};
    clusters.forEach(cl => { const ids = new Set(cl.sop_ids); map[cl.id] = pairs.filter(p => ids.has(p.sop_a_id) && ids.has(p.sop_b_id)); });
    const used = new Set(Object.values(map).flat().map(p => p.id));
    const unc = pairs.filter(p => !used.has(p.id) && p.llm_classification !== "distinct");
    if (unc.length > 0) map["unclustered"] = unc;
    return map;
  }, [pairs, clusters]);

  const readySops = sopDocs.filter(s => s.status === "ready").length;
  const isViewOpen = !!selectedAnalysis;

  if (loading) {
    return (<div className="duplicate-detection"><Navigation /><div className="duplicate-content"><div className="loading-container"><LoadingSpinner size="large" /><span className="loading-text">Loading...</span></div></div></div>);
  }

  return (
    <div className="duplicate-detection">
      <Navigation />
      <div className={`duplicate-content ${isViewOpen ? "split-view" : ""}`}>
        {/* LEFT: Analysis List */}
        <div className={`analysis-list-panel ${isViewOpen ? "compact" : ""}`}>
          <div className="page-header">
            <h2>{isViewOpen ? "Analyses" : "Duplicate Detection"}</h2>
            {!isViewOpen && <span className="subtitle">Stage 1 — Identify and resolve duplicate SOPs</span>}
          </div>

          {!isViewOpen && (
            <div className="stats-overview">
              <div className="stat-card"><h4>Total SOPs</h4><p className="stat-value">{sopDocs.length}</p><p className="stat-label">{readySops} ready</p></div>
              <div className="stat-card"><h4>Analyses</h4><p className="stat-value">{analyses.length}</p></div>
              <div className="stat-card"><h4>Total Flagged</h4><p className="stat-value">{analyses.reduce((s, a) => s + (a.flagged_pairs || 0), 0)}</p></div>
            </div>
          )}

          <div className="action-bar">
            <button className="run-analysis-btn" onClick={handleOpenConfig} disabled={analyzing || readySops < 2}>
              {analyzing ? <><LoadingSpinner size="small" /> Analyzing...</> : "New Analysis"}
            </button>
            {analyses.length > 1 && <button className="clear-all-btn" onClick={handleDeleteAll}>Clear All</button>}
          </div>

          {analyzing && (
            <div className="analysis-progress-sm">
              <LoadingSpinner size="small" /><span>Running analysis...</span>
            </div>
          )}

          {/* Analysis list */}
          <div className="analysis-items">
            {analyses.length === 0 && !analyzing ? (
              <div className="empty-state-sm">
                {sopDocs.length === 0 ? "Upload SOPs first from the SOPs tab." : "No analyses yet. Click New Analysis to start."}
              </div>
            ) : (
              analyses.map((a) => (
                <div
                  key={a.id}
                  className={`analysis-card ${selectedAnalysis?.id === a.id ? "active" : ""}`}
                  onClick={() => loadAnalysisResults(a)}
                >
                  <div className="analysis-card-top">
                    <span className={`status-badge ${a.status}`}>{STATUS_LABELS[a.status] || a.status}</span>
                    <button className="card-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteAnalysis(a.id); }}>×</button>
                  </div>
                  <div className="analysis-card-title">{a.name || "Untitled Analysis"}</div>
                  {a.category?.category_name && (
                    <span className="analysis-card-category">{a.category.category_name}</span>
                  )}
                  <div className="analysis-card-meta">
                    <span>{a.total_sops || 0} SOPs</span>
                    <span>{a.flagged_pairs || 0} flagged</span>
                    <span>{a.cluster_count || 0} clusters</span>
                  </div>
                  <div className="analysis-card-date">{formatDate(a.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Analysis Results */}
        {isViewOpen && (
          <div className="analysis-results-panel">
            <div className="results-panel-header">
              <div>
                <h3>{selectedAnalysis.name || "Analysis Results"}</h3>
                <span className="results-meta">
                  {selectedAnalysis.category?.category_name && <>{selectedAnalysis.category.category_name} · </>}
                  {formatDate(selectedAnalysis.completed_at)} · {selectedAnalysis.total_sops} SOPs · {selectedAnalysis.flagged_pairs} flagged
                </span>
              </div>
              <div className="results-header-actions">
                <button className="delete-analysis-btn" onClick={() => handleDeleteAnalysis(selectedAnalysis.id)}>Delete</button>
                <button className="exit-view-btn" onClick={handleCloseResults}>Exit View</button>
              </div>
            </div>

            {selectedAnalysis.status === "completed" ? (
              <>
                <SimilarityHeatmap pairs={pairs} sopDocs={sopDocs} />

                {clusters.length === 0 ? (
                  <div className="empty-state-sm" style={{ marginTop: "1.5rem" }}>
                    No duplicates flagged. Review the heatmap for similarity scores.
                  </div>
                ) : (
                  <div className="cluster-list" style={{ marginTop: "1.5rem" }}>
                    {clusters.map((cluster) => {
                      const cp = pairsByCluster[cluster.id] || [];
                      const exp = expandedClusters[cluster.id];
                      const maxScore = cp.length > 0 ? Math.max(...cp.map(p => p.overall_score || 0)) : 0;
                      return (
                        <div key={cluster.id} className="cluster-card">
                          <div className="cluster-header" onClick={() => toggleCluster(cluster.id)}>
                            <div className="cluster-header-left">
                              <div className={`cluster-icon ${getScoreClass(maxScore)}`}>{cluster.sop_ids.length}</div>
                              <div>
                                <div className="cluster-title">{cluster.cluster_name || `Cluster`}</div>
                                <div className="cluster-meta">{cp.length} comparison{cp.length !== 1 ? "s" : ""} · Max: {Math.round(maxScore * 100)}%</div>
                              </div>
                            </div>
                            <div className="cluster-header-right">
                              {cluster.recommended_action && <span className={`action-badge ${cluster.recommended_action}`}>{cluster.recommended_action.replace("_", " ")}</span>}
                              <span className={`expand-icon ${exp ? "expanded" : ""}`}>▾</span>
                            </div>
                          </div>
                          {exp && <div className="cluster-body">{cp.map(pair => <PairCard key={pair.id} pair={pair} onDecision={handleDecision} getScoreClass={getScoreClass} />)}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state-sm" style={{ marginTop: "2rem" }}>
                Analysis is {selectedAnalysis.status}. Results will appear when complete.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Config Dialog */}
      <Modal isOpen={showAnalysisConfig} onClose={() => setShowAnalysisConfig(false)} closeOnOutsideClick={true}>
        <div className="analysis-config">
          <h3>Configure Duplicate Analysis</h3>
          <div className="config-field">
            <label>Analysis Name</label>
            <input type="text" value={analysisName} onChange={(e) => setAnalysisName(e.target.value)} placeholder="e.g., Equipment SOPs - June 2026" className="config-input" />
          </div>
          <div className="config-field">
            <label>SOP Category / Area</label>
            <select value={selectedCategory} onChange={(e) => handleCategoryChange(e.target.value)} className="config-select">
              <option value="">Select a category...</option>
              {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.category_name} ({categoryCounts[cat.id] || 0} SOPs)</option>))}
            </select>
          </div>
          {selectedCategory && sopsInCategory.length > 0 && (
            <div className="config-field">
              <div className="sop-select-header">
                <label>Select SOPs ({selectedSopIds.length} of {sopsInCategory.length})</label>
                <button className="select-all-btn" onClick={toggleAll}>{selectAllInCategory ? "Deselect All" : "Select All"}</button>
              </div>
              <div className="sop-select-list">
                {sopsInCategory.map(sop => (
                  <label key={sop.id} className="sop-select-item">
                    <input type="checkbox" checked={selectedSopIds.includes(sop.id)} onChange={() => toggleSop(sop.id)} />
                    <span className="sop-select-title">{sop.title}</span>
                    {sop.sop_code && <span className="sop-select-code">{sop.sop_code}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
          {selectedCategory && sopsInCategory.length < 2 && <div className="config-warning">Fewer than 2 ready SOPs in this category.</div>}
          <div className="config-actions">
            <button className="back-btn" onClick={() => setShowAnalysisConfig(false)}>Cancel</button>
            <button className="run-analysis-btn" onClick={handleRunAnalysis} disabled={selectedSopIds.length < 2}>Run Analysis ({selectedSopIds.length} SOPs)</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const PairCard = ({ pair, onDecision, getScoreClass }) => {
  const [showSections, setShowSections] = useState(false);
  const sopA = pair.sop_a || {}; const sopB = pair.sop_b || {};
  const sections = pair.overlapping_sections || [];

  return (
    <div className="pair-card">
      <div className="pair-sops">
        <div className="pair-sop"><h5>{sopA.title || "SOP A"}</h5><p>{[sopA.sop_code, sopA.department, sopA.site].filter(Boolean).join(" · ")}</p></div>
        <span className="pair-vs">vs</span>
        <div className="pair-sop"><h5>{sopB.title || "SOP B"}</h5><p>{[sopB.sop_code, sopB.department, sopB.site].filter(Boolean).join(" · ")}</p></div>
      </div>
      <div className="pair-scores">
        <div className="score-item"><span className="score-label">Title:</span><span className={`score-value ${getScoreClass(pair.metadata_score)}`}>{Math.round(pair.metadata_score * 100)}%</span></div>
        <div className="score-item"><span className="score-label">Semantic:</span><span className={`score-value ${getScoreClass(pair.semantic_score)}`}>{Math.round(pair.semantic_score * 100)}%</span></div>
        <div className="score-item"><span className="score-label">Scope:</span><span className={`score-value ${getScoreClass(pair.scope_overlap_score)}`}>{Math.round(pair.scope_overlap_score * 100)}%</span></div>
        {pair.llm_classification && <div className="score-item"><span className="score-label">AI:</span><span className={`action-badge ${pair.recommended_action}`}>{pair.llm_classification.replace("_", " ")}</span></div>}
      </div>
      {pair.llm_reasoning && <div className="pair-reasoning">{pair.llm_reasoning}</div>}
      {sections.length > 0 && (
        <div className="section-comparison">
          <button className="section-toggle" onClick={() => setShowSections(!showSections)}>{showSections ? "▾" : "▸"} Section Comparison ({sections.length})</button>
          {showSections && (
            <table className="section-table">
              <thead><tr><th>SOP A</th><th>SOP B</th><th>Score</th><th>Status</th></tr></thead>
              <tbody>{sections.map((sec, i) => (
                <tr key={i} className={`section-row section-${sec.status}`}>
                  <td>{sec.section_a ? <><span className="section-type-badge">{sec.section_a.type}</span> {sec.section_a.heading}</> : <span className="section-missing">—</span>}</td>
                  <td>{sec.section_b ? <><span className="section-type-badge">{sec.section_b.type}</span> {sec.section_b.heading}</> : <span className="section-missing">—</span>}</td>
                  <td><span className={`score-value ${getScoreClass(sec.similarity)}`}>{Math.round(sec.similarity * 100)}%</span></td>
                  <td><span className={`section-status-badge status-${sec.status}`}>{sec.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
      <div className="pair-actions">
        <span style={{ fontSize: "12px", color: "#64748b", marginRight: "0.5rem" }}>Decision:</span>
        {["retire", "merge", "distinct"].map(d => (
          <button key={d} className={`decision-btn ${d} ${pair.user_decision === d ? "active" : ""}`} onClick={() => onDecision(pair.id, d)}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
        ))}
      </div>
    </div>
  );
};

export default DuplicateDetection;
