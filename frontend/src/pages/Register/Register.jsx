import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Recaptcha from '../../components/Recaptcha/Recaptcha';
import GoogleAuthButton from '../../components/GoogleAuthButton/GoogleAuthButton';
import './Register.css';


const PASSWORD_MIN_LENGTH = 8;

export default function Register() {
  const { register, googleRegister } = useAuth();
  const navigate = useNavigate();

  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [geminiApiKey,    setGeminiApiKey]    = useState('');
  const [showApiKey,      setShowApiKey]      = useState(false);
  const [recaptchaToken,  setRecaptchaToken]  = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error,           setError]           = useState('');
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const recaptchaRef = useRef(null);

  function validate() {
    if (!name.trim())  return 'Please enter your name.';
    if (!email.trim()) return 'Please enter your email.';
    if (!geminiApiKey.trim() || geminiApiKey.trim().length < 20) {
        return 'A valid Gemini API key is required. See the guide below if you don\u2019t have one yet.';
    }
    if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    if (password !== confirmPassword) return 'Passwords do not match.';
    if (!recaptchaToken) return 'Please complete the reCAPTCHA verification.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password, geminiApiKey.trim(), recaptchaToken);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setIsSubmitting(false);
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
      setError(err.message || 'Something went wrong. Please try again.');
    }
  }

  async function handleGoogleCredential(credential) {
    setError('');
    setIsGoogleLoading(true);
    try {
      const result = await googleRegister(credential);
      if (result.status === 'logged_in') {
        navigate('/dashboard', { replace: true });
      } else {
        // status === 'needs_gemini_key' — brand-new Google identity,
        // no account exists yet until the key setup step completes.
        navigate('/auth/setup-gemini-key', {
          replace: true,
          state: { name: result.name, email: result.email },
        });
      }
    } catch (err) {
      setIsGoogleLoading(false);
      setError(err.message || 'Google sign-up failed. Please try again.');
    }
  }

  function handleGoogleError(message) {
    setError(message);
  }


  return (
    <main className="page-wrapper">
      <div className="auth">
        <div className="auth__card">

          <h1 className="auth__title">Create your account</h1>
          <p className="auth__subtitle">Start turning your MCQs into real practice tests.</p>
          <br />
          <form className="auth__form" onSubmit={handleSubmit} noValidate>
            <div className="auth__field">
              <label className="auth__label" htmlFor="reg-name">Name</label>
              <input
                id="reg-name"
                type="text"
                className="auth__input"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                className="auth__input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="reg-password">Password</label>

              <div className="auth__password-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth__input auth__password-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
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
            </div>

            <div className="auth__field">
              <label className="auth__label" htmlFor="reg-confirm">Confirm password</label>

              <div className="auth__password-wrapper">
                <input
                  id="reg-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="auth__input auth__password-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="auth__password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* gemini additions patch 2 */}
            <div className="auth__field">
              <div className="auth__field-header">
                <label className="auth__label" htmlFor="reg-gemini-key">Gemini API Key</label>
                <a
                  href="/get-gemini-api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth__field-help-link"
                >
                  How do I get one?
                </a>
              </div>
              <div className="auth__input-with-toggle">
                <input
                  id="reg-gemini-key"
                  type={showApiKey ? 'text' : 'password'}
                  className="auth__input"
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder="AIza…"
                />
                <button
                  type="button"
                  className="auth__input-toggle"
                  onClick={() => setShowApiKey(s => !s)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="auth__field-hint">
                Used for AI-powered question extraction and explanations. Free from
                Google, no credit card required — takes about a minute.
              </p>
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
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth__divider"><span>OR</span></div>

          <GoogleAuthButton
            mode="register"
            onCredential={handleGoogleCredential}
            onError={handleGoogleError}
            disabled={isSubmitting || isGoogleLoading}
          />

          <p className="auth__switch">
            Already have an account? <Link to="/login">Log in</Link>
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