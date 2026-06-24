import React, { useState, useEffect, useRef } from 'react';
import './GapDetailsSidebar.css';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import apiService from '../../../services/api';
import toastService from '../../../services/toastService';
import API_URLS from '../../../config/apiUrls';
import { sanitizeHtml, sanitizeText } from '../../../utils/sanitize';
import { formatDate } from '../../../utils/dateUtils';

const GapDetailsSidebar = ({ isOpen, onClose, gapDetails, analysisResults, loading, error, onRefreshData }) => {
  // Move all hooks to the top, before any conditional returns
  const [editableGaps, setEditableGaps] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const originalGapsRef = useRef([]);
  const [wasValidated, setWasValidated] = useState(false);
  const [expandedGapId, setExpandedGapId] = useState(null);
  
  // Get the result from the gapDetails since we now have comprehensive data
  const result = gapDetails

  
  // Initialize editable gaps when analysis results change
  useEffect(() => {
    // track mounted state to avoid state updates on unmounted component
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Initialize editable gaps when analysis results change
  useEffect(() => { 
    // Since result is now gapDetails directly, we need to access analysis data differently
    const analysisData = result && result.analysis ? result.analysis : null;
    if (isOpen && analysisData && analysisData.gap_details && analysisData.gap_details.length > 0) {
      // Check if validated gap details exist in metadata
      const hasValidatedGaps = analysisData.isValidated;
      
      // Set the wasValidated state based on whether gaps were previously validated
      setWasValidated(hasValidatedGaps);
      // Use validated gaps if available, otherwise use original gap_details
      const gapDetailsToUse = analysisData.gap_details;
      
      // Add unique IDs to each gap for easier manipulation
      const gapsWithIds = gapDetailsToUse.map((gap, index) => ({
        ...gap,
        id: `gap-${index}-${Date.now()}`
      }));
      
      if (isMountedRef.current) {
        setEditableGaps(gapsWithIds);
        originalGapsRef.current = JSON.parse(JSON.stringify(gapsWithIds));
        setHasChanges(false);
      }
    } else {
      if (isMountedRef.current) {
        setEditableGaps([]);
        originalGapsRef.current = [];
        setHasChanges(false);
      }
    }
    
    // Reset editing state when opening/closing the sidebar
    if (isMountedRef.current) setIsEditing(false);
  }, [isOpen, result]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position and prevent scrolling
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scrolling if component unmounts while modal is open
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Check for changes whenever editableGaps changes
  useEffect(() => {
    if (isEditing && originalGapsRef.current.length > 0) {
      const currentGapsString = JSON.stringify(editableGaps);
      const originalGapsString = JSON.stringify(originalGapsRef.current);
      setHasChanges(currentGapsString !== originalGapsString);
    } else if (!isEditing) {
      setHasChanges(false);
      setExpandedGapId(null);
      setIsEditing(false);
    }
  }, [editableGaps, isEditing]);

  // Reset hasChanges when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setHasChanges(false);
    }
  }, [isEditing]);

  // Handle cell edit
  const handleCellEdit = (id, field, value) => {
    setEditableGaps(gaps => 
      gaps.map(gap => 
        gap.id === id ? { ...gap, [field]: value } : gap
      )
    );
  };
  
  // Add new row
  const handleAddRow = () => {
    const newGap = {
      id: `gap-new-${Date.now()}`,
      priority: 'Low',
    };
    
    setEditableGaps(prev => [...prev, newGap]);
    setHasChanges(true);
    
    // Automatically expand the newly added gap
    setExpandedGapId(newGap.id);
  };
  
  // Delete row
  const handleDeleteRow = (id) => {
    setEditableGaps(gaps => gaps.filter(gap => gap.id !== id));
  };
  
  // Verify changes
  const handleVerify = async () => {

    if (!result || !result.analysis || verifyLoading || isSubmittingRef.current) return;
    // Avoid API calls when there are no changes to save
    if (wasValidated && !hasChanges) {
      toastService.info('No changes to save.');
      return;
    }
    try {

      isSubmittingRef.current = true;
      setVerifyLoading(true);
      
      // Prepare the gaps data without the temporary IDs
      const validatedGaps = editableGaps.map(({ id, ...rest }) => rest);
      
      // Create the request payload
      const payload = { validated_gaps: validatedGaps };

      // Decide endpoint/method: first-time verify (POST /verify) vs saving edits (PATCH /edit)
      if (wasValidated) {
        // Saving edits to previously validated gaps
        await apiService.patch(
          API_URLS.ANALYSIS.COMPREHENSIVE_EDIT(result.id),
          payload
        );
      } else {
        // First time verification
        await apiService.post(
          API_URLS.ANALYSIS.COMPREHENSIVE_VERIFY(result.id),
          payload
        );
      }
      
      // Update the state to reflect the changes are now validated
      if (isMountedRef.current) {
        setWasValidated(true);
        setHasChanges(false);
        originalGapsRef.current = JSON.parse(JSON.stringify(editableGaps));
      }
      
      // Stable toast id so it shows only once even if re-triggered

        toastService.success(
          wasValidated
            ? 'Gap details have been successfully saved.'
            : 'Gap details have been successfully verified and saved.',
          {
            toastId: "gap-verify-success",
            position: "top-right",
            autoClose: 2000,
          }
        );

      // Reset editingGapId and isEditing state
      if (isMountedRef.current) {
        setExpandedGapId(null);
        setIsEditing(false);
      }
     
      
      // Update the local analysisResults to reflect the saved changes immediately
      // This ensures the sidebar shows the updated data without needing to close/reopen
      if (analysisResults) {
        const updatedAnalysisResults = {
          ...analysisResults,
          metadata: {
            ...analysisResults.metadata,
            changed_gap_detail: validatedGaps
          }
        };
        
        // If there's a way to update the parent's analysisResults, we could call a callback here
        // For now, the silent update should handle this
      }
      
    } catch (error) {
      console.error('Error verifying gap details:', error);
      
      let errorMessage = 'Failed to verify gap details. Please try again.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      
      const errorToastId = `gap-error-${Date.now()}`;
      toastService.error(errorMessage, {
        toastId: errorToastId,
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      isSubmittingRef.current = false;
      setVerifyLoading(false);
      onRefreshData(true)
    }
  };

  // Add this useEffect after your other useEffects
  useEffect(() => {
    if (isEditing) {
      // Function to adjust textarea height
      const adjustTextareaHeight = () => {
        const textareas = document.querySelectorAll('.auto-resize-textarea');
        textareas.forEach(textarea => {
          textarea.style.height = 'auto';
          textarea.style.height = textarea.scrollHeight + 'px';
        });
      };
      
      // Adjust heights initially
      adjustTextareaHeight();
      
      // Add event listeners to all textareas
      const textareas = document.querySelectorAll('.auto-resize-textarea');
      textareas.forEach(textarea => {
        textarea.addEventListener('input', adjustTextareaHeight);
      });
      
      // Clean up event listeners
      return () => {
        textareas.forEach(textarea => {
          textarea.removeEventListener('input', adjustTextareaHeight);
        });
      };
    }
  }, [isEditing, editableGaps, expandedGapId]); // Re-run when editing mode, gaps, or expanded state changes

  // Update the toggle function to implement accordion behavior
  const toggleGapExpansion = (gapId) => {
    setExpandedGapId(expandedGapId === gapId ? null : gapId);
  };

  // Update the renderGaps function to use arrow icons
  const renderGaps = () => {
    if (!editableGaps || editableGaps.length === 0) {
      return <p className="no-gaps">No gaps identified for this SOP.</p>;
    }

    // Helper function to truncate text for preview
    const truncateText = (text, maxLength = 60) => {
      if (!text) return 'No critique provided';
      return text.length > maxLength 
        ? text.substring(0, maxLength) + '...' 
        : text;
    };

    return (
      <div className="gaps-paragraph-container">
        {editableGaps.map((gap, index) => (
          <div key={gap.id} className="gap-paragraph-item">
            <div 
              className="gap-paragraph-header"
              onClick={() => toggleGapExpansion(gap.id)}
            >
              <div className="gap-header-left">
                <span className="gap-expand-icon">
                  {expandedGapId === gap.id ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <h4>Gap #{index + 1}</h4>
              </div>
              
              <div className="gap-header-preview">
                <span className="gap-critique-label">Critique - </span>
                <span className="gap-critique-preview">
                  {truncateText(gap.critique)}
                </span>
              </div>
              
              <div className={`gap-severity ${(gap.priority || 'MEDIUM').toLowerCase()}`}>
                {gap.priority}
              </div>
            </div>
            
            {expandedGapId === gap.id && (
              <div className="gap-paragraph-content">
                {/* Critique */}
                <div className="gap-field">
                  <h5 className="gap-field-label">Critique:</h5>
                  {isEditing ? (
                    <textarea
                      className="auto-resize-textarea"
                      value={gap.critique || ''}
                      onChange={(e) => handleCellEdit(gap.id, 'critique', e.target.value)}
                      placeholder="Enter critique"
                    />
                  ) : (
                    <p className="gap-field-value">{gap.critique || 'No critique provided'}</p>
                  )}
                </div>
                
                {/* Missing Step - Add this new field */}
                <div className="gap-field">
                  <h5 className="gap-field-label">Suggestions:</h5>
                  {isEditing ? (
                    <textarea
                      className="auto-resize-textarea"
                      value={gap.missing_step || ''}
                      onChange={(e) => handleCellEdit(gap.id, 'missing_step', e.target.value)}
                      placeholder="Enter missing step"
                    />
                  ) : (
                    <p className="gap-field-value">{gap.missing_step || 'No missing step provided'}</p>
                  )}
                </div>
                
                {/* Guidelines Reference */}
                <div className="gap-field">
                  <h5 className="gap-field-label">Guidelines Reference:</h5>
                  {isEditing ? (
                    <textarea
                      className="auto-resize-textarea"
                      value={gap.guidelines_reference || ''}
                      onChange={(e) => handleCellEdit(gap.id, 'guidelines_reference', e.target.value)}
                      placeholder="Enter guidelines reference"
                    />
                  ) : (
                    <p className="gap-field-value">{gap.guidelines_reference || 'No guidelines reference provided'}</p>
                  )}
                </div>
                
                {/* SOP Reference - Add this field */}
                <div className="gap-field">
                  <h5 className="gap-field-label">SOP Reference:</h5>
                  {isEditing ? (
                    <textarea
                      className="auto-resize-textarea"
                      value={gap.sop_reference || ''}
                      onChange={(e) => handleCellEdit(gap.id, 'sop_reference', e.target.value)}
                      placeholder="Enter SOP reference"
                    />
                  ) : (
                    <p className="gap-field-value">{gap.sop_reference || 'No SOP reference provided'}</p>
                  )}
                </div>

                {/* Mentioned SOPs - Show if gap is addressed by secondary SOPs */}
                {gap.mentioned_sops && gap.mentioned_sops.length > 0 && (
                  <div className="gap-field mentioned-sops-field">
                    <h5 className="gap-field-label">
                      <span className="verified-badge">
                        Gap Addressed by Secondary SOPs: 
                      </span>
                    </h5>
                    <div className="mentioned-sops-content">
                      <p className="gap-field-value">
                      <strong>SOP Names:</strong>{" "}
                        {gap.mentioned_sop_titles
                          ? gap.mentioned_sop_titles.join(", ")
                          : gap.mentioned_sops.join(", ")}
                      </p>
                      {gap.verification_explanation && (
                        <p className="gap-field-value verification-explanation">
                          <strong>Explanation:</strong>{" "}
                          {gap.verification_explanation}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Priority/Severity selector if editing */}
                {isEditing && (
                  <div className="gap-field">
                    <h5 className="gap-field-label">Severity:</h5>
                    <select
                      className="severity-select"
                      value={gap.priority}
                      onChange={(e) => handleCellEdit(gap.id, 'priority', e.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                )}
                
                {/* Action buttons for editing mode */}
                {isEditing && (
                  <div className="gap-paragraph-actions">
                    <button 
                      className="delete-row-btn" 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent triggering the header click
                        handleDeleteRow(gap.id);
                      }}
                      title="Delete this gap"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                      </svg>
                      Delete Gap
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        
        {isEditing && (
          <button className="add-gap-btn" onClick={handleAddRow}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Gap
          </button>
        )}
      </div>
    );
  };

  // Return null if not open, but only after all hooks have been called
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="gap-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <h2>Gaps & Suggestions</h2>
          <div className="header-actions">
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>

        {loading ? (
          <div className="sidebar-loading">
            <LoadingSpinner size="large" />
            <span className="loading-text">Loading analysis results...</span>
          </div>
        ) : error ? (
          <div className="sidebar-error">{error}</div>
        ) : (!result || !result.analysis) ? (
          <div className="sidebar-no-data">No analysis results available.</div>
        ) : (
          <>
            <div className="sidebar-content">
              <div className='parent-info'>
              <section className="info-section">
                <div className="info-row">
                  <label>Assessment Title</label>
                  <span>{sanitizeText(gapDetails?.title) || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <label>Primary SOP Name</label>
                  <span>{sanitizeText(gapDetails?.sopName) || 'N/A'}</span>
                </div>
                {gapDetails?.secondarySops && gapDetails.secondarySops.length > 0 && 
                <div className="info-row" style={{width: 'auto'}}>
                  <label>Secondary SOPs Names</label>
                  <ul className="regulations-container">
                    {gapDetails.secondarySops.map((sop, key) => (
                        <li className="regulations-name" key={key}>
                          <span>{sanitizeText(sop.title)}</span>  
                        </li>
                      ))}
                  </ul>
                </div>
                }
                {gapDetails?.department && 
                <div className="info-row">
                  <label>Department</label>
                  <span>{sanitizeText(gapDetails?.department) || 'N/A'}</span>
                </div>
                }

                <div className="info-row">
                  <label>Compliance Score</label>
                  <span className="compliance-score">
                    {result && result.analysis && result.analysis.compliance_score !== undefined ? 
                      `${result.analysis.compliance_score}%` : 'N/A'}
                  </span>
                </div>

                <div className="info-row">
                  <label>{!wasValidated ? 'Analyzed on' : 'Updated on'}</label>
                  <span>
                    {result && result.analysis && (result.analysis.analyzed_at || result.analysis.updated_at) ? 
                      formatDate(result.analysis.updated_at !== result.analysis.analyzed_at ? 
                        result.analysis.updated_at : result.analysis.analyzed_at) : 
                      'N/A'
                    }
                  </span>
                </div>

              </section>

              <section className="info-section">
                <div className="info-row" style={{width: 'auto'}}>
                  <label>Regulation</label>
                  <ul className="regulations-container">
                    {result && result.analysis && result.analysis.regulations && result.analysis.regulations.length > 0 ? 
                      result.analysis.regulations.map((regu, key) => (
                        <li className="regulations-name" key={key}>
                          <span>{sanitizeText(regu?.name || regu?.regulation_name || regu)}</span>  
                        </li>
                      )) : 
                      <span>N/A</span>
                    }
                  </ul>
                </div>
              </section>
              </div>
              <section className="gaps-section">
                <div className="section-header">
                  <h3>Identified Gaps</h3>
                  <div className="section-actions">
                    {isEditing && (
                      <button className="add-row-btn" onClick={handleAddRow}>
                        + Add Gap
                      </button>
                    )}
                    {!loading && result && result.analysis && (
                      <button 
                        className={`edit-button ${isEditing ? 'active' : ''}`} 
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? 'Cancel Editing' : 'Edit Gaps'}
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="gaps-container">
                  {renderGaps()}
                </div>
              </section>
            </div>

            <div className="sidebar-footer">
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button 
                className={`verify-btn ${wasValidated ? (hasChanges ? '' : 'disabled') : 'verify-btn-orange'}`} 
                onClick={handleVerify}
                disabled={verifyLoading || (wasValidated && !hasChanges)}
              >
                {verifyLoading ? (
                  <>
                    <LoadingSpinner size="small" />
                    <span>{wasValidated ? 'Saving...' : 'Verifying...'}</span>
                  </>
                ) : (
                  wasValidated ? 'Save Changes' : 'Verify Changes'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GapDetailsSidebar; 