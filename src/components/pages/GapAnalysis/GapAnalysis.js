import React, { useState, useEffect } from 'react';
import Navigation from '../../common/Navigation/Navigation';
import DepartmentFilters from '../../common/DepartmentFilters/DepartmentFilters';
import Modal from '../../common/Modal/Modal';
import AssessmentForm from './AssessmentForm';
import GapDetailsSidebar from './GapDetailsSidebar';

import apiService from '../../../services/api';
import API_URLS from '../../../config/apiUrls';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import './GapAnalysis.css';
import toastService from '../../../services/toastService';
import { sanitizeText } from '../../../utils/sanitize';
import { formatDate } from '../../../utils/dateUtils';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';

const GapAnalysis = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [gapResults, setGapResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [delAssessment, setDelAssessment] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [processingSopId, setProcessingSopId] = useState(null);

  // Add sorting and filtering states
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [dateFilter, setDateFilter] = useState('all');

  // Tooltip state
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
  
  // Highlight existing assessment state
  const [highlightedAssessmentTitle, setHighlightedAssessmentTitle] = useState(null);


  const fetchComprehensiveResults = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // Call the comprehensive results endpoint
      const response = await apiService.get(API_URLS.ANALYSIS.COMPREHENSIVE_RESULTS);
      if (response && response.results) {
        // Transform the comprehensive results into gap analysis data
        const transformedResults = response.results.map(sop => {
          // Extract SOP data
          // const sop = sop.sop_data || {};
          const analysis = sop.analysis_data || {};
          const department = sop.metadata?.department || 'Unassigned';

          // Determine which gap details to use - prefer changed_gap_detail if available
          let gapDetailsToUse = [];
          let isValidated = false;

          if (analysis.metadata && analysis.metadata.changed_gap_detail &&
            Array.isArray(analysis.metadata.changed_gap_detail) &&
            analysis.metadata.changed_gap_detail.length > 0) {
            gapDetailsToUse = analysis.metadata.changed_gap_detail;
            isValidated = true;
          } else if (analysis.gap_details) {
            gapDetailsToUse = analysis.gap_details;
            isValidated = false;
          }

          // Ensure gap_details is always an array
          if (!Array.isArray(gapDetailsToUse)) {
            gapDetailsToUse = [];
          }
          gapDetailsToUse=sop.gap_details;

          return {
            id: sop.id,
            title: sop.title || 'Unnamed SOP',
            department: sop.department,
            organization_id: sop.organization_id,
            // Extract gap metrics directly from SOP data
            totalGaps: sop.total_gaps,
            highPriorityGaps: sop.high_priority_gaps,
            mediumPriorityGaps: sop.medium_priority_gaps,
            lowPriorityGaps: sop.low_priority_gaps,
            // Include analysis data if available
            analysis_status: sop.analysis_status,
            sopName: sop.sop_title,
            secondarySops: sop.secondary_sop_details,
            analysis: {
              updated_at: sop.updated_at,
              created_at: sop.created_at,
              compliance_score: sop.compliance_score,
              gap_details: sop.gap_details,
              isValidated: sop.is_validated,
              regulations: sop.regulations
            }
          };
        });

        setGapResults(transformedResults);
      }
    } catch (err) {
      console.error('Error fetching comprehensive results:', err);

      let errorMessage = 'Failed to load gap analysis results. Please try again later.';
      if (err?.response?.data?.detail) {
        errorMessage = err?.response?.data?.detail;
      }

      setError(errorMessage);
    } finally {
      setTimeout(() => {
        if (!silent) {
          setLoading(false);
        }
      }, 1000);
    }
  };

  // Fetch comprehensive analysis results
  useEffect(() => {

    fetchComprehensiveResults();
  }, []);



  // Add a silent update function that doesn't show loading states


  // Improve the refreshAllData function to ensure it properly updates the UI
  const refreshAllData = async (silent = false) => {
    // Silently refresh all data without showing loader or toast
    fetchComprehensiveResults(silent);
  };

  // Filter results based on selected department
  const filteredResultsMemo = React.useMemo(() => {
    // Helper function to get the highest date from available dates (shared between filtering and sorting)
    const getHighestDate = (item) => {
      const dates = [];
      // Add analysis dates if they exist
      if (item.analysis && item.analysis.analyzed_at) {
        dates.push(new Date(item.analysis.analyzed_at));
      }
      if (item.analysis && item.analysis.updated_at) {
        dates.push(new Date(item.analysis.updated_at));
      }

      // Add SOP creation date
      if (item.date) {
        dates.push(new Date(item.date));
      }

      // Return the highest date, or epoch if no valid dates
      return dates.length > 0 ? new Date(Math.max(...dates)) : new Date(0);
    };

    // Start with department filtering
    let filtered = gapResults;

    if (selectedDepartment !== 'All') {
      filtered = filtered.filter(item => item.department === selectedDepartment);
    }

    // Apply search term filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        (item.title || '').toLowerCase().includes(term) ||
        (item.department || '').toLowerCase().includes(term)
      );
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      filtered = filtered.filter(item => {
        // Use the highest date among all available dates
        const dateToUse = getHighestDate(item);

        switch (dateFilter) {
          case 'today':
            return dateToUse >= today;
          case 'yesterday':
            return dateToUse >= yesterday && dateToUse < today;
          case 'week':
            return dateToUse >= lastWeek;
          case 'month':
            return dateToUse >= lastMonth;
          default:
            return true;
        }
      });
    }

    // Sort the filtered results
    const sortedResults = filtered.sort((a, b) => {
      if (sortField === 'date') {
        const dateA = getHighestDate(a);
        const dateB = getHighestDate(b);

        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'title') {
        const titleA = (a.title || '').toLowerCase();
        const titleB = (b.title || '').toLowerCase();

        return sortDirection === 'asc'
          ? titleA.localeCompare(titleB)
          : titleB.localeCompare(titleA);
      } else if (sortField === 'priority') {
        // First, check if items have analysis data (analyzed vs not analyzed)
        const aHasAnalysis = a.analysis && a.analysis.analyzed_at;
        const bHasAnalysis = b.analysis && b.analysis.analyzed_at;

        // If one has analysis and the other doesn't, prioritize the analyzed one
        if (aHasAnalysis && !bHasAnalysis) {
          return -1; // a comes first (analyzed items on top)
        } else if (!aHasAnalysis && bHasAnalysis) {
          return 1; // b comes first (analyzed items on top)
        }

        // Helper function to determine priority level of an item
        const getPriorityLevel = (item) => {
          if ((item.highPriorityGaps || 0) > 0) return 'high';
          if ((item.mediumPriorityGaps || 0) > 0) return 'medium';
          if ((item.lowPriorityGaps || 0) > 0) return 'low';
          return 'none'; // No gaps
        };

        const priorityA = getPriorityLevel(a);
        const priorityB = getPriorityLevel(b);

        // Define priority order: high > medium > low > none
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1, 'none': 0 };
        const valueA = priorityOrder[priorityA];
        const valueB = priorityOrder[priorityB];

        // Sort: desc = high to low (3,2,1,0), asc = low to high (0,1,2,3)
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      return 0;
    });

    return sortedResults;
  }, [gapResults, selectedDepartment, searchTerm, sortField, sortDirection, dateFilter]);

  const handleDepartmentChange = (department) => {
    setSelectedDepartment(department);
    setSelectedRowIndex(null); // Clear selected row when changing departments
    setIsSidebarOpen(false); // Close sidebar when changing departments
  };

  const handleViewDetails = (sopRec) => {
    // setSelectedRowIndex(index);
    setSelectedRecord(sopRec)

    // const selectedSop = filteredResultsMemo[index];

    // Check if we already have analysis data for this SOP
    if (sopRec.analysis) {
      // Use the existing analysis data
      setAnalysisResults(sopRec.analysis);
      setIsSidebarOpen(true);
    } else {
      // Only make API call if we don't have the data already
      setAnalysisLoading(true);
      setAnalysisError(null);

      apiService.post(API_URLS.ANALYSIS.ANALYZE, { sop_id: sopRec.id })
        .then(response => {
          setAnalysisResults(response);

          // Also update the cached results for this SOP
          setGapResults(prevResults =>
            prevResults.map(sop =>
              sop.id === sopRec.id
                ? { ...sop, analysis: response }
                : sopRec
            )
          );
        })
        .catch(err => {
          console.error('Error analyzing SOP:', err);
          setAnalysisError('Failed to analyze SOP. Please try again later.');
          toastService.error('Failed to analyze SOP. Please try again later.', {
            toastId: `assessment-error-${Date.now()}`
          });
          setProcessingSopId(null);
        })
        .finally(() => {
          setAnalysisLoading(false);
          setIsSidebarOpen(true);
        });
    }
  };

  const renderCreateAssessmentButton = () => {
    return (
      <button
        className="create-assessment-btn"
        onClick={() => setIsModalOpen(true)}
      >
        Create Assessment
      </button>
    )
  }

  // Function to handle sort changes
  const handleSortChange = (field) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending for date, ascending for title
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  };

  // Add a new function to reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setDateFilter('all');
    setSortField('date');
    setSortDirection('desc');
    // Keep the department filter as is, since it's a primary filter
  };

  // Tooltip handlers
  const showTooltip = (e, text) => {
    const element = e.target;
    // Check if text is truncated (scrollWidth > clientWidth means ellipsis is active)
    const isTextTruncated = element.scrollWidth > element.clientWidth;
    
    if (isTextTruncated) {
      const rect = element.getBoundingClientRect();
      setTooltip({
        show: true,
        text: text,
        x: rect.left + rect.width / 2,
        y: rect.top - 50  // Move tooltip further up to avoid overlap
      });
    }
  };

  const hideTooltip = () => {
    setTooltip({ show: false, text: '', x: 0, y: 0 });
  };

  // Add scroll event listener to hide tooltip when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (tooltip.show) {
        hideTooltip();
      }
    };

    // Add scroll event listener to window and any scrollable containers
    window.addEventListener('scroll', handleScroll, true);
    
    // Cleanup function to remove event listener
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [tooltip.show]);


  // Update the callback functions to track processing state with logging
  const handleBeforeUpload = () => {
    setIsUploading(true);
  };

  const handleAfterUpload = () => {
    setIsUploading(false);
  };

  // Function to highlight existing assessment and scroll to it
  const handleHighlightExistingAssessment = (assessmentTitle) => {
    // Close the modal first
    setIsModalOpen(false);
    
    // Set the highlighted assessment title
    setHighlightedAssessmentTitle(assessmentTitle);
    
    // Find the assessment in the filtered results and scroll to it
    setTimeout(() => {
      const assessmentElement = document.querySelector(`[data-assessment-title="${assessmentTitle}"]`);
      if (assessmentElement) {
        assessmentElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedAssessmentTitle(null);
      }, 3000);
    }, 100);
  };

  // Add functions to handle assessment processing
  const handleAssessmentStart = (sopId) => {
    setProcessingSopId(sopId);
    setIsModalOpen(false); // Close the modal when processing starts
  };

  const handleAssessmentComplete = () => {
    setProcessingSopId(null);
setTimeout(()=>{
  refreshAllData(true); // Refresh data silently to show new assessment

},500)
    handleAfterUpload();
  };

  const handleAssessmentDeletion = async () => {

    try {
      const { organization_id, id } = delAssessment
      const response = await apiService.delete(API_URLS.ANALYSIS.COMPREHENSIVE_DELETE(organization_id, id));

      await fetchComprehensiveResults(true)

      toastService.success(response.message)

    } catch (error) {
      console.log("Assessment delete error: ", error)

      toastService.error("Failed to delete assessment")
    } finally {
      setDelAssessment(null)
      setIsDeleting(false)
    }
  }

  return (
    <div className="gap-analysis">
      <Navigation />
      <div className="gap-content">
        <div className="page-header">
          <h2>Gap Analysis</h2>
        </div>

        {/* <DepartmentFilters
          onDepartmentChange={handleDepartmentChange}
          defaultSelected="All"
        /> */}


        <>
          <div className="search-section">
            <input
              type="text"
              placeholder="Search gap analysis..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {renderCreateAssessmentButton()}
          </div>

          <div className="filter-sort-controls">
            <div className="filter-group">
              <label>Sort by:</label>
              <div className="sort-buttons">
                <button
                  className={`sort-btn ${sortField === 'date' ? 'active' : ''}`}
                  onClick={() => handleSortChange('date')}
                >
                  Date
                  {sortField === 'date' && (
                    <span className="sort-direction">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <button
                  className={`sort-btn ${sortField === 'title' ? 'active' : ''}`}
                  onClick={() => handleSortChange('title')}
                >
                  Title
                  {sortField === 'title' && (
                    <span className="sort-direction">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
                <button
                  className={`sort-btn ${sortField === 'priority' ? 'active' : ''}`}
                  onClick={() => handleSortChange('priority')}
                >
                  Priority
                  {sortField === 'priority' && (
                    <span className="sort-direction">
                      {sortDirection === 'asc' ? '↑' : '↓'}
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
              disabled={dateFilter === 'all' && sortField === 'date' && sortDirection === 'desc' && searchTerm === ''}
            >
              Reset Filters
            </button>
          </div>
        </>


        {loading ? (
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <span className="loading-text">Loading Gap Analysis Results...</span>
          </div>
        ) : (
          <>
            <div className="gap-results">
              <h2>Gap Analysis Results</h2>
              {error ? (
                <div className="error-message">{error}</div>
              ) : filteredResultsMemo.length === 0 ? (
                <div className="empty-state">
                  {searchTerm || dateFilter !== 'all' ?
                    `No results found matching your filters. Try different filter settings.` :
                    <>
                      No gap analysis results found. Create your first assessment by clicking {renderCreateAssessmentButton()}
                    </>
                  }
                </div>
              ) : (
                <div className="gap-items">
                  {filteredResultsMemo.map((item, index) => (

                    <div
                      key={item.id || index}
                      className={`gap-item ${selectedRowIndex === index ? 'selected' : ''} ${highlightedAssessmentTitle === item.title ? 'highlighted-blink' : ''}`}
                      data-assessment-title={item.title}
                    >
                      <div className="gap-info">
                        <span className={`analysis-date ${!item.analysis.isValidated? 'no-analysis' : ''} ${item.analysis && item.analysis.analyzed_at && item.analysis.isValidated ? 'updated' : item.analysis && item.analysis.analyzed_at ? 'analyzed' : ''}`}>
                          {item.analysis.isValidated ? `Updated on ${formatDate(item.analysis.updated_at)}` : `Created on ${formatDate(item.analysis.created_at)}`}
                        </span>
                        <h3 
                          onMouseEnter={(e) => showTooltip(e, item.title)}
                          onMouseLeave={hideTooltip}
                          style={{ cursor: 'default' }}
                        >
                          {sanitizeText(item.title)}
                        </h3>
                        {item.department && 
                        <div className="gap-details">
                          <span className="department">{sanitizeText(item.department)}</span>
                        </div>
                        }
                      </div>
                      {processingSopId !== item.id && (
                        <div className="gap-metrics-container">
                          <>
                            {item.totalGaps !== undefined && item.totalGaps !== null && (
                              <span className="gap-metric total-gaps">
                                <span className="metric-label">Total Gaps:</span>
                                <span className="metric-value">{item.totalGaps}</span>
                              </span>
                            )}

                            {item.highPriorityGaps !== undefined && item.highPriorityGaps !== null && item.highPriorityGaps > 0 ? (
                              <span className="gap-metric high-priority">
                                <span className="metric-label">High Priority:</span>
                                <span className="metric-value">{item.highPriorityGaps}</span>
                              </span>
                            ) : item.mediumPriorityGaps !== undefined && item.mediumPriorityGaps !== null && item.mediumPriorityGaps > 0 ? (
                              <span className="gap-metric medium-priority">
                                <span className="metric-label">Medium Priority:</span>
                                <span className="metric-value">{item.mediumPriorityGaps}</span>
                              </span>
                            ) : item.lowPriorityGaps !== undefined && item.lowPriorityGaps !== null && item.lowPriorityGaps > 0 ? (
                              <span className="gap-metric low-priority">
                                <span className="metric-label">Low Priority:</span>
                                <span className="metric-value">{item.lowPriorityGaps}</span>
                              </span>
                            ) : null}

                          </>
                        </div>
                      )}
                      <div className="gap-meta">
                        <div className="gap-actions">

                          {/* Show processing state based on analysis_status */}
                          {(() => {

                            // If analysis is still processing
                            if (item.analysis_status && item.analysis_status !== 'completed') {
                              return (
                                <div className="processing-state">
                                  <LoadingSpinner size="small" />
                                  <span className="processing-text">Processing</span>
                                </div>
                              );
                            }

                            // If analysis is completed
                            if (item.analysis_status === 'completed') {
                              return (
                                <>
                                  <button
                                    className="details-btn"
                                    onClick={() => handleViewDetails(item)}
                                  >
                                    Details
                                  </button>
                                  <button
                                    disabled={delAssessment?.id === item.id && isDeleting}
                                    className="delete-btn"
                                    onClick={() => {
                                      setDelAssessment(item)
                                      setShowConfirmation(true)
                                    }}
                                  >
                                    {delAssessment?.id === item.id && isDeleting ? <LoadingSpinner size="small" /> : "Delete"}
                                  </button>
                                </>
                              );
                            }

                            // No analysis or unknown status
                            return <span className="no-details">No Assessment</span>;
                          })()}
                        </div>
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
          <AssessmentForm
            results={gapResults}
            onClose={() => setIsModalOpen(false)}
            onSuccess={handleAssessmentComplete}
            onBeforeUpload={handleBeforeUpload}
            onProcessingStart={handleAssessmentStart}
            onHighlightExisting={handleHighlightExistingAssessment}
          />
        </Modal>

        <GapDetailsSidebar
          closeOnOutsideClick={true}
          isOpen={isSidebarOpen}
          onClose={() => {
            setIsSidebarOpen(false);
            setSelectedRowIndex(null);
            setAnalysisResults(null);
          }}
          gapDetails={selectedRecord || null}
          analysisResults={analysisResults}
          loading={analysisLoading}
          error={analysisError}
          onRefreshData={refreshAllData}
        />

        {/* Open delete confirmation modal */}
        <ConfirmationModal
          cancelText={"Cancel"}
          confirmText={'Delete'}
          isOpen={showConfirmation && delAssessment}
          message={"Are you sure you want to delete the assessment? This action cannot be undone."}
          onClose={() => {
            setShowConfirmation(false)
          }}
          onConfirm={() => { 
            setIsDeleting(true)
            handleAssessmentDeletion()
           }}
        />

        {/* Custom instant tooltip */}
        {tooltip.show && (
          <div 
            className="custom-tooltip"
            style={{
              position: 'fixed',
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translateX(-50%)',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default GapAnalysis;