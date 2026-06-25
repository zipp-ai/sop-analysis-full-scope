import React, { useState, useRef } from "react";
import { extractTextFromFile } from "../../../utils/fileParser";
import edgeFunctionService from "../../../services/edgeFunctionService";
import duplicateService from "../../../services/duplicateService";
import toastService from "../../../services/toastService";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import "./BulkUpload.css";

const BulkUploadPanel = ({ organizationId, userId, categories, onComplete, onBackgroundStart }) => {
  const [step, setStep] = useState("select");
  const [files, setFiles] = useState([]);
  const [sopEntries, setSopEntries] = useState([]);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [sopScope, setSopScope] = useState("global"); // global | site
  const [defaultSiteName, setDefaultSiteName] = useState("");
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isValidFile);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(isValidFile);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const isValidFile = (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    return ["pdf", "docx", "doc", "txt"].includes(ext);
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleExtractMetadata = async () => {
    if (files.length === 0) return;
    setStep("extracting");
    setExtractionProgress({ current: 0, total: files.length });
    const entries = [];

    for (let i = 0; i < files.length; i++) {
      setExtractionProgress({ current: i + 1, total: files.length });
      const file = files[i];
      try {
        const rawText = await extractTextFromFile(file);
        const defaultSite = sopScope === "global" ? "Global" : (defaultSiteName || "Site");
        let metadata = { title: file.name.replace(/\.[^/.]+$/, ""), sop_code: null, version: null, department: "General", category: "General", category_id: null, site: defaultSite, summary: "" };
        try {
          const result = await edgeFunctionService.extractMetadata(rawText, file.name);
          if (result.metadata) metadata = { ...metadata, ...result.metadata };
        } catch (err) { console.error("Metadata extraction failed for", file.name, err); }

        const siteValue = sopScope === "global" ? "Global" : (metadata.site && metadata.site !== "Global" ? metadata.site : defaultSiteName || "Site");
        entries.push({
          fileName: file.name, rawText,
          title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          sopCode: metadata.sop_code || "", version: metadata.version || "",
          department: metadata.department || "General",
          categoryId: metadata.category_id || null, categoryName: metadata.category || "General",
          site: siteValue, summary: metadata.summary || "",
          status: "ready", error: null,
        });
      } catch (err) {
        entries.push({
          fileName: file.name, rawText: "",
          title: file.name.replace(/\.[^/.]+$/, ""),
          sopCode: "", version: "", department: "General",
          categoryId: null, categoryName: "General", site: "Global", summary: "",
          status: "error", error: err.message,
        });
      }
    }
    setSopEntries(entries);
    setStep("review");
  };

  const updateEntry = (index, field, value) => {
    setSopEntries((prev) => prev.map((entry, i) => {
      if (i !== index) return entry;
      const updated = { ...entry, [field]: value };
      if (field === "categoryId") {
        const cat = (categories || []).find((c) => c.id === value);
        updated.categoryName = cat?.category_name || "General";
      }
      return updated;
    }));
  };

  const removeEntry = (index) => setSopEntries((prev) => prev.filter((_, i) => i !== index));

  const handleUploadAll = async () => {
    const validEntries = sopEntries.filter((e) => e.status !== "error" && e.rawText);
    if (validEntries.length === 0) { toastService.error("No valid SOPs to upload"); return; }

    // Close modal immediately — upload in background
    onComplete();
    toastService.info(`Uploading ${validEntries.length} SOPs in background...`);

    let successCount = 0;
    for (const entry of validEntries) {
      try {
        const doc = await duplicateService.uploadSOP({
          title: entry.title, sopCode: entry.sopCode, version: entry.version,
          department: entry.department, site: entry.site, categoryId: entry.categoryId,
          fileUrl: `bulk-upload/${entry.fileName}`, rawText: entry.rawText,
          organizationId, userId,
        });
        duplicateService.processSOP(doc.id).catch(console.error);
        successCount++;
      } catch (err) { console.error("Upload failed for", entry.title, err); }
    }
    toastService.success(`${successCount} SOPs uploaded. Processing in background.`);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="bulk-upload">
      <div className="bulk-upload-header">
        <h3>Bulk Upload SOPs</h3>
        <p className="bulk-upload-subtitle">
          {step === "select" && "Drop files or browse. Supported: PDF, DOCX, TXT"}
          {step === "extracting" && "Extracting text and metadata using AI..."}
          {step === "review" && "Review and edit metadata before uploading"}
        </p>
      </div>

      {step === "select" && (
        <>
          <div className="scope-selector">
            <label className="scope-label">These SOPs are:</label>
            <div className="scope-options">
              <button
                className={`scope-btn ${sopScope === "global" ? "active" : ""}`}
                onClick={() => { setSopScope("global"); setDefaultSiteName(""); }}
              >
                Global SOPs
              </button>
              <button
                className={`scope-btn ${sopScope === "site" ? "active" : ""}`}
                onClick={() => setSopScope("site")}
              >
                Site-specific SOPs
              </button>
            </div>
            {sopScope === "site" && (
              <input
                type="text"
                className="site-name-input"
                placeholder="Enter site name (e.g., Plant 1, Hyderabad, Unit 2)"
                value={defaultSiteName}
                onChange={(e) => setDefaultSiteName(e.target.value)}
              />
            )}
          </div>

          <div className="bulk-drop-zone" onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()}>
            <div className="drop-zone-icon">+</div>
            <p>Drop SOP files here or click to browse</p>
            <span className="drop-zone-hint">PDF, DOCX, DOC, TXT</span>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.txt" onChange={handleFileSelect} style={{ display: "none" }} />
          </div>
          {files.length > 0 && (
            <div className="selected-files">
              <h4>{files.length} file(s) selected</h4>
              <div className="file-list">
                {files.map((file, i) => (
                  <div key={i} className="file-item">
                    <div className="file-item-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </div>
                    <button className="file-remove" onClick={() => removeFile(i)}>×</button>
                  </div>
                ))}
              </div>
              <button className="extract-btn" onClick={handleExtractMetadata}>Extract Metadata ({files.length} files)</button>
            </div>
          )}
        </>
      )}

      {step === "extracting" && (
        <div className="extraction-progress">
          <LoadingSpinner size="large" />
          <h4>Processing file {extractionProgress.current} of {extractionProgress.total}</h4>
          <p>Extracting text and using AI to identify metadata...</p>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }} /></div>
        </div>
      )}

      {step === "review" && (
        <>
          <div className="review-table-container">
            <table className="review-table">
              <thead>
                <tr><th>File</th><th>Title</th><th>SOP Code</th><th>Category</th><th>Department</th><th>Site</th><th>Version</th><th></th></tr>
              </thead>
              <tbody>
                {sopEntries.map((entry, i) => (
                  <tr key={i} className={entry.status === "error" ? "row-error" : ""}>
                    <td className="cell-filename"><span title={entry.fileName}>{entry.fileName}</span>{entry.status === "error" && <span className="cell-error">{entry.error}</span>}</td>
                    <td><input type="text" value={entry.title} onChange={(e) => updateEntry(i, "title", e.target.value)} className="review-input" disabled={entry.status === "error"} /></td>
                    <td><input type="text" value={entry.sopCode} onChange={(e) => updateEntry(i, "sopCode", e.target.value)} className="review-input review-input-sm" placeholder="—" disabled={entry.status === "error"} /></td>
                    <td>
                      <select value={entry.categoryId || ""} onChange={(e) => updateEntry(i, "categoryId", e.target.value || null)} className="review-select" disabled={entry.status === "error"}>
                        <option value="">Select</option>
                        {(categories || []).map((cat) => (<option key={cat.id} value={cat.id}>{cat.category_name}</option>))}
                      </select>
                    </td>
                    <td><input type="text" value={entry.department} onChange={(e) => updateEntry(i, "department", e.target.value)} className="review-input review-input-sm" disabled={entry.status === "error"} /></td>
                    <td><input type="text" value={entry.site} onChange={(e) => updateEntry(i, "site", e.target.value)} className="review-input review-input-sm" placeholder="Global" disabled={entry.status === "error"} /></td>
                    <td><input type="text" value={entry.version} onChange={(e) => updateEntry(i, "version", e.target.value)} className="review-input review-input-sm" placeholder="—" disabled={entry.status === "error"} /></td>
                    <td><button className="file-remove" onClick={() => removeEntry(i)}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="review-actions">
            <button className="back-btn" onClick={() => { setStep("select"); setSopEntries([]); }}>Back</button>
            <button className="upload-all-btn" onClick={handleUploadAll} disabled={sopEntries.filter((e) => e.status !== "error").length === 0}>
              Upload {sopEntries.filter((e) => e.status !== "error").length} SOPs
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkUploadPanel;
