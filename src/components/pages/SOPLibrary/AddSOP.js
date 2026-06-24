import React, { useState, useRef, useEffect } from 'react';
import sopService from '../../../services/sopService';
import departmentService from '../../../services/departmentService';
import regulationService from '../../../services/regulationService';
import toastService from '../../../services/toastService';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import './AddSOP.css';
import { useNavigate } from 'react-router-dom';
import { FaFilePdf, FaFileWord, FaFile } from 'react-icons/fa';
import { DummyDepartments } from '../../../constants/constants';
import { sanitizeText } from '../../../utils/sanitize';

const AddSOP = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    selectedDepartment: null,
    description: '',
    file: null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Department state
  const [departments, setDepartments] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [departmentLoading, setDepartmentLoading] = useState(true);
  const [departmentError, setDepartmentError] = useState('');
  const [departmentSearchTerm, setDepartmentSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  
  // Compliance standards state
  const [selectedComplianceStandards, setSelectedComplianceStandards] = useState([]);
  const [regulations, setRegulations] = useState([]);
  const [showRegulationDropdown, setShowRegulationDropdown] = useState(false);
  const [regulationSearchTerm, setRegulationSearchTerm] = useState('');
  const [filteredRegulations, setFilteredRegulations] = useState([]);
  const [regulationLoading, setRegulationLoading] = useState(false);
  const [regulationError, setRegulationError] = useState(null);
  
  const fileInputRef = useRef(null);
  const departmentDropdownRef = useRef(null);
  const regulationDropdownRef = useRef(null);

  // Ref for the modal content
  const modalRef = useRef(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Fetch Departments and Regulations on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      console.log('fetching departments');
      try {
        setDepartmentLoading(true);
        setDepartmentError('');
        
        // const response = await departmentService.getAllDepartments();
        const response = DummyDepartments;
        // Make sure departments is an array
        let departmentArray = [];
        
        // if (response && response.departments) {
          if (response) {
          // If response.departments is an array, use it
          if (Array.isArray(response.departments)) {
            // Filter out "All" option and map to objects with id and name
            departmentArray = response.departments
              .filter(dept => dept !== 'All')
              .map((dept, index) => ({
                id: index.toString(),
                name: dept
              }));
          }
        }
        
        
        
        // Set departments regardless of array length
        setDepartments(departmentArray);
        
      } catch (error) {
        console.error('Error fetching departments:', error);
        setDepartmentError('Failed to load departments');
      } finally {
        // Ensure loading state is set to false
        setDepartmentLoading(false);
      }
    };

    fetchDepartments();

    // const fetchRegulations = async () => {
    //   try {
    //     setRegulationLoading(true);
    //     const regulationData = await regulationService.getOrganizationRegulations();
    //     setRegulations(regulationData);
    //     setFilteredRegulations(regulationData);
    //   } catch (err) {
    //     console.error('Error fetching regulations:', err);
    //     setRegulationError('Failed to load compliance standards. Please try again later.');
    //   } finally {
    //     setRegulationLoading(false);
    //   }
    // };

   
    // fetchRegulations();
  }, []);

  // Filter Departments and Regulations based on search term
  useEffect(() => {
    if (departmentSearchTerm.trim() === '') {
      setFilteredDepartments(departments);
    } else {
      const filtered = departments.filter(department => 
        department.name.toLowerCase().includes(departmentSearchTerm.toLowerCase())
      );
      setFilteredDepartments(filtered);
    }
  }, [departmentSearchTerm, departments]);

  useEffect(() => {
    if (regulationSearchTerm.trim() === '') {
      setFilteredRegulations(regulations);
    } else {
      const filtered = regulations.filter(regulation => 
        regulation.name.toLowerCase().includes(regulationSearchTerm.toLowerCase())
      );
      setFilteredRegulations(filtered);
    }
  }, [regulations, regulationSearchTerm]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedOutside = departmentDropdownRef.current && !departmentDropdownRef.current.contains(event.target);
      if (clickedOutside) {
        setShowDepartmentDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Update the debug useEffect to not override our departments data
  useEffect(() => {
   
    
    // Ensure selectedDepartment is null by default
    if (formData.selectedDepartment === undefined) {
      setFormData(prev => ({
        ...prev,
        selectedDepartment: null
      }));
    }
  }, [departments]);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showDepartmentDropdown) {
        setShowDepartmentDropdown(false);
        setDepartmentSearchTerm('');
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDepartmentDropdown]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDepartmentSearch = (e) => {
    setDepartmentSearchTerm(e.target.value);
  };

  const selectDepartment = (department) => {
    setFormData({
      ...formData,
      selectedDepartment: department
    });
    setShowDepartmentDropdown(false);
  };

  const toggleDepartmentDropdown = () => {
    setShowDepartmentDropdown(!showDepartmentDropdown);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      
      // Create a preview URL for the file
      if (file.type === 'application/pdf') {
        // For PDF files, we can use the URL directly
        const fileUrl = URL.createObjectURL(file);
        setPreviewUrl(fileUrl);
      } else {
        // For other file types, we'll just show an icon
        setPreviewUrl(null);
      }
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const getFileIcon = (file) => {
    if (!file) return <FaFile size={48} />;
    
    const fileType = file.type;
    
    if (fileType === 'application/pdf') {
      return <FaFilePdf size={48} color="#e74c3c" />;
    } else if (fileType.includes('word') || file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      return <FaFileWord size={48} color="#2b579a" />;
    } else {
      return <FaFile size={48} color="#95a5a6" />;
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      
      // Auto-fill title with filename if title is empty
      if (!formData.title) {
        setFormData(prev => ({
          ...prev,
          title: file.name.split('.')[0] // Remove file extension
        }));
      }
      
      // Create preview URL for the file
      if (file.type === 'application/pdf') {
        // For PDF files, we can use the URL directly
        const fileUrl = URL.createObjectURL(file);
        setPreviewUrl(fileUrl);
      } else {
        // For other file types, we'll just show an icon
        setPreviewUrl(null);
      }
    }
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input reference is null");
      // Fallback method if ref is null
      const input = document.getElementById('sop-file');
      if (input) {
        input.click();
      } else {
        toastService.error("Couldn't access file input. Please try again.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.title.trim()) {
      setError('Please enter a title for the SOP');
      return;
    }
    
    if (!formData.selectedDepartment) {
      setError('Please select a category');
      return;
    }
    
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Sanitize the form data before submission
      const sanitizedTitle = sanitizeText(formData.title);
      const sanitizedDepartment = sanitizeText(formData.selectedDepartment.name);
      
      // Create form data for file upload
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      
      // Only add these fields if they have values
      if (sanitizedTitle) {
        uploadData.append('title', sanitizedTitle);
      }
      
      if (sanitizedDepartment) {
        uploadData.append('department', sanitizedDepartment);
      }
      
      if (formData.description) {
        uploadData.append('description', formData.description);
      }
      
      // Add selected compliance standards
      if (selectedComplianceStandards.length > 0) {
        const standardIds = selectedComplianceStandards.map(standard => standard.id);
        uploadData.append('compliance_standards', JSON.stringify(standardIds));
      }
      
      // Make the API call
      const response = await sopService.uploadSOP(uploadData);
    
      toastService.success('SOP uploaded successfully!');
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Close the form
      onClose();
    } catch (err) {
      console.error('Error uploading SOP:', err);
      
      let errorMessage = 'Failed to upload SOP. Please try again.';
      
      // Check if the error is related to file format
      if (err?.response?.data?.detail) {
        errorMessage = err?.response?.data?.detail;
      }
      
      setError(errorMessage);
      
      toastService.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Clean up preview URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle regulation selection (toggle selection)


  // Handle regulation search


  return (
    <div className="add-sop-container">
      <div className="add-sop-modal" ref={modalRef}>
        <h2>Upload SOP Document</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit} className="add-sop-form">
          <div className="form-group">
            <label htmlFor="title">SOP Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter SOP title"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="department">Category</label>
            <div className="department-dropdown-container" ref={departmentDropdownRef}>
              <div 
                className="department-selected-display"
                onClick={() => !departmentLoading && setShowDepartmentDropdown(!showDepartmentDropdown)}
              >
                {departmentLoading ? (
                  <div className="dropdown-loading">
                    <LoadingSpinner size="small" />
                    <span>Loading categories...</span>
                  </div>
                ) : formData.selectedDepartment ? (
                  <span className="selected-value">{formData.selectedDepartment.name}</span>
                ) : (
                  <span className="placeholder">Select a category</span>
                )}
                <span className="dropdown-arrow">▼</span>
              </div>
              
              {showDepartmentDropdown && !departmentLoading && (
                  <div className="department-dropdown">
                    <div className="department-search">
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={departmentSearchTerm}
                        onChange={(e) => setDepartmentSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    <div className="department-options">
                      {Array.isArray(departments) && departments.length > 0 ? (
                        departments
                          .filter(dept => 
                            dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase())
                          )
                          .map((dept) => (
                            <div 
                              key={dept.id} 
                              className={`department-option ${formData.selectedDepartment?.id === dept.id ? 'selected' : ''}`}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  selectedDepartment: dept
                                });
                                setShowDepartmentDropdown(false);
                                setDepartmentSearchTerm('');
                              }}
                            >
                              {dept.name}
                            </div>
                          ))
                      ) : (
                        <div className="no-results">No departments available</div>
                      )}
                      
                      {Array.isArray(departments) && departments.length > 0 && 
                        departments.filter(dept => 
                          dept.name.toLowerCase().includes(departmentSearchTerm.toLowerCase())
                        ).length === 0 && (
                          <div className="no-results">No departments found matching "{departmentSearchTerm}"</div>
                        )
                      }
                    </div>
                  </div>
                )}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}

              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="file">Upload SOP Document</label>
            
            {selectedFile ? (
              <div className="file-preview-container">
                <div className="file-info-bar">
                  <span>{selectedFile.name}</span>
                  <span>({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                  <button 
                    type="button" 
                    className="remove-file-btn"
                    onClick={removeFile}
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
                
                {/* {previewUrl && selectedFile.type === 'application/pdf' ? (
                  <div className="pdf-preview-container">
                    <iframe 
                      src={previewUrl} 
                      className="pdf-preview" 
                      title="PDF Preview"
                    />
                  </div>
                ) : (
                  <div className="generic-file-preview">
                    {getFileIcon(selectedFile)}
                    <p>
                      {selectedFile.type === 'application/pdf' 
                        ? 'PDF preview not available' 
                        : `Preview not available for ${selectedFile.name.split('.').pop().toUpperCase()} files`}
                    </p>
                  </div>
                )} */}
                
              
              </div>
            ) : (
              <div className="file-upload-container">
                <input
                  type="file"
                  id="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf"
                  className="file-input"
                  required
                />

              </div>
            )}
            {!selectedFile && 
          <span className='file-type-info' style={{marginTop: '5px'}}>Supported file types: .pdf</span>            
            }
          </div>
          
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="small" />
                  <span>Uploading...</span>
                </>
              ) : 'Upload SOP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSOP; 