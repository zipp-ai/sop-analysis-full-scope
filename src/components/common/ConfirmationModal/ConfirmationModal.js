import React, { useRef, useEffect } from 'react';
import './ConfirmationModal.css';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, isLoading = false }) => {
  // Add click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if we clicked directly on the overlay (not its children)
      if (event.target.className === 'confirmation-modal-overlay') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="confirmation-modal-overlay">
      <div className="confirmation-modal">
        <div className="confirmation-modal-header">
          <h3>{title || 'Confirm Action'}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="confirmation-modal-body">
          <p>{message || 'Are you sure you want to proceed?'}</p>
        </div>
        <div className="confirmation-modal-footer">
          <button 
            className="cancel-button"
            onClick={onClose}
          >
            {cancelText || 'Cancel'}
          </button>
          <button 
            className="confirm-button" 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal; 