import React, { useState, useEffect, useMemo } from "react";
import Navigation from "../../common/Navigation/Navigation";
import Modal from "../../common/Modal/Modal";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import simplificationService from "../../../services/simplificationService";
import duplicateService from "../../../services/duplicateService";
import toastService from "../../../services/toastService";
import supabase from "../../../supabase";
import { formatDate } from "../../../utils/dateUtils";
import "./Simplification.css";

const LAYER_LABELS = {
  linguistic: { name: "Linguistic", desc: "Readability, passive voice, sentence complexity" },
  structural: { name: "Structural", desc: "Section organization, step hierarchy, content flow" },
  procedural: { name: "Procedural Clarity", desc: "Executable steps, acceptance criteria, verification" },
  role_action: { name: "Role-Action", desc: "Who does what at every step" },
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

const Simplification = () => {
  const [results, setResults] = useState([]);
  const [sopDocs, setSopDocs] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedSopId, setSelectedSopId] = useState("");
  const [organizationId, setOrganizationId] = useState(null);
  const [expandedLayers, setExpandedLayers] = useState({ linguistic: true, structural: true, procedural: true, role_action: true });

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
      const [res, docs] = await Promise.all([
        simplificationService.getResults(organizationId),
        duplicateService.getSOPDocuments(organizationId),
      ]);
      setResults(res || []);
      setSopDocs(docs || []);
    } catch (err) { toastService.error("Failed to load: " + err.message); }
    finally { setLoading(false); }
  };

  const handleRunSimplification = async () => {
    if (!selectedSopId) { toastService.error("Select an SOP"); return; }
    setShowRunModal(false);
    setAnalyzing(true);
    toastService.info("Simplification analysis started...");
    simplificationService.runSimplification(selectedSopId, organizationId)
      .then(() => { toastService.success("Simplification analysis complete"); fetchData(); })
      .catch((e) => toastService.error("Analysis failed: " + e.message))
      .finally(() => setAnalyzing(false));
  };

  const handleDelete = async (id) => {
    try {
      await simplificationService.deleteResult(id);
      toastService.success("Deleted");
      if (selectedResult?.id === id) setSelectedResult(null);
      await fetchData();
    } catch (e) { toastService.error(e.message); }
  };

  const toggleLayer = (layer) => setExpandedLayers(prev => ({ ...prev, [layer]: !prev[layer] }));

  const getScoreColor = (score) => {
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#d97706";
    if (score >= 40) return "#f97316";
    return "#dc2626";
  };

  // SOPs not yet analyzed
  const unanalyzedSops = useMemo(() => {
    const analyzedIds = new Set(results.map(r => r.sop_id));
    return sopDocs.filter(d => d.status === "ready" && !analyzedIds.has(d.id));
  }, [sopDocs, results]);

  const isViewOpen = !!selectedResult;

  if (loading) {
    return (<div className="simplification"><Navigation /><div className="simplification-content"><div className="loading-container"><LoadingSpinner size="large" /><span className="loading-text">Loading...</span></div></div></div>);
  }

  return (
    <div className="simplification">
      <Navigation />
      <div className={`simplification-content ${isViewOpen ? "split-view" : ""}`}>
        {/* LEFT: Results List */}
        <div className={`simp-list-panel ${isViewOpen ? "compact" : ""}`}>
          <div className="page-header">
            <h2>{isViewOpen ? "Analyses" : "Simplification"}</h2>
            {!isViewOpen && <span className="subtitle">Stage 2 — Improve readability and procedural clarity</span>}
          </div>

          <div className="action-bar">
            <button className="run-analysis-btn" onClick={() => { setSelectedSopId(""); setShowRunModal(true); }} disabled={analyzing}>
              {analyzing ? <><LoadingSpinner size="small" /> Analyzing...</> : "Analyze SOP"}
            </button>
          </div>

          {analyzing && <div className="analysis-progress-sm"><LoadingSpinner size="small" /><span>Running 4-layer analysis...</span></div>}

          <div className="simp-items">
            {results.length === 0 && !analyzing ? (
              <div className="empty-state-sm">No simplification analyses yet. Select an SOP to analyze.</div>
            ) : (
              results.map((r) => (
                <div key={r.id} className={`simp-card ${selectedResult?.id === r.id ? "active" : ""}`} onClick={() => setSelectedResult(r)}>
                  <div className="simp-card-top">
                    <span className={`status-badge ${r.status}`}>{r.status}</span>
                    <button className="card-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>×</button>
                  </div>
                  <div className="simp-card-title">{r.sop?.title || "Unknown SOP"}</div>
                  {r.sop?.category?.category_name && <span className="simp-card-category">{r.sop.category.category_name}</span>}
                  {r.status === "completed" && (
                    <div className="simp-card-scores">
                      <ScorePill label="L" score={r.linguistic_score} />
                      <ScorePill label="S" score={r.structural_score} />
                      <ScorePill label="P" score={r.procedural_score} />
                      <ScorePill label="R" score={r.role_action_score} />
                      <span className="simp-card-overall">{r.overall_score}/100</span>
                    </div>
                  )}
                  <div className="simp-card-date">{formatDate(r.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Result Detail */}
        {isViewOpen && selectedResult.status === "completed" && (
          <div className="simp-detail-panel">
            <div className="detail-header">
              <div>
                <h3>{selectedResult.sop?.title || "SOP Analysis"}</h3>
                <span className="detail-meta">
                  {selectedResult.sop?.sop_code && <>{selectedResult.sop.sop_code} · </>}
                  {selectedResult.sop?.category?.category_name && <>{selectedResult.sop.category.category_name} · </>}
                  {formatDate(selectedResult.completed_at)}
                </span>
              </div>
              <button className="exit-view-btn" onClick={() => setSelectedResult(null)}>Exit View</button>
            </div>

            {/* Overall Score */}
            <div className="overall-score-bar">
              <div className="overall-score-circle" style={{ borderColor: getScoreColor(selectedResult.overall_score) }}>
                <span className="overall-score-num">{selectedResult.overall_score}</span>
                <span className="overall-score-label">/100</span>
              </div>
              <div className="overall-score-info">
                <h4>Overall Simplification Score</h4>
                <p>{selectedResult.overall_summary}</p>
              </div>
            </div>

            {/* Layer Scores Summary */}
            <div className="layer-scores-grid">
              {Object.entries(LAYER_LABELS).map(([key, { name, desc }]) => {
                const score = selectedResult[`${key}_score`] || 0;
                const issues = selectedResult[`${key}_issues`] || [];
                const highCount = issues.filter(i => i.severity === "high").length;
                return (
                  <div key={key} className="layer-score-card" onClick={() => toggleLayer(key)}>
                    <div className="layer-score-top">
                      <span className="layer-score-num" style={{ color: getScoreColor(score) }}>{score}</span>
                      <span className="layer-score-max">/100</span>
                    </div>
                    <div className="layer-score-name">{name}</div>
                    <div className="layer-score-meta">
                      {issues.length} issues{highCount > 0 && <span className="high-count"> · {highCount} high</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Layer Details */}
            {Object.entries(LAYER_LABELS).map(([key, { name, desc }]) => {
              const issues = selectedResult[`${key}_issues`] || [];
              const isExpanded = expandedLayers[key];
              const sorted = [...issues].sort((a, b) => (SEVERITY_ORDER[a.severity] || 2) - (SEVERITY_ORDER[b.severity] || 2));

              return (
                <div key={key} className="layer-section">
                  <div className="layer-section-header" onClick={() => toggleLayer(key)}>
                    <div>
                      <h4>{name}</h4>
                      <span className="layer-desc">{desc}</span>
                    </div>
                    <div className="layer-section-right">
                      <span className="issue-count">{issues.length} issues</span>
                      <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>▾</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="layer-issues">
                      {sorted.length === 0 ? (
                        <div className="no-issues">No issues found in this layer.</div>
                      ) : (
                        sorted.map((issue, i) => (
                          <div key={i} className={`issue-card severity-${issue.severity}`}>
                            <div className="issue-top">
                              <span className={`severity-badge ${issue.severity}`}>{issue.severity}</span>
                              <span className="issue-type">{(issue.type || "").replace(/_/g, " ")}</span>
                            </div>
                            {(issue.original || issue.step) && (
                              <div className="issue-original">"{issue.original || issue.step}"</div>
                            )}
                            <div className="issue-desc">{issue.description || issue.reason}</div>
                            {issue.suggestion && <div className="issue-suggestion"><strong>Suggestion:</strong> {issue.suggestion}</div>}
                            {issue.audit_risk && <div className="issue-audit"><strong>Audit risk:</strong> {issue.audit_risk}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Role-Action Matrix */}
            {selectedResult.role_action_matrix && selectedResult.role_action_matrix.length > 0 && (
              <div className="layer-section">
                <div className="layer-section-header">
                  <div><h4>Role-Action Matrix</h4><span className="layer-desc">Who does what at each step</span></div>
                </div>
                <div className="ram-table-container">
                  <table className="ram-table">
                    <thead>
                      <tr><th>#</th><th>Actor</th><th>Action</th><th>Output</th><th>Approver</th></tr>
                    </thead>
                    <tbody>
                      {selectedResult.role_action_matrix.map((row, i) => (
                        <tr key={i}>
                          <td>{row.step_number || i + 1}</td>
                          <td><span className="actor-badge">{row.actor || "—"}</span></td>
                          <td>{row.action || "—"}</td>
                          <td>{row.output || "—"}</td>
                          <td>{row.approver || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Flowchart */}
            {selectedResult.flowchart_mermaid && (
              <div className="layer-section">
                <div className="layer-section-header">
                  <div><h4>Process Flowchart</h4><span className="layer-desc">Generated from role-action analysis</span></div>
                </div>
                <div className="flowchart-container">
                  <pre className="flowchart-code">{selectedResult.flowchart_mermaid}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Run Analysis Modal */}
      <Modal isOpen={showRunModal} onClose={() => setShowRunModal(false)} closeOnOutsideClick={true}>
        <div className="run-config">
          <h3>Run Simplification Analysis</h3>
          <p className="run-config-desc">Select an SOP to analyze across all 4 simplification layers: Linguistic, Structural, Procedural Clarity, and Role-Action Alignment.</p>
          <div className="config-field">
            <label>Select SOP</label>
            <select value={selectedSopId} onChange={(e) => setSelectedSopId(e.target.value)} className="config-select">
              <option value="">Choose an SOP...</option>
              {sopDocs.filter(d => d.status === "ready").map(sop => (
                <option key={sop.id} value={sop.id}>
                  {sop.title}{sop.sop_code ? ` (${sop.sop_code})` : ""}{sop.category?.category_name ? ` — ${sop.category.category_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="config-actions">
            <button className="back-btn" onClick={() => setShowRunModal(false)}>Cancel</button>
            <button className="run-analysis-btn" onClick={handleRunSimplification} disabled={!selectedSopId}>Analyze</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const ScorePill = ({ label, score }) => {
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : score >= 40 ? "#f97316" : "#dc2626";
  const bg = score >= 80 ? "#f0fdf4" : score >= 60 ? "#fffbeb" : score >= 40 ? "#fff7ed" : "#fef2f2";
  return (
    <span className="score-pill" style={{ background: bg, color }} title={`${label}: ${score}/100`}>
      {label}:{score}
    </span>
  );
};

export default Simplification;
