import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './GeminiKeySetup.css';

const MIN_KEY_LENGTH = 20;

/* ─── GeminiKeySetup — "/auth/setup-gemini-key" ──────────────────────────────
   Landing page for a brand-new Google user, reached only via
   Register.jsx's handleGoogleCredential when the backend responds
   status: 'needs_gemini_key'. name/email are passed through router state
   purely for the friendly greeting below — never trusted for anything
   security-relevant (the real identity check already happened server-side
   during Google verification).

   DELIBERATELY A PUBLIC ROUTE, not wrapped in ProtectedRoute — there's no
   real session yet at this point, only the restricted pendingGoogleAuth
   cookie (invisible to JS, and irrelevant to ProtectedRoute's `user`
   check anyway). If someone reaches this page without a valid pending
   registration in flight (e.g. they bookmarked it, or their 15-minute
   window expired), submitting the form fails cleanly with a clear
   "session expired" message from the backend — no complex route-guarding
   needed on the frontend to make that safe, since the actual enforcement
   lives in protectPendingGoogle on the backend.
────────────────────────────────────────────────────────────────────────────── */

export default function GeminiKeySetup() {
  const { completeGoogleRegistration } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { name, email } = location.state || {};

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKey,   setShowApiKey]   = useState(false);
  const [error,        setError]        = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!geminiApiKey.trim()) {
      setError('Please enter your Gemini API key.');
      return;
    }
    if (geminiApiKey.trim().length < MIN_KEY_LENGTH) {
      setError("That doesn't look like a valid Gemini API key.");
      return;
    }

    setIsSubmitting(true);
    try {
      await completeGoogleRegistration(geminiApiKey.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setIsSubmitting(false);
      setError(
        err.message ||
        'Something went wrong. If this keeps happening, your Google sign-up session may have expired — try signing up again.'
      );
    }
  }

  return (
    <main className="page-wrapper">
      <div className="auth">
        <div className="auth__card">

          <h1 className="auth__title">One more step</h1>
          <p className="auth__subtitle">
            {name ? `Welcome, ${name}! ` : ''}
            Enter your Gemini API key to enable AI-powered features on your
            Exam Practice Challenges account.
          </p>
          <br />
          <form className="auth__form" onSubmit={handleSubmit} noValidate>
            <div className="auth__field">
              <div className="auth__field-header">
                <label className="auth__label" htmlFor="setup-gemini-key">Gemini API Key</label>
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
                  id="setup-gemini-key"
                  type={showApiKey ? 'text' : 'password'}
                  className="auth__input"
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  autoComplete="off"
                  placeholder="AIza…"
                  aria-describedby="setup-gemini-key-hint"
                  aria-invalid={!!error}
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
              <p className="auth__field-hint" id="setup-gemini-key-hint">
                {email ? `For ${email}. ` : ''}
                Free from Google, no credit card required — takes about a
                minute. This key is encrypted before it's stored and is
                never shown again after you save it.
              </p>
            </div>

            {error && (
              <p className="auth__error" role="alert">
                <ErrorIcon /> {error}
              </p>
            )}

            <button className="btn btn--primary btn--lg auth__submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save & Continue'}
            </button>
          </form>

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
