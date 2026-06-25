import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { UMAP } from "umap-js";
import Navigation from "../../common/Navigation/Navigation";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import edgeFunctionService from "../../../services/edgeFunctionService";
import toastService from "../../../services/toastService";
import supabase from "../../../supabase";
import "./SOPLandscape.css";

const CATEGORY_COLORS = [
  "#6c63ff", "#ef4444", "#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#64748b", "#84cc16", "#06b6d4",
  "#e11d48", "#a855f7",
];

const SOPLandscape = () => {
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [discoveredEdges, setDiscoveredEdges] = useState([]);
  const [declaredEdges, setDeclaredEdges] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selection, setSelection] = useState([]);

  // Filters
  const [filterArea, setFilterArea] = useState("all");
  const [filterSite, setFilterSite] = useState("all");
  const [filterDocType, setFilterDocType] = useState("all");
  const [showDeclared, setShowDeclared] = useState(true);
  const [showDiscovered, setShowDiscovered] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const svgRef = useRef(null);
  const containerRef = useRef(null);

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
      const data = await edgeFunctionService.getLandscapeData(organizationId);
      setDiscoveredEdges(data.discovered_edges || []);
      setDeclaredEdges(data.declared_edges || []);

      // Run UMAP on embeddings
      const rawNodes = data.nodes || [];
      const nodesWithEmbeddings = rawNodes.filter(n => n.embedding && n.embedding.length > 0);

      if (nodesWithEmbeddings.length >= 2) {
        setComputing(true);
        const embeddings = nodesWithEmbeddings.map(n => n.embedding);

        // Run UMAP in a timeout to not block UI
        setTimeout(() => {
          try {
            const umap = new UMAP({
              nNeighbors: Math.min(15, Math.max(2, nodesWithEmbeddings.length - 1)),
              minDist: 0.1,
              nComponents: 2,
            });
            const coords = umap.fit(embeddings);

            const processed = nodesWithEmbeddings.map((n, i) => ({
              ...n,
              x: coords[i][0],
              y: coords[i][1],
              embedding: undefined,
            }));

            // Add nodes without embeddings at random positions
            const noEmbedding = rawNodes.filter(n => !n.embedding || n.embedding.length === 0);
            const xExtent = d3.extent(processed, d => d.x);
            const yExtent = d3.extent(processed, d => d.y);
            noEmbedding.forEach(n => {
              processed.push({
                ...n,
                x: xExtent[0] + Math.random() * (xExtent[1] - xExtent[0]),
                y: yExtent[0] + Math.random() * (yExtent[1] - yExtent[0]),
                embedding: undefined,
                noEmbedding: true,
              });
            });

            setNodes(processed);
          } catch (e) {
            console.error("UMAP failed:", e);
            // Fallback: random positions
            const fallback = rawNodes.map(n => ({
              ...n, x: Math.random() * 10, y: Math.random() * 10, embedding: undefined,
            }));
            setNodes(fallback);
          }
          setComputing(false);
        }, 100);
      } else {
        const fallback = rawNodes.map(n => ({
          ...n, x: Math.random() * 10, y: Math.random() * 10, embedding: undefined,
        }));
        setNodes(fallback);
      }
    } catch (err) {
      toastService.error("Failed to load landscape: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Unique values for filters
  const areas = useMemo(() => [...new Set(nodes.map(n => n.functional_area))].sort(), [nodes]);
  const sites = useMemo(() => [...new Set(nodes.map(n => n.site_name))].sort(), [nodes]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter(n => {
      if (filterArea !== "all" && n.functional_area !== filterArea) return false;
      if (filterSite !== "all" && n.site_name !== filterSite) return false;
      if (filterDocType !== "all" && n.document_type !== filterDocType) return false;
      return true;
    });
  }, [nodes, filterArea, filterSite, filterDocType]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.sop_id)), [filteredNodes]);

  // Color scale
  const colorScale = useMemo(() => {
    const scale = {};
    areas.forEach((area, i) => { scale[area] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]; });
    return scale;
  }, [areas]);

  // D3 rendering
  useEffect(() => {
    if (filteredNodes.length === 0 || !svgRef.current) return;

    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = 560;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // Scales
    const xExtent = d3.extent(filteredNodes, d => d.x);
    const yExtent = d3.extent(filteredNodes, d => d.y);
    const padding = 60;
    const xScale = d3.scaleLinear().domain(xExtent).range([padding, width - padding]);
    const yScale = d3.scaleLinear().domain(yExtent).range([padding, height - padding]);
    const sizeScale = d3.scaleSqrt().domain([1, 5]).range([6, 16]).clamp(true);

    const g = svg.append("g");

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.3, 8])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // Edges
    const edgeGroup = g.append("g").attr("class", "edges");

    if (showDiscovered) {
      discoveredEdges
        .filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
        .forEach(edge => {
          const s = filteredNodes.find(n => n.sop_id === edge.source);
          const t = filteredNodes.find(n => n.sop_id === edge.target);
          if (s && t) {
            edgeGroup.append("line")
              .attr("x1", xScale(s.x)).attr("y1", yScale(s.y))
              .attr("x2", xScale(t.x)).attr("y2", yScale(t.y))
              .attr("stroke", "#94a3b8")
              .attr("stroke-width", Math.max(0.5, (edge.similarity_score || 0) * 2))
              .attr("stroke-dasharray", "4,3")
              .attr("opacity", 0.4);
          }
        });
    }

    if (showDeclared) {
      declaredEdges
        .filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
        .forEach(edge => {
          const s = filteredNodes.find(n => n.sop_id === edge.source);
          const t = filteredNodes.find(n => n.sop_id === edge.target);
          if (s && t) {
            edgeGroup.append("line")
              .attr("x1", xScale(s.x)).attr("y1", yScale(s.y))
              .attr("x2", xScale(t.x)).attr("y2", yScale(t.y))
              .attr("stroke", "#6c63ff")
              .attr("stroke-width", 1.5)
              .attr("opacity", 0.6);
          }
        });
    }

    // Nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const nodeElements = nodeGroup.selectAll(".node")
      .data(filteredNodes, d => d.sop_id)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${xScale(d.x)},${yScale(d.y)})`)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(prev => prev?.sop_id === d.sop_id ? null : d);
      });

    // Shape based on document type
    nodeElements.each(function(d) {
      const el = d3.select(this);
      const size = sizeScale(d.version_count || 1);
      const fill = colorScale[d.functional_area] || "#64748b";
      const borderColor = d.site_name === "Global" ? "#1e293b" : "#f59e0b";

      if (d.document_type === "site") {
        // Square for site SOPs
        el.append("rect")
          .attr("x", -size).attr("y", -size)
          .attr("width", size * 2).attr("height", size * 2)
          .attr("rx", 2)
          .attr("fill", fill)
          .attr("stroke", borderColor)
          .attr("stroke-width", 2);
      } else {
        // Circle for global SOPs
        el.append("circle")
          .attr("r", size)
          .attr("fill", fill)
          .attr("stroke", borderColor)
          .attr("stroke-width", 2);
      }
    });

    // Tooltip on hover
    nodeElements.append("title")
      .text(d => `${d.title}\n${d.functional_area} · ${d.site_name}${d.sop_code ? ` · ${d.sop_code}` : ""}`);

    // Text labels
    if (showLabels) {
      nodeElements.append("text")
        .attr("class", "node-label")
        .attr("x", d => sizeScale(d.version_count || 1) + 4)
        .attr("y", 4)
        .text(d => d.title.length > 30 ? d.title.slice(0, 28) + "…" : d.title)
        .attr("font-size", "10px")
        .attr("fill", "#334155")
        .attr("pointer-events", "none");
    }

    // Selection brush
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on("end", (event) => {
        if (!event.selection) { setSelection([]); return; }
        const [[x0, y0], [x1, y1]] = event.selection;
        const transform = d3.zoomTransform(svg.node());
        const selected = filteredNodes.filter(d => {
          const px = transform.applyX(xScale(d.x));
          const py = transform.applyY(yScale(d.y));
          return px >= x0 && px <= x1 && py >= y0 && py <= y1;
        });
        setSelection(selected);
        svg.select(".brush").call(brush.move, null);
      });

    svg.append("g").attr("class", "brush").call(brush);

    // Click on background to deselect
    svg.on("click", () => { setSelectedNode(null); });

  }, [filteredNodes, discoveredEdges, declaredEdges, showDeclared, showDiscovered, showLabels, colorScale, filteredNodeIds]);

  if (loading || computing) {
    return (
      <div className="landscape">
        <Navigation />
        <div className="landscape-content">
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <span className="loading-text">{computing ? "Computing UMAP layout..." : "Loading SOP data..."}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landscape">
      <Navigation />
      <div className="landscape-content">
        <div className="page-header">
          <h2>SOP Landscape</h2>
          <span className="subtitle">{nodes.length} SOPs · Semantic similarity map</span>
        </div>

        {/* Controls */}
        <div className="landscape-controls">
          <div className="controls-left">
            <select className="landscape-filter" value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
              <option value="all">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="landscape-filter" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
              <option value="all">All Sites</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="landscape-filter" value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)}>
              <option value="all">All Types</option>
              <option value="global">Global SOPs</option>
              <option value="site">Site SOPs</option>
            </select>
          </div>
          <div className="controls-right">
            <label className="edge-toggle">
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              SOP Names
            </label>
            <label className="edge-toggle">
              <input type="checkbox" checked={showDeclared} onChange={(e) => setShowDeclared(e.target.checked)} />
              <span className="edge-line-solid" /> Declared
            </label>
            <label className="edge-toggle">
              <input type="checkbox" checked={showDiscovered} onChange={(e) => setShowDiscovered(e.target.checked)} />
              <span className="edge-line-dashed" /> Discovered
            </label>
          </div>
        </div>

        {/* Legend */}
        <div className="landscape-legend">
          <div className="legend-colors">
            {areas.map(area => (
              <span key={area} className="legend-item" onClick={() => setFilterArea(filterArea === area ? "all" : area)}>
                <span className="legend-dot" style={{ background: colorScale[area] }} />
                {area}
              </span>
            ))}
          </div>
          <div className="legend-shapes">
            <span className="legend-shape-item"><span className="shape-circle" /> Global</span>
            <span className="legend-shape-item"><span className="shape-square" /> Site</span>
            <span className="legend-info">Size = version count · Drag to select region</span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="landscape-chart" ref={containerRef}>
          {filteredNodes.length === 0 ? (
            <div className="empty-state-sm">No SOPs match the current filters.</div>
          ) : (
            <svg ref={svgRef} />
          )}
        </div>

        {/* Selection Panel */}
        {selection.length > 0 && (
          <div className="selection-panel">
            <div className="selection-header">
              <h4>{selection.length} SOPs Selected</h4>
              <button className="clear-selection" onClick={() => setSelection([])}>Clear</button>
            </div>
            <div className="selection-list">
              {selection.map(n => (
                <div key={n.sop_id} className="selection-item">
                  <span className="selection-dot" style={{ background: colorScale[n.functional_area] }} />
                  <span className="selection-title">{n.title}</span>
                  <span className="selection-meta">{n.functional_area}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Detail */}
        {selectedNode && (
          <div className="node-detail">
            <div className="node-detail-header">
              <h4>{selectedNode.title}</h4>
              <button className="close-detail" onClick={() => setSelectedNode(null)}>×</button>
            </div>
            <div className="node-detail-body">
              <div className="detail-row"><span className="detail-label">SOP Code</span><span>{selectedNode.sop_code || "—"}</span></div>
              <div className="detail-row"><span className="detail-label">Area</span><span className="legend-dot-inline" style={{ background: colorScale[selectedNode.functional_area] }} /><span>{selectedNode.functional_area}</span></div>
              <div className="detail-row"><span className="detail-label">Site</span><span>{selectedNode.site_name}</span></div>
              <div className="detail-row"><span className="detail-label">Type</span><span>{selectedNode.document_type === "site" ? "Site SOP" : "Global SOP"}</span></div>
              <div className="detail-row"><span className="detail-label">Department</span><span>{selectedNode.department || "—"}</span></div>
              <div className="detail-row"><span className="detail-label">Versions</span><span>{selectedNode.version_count}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SOPLandscape;
