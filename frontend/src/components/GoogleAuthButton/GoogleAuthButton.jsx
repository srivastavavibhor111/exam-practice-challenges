import { GoogleLogin } from '@react-oauth/google';
import { useTheme } from '../../context/ThemeContext';
import './GoogleAuthButton.css';
import { useContext } from 'react';

/* ─── GoogleAuthButton — NEW ──────────────────────────────────────────────────
   Wraps @react-oauth/google's official GoogleLogin button.

   A REAL CONSTRAINT WORTH KNOWING: this button renders inside a
   cross-origin iframe Google itself controls — it CANNOT be restyled
   with this app's own CSS custom properties/tokens, unlike every other
   button in this app. That's not a shortcut taken here; it's inherent to
   using Google's officially-rendered, policy-compliant button rather
   than a custom-triggered flow. What CAN be controlled is which of
   Google's own preset themes it uses — switched here to track this app's
   light/dark mode, so it harmonizes as closely as Google's API allows.

   `mode` only affects which text Google's button displays
   ("Continue with Google" vs "Sign up with Google") — it does NOT decide
   which backend endpoint gets called; that's the calling page's job
   (Login.jsx calls googleLogin, Register.jsx calls googleRegister),
   keeping this component focused purely on obtaining and forwarding the
   credential.
────────────────────────────────────────────────────────────────────────────── */

export default function GoogleAuthButton({ mode, onCredential, onError, disabled }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`google-auth-button${disabled ? ' google-auth-button--disabled' : ''}`}>
      <GoogleLogin
        theme={isDark ? 'filled_black' : 'outline'}
        size="large"
        // width="100%"
        text={mode === 'register' ? 'signup_with' : 'continue_with'}
        shape="rectangular"
        onSuccess={(credentialResponse) => {
          if (!credentialResponse?.credential) {
            onError?.('Google did not return a valid credential. Please try again.');
            return;
          }
          onCredential(credentialResponse.credential);
        }}
        onError={() => {
          onError?.('Google sign-in was cancelled or failed. Please try again.');
        }}
      />
    </div>
  );
}
