import React, { useState, useEffect, useRef } from "react";
import Navigation from "../../common/Navigation/Navigation";
import Modal from "../../common/Modal/Modal";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import ConfirmationModal from "../../common/ConfirmationModal/ConfirmationModal";
import BulkUpload from "./BulkUploadPanel";
import duplicateService from "../../../services/duplicateService";
import toastService from "../../../services/toastService";
import supabase from "../../../supabase";
import "./SOPManager.css";

const SOPManager = () => {
  const [sopDocs, setSopDocs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sopToDelete, setSopToDelete] = useState(null);
  const [viewingSop, setViewingSop] = useState(null);
  const [viewForm, setViewForm] = useState({});
  const [viewSaving, setViewSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const pollRef = useRef(null);

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

  useEffect(() => {
    if (organizationId) {
      fetchData();
      startPolling();
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [organizationId]);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchData(true), 5000);
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [docs, cats] = await Promise.all([
        duplicateService.getSOPDocuments(organizationId),
        duplicateService.getCategories(),
      ]);
      setSopDocs(docs || []);
      setCategories(cats || []);
      // Update viewing SOP if it changed
      if (viewingSop) {
        const updated = (docs || []).find(d => d.id === viewingSop.id);
        if (updated) setViewingSop(updated);
      }
    } catch (err) {
      if (!silent) toastService.error("Failed to load SOPs: " + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleViewSOP = (doc) => {
    setViewingSop(doc);
    setViewForm({
      title: doc.title || "",
      sop_code: doc.sop_code || "",
      version: doc.version || "",
      department: doc.department || "",
      site: doc.site || "Global",
      category_id: doc.category_id || "",
    });
  };

  const handleCloseView = () => {
    setViewingSop(null);
    setViewForm({});
  };

  const handleViewSave = async () => {
    if (!viewingSop) return;
    try {
      setViewSaving(true);
      await duplicateService.updateSOPDocument(viewingSop.id, viewForm);
      toastService.success("SOP updated");
      await fetchData();
    } catch (err) {
      toastService.error("Update failed: " + err.message);
    } finally {
      setViewSaving(false);
    }
  };

  const handleDeleteSOP = async () => {
    if (!sopToDelete) return;
    try {
      await duplicateService.deleteSOPDocument(sopToDelete.id);
      toastService.success("SOP deleted");
      if (viewingSop?.id === sopToDelete.id) handleCloseView();
      setSopToDelete(null);
      setShowDeleteConfirm(false);
      await fetchData();
    } catch (err) {
      toastService.error("Delete failed: " + err.message);
    }
  };

  const filteredDocs = React.useMemo(() => {
    let docs = sopDocs;
    if (filterCategory !== "all") docs = docs.filter(d => d.category_id === filterCategory);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(d => (d.title || "").toLowerCase().includes(term));
    }
    return docs;
  }, [sopDocs, filterCategory, searchTerm]);

  const processingCount = sopDocs.filter(d => d.status === "processing" || d.status === "pending").length;
  const readyCount = sopDocs.filter(d => d.status === "ready").length;
  const isViewOpen = !!viewingSop;

  if (loading) {
    return (
      <div className="sop-manager"><Navigation />
        <div className="sop-manager-content">
          <div className="loading-container"><LoadingSpinner size="large" /><span className="loading-text">Loading SOPs...</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="sop-manager">
      <Navigation />
      <div className={`sop-manager-content ${isViewOpen ? "split-view" : ""}`}>
        {/* LEFT: SOP List */}
        <div className={`sop-list-panel ${isViewOpen ? "compact" : ""}`}>
          <div className="page-header">
            <h2>SOP Library</h2>
            <span className="subtitle">{sopDocs.length} SOPs</span>
          </div>

          {processingCount > 0 && (
            <div className="processing-banner">
              <LoadingSpinner size="small" />
              <span>{processingCount} SOP(s) processing...</span>
            </div>
          )}

          {!isViewOpen && (
            <div className="sop-stats">
              <div className="sop-stat"><span className="sop-stat-value">{sopDocs.length}</span><span className="sop-stat-label">Total</span></div>
              <div className="sop-stat"><span className="sop-stat-value" style={{ color: "#22c55e" }}>{readyCount}</span><span className="sop-stat-label">Ready</span></div>
              <div className="sop-stat"><span className="sop-stat-value" style={{ color: "#f59e0b" }}>{processingCount}</span><span className="sop-stat-label">Processing</span></div>
              <div className="sop-stat"><span className="sop-stat-value">{new Set(sopDocs.map(d => d.category_id).filter(Boolean)).size}</span><span className="sop-stat-label">Categories</span></div>
            </div>
          )}

          <div className="sop-controls">
            <div className="sop-controls-left">
              <input type="text" className="sop-search" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              {!isViewOpen && (
                <select className="sop-filter" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.category_name}</option>))}
                </select>
              )}
            </div>
            <button className="upload-btn" onClick={() => setShowUploadModal(true)}>Bulk Upload</button>
          </div>

          <div className="sop-table-container">
            <table className="sop-table">
              <thead>
                <tr>
                  <th>Title</th>
                  {!isViewOpen && <th>SOP Code</th>}
                  {!isViewOpen && <th>Category</th>}
                  {!isViewOpen && <th>Department</th>}
                  {!isViewOpen && <th>Site</th>}
                  {!isViewOpen && <th>Version</th>}
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={isViewOpen ? 3 : 8} className="empty-row">{sopDocs.length === 0 ? "No SOPs uploaded yet." : "No SOPs match filters."}</td></tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className={viewingSop?.id === doc.id ? "row-active" : ""}>
                      <td className="cell-title">{doc.title}</td>
                      {!isViewOpen && <td>{doc.sop_code || "—"}</td>}
                      {!isViewOpen && <td>{doc.category?.category_name ? <span className="category-badge">{doc.category.category_name}</span> : "—"}</td>}
                      {!isViewOpen && <td>{doc.department || "—"}</td>}
                      {!isViewOpen && <td>{doc.site || "Global"}</td>}
                      {!isViewOpen && <td>{doc.version || "—"}</td>}
                      <td><span className={`status-pill status-${doc.status}`}>{doc.status}</span></td>
                      <td className="action-cell">
                        <button className="view-btn-sm" onClick={() => handleViewSOP(doc)} title="View document">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <button className="edit-btn-sm" onClick={() => { handleViewSOP(doc); }} title="Edit metadata">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                          </svg>
                        </button>
                        <button className="delete-btn-sm" onClick={() => { setSopToDelete(doc); setShowDeleteConfirm(true); }} title="Delete SOP">×</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Document View Panel */}
        {isViewOpen && (
          <div className="sop-view-panel">
            <div className="view-panel-header">
              <h3>{viewingSop.title}</h3>
              <button className="exit-view-btn" onClick={handleCloseView}>Exit View</button>
            </div>

            {/* Editable metadata */}
            <div className="view-metadata">
              <div className="view-meta-row">
                <div className="view-meta-field">
                  <label>Title</label>
                  <input type="text" value={viewForm.title || ""} onChange={(e) => setViewForm({ ...viewForm, title: e.target.value })} />
                </div>
              </div>
              <div className="view-meta-row">
                <div className="view-meta-field">
                  <label>SOP Code</label>
                  <input type="text" value={viewForm.sop_code || ""} onChange={(e) => setViewForm({ ...viewForm, sop_code: e.target.value })} placeholder="—" />
                </div>
                <div className="view-meta-field">
                  <label>Version</label>
                  <input type="text" value={viewForm.version || ""} onChange={(e) => setViewForm({ ...viewForm, version: e.target.value })} placeholder="—" />
                </div>
              </div>
              <div className="view-meta-row">
                <div className="view-meta-field">
                  <label>Category</label>
                  <select value={viewForm.category_id || ""} onChange={(e) => setViewForm({ ...viewForm, category_id: e.target.value || null })}>
                    <option value="">Select</option>
                    {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.category_name}</option>))}
                  </select>
                </div>
                <div className="view-meta-field">
                  <label>Department</label>
                  <input type="text" value={viewForm.department || ""} onChange={(e) => setViewForm({ ...viewForm, department: e.target.value })} />
                </div>
              </div>
              <div className="view-meta-row">
                <div className="view-meta-field">
                  <label>Site</label>
                  <input type="text" value={viewForm.site || ""} onChange={(e) => setViewForm({ ...viewForm, site: e.target.value })} placeholder="Global" />
                </div>
                <div className="view-meta-field view-meta-actions">
                  <button className="save-btn" onClick={handleViewSave} disabled={viewSaving}>
                    {viewSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>

            {/* Document content */}
            <div className="view-document">
              <h4>Document Content</h4>
              <div className="document-text">
                {viewingSop.raw_text ? (
                  viewingSop.raw_text.split("\n").map((line, i) => (
                    <p key={i} className={line.trim() === "" ? "empty-line" : ""}>{line || " "}</p>
                  ))
                ) : (
                  <p className="no-content">No text content available. SOP may still be processing.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} closeOnOutsideClick={true}>
        <BulkUpload organizationId={organizationId} userId={userId} categories={categories}
          onComplete={() => { setShowUploadModal(false); fetchData(); }} onBackgroundStart={() => {}} />
      </Modal>

      <ConfirmationModal isOpen={showDeleteConfirm} onClose={() => { setShowDeleteConfirm(false); setSopToDelete(null); }}
        onConfirm={handleDeleteSOP} title="Delete SOP" message={`Are you sure you want to delete "${sopToDelete?.title}"?`}
        confirmText="Delete" cancelText="Cancel" />
    </div>
  );
};

export default SOPManager;
