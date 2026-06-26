import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import supabase from '../../../supabase';
import './Login.css';

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

  const [loginError, setLoginError] = useState(null);
  const [loginMessage, setLoginMessage] = useState('');
  const [signupError, setSignupError] = useState(null);
  const [signupMessage, setSignupMessage] = useState('');

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPasswordConfirm, setShowSignupPasswordConfirm] = useState(false);

  useEffect(() => {
    const hash = location.hash;
    const hasAccessToken = hash && hash.includes('access_token');

    if (hasAccessToken) {
      const logoutAndRedirect = async () => {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.error('Error logging out user:', error);
        } finally {
          window.location.href = '/login';
        }
      };
      logoutAndRedirect();
    }
  }, [location]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setLoginMessage('');
    setSignupMessage('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);
    setLoginMessage('');

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

      if (data?.user) {
        window.location.href = '/sop-library';
      }
    } catch (error) {
      setLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSignupError(null);
    setSignupMessage('');

    if (!formData.signupEmail || !formData.signupPassword || !formData.signupPasswordConfirm || !formData.firstName) {
      setSignupError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.signupPassword !== formData.signupPasswordConfirm) {
      setSignupError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const normalizedEmail = formData.signupEmail.trim().toLowerCase();
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

      if (signupError) {
        if (signupError.message.includes('User already registered')) {
          setSignupError('User already signed up, please login');
        } else {
          setSignupError(signupError.message || 'Error during signup');
        }
        return;
      }

      if (data?.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          setSignupError('This email is already registered. Please login instead.');
          return;
        }
        setSignupMessage('Check your email for the confirmation link.');
        setFormData(prev => ({
          ...prev,
          signupEmail: '', signupPassword: '', signupPasswordConfirm: '',
          firstName: '', lastName: ''
        }));
      }
    } catch (error) {
      setSignupError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="logo-container">
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
          <img src="/zipplogo.png" alt="Zipp Logo" className="logo-image" />
          <span style={{color:'#000'}}>|</span>
          <img src='latentlogo.png' className="logo-image" style={{width: '110px', height: '30px', marginTop: '4px'}} alt="Latent Logo" />
        </div>
      </div>

      <div id="auth-container">
        <div className="tab-container">
          <button className={`tab-button ${activeTab === 'login' ? 'active' : ''}`} onClick={() => handleTabSwitch('login')}>Login</button>
          <button className={`tab-button ${activeTab === 'signup' ? 'active' : ''}`} onClick={() => handleTabSwitch('signup')}>Sign Up</button>
        </div>

        <div id="login" className={`tab-content ${activeTab === 'login' ? 'active' : ''}`}>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="loginEmail">Email <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <input type="email" id="loginEmail" value={formData.loginEmail} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="loginPassword">Password <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <div className="password-input-wrapper">
                <input type={showLoginPassword ? "text" : "password"} id="loginPassword" value={formData.loginPassword} onChange={handleInputChange} required />
                <button type="button" className="password-toggle-btn" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                  {showLoginPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="btn" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          </form>
          {loginError && <div className="message error">{loginError}</div>}
          {loginMessage && <div className="message success">{loginMessage}</div>}
        </div>

        <div id="signup" className={`tab-content ${activeTab === 'signup' ? 'active' : ''}`}>
          <h2>Sign Up</h2>
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label htmlFor="firstName">First Name <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <input type="text" id="firstName" value={formData.firstName} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input type="text" id="lastName" value={formData.lastName} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label htmlFor="signupEmail">Email <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <input type="email" id="signupEmail" value={formData.signupEmail} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="signupPassword">Password <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <div className="password-input-wrapper">
                <input type={showSignupPassword ? "text" : "password"} id="signupPassword" value={formData.signupPassword} onChange={handleInputChange} required />
                <button type="button" className="password-toggle-btn" onClick={() => setShowSignupPassword(!showSignupPassword)}>
                  {showSignupPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="signupPasswordConfirm">Confirm Password <span style={{color: 'var(--severity-high-text)'}}>*</span></label>
              <div className="password-input-wrapper">
                <input type={showSignupPasswordConfirm ? "text" : "password"} id="signupPasswordConfirm" value={formData.signupPasswordConfirm} onChange={handleInputChange} required />
                <button type="button" className="password-toggle-btn" onClick={() => setShowSignupPasswordConfirm(!showSignupPasswordConfirm)}>
                  {showSignupPasswordConfirm ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <button type="submit" className="btn" disabled={loading}>{loading ? 'Signing up...' : 'Sign Up'}</button>
          </form>
          {signupError && <div className="message error">{signupError}</div>}
          {signupMessage && <div className="message success">{signupMessage}</div>}
        </div>
      </div>
    </div>
  );
};

export default Login;
