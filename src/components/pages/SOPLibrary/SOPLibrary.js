import React, { useState, useEffect } from "react";
import Navigation from "../../common/Navigation/Navigation";
import Modal from "../../common/Modal/Modal";
import AddSOP from "./AddSOP";
import DepartmentFilters from "../../common/DepartmentFilters/DepartmentFilters";
import sopService from "../../../services/sopService";
import apiService from "../../../services/api";
import API_URLS from "../../../config/apiUrls";
import toastService from "../../../services/toastService";
import "./SOPLibrary.css";
import LoadingSpinner from "../../common/LoadingSpinner/LoadingSpinner";
import ConfirmationModal from "../../common/ConfirmationModal/ConfirmationModal";
import { sanitizeText } from "../../../utils/sanitize";
import { formatDate } from "../../../utils/dateUtils";

const SOPLibrary = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [sopToDelete, setSopToDelete] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Department refresh trigger
  const [departmentRefreshTrigger, setDepartmentRefreshTrigger] = useState(0);

  // Add sorting and filtering states
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [dateFilter, setDateFilter] = useState("all");

  // Fetch SOPs on component mount
  useEffect(() => {
    fetchSOPs();
  }, []);

  // Prevent body scroll when modals are open
  useEffect(() => {
    if (
      isModalOpen ||
      showDeleteConfirmation
    ) {
      // Disable scrolling
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");
    } else {
      // Re-enable scrolling
      document.body.style.overflow = "unset";
      document.body.classList.remove("modal-open");
    }

    // Cleanup function to ensure scrolling is re-enabled when component unmounts
    return () => {
      document.body.style.overflow = "unset";
      document.body.classList.remove("modal-open");
    };
  }, [
    isModalOpen,
    showDeleteConfirmation,
  ]);

  const fetchSOPs = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // Fetch regular SOPs and AI-generated SOPs in parallel
      const regularSOPsResponse = await sopService.getAllSOPs();

      let allSOPs = [];
      let hasRegularSOPs = false;
      console.log("Regular SOPs response:", regularSOPsResponse);

      // Process regular SOPs
      if (regularSOPsResponse) {
        const regularSOPs = regularSOPsResponse.sops_data || [];
        // Add isAiGenerated: false flag to regular SOPs
        const regularSOPsWithFlag = regularSOPs.map((sop) => ({
          ...sop,
          isAiGenerated: false,
        }));
        allSOPs = [...allSOPs, ...regularSOPsWithFlag];
        hasRegularSOPs = true;
      } else {
        console.error(
          "Error fetching regular SOPs:",
          regularSOPsResponse.reason,
        );
      }

      // Handle different scenarios
      if (!hasRegularSOPs) {
        // Both failed - show error
        let errorMessage = "Failed to load SOPs. Please try again later.";
        if (regularSOPsResponse.reason?.response?.data?.detail) {
          errorMessage = regularSOPsResponse.reason.response.data.detail;
        }
        setError(errorMessage);
        toastService.error(errorMessage);
        setSops([]);
      } else {
        // At least one succeeded
        setSops(allSOPs);
        setError(null);

      }
    } catch (error) {
      // This should rarely happen with Promise.allSettled, but just in case
      console.error("Unexpected error in fetchSOPs:", error);

      let errorMessage =
        "An unexpected error occurred while loading SOPs. Please try again later.";
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      setError(errorMessage);
      toastService.error(errorMessage);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Silent fetch function for background updates
  const silentFetchSOPs = async () => {
    await fetchSOPs(true);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Filter SOPs based on department and search term
  const filteredSOPs = React.useMemo(() => {
    let filtered = sops;
    // Filter by department if not "All"
    if (selectedDepartment !== "All") {
      filtered = sops.filter(
        (sop) =>
          (sop.metadata && sop.metadata.department === selectedDepartment) ||
          sop.category === selectedDepartment,
      );
    }

    // Filter by search term if not empty
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((sop) =>
        (sop.title || sop.file_name || "").toLowerCase().includes(term),
      );
    }

    // Apply date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      filtered = filtered.filter((sop) => {
        const sopDate = new Date(sop.updated_at || sop.created_at);

        switch (dateFilter) {
          case "today":
            return sopDate >= today;
          case "yesterday":
            return sopDate >= yesterday && sopDate < today;
          case "week":
            return sopDate >= lastWeek;
          case "month":
            return sopDate >= lastMonth;
          default:
            return true;
        }
      });
    }

    // Sort the filtered results
    return filtered.sort((a, b) => {
      if (sortField === "date") {
        const dateA = new Date(a.updated_at || a.created_at || 0);
        const dateB = new Date(b.updated_at || b.created_at || 0);
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
      } else if (sortField === "title") {
        const titleA = (a.title || "").toLowerCase();
        const titleB = (b.title || "").toLowerCase();
        return sortDirection === "asc"
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);
      }
      return 0;
    });
  }, [
    sops,
    selectedDepartment,
    searchTerm,
    sortField,
    sortDirection,
    dateFilter,
  ]);

  const handleDepartmentChange = (department) => {
    setSelectedDepartment(department);
  };

  // Function to handle sort changes
  const handleSortChange = (field) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to descending for date, ascending for title
      setSortField(field);
      setSortDirection(field === "date" ? "desc" : "asc");
    }
  };

  // Add a function to reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setDateFilter("all");
    setSortField("date");
    setSortDirection("desc");
    // Keep the department filter as is, since it's a primary filter
  };

  // formatDate is now imported from '../../../utils/dateUtils'

  // Extract file extension for display
  // const getFileExtension = (fileName) => {
  //   if (!fileName) return '';
  //   return fileName.split('.').pop().toUpperCase();
  // };

  // Add a function to extract department from SOP for display
  const getDepartment = (sop) => {
    // Check if metadata exists and has a department property
    if (sop.metadata && sop.metadata.department) {
      return sop.metadata.department;
    }

    // Fall back to other possible department properties
    return (
      sop.department ||
      sop.department_name ||
      sop.dept ||
      sop.category ||
      "Unknown"
    );
  };

  const handleSOPUploadSuccess = (newSOP) => {
    // Add a property to identify this as a newly uploaded SOP
    // const sopWithUploadFlag = {
    //   ...newSOP,
    //   isNewlyUploaded: true
    // };

    // // Add the new SOP to the existing list
    // setSops(prevSops => [sopWithUploadFlag, ...prevSops]);

    // // Close the modal
    silentFetchSOPs();
    setIsModalOpen(false);

    // Success message is already shown in AddSOP component, no need to duplicate it here
  };

  const handleSOPUploadError = (errorMessage) => {
    toastService.error(
      errorMessage || "Failed to upload SOP. Please try again.",
    );
  };

  // Handle SOP download
  const handleDownloadSOP = async (sopId, fileName, isAiGenerated = false) => {
    try {
      setDownloadingId(sopId);
      const response = await sopService.downloadSOP(
        sopId,
        isAiGenerated,
        fileName,
      );

      // For AI-generated SOPs, the service already handled the download
      if (isAiGenerated && response.success) {
        toastService.success(response.message);
        return;
      }

      // For normal SOPs, handle the download here
      // Create a blob URL for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));

      // Create a temporary link element to trigger the download
      const link = document.createElement("a");
      link.href = url;
      if (response.data.type === "application/pdf") {
        link.setAttribute("download", `${fileName}.pdf` || "document.pdf"); // Use the original filename or a default
      } else if (response.data.type === "text/plain") {
        link.setAttribute("download", `${fileName}.txt` || "document.txt"); // Use the original filename or a default
      } else if (response.data.type === "application/msword") {
        link.setAttribute("download", `${fileName}.doc` || "document.doc"); // Use the original filename or a default
      } else if (
        response.data.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        link.setAttribute("download", `${fileName}.docx` || "document.docx"); // Use the original filename or a default
      }
      document.body.appendChild(link);

      // Trigger the download
      link.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      toastService.success("File downloaded successfully");
    } catch (err) {
      console.error("Error downloading SOP:", err);

      let errorMessage = "Failed to download file. Please try again.";
      if (err?.response?.data?.detail) {
        errorMessage = err?.response?.data?.detail;
      }

      toastService.error(errorMessage);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteClick = (sop) => {
    setSopToDelete(sop);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteSOP = async () => {
    if (!sopToDelete) return;

    try {
      setDeletingId(sopToDelete.id);

      // Make the DELETE API call
      await sopService.deleteSOP(sopToDelete.id);

      // Remove the deleted SOP from the state
      setSops((prevSops) =>
        prevSops.filter((sop) => sop.id !== sopToDelete.id),
      );

      // Trigger department filter refresh to update categories
      setDepartmentRefreshTrigger((prev) => prev + 1);

      toastService.success("SOP deleted successfully");
    } catch (err) {
      console.error("Error deleting SOP:", err);

      let errorMessage = "Failed to delete SOP. Please try again.";
      if (err?.response?.data?.detail) {
        errorMessage = err?.response?.data?.detail;
      }

      toastService.error(errorMessage);
    } finally {
      setDeletingId(null);
      setSopToDelete(null);
    }
  };

  // Add a function to handle adding a new SOP at the top of the list
  const handleSOPAdded = (newSOP) => {
    // Add the new SOP at the beginning of the array
    setSops((prevSops) => [newSOP, ...prevSops]);
  };

  const renderAddSOPButton = () => {
    return (
      <button className="add-sop-btn" onClick={() => setIsModalOpen(true)}>
        Add New SOP
      </button>
    );
  };

  // Update the callback function to track processing state
  const handleBeforeUpload = () => {
    setIsUploading(true);
  };

  const handleAfterUpload = () => {
    setIsUploading(false);
  };


  const handleEditSOPSave = (updatedSections) => {
    // Here you would typically save the updated sections to your backend
    toastService.success("SOP changes verified successfully!");

    // Optionally refresh the SOPs list
    silentFetchSOPs();
  };

  return (
    <div className="sop-library">
      <Navigation />
      <div className="sop-content">
        <div className="page-header">
          <h2>SOP Library</h2>
          {!loading && (
            <span className="subtitle">{filteredSOPs.length} items</span>
          )}
        </div>

        {loading ? (
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <span className="loading-text">Loading SOPs...</span>
          </div>
        ) : (
          <>
            <DepartmentFilters
              onDepartmentChange={handleDepartmentChange}
              defaultSelected="All"
              refreshTrigger={departmentRefreshTrigger}
            />

            {/* Show search and filter controls if there are any SOPs in the database */}
            {sops.length > 0 && (
              <>
                <div className="search-section">
                  <input
                    type="text"
                    placeholder="Search SOPs..."
                    className="search-input"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  {renderAddSOPButton()}
                </div>

                <div className="filter-sort-controls">
                  <div className="filter-group">
                    <label>Sort by:</label>
                    <div className="sort-buttons">
                      <button
                        className={`sort-btn ${sortField === "date" ? "active" : ""}`}
                        onClick={() => handleSortChange("date")}
                      >
                        Date
                        {sortField === "date" && (
                          <span className="sort-direction">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                      <button
                        className={`sort-btn ${sortField === "title" ? "active" : ""}`}
                        onClick={() => handleSortChange("title")}
                      >
                        Title
                        {sortField === "title" && (
                          <span className="sort-direction">
                            {sortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="filter-group">
                    <label>Date:</label>
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="filter-select"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>
                  </div>

                  <button
                    className="reset-filters-btn"
                    onClick={resetFilters}
                    disabled={
                      dateFilter === "all" &&
                      sortField === "date" &&
                      sortDirection === "desc" &&
                      searchTerm === ""
                    }
                  >
                    Reset Filters
                  </button>
                </div>
              </>
            )}

            <div className="sop-list">
              <h2>Standard Operating Procedures</h2>

              {error ? (
                <div className="error-message">{error}</div>
              ) : sops.length === 0 ? (
                <div className="empty-state">
                  No SOPs found. Add your first SOP by clicking{" "}
                  {renderAddSOPButton()}
                </div>
              ) : filteredSOPs.length === 0 ? (
                <div className="empty-state">
                  {searchTerm ||
                  dateFilter !== "all" ||
                  selectedDepartment !== "All" ? (
                    <div>
                      <p>
                        No results found matching your filters. Try different
                        filter settings.
                      </p>
                    </div>
                  ) : (
                    "No SOPs available."
                  )}
                </div>
              ) : (
                <div className="sop-items">
                  {filteredSOPs.map((sop, index) => (
                    <div key={sop.id} className="sop-item">
                      <div className="sop-info">
                        <h3>{sanitizeText(sop.title)}</h3>
                        <div className="sop-details">
                          {/* {sop.isAiGenerated && (
                            <span className="department ai-generated">
                              AI Generated
                            </span>
                          )} */}
                          <span className="department">
                            {getDepartment(sop)}
                          </span>
                          {/* <span className="file-type">{getFileExtension(sop.file_name)}</span> */}
                        </div>
                      </div>
                      <div className="sop-meta">
                        <span className="last-updated">
                          Last updated: {formatDate(sop.updated_at)}
                        </span>
                        {sop.is_processing ? (
                          <span className="processing">
                            <LoadingSpinner size="small" /> Processing
                          </span>
                        ) : (
                          <div className="sop-actions">
                            {!sop.isNewlyUploaded &&
                              (!sop.isAiGenerated ||
                                (sop.isAiGenerated &&
                                  sop.is_approved &&
                                  sop.is_approved !== false &&
                                  !(
                                    !sop.is_approved && sop.isAiGenerated
                                  ))) && (
                                <button
                                  className="view-icon-link"
                                  onClick={() =>
                                    handleDownloadSOP(
                                      sop.id,
                                      sop.title,
                                      sop.isAiGenerated,
                                    )
                                  }
                                  disabled={downloadingId === sop.id}
                                  data-tooltip="Download SOP"
                                >
                                  {downloadingId === sop.id ? (
                                    <LoadingSpinner size="small" />
                                  ) : (
                                    <svg
                                      className="view-icon"
                                      width="16"
                                      height="16"
                                      viewBox="0 0 16 16"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        d="M8 11.5L8 3.5"
                                        stroke="#6c63ff"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M4.5 8L8 11.5L11.5 8"
                                        stroke="#6c63ff"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path
                                        d="M3 13.5H13"
                                        stroke="#6c63ff"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </button>
                              )}
                            <button
                              className="delete-icon-link"
                              onClick={() => handleDeleteClick(sop)}
                              disabled={deletingId === sop.id}
                              data-tooltip="Delete SOP"
                            >
                              {deletingId === sop.id ? (
                                <LoadingSpinner size="small" />
                              ) : (
                                <svg
                                  className="delete-icon"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M2 4H3.33333H14"
                                    stroke="#ff6b6b"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M5.33334 4V2.66667C5.33334 2.31305 5.47382 1.97391 5.72387 1.72386C5.97392 1.47381 6.31305 1.33334 6.66667 1.33334H9.33334C9.68696 1.33334 10.0261 1.47381 10.2761 1.72386C10.5262 1.97391 10.6667 2.31305 10.6667 2.66667V4M12.6667 4V13.3333C12.6667 13.687 12.5262 14.0261 12.2761 14.2761C12.0261 14.5262 11.687 14.6667 11.3333 14.6667H4.66667C4.31305 14.6667 3.97391 14.5262 3.72386 14.2761C3.47381 14.0261 3.33334 13.687 3.33334 13.3333V4H12.6667Z"
                                    stroke="#ff6b6b"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          closeOnOutsideClick={true}
          isProcessing={isUploading}
        >
          <AddSOP
            onClose={() => setIsModalOpen(false)}
            onSuccess={(sop) => {
              handleSOPUploadSuccess(sop);
              handleAfterUpload();
            }}
            onError={() => {
              handleSOPUploadError();
              handleAfterUpload();
            }}
            onBeforeUpload={handleBeforeUpload}
            refreshSOPs={silentFetchSOPs}
          />
        </Modal>

        <ConfirmationModal
          isOpen={showDeleteConfirmation}
          onClose={() => setShowDeleteConfirmation(false)}
          onConfirm={handleDeleteSOP}
          title="Delete SOP"
          message={`Are you sure you want to delete "${sopToDelete?.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
};

export default SOPLibrary;
