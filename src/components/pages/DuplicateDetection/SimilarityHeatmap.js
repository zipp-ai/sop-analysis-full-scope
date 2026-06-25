import React, { useMemo, useState } from "react";
import "./SimilarityHeatmap.css";

const SECTION_TYPES = [
  { key: "purpose", label: "Purpose" },
  { key: "scope", label: "Scope" },
  { key: "definitions", label: "Definitions" },
  { key: "responsibilities", label: "Responsibilities" },
  { key: "procedure", label: "Procedure" },
  { key: "references", label: "References" },
  { key: "other", label: "Other" },
];

function getHeatColor(score) {
  if (score === null || score === undefined) return "#f1f5f9";
  if (score >= 0.9) return "#dc2626";
  if (score >= 0.75) return "#f97316";
  if (score >= 0.6) return "#eab308";
  if (score >= 0.4) return "#a3e635";
  if (score >= 0.2) return "#4ade80";
  return "#22c55e";
}

function getTextColor(score) {
  if (score === null || score === undefined) return "#94a3b8";
  if (score >= 0.75) return "#fff";
  return "#1e293b";
}

const SimilarityHeatmap = ({ pairs, sopDocs }) => {
  const [selectedPair, setSelectedPair] = useState(null);
  const [viewMode, setViewMode] = useState("overview"); // overview | sections

  // Build SOP-to-SOP matrix
  const { sopList, matrix, sectionMatrix } = useMemo(() => {
    const sopMap = {};
    for (const doc of sopDocs) {
      sopMap[doc.id] = doc;
    }

    // Get unique SOPs from pairs
    const sopIds = new Set();
    for (const pair of pairs) {
      sopIds.add(pair.sop_a_id);
      sopIds.add(pair.sop_b_id);
    }

    const sopList = Array.from(sopIds)
      .map((id) => sopMap[id])
      .filter(Boolean)
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    // Build overall similarity matrix
    const matrix = {};
    const sectionMatrix = {};
    for (const pair of pairs) {
      const key = `${pair.sop_a_id}__${pair.sop_b_id}`;
      const keyRev = `${pair.sop_b_id}__${pair.sop_a_id}`;
      const score = Math.max(pair.semantic_score || 0, pair.metadata_score || 0);
      matrix[key] = score;
      matrix[keyRev] = score;

      // Build section-level data
      if (pair.overlapping_sections) {
        sectionMatrix[key] = pair.overlapping_sections;
        sectionMatrix[keyRev] = pair.overlapping_sections;
      }
    }

    return { sopList, matrix, sectionMatrix };
  }, [pairs, sopDocs]);

  // Build section-type similarity for a pair
  const getSectionScores = (pairSections) => {
    if (!pairSections) return {};
    const scores = {};
    for (const sec of pairSections) {
      const type = sec.section_a?.type || sec.section_b?.type || "other";
      if (!scores[type] || sec.similarity > scores[type]) {
        scores[type] = sec.similarity;
      }
    }
    return scores;
  };

  const truncateTitle = (title, max = 25) => {
    if (!title) return "—";
    return title.length > max ? title.slice(0, max) + "…" : title;
  };

  if (sopList.length === 0) return null;

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h3>Similarity Heatmap</h3>
        <div className="heatmap-controls">
          <button
            className={`heatmap-tab ${viewMode === "overview" ? "active" : ""}`}
            onClick={() => setViewMode("overview")}
          >
            SOP Overview
          </button>
          <button
            className={`heatmap-tab ${viewMode === "sections" ? "active" : ""}`}
            onClick={() => setViewMode("sections")}
          >
            Section Breakdown
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="legend-label">Low</span>
        <div className="legend-gradient">
          <div className="legend-stop" style={{ background: "#22c55e" }} />
          <div className="legend-stop" style={{ background: "#4ade80" }} />
          <div className="legend-stop" style={{ background: "#a3e635" }} />
          <div className="legend-stop" style={{ background: "#eab308" }} />
          <div className="legend-stop" style={{ background: "#f97316" }} />
          <div className="legend-stop" style={{ background: "#dc2626" }} />
        </div>
        <span className="legend-label">High</span>
      </div>

      {viewMode === "overview" ? (
        /* SOP-to-SOP Overview Heatmap */
        <div className="heatmap-scroll">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th className="heatmap-corner"></th>
                {sopList.map((sop) => (
                  <th key={sop.id} className="heatmap-col-header" title={sop.title}>
                    <div className="rotated-header">{truncateTitle(sop.title, 20)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sopList.map((rowSop) => (
                <tr key={rowSop.id}>
                  <td className="heatmap-row-header" title={rowSop.title}>
                    {truncateTitle(rowSop.title)}
                  </td>
                  {sopList.map((colSop) => {
                    if (rowSop.id === colSop.id) {
                      return (
                        <td key={colSop.id} className="heatmap-cell heatmap-diagonal">
                          —
                        </td>
                      );
                    }
                    const key = `${rowSop.id}__${colSop.id}`;
                    const score = matrix[key];
                    const hasData = score !== undefined;

                    return (
                      <td
                        key={colSop.id}
                        className={`heatmap-cell ${hasData ? "clickable" : ""}`}
                        style={{
                          background: hasData ? getHeatColor(score) : "#f8fafc",
                          color: hasData ? getTextColor(score) : "#cbd5e1",
                        }}
                        onClick={() => {
                          if (hasData) {
                            const pair = pairs.find(
                              (p) =>
                                (p.sop_a_id === rowSop.id && p.sop_b_id === colSop.id) ||
                                (p.sop_a_id === colSop.id && p.sop_b_id === rowSop.id)
                            );
                            setSelectedPair(pair);
                          }
                        }}
                        title={hasData ? `${rowSop.title} vs ${colSop.title}: ${Math.round(score * 100)}%` : "Not compared"}
                      >
                        {hasData ? `${Math.round(score * 100)}%` : "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Section Breakdown Heatmap */
        <div className="heatmap-scroll">
          <table className="heatmap-table section-heatmap">
            <thead>
              <tr>
                <th className="heatmap-corner">SOP Pair</th>
                <th className="section-col-header">Overall</th>
                {SECTION_TYPES.map((st) => (
                  <th key={st.key} className="section-col-header">{st.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs
                .filter((p) => p.llm_classification !== "distinct" || (p.semantic_score || 0) > 0.3)
                .sort((a, b) => (b.semantic_score || 0) - (a.semantic_score || 0))
                .map((pair) => {
                  const sopA = sopDocs.find((d) => d.id === pair.sop_a_id);
                  const sopB = sopDocs.find((d) => d.id === pair.sop_b_id);
                  const sectionScores = getSectionScores(pair.overlapping_sections);
                  const overallScore = Math.max(pair.semantic_score || 0, pair.metadata_score || 0);

                  return (
                    <tr
                      key={pair.id}
                      className={`section-row ${selectedPair?.id === pair.id ? "selected" : ""}`}
                      onClick={() => setSelectedPair(pair)}
                    >
                      <td className="pair-label">
                        <span className="pair-title-a">{truncateTitle(sopA?.title, 20)}</span>
                        <span className="pair-vs-label">vs</span>
                        <span className="pair-title-b">{truncateTitle(sopB?.title, 20)}</span>
                      </td>
                      <td
                        className="heatmap-cell"
                        style={{
                          background: getHeatColor(overallScore),
                          color: getTextColor(overallScore),
                          fontWeight: 600,
                        }}
                      >
                        {Math.round(overallScore * 100)}%
                      </td>
                      {SECTION_TYPES.map((st) => {
                        const score = sectionScores[st.key];
                        const hasScore = score !== undefined;
                        return (
                          <td
                            key={st.key}
                            className="heatmap-cell"
                            style={{
                              background: hasScore ? getHeatColor(score) : "#f8fafc",
                              color: hasScore ? getTextColor(score) : "#cbd5e1",
                            }}
                          >
                            {hasScore ? `${Math.round(score * 100)}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected pair detail */}
      {selectedPair && (
        <div className="heatmap-detail">
          <div className="heatmap-detail-header">
            <h4>
              {sopDocs.find((d) => d.id === selectedPair.sop_a_id)?.title || "SOP A"}
              <span className="detail-vs">vs</span>
              {sopDocs.find((d) => d.id === selectedPair.sop_b_id)?.title || "SOP B"}
            </h4>
            <button className="detail-close" onClick={() => setSelectedPair(null)}>×</button>
          </div>
          <div className="heatmap-detail-scores">
            <span>Title: <strong>{Math.round((selectedPair.metadata_score || 0) * 100)}%</strong></span>
            <span>Semantic: <strong>{Math.round((selectedPair.semantic_score || 0) * 100)}%</strong></span>
            <span>Scope: <strong>{Math.round((selectedPair.scope_overlap_score || 0) * 100)}%</strong></span>
            {selectedPair.llm_classification && (
              <span>AI: <strong>{selectedPair.llm_classification.replace("_", " ")}</strong></span>
            )}
          </div>
          {selectedPair.llm_reasoning && (
            <div className="heatmap-detail-reasoning">{selectedPair.llm_reasoning}</div>
          )}
          {selectedPair.overlapping_sections?.length > 0 && (
            <table className="heatmap-section-detail">
              <thead>
                <tr>
                  <th>SOP A Section</th>
                  <th>SOP B Section</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedPair.overlapping_sections.map((sec, i) => (
                  <tr key={i}>
                    <td>
                      {sec.section_a ? (
                        <><span className="sec-type">{sec.section_a.type}</span> {sec.section_a.heading}</>
                      ) : <span className="sec-missing">—</span>}
                    </td>
                    <td>
                      {sec.section_b ? (
                        <><span className="sec-type">{sec.section_b.type}</span> {sec.section_b.heading}</>
                      ) : <span className="sec-missing">—</span>}
                    </td>
                    <td>
                      <span
                        className="sec-score"
                        style={{ background: getHeatColor(sec.similarity), color: getTextColor(sec.similarity) }}
                      >
                        {Math.round(sec.similarity * 100)}%
                      </span>
                    </td>
                    <td><span className={`sec-status sec-${sec.status}`}>{sec.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default SimilarityHeatmap;
