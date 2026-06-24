import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param {string} content - The HTML content to sanitize
 * @param {Object} options - DOMPurify configuration options
 * @returns {string} - Sanitized HTML
 */
export const sanitizeHtml = (content, options = {}) => {
  // Default configuration
  const defaultOptions = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    USE_PROFILES: { html: true },
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: true,
  };

  // Merge default options with provided options
  const mergedOptions = { ...defaultOptions, ...options };

  // Return sanitized HTML
  return DOMPurify.sanitize(content || '', mergedOptions);
};

/**
 * Sanitizes a plain text string (removes all HTML)
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text with all HTML removed
 */
export const sanitizeText = (text) => {
  return DOMPurify.sanitize(text || '', {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

export default {
  sanitizeHtml,
  sanitizeText
}; 