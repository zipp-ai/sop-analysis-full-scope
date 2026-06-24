import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../../../supabase';
import toastService from '../../../services/toastService';
import './AutoLogout.css';

// Custom timeout warning component
const TimeoutWarning = ({ seconds, onStayLoggedIn, onLogout }) => {
  return (
    <div className="timeout-warning-container">
      <div className="timeout-warning-header">
        <svg className="warning-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h3>Session Timeout Warning</h3>
      </div>
      <div className="timeout-warning-body">
        <p>Your session is about to expire due to inactivity.</p>
        <div className="timeout-countdown">
          <span className={`countdown-number ${seconds <= 10 ? 'urgent' : ''}`}>{seconds}</span>
          <span className="countdown-text">seconds remaining</span>
        </div>
        <p className="timeout-instruction">Move your mouse or press a key to stay logged in.</p>
      </div>
    
    </div>
  );
};

const AutoLogout = ({ timeoutMinutes = 5 }) => {
  const navigate = useNavigate();
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [warningShown, setWarningShown] = useState(false);
  const [countdown, setCountdown] = useState(60); // Countdown in seconds
  const countdownIntervalRef = useRef(null);
  const [showCustomWarning, setShowCustomWarning] = useState(false);
  
  // Convert minutes to milliseconds
  const timeoutDuration = timeoutMinutes * 60 * 1000;
  // Show warning 1 minute before logout
  const warningTime = timeoutDuration - (60 * 1000);
  
  // Function to clear warning toast and reset countdown
  const clearWarningAndReset = () => {
    // Hide custom warning
    setShowCustomWarning(false);
    
    // Dismiss any existing toast
    toastService.dismiss('inactivity-warning');
    setWarningShown(false);
    setCountdown(60); // Reset countdown
    
    // Clear the countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };
  
  // Function to handle user activity
  const handleUserActivity = () => {
    setLastActivity(Date.now());
    
    // If warning is shown, dismiss it immediately
    if (warningShown) {
      clearWarningAndReset();
    }
  };
  
  // Function to handle logout
  const handleLogout = async () => {
    try {
      // Clear warning toast and reset countdown
      clearWarningAndReset();
      
      // Show logout toast
      toastService.info('You have been logged out due to inactivity', {
        toastId: 'auto-logout',
        autoClose: 2000
      });
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Error during auto-logout:', error);
      
      let errorMessage = 'Error during auto-logout.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }
      
      // Force reload to ensure logout even if there's an error
      window.location.href = '/login';
    }
  };
  
  // Function to manually stay logged in (reset timer)
  const handleStayLoggedIn = () => {
    handleUserActivity();
  };
  
  // Set up event listeners for user activity
  useEffect(() => {
    // List of events to track for user activity
    const events = [
      'mousedown', 'mousemove', 'keypress', 
      'scroll', 'touchstart', 'click', 'keydown'
    ];
    
    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });
    
    // Clean up event listeners
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [warningShown]); // Add warningShown as dependency to update event listeners when it changes
  
  // Start countdown timer when warning is shown
  useEffect(() => {
    if (warningShown && !countdownIntervalRef.current) {
      // Start a countdown timer that updates every second
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prevCount => {
          const newCount = prevCount - 1;
          
          // If countdown reaches 0, trigger logout
          if (newCount <= 0) {
            handleLogout();
            return 0;
          }
          
          return newCount;
        });
      }, 1000);
    }
    
    // Clean up interval on unmount or when warning is dismissed
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [warningShown]);
  
  // Check for inactivity
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;
      
      // Show warning if approaching timeout and warning not shown yet
      if (timeSinceLastActivity > warningTime && !warningShown) {
        // Calculate seconds remaining
        const secondsRemaining = Math.floor((timeoutDuration - timeSinceLastActivity) / 1000);
        setCountdown(secondsRemaining);
        
        // Show custom warning
        setShowCustomWarning(true);
        setWarningShown(true);
      }
      
      // Log out if inactive for too long
      if (timeSinceLastActivity > timeoutDuration) {
        handleLogout();
        clearInterval(interval);
      }
    }, 1000); // Check every second for more accurate detection
    
    return () => clearInterval(interval);
  }, [lastActivity, timeoutDuration, warningShown, warningTime]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearWarningAndReset();
    };
  }, []);
  
  // Render the custom warning if shown
  return showCustomWarning ? (
    <div className="timeout-warning-overlay">
      <TimeoutWarning 
        seconds={countdown} 
        onStayLoggedIn={handleStayLoggedIn} 
        onLogout={handleLogout} 
      />
    </div>
  ) : null;
};

export default AutoLogout; 