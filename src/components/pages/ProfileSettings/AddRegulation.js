import React, { useState } from 'react';
import './AddRegulation.css';
import LoadingSpinner from '../../common/LoadingSpinner/LoadingSpinner';
import toastService from '../../../services/toastService';
import supabase from '../../../supabase';

const AddRegulation = ({ onClose, onSuccess }) => {
  const [uploadFile, setUploadFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    industry: '',
    region: '',
    compliance_type: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setUploadFile(file);
    setError(null);

    // Auto-fill name if empty
    if (file && !formData.name) {
      setFormData(prev => ({
        ...prev,
        name: file.name.split('.')[0] // Remove file extension
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!uploadFile) {
      setError('Please select a file to upload.');
      return;
    }

    if (!formData.name.trim()) {
      setError('Please enter a regulation name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare form data
      const submitFormData = new FormData();
      submitFormData.append('file', uploadFile);
      submitFormData.append('name', formData.name.trim());

      if (formData.description.trim()) {
        submitFormData.append('description', formData.description.trim());
      }
      if (formData.industry.trim()) {
        submitFormData.append('industry', formData.industry.trim());
      }
      if (formData.region.trim()) {
        submitFormData.append('region', formData.region.trim());
      }
      if (formData.compliance_type.trim()) {
        submitFormData.append('compliance_type', formData.compliance_type.trim());
      }

      // Get the token from supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Make the API call
      const response = await fetch(`${process.env.REACT_APP_API_URL}/regulations/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitFormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to upload regulation');
      }

      const result = await response.json();

      toastService.success('Regulation uploaded successfully!', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Call success callback to refresh parent data
      onSuccess && onSuccess(result);

      // Close modal
      onClose();

    } catch (err) {
      console.error('Error uploading regulation:', err);

      let errorMessage = 'Failed to upload regulation. Please try again.';
      if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

      toastService.error(errorMessage, {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-regulation-modal">
      <div className="add-regulation-header">
        <h2>Add New Regulation</h2>
        
      </div>

      <form onSubmit={handleSubmit} className="add-regulation-form">
        <div className="add-regulation-content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="regulation-file">
              Regulation Document <span className="required">*</span>
            </label>
            <input
              type="file"
              id="regulation-file"
              accept=".txt,.pdf"
              onChange={handleFileChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="regulation-name">
              Regulation Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="regulation-name"
              name="name"
              placeholder="Enter regulation name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="regulation-description">Description</label>
            <textarea
              id="regulation-description"
              name="description"
              placeholder="Enter regulation description (optional)"
              value={formData.description}
              onChange={handleInputChange}
              disabled={loading}
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="regulation-industry">Industry</label>
              <input
                type="text"
                id="regulation-industry"
                name="industry"
                placeholder="Enter industry"
                value={formData.industry}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="regulation-region">Region</label>
              <input
                type="text"
                id="regulation-region"
                name="region"
                placeholder="Enter region"
                value={formData.region}
                onChange={handleInputChange}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="regulation-compliance-type">Compliance Type</label>
            <input
              type="text"
              id="regulation-compliance-type"
              name="compliance_type"
              placeholder="Enter compliance type"
              value={formData.compliance_type}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>
        </div>

        <div className="add-regulation-actions">
          <button 
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="btn-primary"
            disabled={loading || !uploadFile || !formData.name.trim()}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                Uploading...
              </>
            ) : (
              'Add Regulation'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddRegulation;