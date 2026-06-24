import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import supabase from '../../../supabase';
import './Login.css';
import API_URLS from '../../../config/apiUrls';
import userService from '../../../services/userService';

const Login = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    loginEmail: '',
    loginPassword: '',
    signupEmail: '',
    signupPassword: '',
    signupPasswordConfirm: '',
    firstName: '',
    lastName: ''
  });
  const [loading, setLoading] = useState(false);
  const [isConfirmationAccess, setIsConfirmationAccess] = useState(false);

  // Separate error and message states for login and signup
  const [loginError, setLoginError] = useState(null);
  const [loginMessage, setLoginMessage] = useState('');
  const [signupError, setSignupError] = useState(null);
  const [signupMessage, setSignupMessage] = useState('');

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPasswordConfirm, setShowSignupPasswordConfirm] = useState(false);
  // const navigate = useNavigate();

  useEffect(() => {
    // Add comprehensive debugging


    // Check if accessed via confirmation email
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');
    const confirmationType = urlParams.get('confirmation_url');


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



    // Check all hash parameters
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1)); // Remove # from hash
    }

    // If hasAccessToken or confirmation email detected, logout and redirect to clean login page
    if (hasAccessToken || isSupabaseConfirmation || isConfirmationEmail) {


      // Logout user and redirect to clean login URL
      const logoutAndRedirect = async () => {
        try {
          // Sign out from Supabase if user is logged in
          await supabase.auth.signOut();
        } catch (error) {
          console.error('Error logging out user:', error);
          // Continue with redirect even if signOut fails
        } finally {
          // Clear the hash and redirect to clean login URL
          window.location.href = '/login';
        }
      };

      logoutAndRedirect();
      return;
    }

    // Check localStorage for confirmation access flag
    const confirmationAccessFlag = localStorage.getItem('confirmation_email_access');


    if (token || type || confirmationType || confirmationAccessFlag) {

      // setIsConfirmationAccess(true);
      // setError('Login is temporarily disabled. This appears to be a confirmation email link. Please access the application directly.');

      // Clear the flag if it exists
      if (confirmationAccessFlag) {
        localStorage.removeItem('confirmation_email_access');
      }
    }


  }, [location]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Toggle password visibility functions
  const toggleLoginPasswordVisibility = () => {
    setShowLoginPassword(!showLoginPassword);
  };

  const toggleSignupPasswordVisibility = () => {
    setShowSignupPassword(!showSignupPassword);
  };

  const toggleSignupPasswordConfirmVisibility = () => {
    setShowSignupPasswordConfirm(!showSignupPasswordConfirm);
  };

  // Function to handle tab switching and clear only success messages (keep errors)
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    // Only clear success messages when switching tabs, keep error messages
    setLoginMessage('');
    setSignupMessage('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    // Prevent login if accessed via confirmation email
    if (isConfirmationAccess) {
      setLoginError('Login is disabled when accessing via confirmation email. Please visit the application directly.');
      return;
    }

    setLoading(true);
    setLoginError(null);
    setLoginMessage('');
    // Clear only signup success messages when submitting login (keep signup errors)
    setSignupMessage('');

    // Basic validation
    // Check user status before proceeding with login
    try {
      const response = await fetch(API_URLS.USER.CHECK_USER_EXISTS(formData.loginEmail), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        const errorData = await response.json();
        setLoginError(errorData.message || 'User account is not active');
        setLoading(false);
        return;
      }

      if (response.status !== 200) {
        setLoginError('Failed to verify user status. Please try again.');
        setLoading(false);
        return;
      }
    } catch (error) {
      let errorMessage = 'Failed to verify user status. Please try again.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      setLoginError(errorMessage);
      setLoading(false);
      return;
    }


    if (!formData.loginEmail || !formData.loginPassword) {
      setLoginError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.loginEmail,
        password: formData.loginPassword,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setLoginError('Invalid email or password');
        } else {
          setLoginError(error.message);
        }
        return;
      }

      // If login successful, navigate to dashboard
      if (data?.user) {
        // Record user login timestamp
        userService.recordLoginTime();

        sessionStorage.removeItem("chatHistory");
        sessionStorage.removeItem("chatSessionTimestamp");
        window.location.href = '/dashboard'; // This will force a full page reload
        // OR use this if you want to keep React state:
        // navigate('/dashboard', { replace: true });

      }
    } catch (error) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      setLoginError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    // Prevent signup if accessed via confirmation email
    if (isConfirmationAccess) {
      setSignupError('Signup is disabled when accessing via confirmation email. Please visit the application directly.');
      return;
    }

    setLoading(true);
    setSignupError(null);
    setSignupMessage('');
    // Clear only login success messages when submitting signup (keep login errors)
    setLoginMessage('');

    // Basic validation
    if (!formData.signupEmail || !formData.signupPassword || !formData.signupPasswordConfirm ||
      !formData.firstName) {
      setSignupError('Please fill in all fields');
      setLoading(false);
      return;
    }

    // Password confirmation check
    if (formData.signupPassword !== formData.signupPasswordConfirm) {
      setSignupError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Normalize the email
      const normalizedEmail = formData.signupEmail.trim().toLowerCase();


      // Attempt signup
      const { data, error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.signupPassword,
        options: {
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName ? formData.lastName.trim() : null
          }
        }
      });


      // Check for errors
      if (signupError) {
        console.error("Signup error details:", signupError);

        if (signupError.message.includes('Database error saving new user')) {
          setSignupError(`you are not allowed to login contact your administrator`);
        } else if (signupError.message.includes('User already registered')) {
          setSignupError('User already signed up, please login');
        } else {
          setSignupError(signupError.message || 'Error during signup');
        }
        return;
      }

      // Check if user was created
      if (data?.user) {

        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          setSignupError('This email is already registered. Please login instead.');
          return;
        }

        setSignupMessage('Check your email for the confirmation link.');
        // Clear the form
        setFormData(prev => ({
          ...prev,
          signupEmail: '',
          signupPassword: '',
          signupPasswordConfirm: '',
          firstName: '',
          lastName: ''
        }));
      } else {
        // No user data but also no error - unusual case
        console.warn("No user data returned but no error either");
        setSignupError('Something went wrong with registration. Please try again.');
      }
    } catch (error) {
      console.error("Unexpected error during signup:", error);

      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error?.response?.data?.detail) {
        errorMessage = error?.response?.data?.detail;
      }

      setSignupError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="logo-container">

          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>

          <img
            src="/zipplogo.png"
            alt="Zipp Logo"
            className="logo-image"
          />
            <span style={{color:'#000'}}>|</span>
            <img src='latentlogo.png'  className="logo-image" style={{width: '110px', height: '30px', marginTop: '4px'}}/>
        </div>

      </div>

      <div id="auth-container">
        <div className="tab-container">
          <button
            className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('login')}
          >
            Login
          </button>
          <button
            className={`tab-button ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('signup')}
          >
            Sign Up
          </button>
        </div>

        <div id="login" className={`tab-content ${activeTab === 'login' ? 'active' : ''}`}>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
            <label htmlFor="loginEmail">Email <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <input
                type="email"
                id="loginEmail"
                value={formData.loginEmail}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="loginPassword">Password <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <div className="password-input-wrapper">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  id="loginPassword"
                  value={formData.loginPassword}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={toggleLoginPasswordVisibility}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          {/* Login-specific messages */}
          {loginError && <div className="message error">{loginError}</div>}
          {loginMessage && <div className="message success">{loginMessage}</div>}
        </div>

        <div id="signup" className={`tab-content ${activeTab === 'signup' ? 'active' : ''}`}>
          <h2>Sign Up</h2>
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label htmlFor="firstName">First Name <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name </label>
              <input
                type="text"
                id="lastName"
                value={formData.lastName}
                onChange={handleInputChange}

              />
            </div>
            <div className="form-group">
              <label htmlFor="signupEmail">Email <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <input
                type="email"
                id="signupEmail"
                value={formData.signupEmail}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="signupPassword">Password <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <div className="password-input-wrapper">
                <input
                  type={showSignupPassword ? "text" : "password"}
                  id="signupPassword"
                  value={formData.signupPassword}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={toggleSignupPasswordVisibility}
                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                >
                  {showSignupPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="signupPasswordConfirm">Confirm Password  <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <div className="password-input-wrapper">
                <input
                  type={showSignupPasswordConfirm ? "text" : "password"}
                  id="signupPasswordConfirm"
                  value={formData.signupPasswordConfirm}
                  onChange={handleInputChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={toggleSignupPasswordConfirmVisibility}
                  aria-label={showSignupPasswordConfirm ? "Hide password" : "Show password"}
                >
                  {showSignupPasswordConfirm ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
          <p className="info-text">
            Only allowed emails can sign up. Please check if your email is on the allowlist.
          </p>
          {/* Signup-specific messages */}
          {signupError && <div className="message error">{signupError}</div>}
          {signupMessage && <div className="message success">{signupMessage}</div>}
        </div>
      </div>
    </div>
  );
};

export default Login;