const googleAuthService = require('../services/googleAuthService');
const authService = require('../services/authService');

/**
 * googleAuthController.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Owns the distinction between the two cookie types used here:
 *   - `token` — the REAL session cookie, identical to what local
 *     login/register already issue (same cookieOptions logic, copied
 *     from authController.js rather than imported, to keep this file
 *     fully independent of the existing one — see setup notes for why).
 *   - `pendingGoogleAuth` — the SHORT-LIVED, RESTRICTED cookie, only
 *     ever set when a brand-new Google user still needs to provide a
 *     Gemini key, and only ever read by protectPendingGoogle.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TOKEN_COOKIE_NAME = 'token';
const PENDING_COOKIE_NAME = 'pendingGoogleAuth';
const TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days — matches local login
const PENDING_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;           // 15 minutes — matches the pending JWT's own expiry

function isProd() {
  return process.env.NODE_ENV === 'production';
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    maxAge: TOKEN_COOKIE_MAX_AGE_MS,
  };
}

function pendingCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
    maxAge: PENDING_COOKIE_MAX_AGE_MS,
  };
}

function clearCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: isProd() ? 'none' : 'lax',
  };
}

async function googleLogin(req, res) {
  const { credential } = req.body;
  const googleIdentity = await googleAuthService.verifyGoogleToken(credential);
  const result = await authService.googleLogin(googleIdentity);

  res.cookie(TOKEN_COOKIE_NAME, result.token, sessionCookieOptions());
  res.json({ user: result.user });
}

async function googleRegister(req, res) {
  const { credential } = req.body;
  const googleIdentity = await googleAuthService.verifyGoogleToken(credential);
  const result = await authService.googleRegister(googleIdentity);

  if (result.status === 'logged_in') {
    res.cookie(TOKEN_COOKIE_NAME, result.token, sessionCookieOptions());
    return res.json({ status: 'logged_in', user: result.user });
  }

  // status === 'needs_gemini_key' — this account does not exist yet.
  // Issue ONLY the restricted pending cookie, never the real session one.
  res.cookie(PENDING_COOKIE_NAME, result.pendingToken, pendingCookieOptions());
  res.json({ status: 'needs_gemini_key', name: result.name, email: result.email });
}

async function completeGoogleRegistration(req, res) {
  const { geminiApiKey } = req.body;
  // req.pendingGoogle was set by protectPendingGoogle — a verified,
  // still-valid pending token was required just to reach this line.
  const result = await authService.completeGoogleRegistration(req.pendingGoogle, geminiApiKey);

  res.clearCookie(PENDING_COOKIE_NAME, clearCookieBaseOptions());
  res.cookie(TOKEN_COOKIE_NAME, result.token, sessionCookieOptions());
  res.json({ user: result.user });
}

module.exports = { googleLogin, googleRegister, completeGoogleRegistration };
