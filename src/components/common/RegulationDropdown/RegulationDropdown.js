import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './RegulationDropdown.css';

const RegulationDropdown = ({ 
  regulations = [],
  selectedRegulations = [],
  onRegulationToggle,
  loading = false,
  error = null,
  placeholder = "Select compliance requirements",
  searchPlaceholder = "Search compliance...",
  className = "",
  disabled = false,
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

  // Handle regulation selection (toggle)
  const handleRegulationToggle = (regulation) => {
    if (onRegulationToggle) {
      onRegulationToggle(regulation);
    }
  };

  // Remove a selected regulation
  const removeRegulation = (regulationToRemove) => {
    if (onRegulationToggle) {
      onRegulationToggle(regulationToRemove);
    }
  };

  // Filter regulations based on search term
  const filteredRegulations = regulations.filter(reg => 
    (reg.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [showDropdown, regulations.length, searchTerm]);

  return (
    <div className={`regulation-dropdown-widget ${className}`} ref={dropdownRef}>
      <div 
        className={`selected-display ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        aria-expanded={showDropdown}
      >
        {loading ? (
          <div className="dropdown-loading">
            <LoadingSpinner size="small" />
            <span>Loading requirements...</span>
          </div>
        ) : isChatPage ? (
          <span className="placeholder">{placeholder}</span>
        ) : selectedRegulations && selectedRegulations.length > 0 ? (
          <div className="selected-tags">
            {selectedRegulations.map(req => (
              <div key={req.id} className="regulation-tag">
                {req.name}
                <button 
                  className="remove-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRegulation(req);
                  }}
                  disabled={disabled}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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
          ) : regulations.length === 0 ? (
            <div className="dropdown-message">
              No compliance requirements available.
            </div>
          ) : (
            <div className="dropdown-options">
              {filteredRegulations.map(reg => {
                const isSelected = selectedRegulations.some(r => r.id === reg.id);
                
                return (
                  <div
                    key={reg.id}
                    className={`regulation-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleRegulationToggle(reg)}
                  >
                    <div className="regulation-option-content">
                      <div className="checkbox">
                        {isSelected && '✓'}
                      </div>
                      <span className="regulation-title">{reg.name || 'Unnamed Requirement'}</span>
                    </div>
                  </div>
                );
              })}
              
              {/* Show message when no regulations match the search */}
              {filteredRegulations.length === 0 && (
                <div className="dropdown-message">
                  No requirements match your search.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegulationDropdown;