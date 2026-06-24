import React from 'react';
import { sanitizeHtml } from '../../../utils/sanitize';

/**
 * Component to safely render HTML content after sanitizing it
 * @param {Object} props - Component props
 * @param {string} props.html - The HTML content to sanitize and render
 * @param {Object} props.options - DOMPurify configuration options
 * @param {string} props.className - CSS class to apply to the container
 * @returns {JSX.Element} - React component with sanitized HTML
 */
const SanitizedHTML = ({ html, options = {}, className = '', ...rest }) => {
  const sanitizedHTML = sanitizeHtml(html, options);
  
  return (
    <div 
      className={`sanitized-html ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      {...rest}
    />
  );
};

export default SanitizedHTML; 