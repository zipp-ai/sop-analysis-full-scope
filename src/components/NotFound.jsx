import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="error-icon">404</div>
        <h1>Page Not Found</h1>
        <p>Sorry, we couldn't find the page you're looking for. The page might have been moved, deleted, or never existed.</p>
        <div className="button-container">
          <button 
            className="primary-button"
            onClick={() => navigate('/')}
          >
            Go to Homepage
          </button>
          <button 
            className="secondary-button"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 