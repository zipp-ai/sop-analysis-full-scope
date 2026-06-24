import React from 'react';
import ReactDOM from 'react-dom/client';
import './constants/colors.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Global error handler for ResizeObserver errors
const suppressResizeObserverErrors = () => {
  const resizeObserverErr = /^ResizeObserver loop completed with undelivered notifications/;
  const origError = window.console.error;
  
  window.console.error = (...args) => {
    if (args[0] && typeof args[0] === 'string' && resizeObserverErr.test(args[0])) {
      return; // Suppress ResizeObserver errors
    }
    origError.apply(window.console, args);
  };
  
  // Also handle errors thrown as exceptions
  window.addEventListener('error', (e) => {
    if (resizeObserverErr.test(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  });
};

// Initialize error suppression
suppressResizeObserverErrors();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <App />
);

// If you want to start measuring performance in your app, pass a function
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
