import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import supabase from '../../../supabase';

const URLParamChecker = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {

    
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');
    
    // Check URL hash for access_token (format: #access_token=...)
    const hash = location.hash;
    const hasAccessToken = hash && hash.includes('access_token');
    
    // Check if URL comes from Supabase confirmation email (sendibt3.com redirect)
    const referrer = document.referrer;
    const isSupabaseConfirmation = referrer && referrer.includes('sendibt3.com');
    
    
    // Check for confirmation email indicators in current URL
    const currentUrl = window.location.href;
    const isConfirmationEmail = currentUrl.includes('sendibt3.com') || 
                               currentUrl.includes('confirmation') ||
                               currentUrl.includes('verify');
    
    // Check if user landed directly on dashboard (common with confirmation emails)
    const isDashboardAccess = location.pathname === '/dashboard';
    
    // Check various suspicious patterns for dashboard access
    const isDashboardWithoutReferrer = isDashboardAccess && !document.referrer;
    const isDashboardFromExternal = isDashboardAccess && 
                                   document.referrer && 
                                   !document.referrer.includes(window.location.origin);
    
    // Check if this is a fresh session (no previous app navigation)
    const lastAppNavigation = sessionStorage.getItem('last_app_navigation');
    const isFreshSession = !lastAppNavigation;
    
    // Strong indicators of confirmation email access
    // BUT EXCLUDE login page - users should be able to login normally after redirect
    const isSuspiciousDashboardAccess = isDashboardAccess && 
                                       location.pathname !== '/login' && 
                                       (isDashboardWithoutReferrer || 
                                        isDashboardFromExternal || 
                                        (isFreshSession && isDashboardAccess));
    


    // If any confirmation indicators are present, clear session and redirect to login
    if (token || type || hasAccessToken || isSupabaseConfirmation || isConfirmationEmail || isSuspiciousDashboardAccess) {

      
      // Set flag to indicate confirmation email access
      localStorage.setItem('confirmation_email_access', 'true');
      
      // Clear the session before redirecting
      const clearSessionAndRedirect = async () => {
        try {
          // Sign out from Supabase
          await supabase.auth.signOut();
        } catch (error) {
          console.error('Error clearing session:', error);
          // Continue with redirect even if signOut fails
        } finally {
          // Force a page reload to clear any cached state and redirect to login
          window.location.href = '/login';
        }
      };

      clearSessionAndRedirect();
    } else {
      // Mark this as legitimate app navigation
      if (location.pathname !== '/login') {
        sessionStorage.setItem('last_app_navigation', Date.now().toString());
      }
    }
    
  }, [location.search, location.hash, location.pathname, navigate]);

  return children;
};

export default URLParamChecker; 