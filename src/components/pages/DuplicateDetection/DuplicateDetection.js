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
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysisConfig, setShowAnalysisConfig] = useState(false);
  const [organizationId, setOrganizationId] = useState(null);
  const [activeTab, setActiveTab] = useState("analysis"); // analysis | results

  // Config state
  const [analysisName, setAnalysisName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedSopIds, setSelectedSopIds] = useState([]);
  const [selectAllInCategory, setSelectAllInCategory] = useState(true);

  // Results: SOP verdicts keyed by sop_id
  const [verdicts, setVerdicts] = useState({});

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
      setActiveTab("analysis");
      const p = await duplicateService.getPairs(analysis.id);
      setPairs(p || []);
      // Build initial verdicts from pair data
      buildVerdicts(p || [], sopDocs);
    } catch (err) { toastService.error("Failed to load results: " + err.message); }
  };

  const buildVerdicts = (pairsData, docs) => {
    const sopIds = new Set();
    pairsData.forEach(p => { sopIds.add(p.sop_a_id); sopIds.add(p.sop_b_id); });

    const v = {};
    sopIds.forEach(id => {
      // Find the highest semantic similarity for this SOP
      const maxSem = pairsData
        .filter(p => p.sop_a_id === id || p.sop_b_id === id)
        .reduce((max, p) => Math.max(max, p.semantic_score || 0), 0);

      // Only mark as duplicate if semantic similarity > 85% AND LLM agrees
      const hasHighSimDuplicate = pairsData.some(p =>
        (p.sop_a_id === id || p.sop_b_id === id) &&
        (p.semantic_score || 0) > 0.85 &&
        p.llm_classification === "full_duplicate"
      );

      v[id] = hasHighSimDuplicate ? "duplicate" : "continue";
    });
    setVerdicts(v);
  };

  const handleCloseResults = () => { setSelectedAnalysis(null); setPairs([]); setVerdicts({}); };

  // Unique sites from SOPs
  const uniqueSites = useMemo(() => {
    const sites = new Set();
    sopDocs.forEach(d => { if (d.site) sites.add(d.site); });
    return Array.from(sites).sort();
  }, [sopDocs]);

  // Sites available for selected category
  const sitesInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    const sites = new Set();
    sopDocs.filter(d => d.category_id === selectedCategory && d.status === "ready")
      .forEach(d => { if (d.site) sites.add(d.site); });
    return Array.from(sites).sort();
  }, [sopDocs, selectedCategory]);

  const sopsInCategory = useMemo(() => {
    if (!selectedCategory || !selectedSite) return [];
    return sopDocs.filter(d => d.category_id === selectedCategory && d.site === selectedSite && d.status === "ready");
  }, [sopDocs, selectedCategory, selectedSite]);

  const handleOpenConfig = () => { setAnalysisName(""); setSelectedCategory(""); setSelectedSite(""); setSelectedSopIds([]); setSelectAllInCategory(true); setShowAnalysisConfig(true); };

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setSelectedSite("");
    setSelectedSopIds([]);
    setSelectAllInCategory(true);
  };

  const handleSiteChange = (site) => {
    setSelectedSite(site);
    setSelectAllInCategory(true);
    const sops = sopDocs.filter(d => d.category_id === selectedCategory && d.site === site && d.status === "ready");
    setSelectedSopIds(sops.map(s => s.id));
  };

  const toggleSop = (id) => { setSelectAllInCategory(false); setSelectedSopIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const toggleAll = () => { if (selectAllInCategory) { setSelectedSopIds([]); setSelectAllInCategory(false); } else { setSelectedSopIds(sopsInCategory.map(s => s.id)); setSelectAllInCategory(true); } };

  const handleRunAnalysis = async () => {
    if (selectedSopIds.length < 2) { toastService.error("Select at least 2 SOPs"); return; }
    setShowAnalysisConfig(false); setAnalyzing(true);
    toastService.info("Duplicate analysis started...");
    duplicateService.runAnalysis(organizationId, { name: analysisName, categoryId: selectedCategory, sopIds: selectedSopIds })
      .then(() => { toastService.success("Analysis complete"); fetchData(); })
      .catch((e) => toastService.error("Analysis failed: " + e.message))
      .finally(() => setAnalyzing(false));
  };

  const handleDeleteAnalysis = async (id) => {
    try { await duplicateService.deleteAnalysis(id); toastService.success("Deleted"); if (selectedAnalysis?.id === id) handleCloseResults(); await fetchData(); } catch (e) { toastService.error(e.message); }
  };

  const handleDeleteAll = async () => {
    try { await duplicateService.deleteAllAnalyses(organizationId); toastService.success("All deleted"); handleCloseResults(); await fetchData(); } catch (e) { toastService.error(e.message); }
  };

  const toggleVerdict = (sopId) => {
    setVerdicts(prev => ({
      ...prev,
      [sopId]: prev[sopId] === "duplicate" ? "continue" : "duplicate",
    }));
  };

  const categoryCounts = useMemo(() => {
    const c = {}; sopDocs.forEach(d => { if (d.category_id) c[d.category_id] = (c[d.category_id] || 0) + 1; }); return c;
  }, [sopDocs]);

  // SOPs involved in selected analysis
  const analysisSops = useMemo(() => {
    const ids = new Set();
    pairs.forEach(p => { ids.add(p.sop_a_id); ids.add(p.sop_b_id); });
    return sopDocs.filter(d => ids.has(d.id));
  }, [pairs, sopDocs]);

  const readySops = sopDocs.filter(s => s.status === "ready").length;
  const isViewOpen = !!selectedAnalysis;
  const duplicateCount = Object.values(verdicts).filter(v => v === "duplicate").length;
  const continueCount = Object.values(verdicts).filter(v => v === "continue").length;

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

          {analyzing && <div className="analysis-progress-sm"><LoadingSpinner size="small" /><span>Running analysis...</span></div>}

          <div className="analysis-items">
            {analyses.length === 0 && !analyzing ? (
              <div className="empty-state-sm">{sopDocs.length === 0 ? "Upload SOPs first from the SOPs tab." : "No analyses yet. Click New Analysis."}</div>
            ) : (
              analyses.map((a) => (
                <div key={a.id} className={`analysis-card ${selectedAnalysis?.id === a.id ? "active" : ""}`} onClick={() => loadAnalysisResults(a)}>
                  <div className="analysis-card-top">
                    <span className={`status-badge ${a.status}`}>{STATUS_LABELS[a.status] || a.status}</span>
                    <button className="card-delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteAnalysis(a.id); }}>×</button>
                  </div>
                  <div className="analysis-card-title">{a.name || "Untitled Analysis"}</div>
                  {a.category?.category_name && <span className="analysis-card-category">{a.category.category_name}</span>}
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
                {/* Analysis: Heatmap */}
                <div className="results-section-block">
                  <h4 className="section-heading">Similarity Analysis</h4>
                  {analysisSops.length > 0 ? (
                    <SimilarityHeatmap pairs={pairs} sopDocs={sopDocs} />
                  ) : pairs.length > 0 ? (
                    <div className="empty-state-sm">
                      SOPs referenced by this analysis no longer exist. Delete and re-run.
                    </div>
                  ) : (
                    <div className="empty-state-sm">No comparison data available.</div>
                  )}
                </div>

                {/* Results: Verdict Table */}
                {analysisSops.length > 0 && (
                  <div className="results-section-block">
                    <h4 className="section-heading">
                      Results
                      <span className="section-heading-meta">
                        <span style={{ color: "#16a34a" }}>{continueCount} Continue</span>
                        <span style={{ color: "#dc2626" }}>{duplicateCount} Duplicate</span>
                      </span>
                    </h4>

                    <div className="verdict-table-container">
                      <table className="verdict-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>SOP Code</th>
                            <th>Category</th>
                            <th>Department</th>
                            <th>Site</th>
                            <th>Version</th>
                            <th>Verdict</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisSops.map((sop) => {
                            const verdict = verdicts[sop.id] || "continue";
                            const maxSim = pairs
                              .filter(p => p.sop_a_id === sop.id || p.sop_b_id === sop.id)
                              .reduce((max, p) => Math.max(max, p.semantic_score || 0, p.metadata_score || 0), 0);

                            return (
                              <tr key={sop.id} className={verdict === "duplicate" ? "row-duplicate" : ""}>
                                <td className="cell-title">{sop.title}</td>
                                <td>{sop.sop_code || "—"}</td>
                                <td>{sop.category?.category_name ? <span className="category-badge-sm">{sop.category.category_name}</span> : "—"}</td>
                                <td>{sop.department || "—"}</td>
                                <td>{sop.site || "Global"}</td>
                                <td>{sop.version || "—"}</td>
                                <td>
                                  <button className={`verdict-btn ${verdict}`} onClick={() => toggleVerdict(sop.id)}>
                                    {verdict === "continue" ? "Continue" : "Duplicate"}
                                  </button>
                                  {maxSim > 0.5 && <span className="sim-hint">{Math.round(maxSim * 100)}% max sim</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
          {selectedCategory && sitesInCategory.length > 0 && (
            <div className="config-field">
              <label>Site</label>
              <select value={selectedSite} onChange={(e) => handleSiteChange(e.target.value)} className="config-select">
                <option value="">Select a site...</option>
                {sitesInCategory.map(site => {
                  const count = sopDocs.filter(d => d.category_id === selectedCategory && d.site === site && d.status === "ready").length;
                  return <option key={site} value={site}>{site} ({count} SOPs)</option>;
                })}
              </select>
            </div>
          )}
          {selectedSite && sopsInCategory.length > 0 && (
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
          {selectedSite && sopsInCategory.length < 2 && <div className="config-warning">Fewer than 2 ready SOPs for this category and site combination.</div>}
          <div className="config-actions">
            <button className="back-btn" onClick={() => setShowAnalysisConfig(false)}>Cancel</button>
            <button className="run-analysis-btn" onClick={handleRunAnalysis} disabled={selectedSopIds.length < 2}>Run Analysis ({selectedSopIds.length} SOPs)</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DuplicateDetection;
