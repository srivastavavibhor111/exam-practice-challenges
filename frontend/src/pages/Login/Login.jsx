import { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Recaptcha from '../../components/Recaptcha/Recaptcha';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import './Login.css';


export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/dashboard';

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recaptchaRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password, recaptchaToken);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setIsSubmitting(false);
      recaptchaRef.current?.reset();   // tokens are single-use — clear it for the retry
      setRecaptchaToken('');
      setError(err.message || 'Something went wrong. Please try again.');
    }
  }

  async function handleGoogleCredential(credential) {
    setError('');
    setIsGoogleLoading(true);
    try {
      await googleLogin(credential);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setIsGoogleLoading(false);
      setError(err.message || 'Google sign-in failed. Please try again.');
    }
  }

  function handleGoogleError(message) {
    setError(message);
  }

  return (
    <main className="page-wrapper">
      <div className="auth">
        <div className="auth__card">

          <h1 className="auth__title">Welcome back</h1>
          <p className="auth__subtitle">Log in to continue practicing.</p>
          <br />
          <form className="auth__form" onSubmit={handleSubmit} noValidate>
            <div className="auth__field">
              <label className="auth__label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="auth__input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            {/* <div className="auth__field">
              <label className="auth__label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="auth__input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div> */}

            {/* Added an eye icon in password field */}
            <div className="auth__password-wrapper">
              <label className="auth__label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="auth__input auth__password-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />

              <button
                type="button"
                className="auth__password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <Recaptcha ref={recaptchaRef} onChange={token => setRecaptchaToken(token || '')} />

            {error && (
              <p className="auth__error" role="alert">
                <ErrorIcon /> {error}
              </p>
            )}

            <button
              className="btn btn--primary btn--lg auth__submit"
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
            >
              {isSubmitting ? 'Logging in…' : 'Log In'}
            </button>
          </form>

          <div className="auth__divider"><span>OR</span></div>

          <GoogleAuthButton
            mode="login"
            onCredential={handleGoogleCredential}
            onError={handleGoogleError}
            disabled={isSubmitting || isGoogleLoading}
          />

          <p className="auth__switch">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>


        </div>
      </div>
    </main>
  );
}

function ErrorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6.5 3.5V7M6.5 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-3.1 4.4" />
      <path d="M6.6 6.6C3.7 8.6 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 3.4-.6" />
    </svg>
  );
}