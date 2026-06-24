import React, { useEffect, useCallback } from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, children, closeOnOutsideClick = false, isProcessing = false }) => {

  
  const handleOutsideClick = useCallback((e) => {
    // Verify target is exactly the overlay, not a child element
    if (e.target === e.currentTarget && e.target.classList.contains('modal-overlay')) {

      
      // Safety check - never close if processing
      if (closeOnOutsideClick && !isProcessing) {
        onClose();
      } else {

      }
    }
  }, [closeOnOutsideClick, isProcessing, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    
    // Direct event on the overlay itself
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('mousedown', handleOutsideClick);
      
      // Cleanup function
      return () => {
        overlay.removeEventListener('mousedown', handleOutsideClick);
      };
    }
  }, [isOpen, handleOutsideClick]);
  
  if (!isOpen) return null;

  return (
    // Add the handler directly to the overlay for more reliability
    <div className="modal-overlay" onMouseDown={handleOutsideClick}>
      {/* Stop propagation to prevent the overlay handler from firing */}
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export default Modal; 