import React, { useState, useEffect, useRef } from 'react';
import sopService from '../../../services/sopService';
import regulationService from '../../../services/regulationService';
import departmentService from '../../../services/departmentService';
import apiService from '../../../services/api';
import API_URLS from '../../../config/apiUrls';
import toastService from '../../../services/toastService';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import RegulationDropdown from '../../common/RegulationDropdown';
import SOPDropdown from '../../common/SOPDropdown';
import './AssessmentForm.css';
import { sanitizeText } from '../../../utils/sanitize';

const AssessmentForm = ({results, onClose, onSubmit, onSuccess, onProcessingStart, onError, onHighlightExisting }) => {
  const [sops, setSops] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const departmentDropdownRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    selectedDepartment: null,
    category: '',
    selectedComplianceRequirements: [],
    selectedSOPs: [],
    selectedSecondarySOPs: []
  });
  
  // First, add state variables to track loading state for each dropdown
  const [sopsLoading, setSOPsLoading] = useState(true);
  const [regulationsLoading, setRegulationsLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  
  // Add state for error handling
  const [sopsError, setSopsError] = useState(null);
  const [departmentsError, setDepartmentsError] = useState(null);
  const [regulationsError, setRegulationsError] = useState(null);

    
  // Prevent body scroll when modal is open
  useEffect(() => {
    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Suppress ResizeObserver errors
    const resizeObserverErrorHandler = (e) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
        e.stopImmediatePropagation();
        return false;
      }
    };
    
    window.addEventListener('error', resizeObserverErrorHandler);

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('error', resizeObserverErrorHandler);
    };
  }, []);
  
  // Fetch SOPs, departments, and regulations on component mount
  useEffect(() => {
    const fetchSOPs = async () => {
      try {
        setSOPsLoading(true);
        setSopsError(null);
        const sopData = await sopService.getAllSOPs();
        setSops(sopData.sops_data || []);
      } catch (err) {
        console.error('Error fetching SOPs:', err);
        
        let errorMessage = 'Failed to load SOPs. Please try again later.';
        if (err?.response?.data?.detail) {
          errorMessage = err?.response?.data?.detail;
        }
        
        setSopsError(errorMessage);
      } finally {
        setSOPsLoading(false);
      }
    };
    
    const fetchDepartments = async () => {
      try {
        const departmentData = await departmentService.getAllDepartments();
        setDepartments(departmentData);
      } catch (err) {
        console.error('Error fetching departments:', err);
        
        let errorMessage = 'Failed to load departments. Please try again later.';
        if (err?.response?.data?.detail) {
          errorMessage = err?.response?.data?.detail;
        }
        
        setDepartmentsError(errorMessage);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    
    const fetchRegulations = async () => {
      try {
        setRegulationsLoading(true);
        const regulationData = await regulationService.getOrganizationRegulations();
        let regulationData_details = regulationData.map(regulation => regulation.regulation_details);
        setRegulations(regulationData_details);
      } catch (err) {
        console.error('Error fetching regulations:', err);
        
        let errorMessage = 'Failed to load compliance requirements. Please try again later.';
        if (err?.response?.data?.detail) {
          errorMessage = err?.response?.data?.detail;
        }
        
        setRegulationsError(errorMessage);
      } finally {
        setRegulationsLoading(false);
      }
    };
    
    fetchSOPs();
    fetchDepartments();
    fetchRegulations();
  }, []);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target)) {
        setShowDepartmentDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Handle SOP selection (single select)
  const handleSOPToggle = (sop) => {
    setFormData(prev => {
      const isAlreadySelected = prev.selectedSOPs.some(s => s.id === sop.id);
      
      if (isAlreadySelected) {
        // Remove the SOP if already selected (clear selection)
        return {
          ...prev,
          selectedSOPs: []
        };
      } else {
        // Replace any existing selection with the new SOP (single select)
        // Also remove from secondary SOPs if it was selected there
        return {
          ...prev,
          selectedSOPs: [sop],
          selectedSecondarySOPs: prev.selectedSecondarySOPs.filter(s => s.id !== sop.id)
        };
      }
    });
  };
  
  // Handle secondary SOP selection (multi-select)
  const handleSecondarySOPToggle = (sop) => {
    setFormData(prev => {
      const isAlreadySelected = prev.selectedSecondarySOPs.some(s => s.id === sop.id);
      
      if (isAlreadySelected) {
        // Remove the SOP if already selected
        return {
          ...prev,
          selectedSecondarySOPs: prev.selectedSecondarySOPs.filter(s => s.id !== sop.id)
        };
      } else {
        // Add the SOP if not already selected
        return {
          ...prev,
          selectedSecondarySOPs: [...prev.selectedSecondarySOPs, sop]
        };
      }
    });
  };
  
  // Handle department selection
  const selectDepartment = (department) => {
    setFormData({
      ...formData,
      selectedDepartment: department
    });
    setShowDepartmentDropdown(false);
  };
  
  // Handle regulation selection (toggle)
  const handleRegulationToggle = (regulation) => {
    setFormData(prev => {
      const isAlreadySelected = prev.selectedComplianceRequirements.some(r => r.id === regulation.id);
      
      if (isAlreadySelected) {
        // Remove the regulation if already selected
        return {
          ...prev,
          selectedComplianceRequirements: prev.selectedComplianceRequirements.filter(r => r.id !== regulation.id)
        };
      } else {
        // Add the regulation if not already selected
        return {
          ...prev,
          selectedComplianceRequirements: [...prev.selectedComplianceRequirements, regulation]
        };
      }
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Add validation logic to check if form is complete
  const isFormValid = () => {
    return (
      formData.selectedSOPs && 
      formData.selectedSOPs.length > 0 && // At least one SOP must be selected
      formData.selectedComplianceRequirements && 
      formData.selectedComplianceRequirements.length > 0 // At least one compliance requirement must be selected
    );
  };
  
  // Filter regulations based on search term
  // const filteredRegulations = regulations.filter(regulation => 
  //   regulation.name.toLowerCase().includes(searchTerm.toLowerCase())
  // );

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (loading) {
      return;
    }
    
    
    // Validate form
    if (!formData.selectedSOPs || formData.selectedSOPs.length === 0) {
      toastService.error('Please select a SOP for assessment');
      return;
    }
    
    if (!formData.selectedComplianceRequirements || formData.selectedComplianceRequirements.length === 0) {
      toastService.error('Please select at least one compliance requirement');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      toastService.info('Assessment creation started...');
      // Sanitize form data before submission
      const sanitizedFormData = {
        ...formData,
        title: sanitizeText(formData.title),
        department: sanitizeText(formData.selectedDepartment?.name),
        description: sanitizeText(formData.description),
        // Sanitize any other text fields
      };
      
      // Prepare the title, SOP IDs, and regulation IDs
      const sopTitles = sanitizedFormData.selectedSOPs.map(sop => sop.title || 'Unnamed SOP').join(', ');
      const assessmentTitle = sanitizedFormData.title || `Assessment for ${sopTitles}`;
      const sopIds = sanitizedFormData.selectedSOPs.map(sop => sop.id);
      const regulationIds = sanitizedFormData.selectedComplianceRequirements.map(req => req.id);
      
      // Call the processing start handler to close modal and show processing state
      if (typeof onProcessingStart === 'function') {
        onProcessingStart(sopIds);
      }

      const secondarySopIds = sanitizedFormData.selectedSecondarySOPs.map(sop => sop.id);
      
      const requestBody = {
        sop_id: sopIds,
        regulation_ids: regulationIds,
        ...(secondarySopIds.length > 0 && { secondary_sop_ids: secondarySopIds })
      };
      setTimeout(()=>{
        onSuccess();
      },2000)
      



      const response = await apiService.post(
        API_URLS.ANALYSIS.COMPREHENSIVE_ANALYZE(assessmentTitle),
        requestBody
      );

      if (response?.message && response.message.includes("Analysis retrieved from existing analysis")) {
        let matchedTitle = null;

        if (
          results
        ) {


          for (const item of results) {
            const itemSopIds = Array.isArray(item.sop_id) ? item.sop_id.map(String) : typeof item.sop_id === 'string' ? [item.sop_id] : [];
            const itemRegIds = Array.isArray(item.regulation_ids) ? item.regulation_ids.map(String) : typeof item.regulation_ids === 'string' ? [item.regulation_ids] : [];

            const matchSop =
              sopIds.length === itemSopIds.length &&
              sopIds.every(id => itemSopIds.includes(String(id)));
            const matchReg =
              regulationIds.length === itemRegIds.length &&
              regulationIds.every(id => itemRegIds.includes(String(id)));

            if (matchSop && matchReg) {
              matchedTitle = item.title || null;
              break;
            }
          }

          if (matchedTitle) {
            toastService.info(
              `Assessment already exists: "${matchedTitle}"`
            );
          } else if (results[0] && results[0].title) {
            // fallback: just show the first one's title if available
            toastService.info(
              `Assessment already exists, for title: "${results[0].title}"`
            );
            matchedTitle = results[0].title;
          } else {
            toastService.info(
              `Assessment already exists.`
            );
          }
        }

        if (matchedTitle || onHighlightExisting) {
          onHighlightExisting(matchedTitle);
          } else {
            onClose();
            }
        return;
      }

      const successMessage = 'Assessment Created Successfully';
      toastService.success(successMessage);

          onSuccess();
      
    } catch (err) {
      console.error('Error creating assessment:', err);
      
      let errorMessage = 'Failed to create assessment. Please try again later.';
      if (err?.response?.data?.detail) {
        errorMessage = err?.response?.data?.detail;
      }
      
      setError(errorMessage);
      
      
      toastService.error(errorMessage);
      
      if (typeof onError === 'function') {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="assessment-form">
      <h2>Create Gap Assessment</h2>
      <form onSubmit={handleSubmit}>
       <div className="form-group">
          <label htmlFor="title">
            Assessment Title <span style={{ color: 'red' }}>*</span>
          </label>
          <input 
            type="text" 
            id="title" 
            name="title" 
            value={formData.title} 
            onChange={handleInputChange} 
            placeholder="Enter assessment title"
            required
          />
        </div>
 
        
        {/* <div className="form-row"> */}
          <div className="form-group">
            <label>Select  Primary SOP for assessment</label>
            <SOPDropdown
              sops={sops}
              selectedSOPs={formData.selectedSOPs}
              onSOPToggle={handleSOPToggle}
              loading={sopsLoading}
              error={sopsError}
              placeholder="Select SOP for assessment"
              searchPlaceholder="Search SOPs..."
              singleSelect={true}
            />
          </div>
          
          <div className="form-group">
            <label>Select Secondary SOPs for Assessment (Optional)</label>
            <SOPDropdown
              sops={sops.filter(sop => !formData.selectedSOPs.some(s => s.id === sop.id))}
              selectedSOPs={formData.selectedSecondarySOPs}
              onSOPToggle={handleSecondarySOPToggle}
              loading={sopsLoading}
              error={sopsError}
              placeholder="Select secondary SOPs for assessment"
              searchPlaceholder="Search SOPs..."
              singleSelect={false}
            />
          </div>
          
         
        <div className="form-group">
          <label>Compliance Requirements</label>
          <RegulationDropdown
            regulations={regulations}
            selectedRegulations={formData.selectedComplianceRequirements}
            onRegulationToggle={handleRegulationToggle}
            loading={regulationsLoading}
            error={regulationsError}
            placeholder="Select compliance requirements"
            searchPlaceholder="Search compliance..."
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="assessment-form-actions">
          <button 
            type="button" 
            className="btn-cancel" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className={`create-assessment-btn ${loading ? 'creating' : ''} ${!isFormValid() ? 'disabled' : ''}`}
            disabled={loading || !isFormValid()}
            title={!isFormValid() ? 'Please select a SOP and at least one compliance requirement' : ''}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                <span>Creating...</span>
              </>
            ) : 'Create Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssessmentForm; 