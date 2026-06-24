import React from 'react';
import Footer from '../Footer/Footer';
import './Layout.css';

const Layout = ({ children, className = "" }) => {
  return (
    <div className={`page-container ${className}`}>
      <div className="page-content">
        {children}
      </div>
      <Footer />
    </div>
  );
};

export default Layout; 