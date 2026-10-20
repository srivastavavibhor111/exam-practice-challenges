const authService = require('../services/authService');
const AppError = require('../utils/AppError');

/**
 * protectPendingGoogle.js — NEW middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads and verifies ONLY the `pendingGoogleAuth` cookie — a completely
 * separate, short-lived, differently-shaped token from the real session
 * cookie (`token`). This is what makes the "restricted, can't access
 * protected routes" requirement true by construction rather than by
 * convention: the real `protect` middleware (middleware/auth.js) never
 * reads this cookie, and this middleware never reads `token`. There is
 * no code path where a pending-registration token grants access to
 * Dashboard, My Tests, or anything else — not because something checks
 * and blocks it, but because nothing in that path looks at it at all.
 *
 * Used by exactly one route: POST /api/auth/google/complete-registration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function protectPendingGoogle(req, res, next) {
  try {
    const token = req.cookies?.pendingGoogleAuth;

    if (!token) {
      return next(new AppError(401, 'Your Google sign-up session has expired. Please start again.'));
    }

    let decoded;
    try {
      decoded = authService.verifyPendingGoogleToken(token);
    } catch {
      return next(new AppError(401, 'Your Google sign-up session has expired. Please start again.'));
    }

    req.pendingGoogle = { googleId: decoded.googleId, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = protectPendingGoogle;
