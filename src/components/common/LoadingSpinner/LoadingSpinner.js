import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', color = '#6c63ff' }) => {
  const sizeClass = `spinner-${size}`;
  
  return (
    <div className={`loading-spinner ${sizeClass}`} style={{ borderTopColor: color }}>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default LoadingSpinner; 