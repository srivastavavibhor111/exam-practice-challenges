import { forwardRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useTheme } from '../../context/ThemeContext';
import './Recaptcha.css';

/* ─── Recaptcha — NEW ─────────────────────────────────────────────────────────
   Thin wrapper around react-google-recaptcha's widget. Forwards a ref so
   the parent form can call .reset() after a failed submit — reCAPTCHA
   tokens are single-use, so a login/register attempt that fails for any
   reason (wrong password, server error, whatever) needs a fresh token
   before the user can try again, not a silent re-use of the old one.

   Same iframe constraint as GoogleAuthButton: this widget is rendered by
   Google, not by this app's CSS, so only its own 'light'/'dark' theme
   prop can be switched — not the full token palette.

   Fails LOUD (a visible message, not silent pass-through) if
   VITE_RECAPTCHA_SITE_KEY is missing — a missing site key is a
   configuration mistake, and letting forms submit with no verification
   at all in that case would be worse than an obvious error telling you
   to fix your .env.
────────────────────────────────────────────────────────────────────────────── */

const Recaptcha = forwardRef(function Recaptcha({ onChange }, ref) {
  const { theme } = useTheme();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    return (
      <p className="recaptcha-config-error" role="alert">
        reCAPTCHA is not configured (VITE_RECAPTCHA_SITE_KEY is missing from your .env).
      </p>
    );
  }

  return (
    <div className="recaptcha-wrap">
      <ReCAPTCHA
        ref={ref}
        sitekey={siteKey}
        onChange={onChange}
        onExpired={() => onChange(null)}
        theme={theme === 'dark' ? 'dark' : 'light'}
      />
    </div>
  );
});

export default Recaptcha;
