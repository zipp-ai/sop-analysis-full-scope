import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import { sanitizeText } from '../../../utils/sanitize';
import './SOPDropdown.css';

const SOPDropdown = ({ 
  sops = [],
  selectedSOPs = [],
  onSOPToggle,
  loading = false,
  error = null,
  placeholder = "Select SOPs",
  searchPlaceholder = "Search SOPs...",
  className = "",
  disabled = false,
  singleSelect = false,
  isChatPage = false
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle SOP selection (toggle)
  const handleSOPToggle = (sop) => {
    if (onSOPToggle) {
      onSOPToggle(sop);
      // Close dropdown immediately in single select mode
      if (singleSelect) {
        setShowDropdown(false);
      }
    }
  };

  // Remove a selected SOP
  const removeSOP = (sopToRemove) => {
    if (onSOPToggle) {
      onSOPToggle(sopToRemove);
    }
  };

  // Sort SOPs by date (most recent first)
  const sortedSOPs = [...sops].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || Date.now());
    const dateB = new Date(b.updated_at || b.created_at || Date.now());
    return dateB - dateA; // Sort in descending order (newest first)
  });

  // Filter SOPs based on search term
  const filteredSOPs = sortedSOPs.filter(sop => 
    (sop.title || 'Unnamed SOP').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic spacing when dropdown opens/closes
  useEffect(() => {
    const updateDropdownSpacing = () => {
      if (showDropdown && dropdownRef.current) {
        const dropdownMenu = dropdownRef.current.querySelector('.dropdown-menu');
        if (dropdownMenu) {
          const dropdownHeight = dropdownMenu.offsetHeight;
          dropdownRef.current.style.marginBottom = `${dropdownHeight + 20}px`;
        }
      } else if (dropdownRef.current) {
        dropdownRef.current.style.marginBottom = '0px';
      }
    };

    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(updateDropdownSpacing, 10);
    return () => clearTimeout(timeoutId);
  }, [showDropdown, sops.length, searchTerm]);

  return (
    <div className={`sop-dropdown-widget ${className}`} ref={dropdownRef}>
      <div 
        className={`selected-display ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        aria-expanded={showDropdown}
      >
        {loading ? (
          <div className="dropdown-loading">
            <LoadingSpinner size="small" />
            <span>Loading SOPs...</span>
          </div>
        ) : isChatPage ? (
          <span className="placeholder">{placeholder}</span>
        ) : selectedSOPs && selectedSOPs.length > 0 ? (
          singleSelect ? (
            <div className="selected-single">
              <span className="selected-value">
                {sanitizeText(selectedSOPs[0].title || 'Unnamed SOP')}
              </span>
            </div>
          ) : (
            <div className="selected-tags">
              {selectedSOPs.map(sop => (
                <div key={sop.id} className="sop-tag">
                  {sanitizeText(sop.title || 'Unnamed SOP')}
                  <button 
                    className="remove-tag"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSOP(sop);
                    }}
                    disabled={disabled}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <span className="placeholder">{placeholder}</span>
        )}
        <span className="dropdown-arrow">▼</span>
      </div>
      
      {showDropdown && !loading && (
        <div className="dropdown-menu">
          {/* Search input */}
          <div className="dropdown-search">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          
          {error ? (
            <div className="dropdown-message error">
              {error}
            </div>
          ) : sops.length === 0 ? (
            <div className="dropdown-message">
              No SOPs available. Please add SOPs first.
            </div>
          ) : (
            <div className="dropdown-options">
              {filteredSOPs.map(sop => {
                const isSelected = selectedSOPs.some(s => s.id === sop.id);
                
                return (
                  <div
                    key={sop.id}
                    className={`sop-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSOPToggle(sop)}
                  >
                    <div className="sop-option-content">
                      <div className={singleSelect ? "radio" : "checkbox"}>
                        {isSelected && (singleSelect ? '' : '✓')}
                      </div>
                      <span className="sop-title">{sanitizeText(sop.title || 'Unnamed SOP')}</span>
                    </div>
                  </div>
                );
              })}
              
              {/* Show message when no SOPs match the search */}
              {filteredSOPs.length === 0 && (
                <div className="dropdown-message">
                  No SOPs match your search.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SOPDropdown;