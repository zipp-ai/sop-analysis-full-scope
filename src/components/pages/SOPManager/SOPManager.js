import React, { useState, useEffect, useRef, useCallback } from "react";
import Navigation from "../../common/Navigation/Navigation";
import Modal from "../../common/Modal/Modal";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import ConfirmationModal from "../../common/ConfirmationModal/ConfirmationModal";
import BulkUpload from "./BulkUploadPanel";
import duplicateService from "../../../services/duplicateService";
import toastService from "../../../services/toastService";
import supabase from "../../../supabase";
import { formatDate } from "../../../utils/dateUtils";
import "./SOPManager.css";

const SOPManager = () => {
  const [sopDocs, setSopDocs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sopToDelete, setSopToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSop, setEditingSop] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [backgroundJobs, setBackgroundJobs] = useState([]);
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
    pollRef.current = setInterval(() => {
      fetchData(true);
    }, 5000);
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

      // Check if any are still processing
      const processing = (docs || []).filter(d => d.status === "processing" || d.status === "pending");
      if (processing.length === 0 && pollRef.current) {
        // Stop polling if nothing is processing
      }
    } catch (err) {
      if (!silent) toastService.error("Failed to load SOPs: " + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleBulkUploadStart = (jobs) => {
    setBackgroundJobs(jobs);
    setShowUploadModal(false);
    toastService.info(`Uploading ${jobs.length} SOPs in background...`);
  };

  const handleEditSOP = (doc) => {
    setEditingSop(doc);
    setEditForm({
      title: doc.title || "",
      sop_code: doc.sop_code || "",
      version: doc.version || "",
      department: doc.department || "",
      site: doc.site || "Global",
      category_id: doc.category_id || "",
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSop) return;
    try {
      setSaving(true);
      await duplicateService.updateSOPDocument(editingSop.id, editForm);
      toastService.success("SOP updated");
      setShowEditModal(false);
      setEditingSop(null);
      await fetchData();
    } catch (err) {
      toastService.error("Update failed: " + err.message);
    } finally {
      setSaving(false);
    }
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

  const filteredDocs = React.useMemo(() => {
    let docs = sopDocs;
    if (filterCategory !== "all") {
      docs = docs.filter(d => d.category_id === filterCategory);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      docs = docs.filter(d => (d.title || "").toLowerCase().includes(term));
    }
    return docs;
  }, [sopDocs, filterCategory, searchTerm]);

  const processingCount = sopDocs.filter(d => d.status === "processing" || d.status === "pending").length;
  const readyCount = sopDocs.filter(d => d.status === "ready").length;

  if (loading) {
    return (
      <div className="sop-manager">
        <Navigation />
        <div className="sop-manager-content">
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <span className="loading-text">Loading SOPs...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sop-manager">
      <Navigation />
      <div className="sop-manager-content">
        <div className="page-header">
          <h2>SOP Library</h2>
          <span className="subtitle">{sopDocs.length} SOPs</span>
        </div>

        {/* Background processing banner */}
        {processingCount > 0 && (
          <div className="processing-banner">
            <LoadingSpinner size="small" />
            <span>{processingCount} SOP(s) processing in background — extracting sections & generating embeddings...</span>
          </div>
        )}

        {/* Stats */}
        <div className="sop-stats">
          <div className="sop-stat">
            <span className="sop-stat-value">{sopDocs.length}</span>
            <span className="sop-stat-label">Total</span>
          </div>
          <div className="sop-stat">
            <span className="sop-stat-value" style={{ color: "#22c55e" }}>{readyCount}</span>
            <span className="sop-stat-label">Ready</span>
          </div>
          <div className="sop-stat">
            <span className="sop-stat-value" style={{ color: "#f59e0b" }}>{processingCount}</span>
            <span className="sop-stat-label">Processing</span>
          </div>
          <div className="sop-stat">
            <span className="sop-stat-value">{new Set(sopDocs.map(d => d.category_id).filter(Boolean)).size}</span>
            <span className="sop-stat-label">Categories</span>
          </div>
        </div>

        {/* Controls */}
        <div className="sop-controls">
          <div className="sop-controls-left">
            <input
              type="text"
              className="sop-search"
              placeholder="Search SOPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="sop-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.category_name}</option>
              ))}
            </select>
          </div>
          <button className="upload-btn" onClick={() => setShowUploadModal(true)}>
            Bulk Upload
          </button>
        </div>

        {/* SOP Table */}
        <div className="sop-table-container">
          <table className="sop-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>SOP Code</th>
                <th>Category</th>
                <th>Department</th>
                <th>Site</th>
                <th>Version</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {sopDocs.length === 0
                      ? "No SOPs uploaded yet. Use Bulk Upload to add SOPs."
                      : "No SOPs match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="cell-title">{doc.title}</td>
                    <td>{doc.sop_code || "—"}</td>
                    <td>
                      {doc.category?.category_name ? (
                        <span className="category-badge">{doc.category.category_name}</span>
                      ) : "—"}
                    </td>
                    <td>{doc.department || "—"}</td>
                    <td>{doc.site || "Global"}</td>
                    <td>{doc.version || "—"}</td>
                    <td>
                      <span className={`status-pill status-${doc.status}`}>
                        {doc.status === "processing" && <LoadingSpinner size="tiny" />}
                        {doc.status}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button
                        className="edit-btn-sm"
                        onClick={() => handleEditSOP(doc)}
                        title="Edit metadata"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                      </button>
                      <button
                        className="delete-btn-sm"
                        onClick={() => { setSopToDelete(doc); setShowDeleteConfirm(true); }}
                        title="Delete SOP"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        closeOnOutsideClick={true}
      >
        <BulkUpload
          organizationId={organizationId}
          userId={userId}
          categories={categories}
          onComplete={() => { setShowUploadModal(false); fetchData(); }}
          onBackgroundStart={handleBulkUploadStart}
        />
      </Modal>

      {/* Edit Metadata Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingSop(null); }}
        closeOnOutsideClick={!saving}
      >
        <div className="edit-sop-modal">
          <h3>Edit SOP Metadata</h3>
          <div className="edit-form">
            <div className="edit-field">
              <label>Title</label>
              <input type="text" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>SOP Code</label>
                <input type="text" value={editForm.sop_code || ""} onChange={(e) => setEditForm({ ...editForm, sop_code: e.target.value })} placeholder="e.g., SOP-QA-001" />
              </div>
              <div className="edit-field">
                <label>Version</label>
                <input type="text" value={editForm.version || ""} onChange={(e) => setEditForm({ ...editForm, version: e.target.value })} placeholder="e.g., 1.0" />
              </div>
            </div>
            <div className="edit-field">
              <label>Category</label>
              <select value={editForm.category_id || ""} onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value || null })}>
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                ))}
              </select>
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>Department</label>
                <input type="text" value={editForm.department || ""} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
              </div>
              <div className="edit-field">
                <label>Site</label>
                <input type="text" value={editForm.site || ""} onChange={(e) => setEditForm({ ...editForm, site: e.target.value })} placeholder="Global" />
              </div>
            </div>
            <div className="edit-actions">
              <button className="cancel-btn" onClick={() => { setShowEditModal(false); setEditingSop(null); }}>Cancel</button>
              <button className="save-btn" onClick={handleSaveEdit} disabled={saving || !editForm.title}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setSopToDelete(null); }}
        onConfirm={handleDeleteSOP}
        title="Delete SOP"
        message={`Are you sure you want to delete "${sopToDelete?.title}"?`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
};

export default SOPManager;
