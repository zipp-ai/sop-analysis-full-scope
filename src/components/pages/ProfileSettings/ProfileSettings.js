import React, { useState, useEffect, useMemo } from 'react';
import userService from '../../../services/userService';
import Navigation from '../../common/Navigation/Navigation';
import './ProfileSettings.css';
import apiService from '../../../services/api';
import toastService from '../../../services/toastService';
import API_URLS from '../../../config/apiUrls';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import { sanitizeText } from '../../../utils/sanitize';
import supabase from '../../../supabase';
import Modal from '../../common/Modal/Modal';
import AddRegulation from './AddRegulation';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';

const ProfileSettings = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    department: '',
    designation: '',
    organizationName: '',
    industry: '',
    subIndustry: '',
    standards: ''
  });
  const [error, setError] = useState(null);
  const [regulations, setRegulations] = useState([]);
  const [completeProfileData, setCompleteProfileData] = useState(null);
  const [selectedRegulations, setSelectedRegulations] = useState([]);
  const [regulationsLoading, setRegulationsLoading] = useState(false);
  const [regulationsError, setRegulationsError] = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [originalRegulations, setOriginalRegulations] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [regulationsDataReady, setRegulationsDataReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasOrgDataChanged, setHasOrgDataChanged] = useState(false);

  // Track individual API loading states
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);
  const [regulationsLoaded, setRegulationsLoaded] = useState(false);
  const [adminStatusLoaded, setAdminStatusLoaded] = useState(false);
  const [showAddRegulationModal, setShowAddRegulationModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null); // Track which regulation is being deleted
  const [saveLoading, setSaveLoading] = useState(false); // Separate loading state for save operation

  // Confirmation modal state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [regulationToDelete, setRegulationToDelete] = useState(null);

  // Helper function to compare arrays
  const arraysEqual = (a, b) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  };

  // // Check if all data have loaded
  const loading = !(userProfileLoaded && regulationsLoaded && adminStatusLoaded);



  // Helper function to refresh regulations
  const refreshRegulations = async () => {
    try {
      const completeProfileData = await userService.getCompleteProfile();

      setRegulations(completeProfileData.all_regulations || []);
      const selectedIds = (completeProfileData.organization_regulations || []).map(reg => reg.regulation_id);
      setSelectedRegulations(selectedIds);
      setOriginalRegulations([...selectedIds]);
    } catch (error) {
      console.error('Error refreshing regulations:', error);
    }
  };

  // Modal handlers
  const handleAddRegulationClick = () => {
    if (!isAdmin) {
      toastService.warning('Only administrators can add regulations.');
      return;
    }
    setShowAddRegulationModal(true);
  };

  const handleAddRegulationSuccess = async () => {
    await refreshRegulations();
    setShowAddRegulationModal(false);
  };

  const handleAddRegulationClose = () => {
    setShowAddRegulationModal(false);
  };

  // Function to show delete confirmation
  const showDeleteConfirmationModal = (regulationId, regulationName) => {
    setRegulationToDelete({ id: regulationId, name: regulationName });
    setShowDeleteConfirmation(true);
  };

  // Function to handle confirmed deletion
  const handleDeleteRegulation = async () => {
    if (!regulationToDelete) return;

    const { id: regulationId, name: regulationName } = regulationToDelete;

    try {
      setDeleteLoading(regulationId);

      // Get the token from supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Make the API call
      const response = await fetch(`${process.env.REACT_APP_API_URL}/regulations/${regulationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete regulation');
      }

      // Refresh regulations list
      await refreshRegulations();

      toastService.success(`Regulation "${regulationName}" deleted successfully!`);

    } catch (err) {
      console.error('Error deleting regulation:', err);

      let errorMessage = 'Failed to delete regulation. Please try again.';
      if (err.message) {
        errorMessage = err.message;
      }

      toastService.error(errorMessage);
    } finally {
      setDeleteLoading(null);
      setShowDeleteConfirmation(false);
      setRegulationToDelete(null);
    }
  };

  // Function to close delete confirmation modal
  const closeDeleteConfirmation = () => {
    setShowDeleteConfirmation(false);
    setRegulationToDelete(null);
  };

  // OPTIMIZED: Single useEffect that fetches all data at once
  useEffect(() => {
    const fetchCompleteProfileData = async () => {
      try {
        setRegulationsLoading(true);
        setRegulationsError(null);
        
        // Single API call to get all profile data - 75% faster than 4 separate calls
        const completeProfileData = await userService.getCompleteProfile();

        // Process user data
        if (completeProfileData.user && completeProfileData.user.length > 0) {
          const user = completeProfileData.user[0];
          const dummyData = {
            department:'',
            standards:'',
            organizationName:'',
            industry:'',
            subIndustry:''
          }
          
          // Create the form data object
          const newFormData = {
            fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
            email: user.email || '',
            department: user.metadata.department || dummyData.department,
            designation: user.org_role || '',
            organizationName: user.organization?.name || dummyData.organizationName,
            industry: user.organization.industry || dummyData.industry,
            subIndustry: user.organization.sub_industry || dummyData.subIndustry,
            standards: dummyData.standards
          };

          // Update form data
          setFormData(newFormData);

          // Store complete profile data
          setCompleteProfileData(completeProfileData);

          // Store original form data for comparison
          setOriginalFormData(JSON.stringify(newFormData));

          // Set all Regulations
          setRegulations(completeProfileData.all_regulations || []);

          // Check admin status from the same data
          setIsAdmin(user.org_role === 'admin');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        
        let errorMessage = 'Failed to load user profile. Please try again later.';
        if (err?.response?.data?.detail) {
          errorMessage = err?.response?.data?.detail;
        }
        
        setError(errorMessage);
      } finally {
        setUserProfileLoaded(true);
        setRegulationsLoaded(true)
        setRegulationsLoading(false);
        setRegulationsDataReady(true)
        setAdminStatusLoaded(true)
      }
    };

    fetchCompleteProfileData();
  }, []);

  useEffect(() => {
    // Check if form data has changed
    const formDataChanged = originalFormData && JSON.stringify(formData) !== originalFormData;
    
    // Check if regulations have changed
    const regulationsChanged = originalRegulations && !arraysEqual(selectedRegulations, originalRegulations);
    
    // Update hasChanges state
    setHasChanges(formDataChanged || regulationsChanged);
  }, [formData, selectedRegulations, originalFormData, originalRegulations]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showAddRegulationModal) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    }

    // Cleanup function to ensure scrolling is re-enabled when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    };
  }, [showAddRegulationModal]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'organizationName' || name === 'industry' || name === 'subIndustry' || name === 'standards') {
      if (!hasOrgDataChanged) {
        setHasOrgDataChanged(true);
      }
    }
  };

  const handleRegulationToggle = (regulationId) => {
    // Only allow admin users to toggle regulations
    if (!isAdmin) return;
    
    setSelectedRegulations(prev => {
      if (prev.includes(regulationId)) {
        return prev.filter(id => id !== regulationId);
      } else {
        return [...prev, regulationId];
      }
    });
  };

  const handleSaveChanges = async () => {
    try {
      setSaveLoading(true);
      
      // Sanitize form data before submission
      const sanitizedFormData = {
        ...formData,
        fullName: sanitizeText(formData.fullName),
        department: sanitizeText(formData.department),
        designation: sanitizeText(formData.designation),
        industry: sanitizeText(formData.industry),
        subIndustry: sanitizeText(formData.subIndustry),
        // Sanitize any other text fields
      };
      
      // Get the current user ID from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('User ID not found');
      }
      
      // Split the full name into first and last name
      const nameParts = sanitizedFormData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Prepare data for API
      const updateData = {
        first_name: firstName,
        last_name: lastName,
      };
      const updateOrgData = {};
      
      // Get the current user data to access existing metadata
      const currentUserData = await userService.getCompleteProfile();
      const currentUser = currentUserData && currentUserData.length > 0 ? currentUserData[0] : null;
      
      // Handle metadata for standards
      if (sanitizedFormData.standards && sanitizedFormData.standards.trim() !== '') {
        // Initialize metadata object if it doesn't exist
        if (!updateData.metadata) {
          updateData.metadata = {};
        }
        
        // Get existing user_recommended_compliances as an array or initialize as empty array
        let existingCompliances = [];
        
        if (currentUser && 
            currentUser.metadata && 
            currentUser.metadata.user_recommended_compliances) {
          // If it's already an array, use it
          if (Array.isArray(currentUser.metadata.user_recommended_compliances)) {
            existingCompliances = currentUser.metadata.user_recommended_compliances;
          } 
          // If it's a string, convert to array with one item
          else if (typeof currentUser.metadata.user_recommended_compliances === 'string') {
            existingCompliances = [currentUser.metadata.user_recommended_compliances];
          }
        }
        
        // Add the new compliance if it's not already in the array
        if (!existingCompliances.includes(sanitizedFormData.standards.trim())) {
          existingCompliances.push(sanitizedFormData.standards.trim());
        }
        
        // Update the metadata with the combined array
        updateData.metadata.user_recommended_compliances = existingCompliances;
      }

      // Handle metadata for department, industry, and sub-industry
      updateData.metadata = {
        ...currentUser?.metadata,
        department: sanitizedFormData.department,
      };

      const response = await userService.updateUserProfile(updateData, userId);

      if (hasOrgDataChanged && completeProfileData?.user[0]?.organization?.id) {
        updateOrgData.industry = sanitizedFormData.industry;
        updateOrgData.sub_industry = sanitizedFormData.subIndustry;
        updateOrgData.metadata = {...completeProfileData?.user[0]?.organization?.metadata};

        if (sanitizedFormData.standards) {
          const standardsArray = sanitizedFormData.standards.split(',').map(s => s.trim()).filter(s => s !== '');

          if ("applicableStandards" in completeProfileData.user[0].organization.metadata) {
            updateOrgData.metadata.applicableStandards = [...completeProfileData.user[0].organization.metadata.applicableStandards, ...standardsArray];
          } else {
            updateOrgData.metadata.applicableStandards = standardsArray;
          }
        }

        try {
          await userService.updateOrganizationMetadata(completeProfileData.user[0].organization.id, updateOrgData)
  
        } catch (error) {
          toastService.error('Failed to update organization metadata.');
        }
      }

      // Handle regulation changes
      const regulationsToAdd = selectedRegulations.filter(id => !originalRegulations.includes(id));
      const regulationsToRemove = originalRegulations.filter(id => !selectedRegulations.includes(id));
      
      // Process regulation additions
      for (const regulationId of regulationsToAdd) {
        await apiService.post(API_URLS.REGULATIONS.ORGANIZATION + `/${regulationId}`);
      }
      
      // Process regulation removals
      for (const regulationId of regulationsToRemove) {
        await apiService.delete(API_URLS.REGULATIONS.ORGANIZATION + `/${regulationId}`);
      }
      
      
      // Show success message with more details
      toastService.success('Profile updated successfully!');
      
      // Update the original form data and regulations to reflect the saved state
      setOriginalFormData(JSON.stringify(sanitizedFormData));
      setOriginalRegulations([...selectedRegulations]);
      
      // Clear the standards input after successful update
      setFormData(prev => ({
        ...prev,
        standards: ''
      }));
      
    } catch (err) {
      console.error('Error updating profile:', err);
      
      let errorMessage = 'Failed to update profile. Please try again.';
      if (err?.response?.data?.detail) {
        errorMessage = err?.response?.data?.detail;
      }
      
      setError(errorMessage);
      
      // Show detailed error message
      toastService.error(`Failed to update profile: ${errorMessage}`);
    } finally {
      setSaveLoading(false);
    }
  };

  // Show loading screen until all APIs have completed
  if (loading) {
    return (
      <>
        <Navigation />
        <div className="profile-settings">
          <div className="loading-container">
            <LoadingSpinner size="large" />
            <span className="loading-text">Loading Profile...</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="profile-settings">
        {error && <div className="error-message">{error}</div>}

        <section className="settings-section">
          <h1>User Profile Settings</h1>
          <h2>Basic Information</h2>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="fullName"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter user's email address"
              value={formData.email}
              onChange={handleInputChange}
              disabled
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Department</label>
              <input
                type="text"
                name="department"
                placeholder="Select department"
                value={formData.department}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Designation/Role</label>
              <input
                type="text"
                name="designation"
                placeholder="Enter user's role"
                value={formData.designation}
                onChange={handleInputChange}
                disabled
              />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>Organization Details</h2>
          <div className="form-group">
            <label>Organization Name</label>
            <input
              type="text"
              name="organizationName"
              placeholder="Enter organization name"
              value={formData.organizationName}
              onChange={handleInputChange}
              disabled
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Industry</label>
              <input
                type="text"
                name="industry"
                placeholder="Enter industry"
                value={formData.industry}
                onChange={handleInputChange}
                disabled = {!isAdmin}
              />
            </div>
            <div className="form-group">
              <label>Sub-Industry</label>
              <input
                type="text"
                name="subIndustry"
                placeholder="Enter sub-industry"
                value={formData.subIndustry}
                onChange={handleInputChange}
                disabled = {!isAdmin}
              />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="section-header">
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <h3 className="regulations-heading">
              Regulations List
              {!isAdmin && <span className="admin-only-badge">Admin only</span>}
            </h3>
            {regulationsLoading && <LoadingSpinner size="small" />}
            </div>
            <div>
              <button className="btn-save" onClick={handleAddRegulationClick}>
                Add Regulation
              </button>
            </div>
          </div>
          
          {!isAdmin && (
            <div className="admin-notice">
              <p>Only administrators can modify organization regulations. Contact your administrator for changes.</p>
            </div>
          )}
          
          {regulationsError ? (
            <div className="error-message">{regulationsError}</div>
          ) : !regulationsDataReady ? (
            <div className="loading-message">Loading regulations data...</div>
          ) : (
            <div className="regulations-list">
              {regulations.length === 0 ? (
                <p>No regulations available.</p>
              ) : (
                regulations.map(regulation => (
                  <div
                    key={regulation.id}
                    className={`regulation-item ${!isAdmin ? 'disabled-regulation' : ''}`}
                  >
                    <label className={`checkbox-container ${!isAdmin ? 'disabled-checkbox' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedRegulations.includes(regulation.id)}
                        onChange={() => handleRegulationToggle(regulation.id)}
                        disabled={!isAdmin}
                      />
                      <span className={`checkmark ${!isAdmin ? 'disabled' : ''}`}></span>
                      <span className="regulation-name">{regulation.name}</span>

                      {/* Delete button right after regulation name */}
                      
                    </label>
                    {isAdmin && regulation.organization_id && (
                        <button
                          className="delete-icon-link"
                          onClick={(e) => {
                            e.preventDefault(); // Prevent label click
                            showDeleteConfirmationModal(regulation.id, regulation.name);
                          }}
                          disabled={deleteLoading === regulation.id}
                          title={`Delete "${regulation.name}"`}
                        >
                          {deleteLoading === regulation.id ? (
                            <LoadingSpinner size="small" />
                          ) : (
                            <svg className="delete-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M3 6H5H21"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M10 11V17"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M14 11V17"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        <section className="settings-section">
          <h2>Recommend Compliances To Be Added</h2>
          <div className="form-group">
            {/* <label>GXP Compliance Standards</label> */}
            <input
              type="text"
              name="standards"
              placeholder="Add applicable standards"
              value={formData.standards}
              onChange={handleInputChange}
            />
          </div>
       
          <div className="form-actions">
            <button 
              className="btn-cancel"
              onClick={() => window.history.back()}
              disabled={saveLoading}
            >
              Cancel
            </button>
            <button 
              className="btn-save" 
              onClick={handleSaveChanges}
              disabled={saveLoading || !hasChanges}
            >
              {saveLoading ? (
                <span className="button-loading">
                  <LoadingSpinner size="small" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </section>

        
      </div>
      
      <Modal
        isOpen={showAddRegulationModal}
        onClose={handleAddRegulationClose}
        closeOnOutsideClick={true}
      >
        <AddRegulation 
          onClose={handleAddRegulationClose}
          onSuccess={handleAddRegulationSuccess}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={closeDeleteConfirmation}
        onConfirm={handleDeleteRegulation}
        title="Delete Regulation"
        message={`Are you sure you want to delete "${regulationToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteLoading === regulationToDelete?.id}
      />
    </>
  );
};

export default ProfileSettings; 