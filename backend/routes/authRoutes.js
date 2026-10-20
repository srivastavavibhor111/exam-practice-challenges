const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const googleAuthController = require('../controllers/googleAuthController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');
const protect = require('../middleware/auth');
const protectPendingGoogle = require('../middleware/protectPendingGoogle');
const verifyRecaptcha = require('../middleware/verifyRecaptcha');
const { authLimiter } = require('../middleware/rateLimiters');

/**
 * authRoutes.js — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * Existing /register and /login: UNCHANGED except for one new middleware
 * (verifyRecaptcha) inserted into the chain, and one new required field
 * (recaptchaToken) added to validateBody. authController.register and
 * authController.login themselves were NOT modified — verifyRecaptcha
 * runs and resolves BEFORE the request ever reaches them; if it fails,
 * the controller never even runs. Every existing field, validation rule,
 * and the controller functions themselves are byte-for-byte unchanged.
 *
 * Everything else — /google/login, /google/register,
 * /google/complete-registration — is new.
 *
 * NOTE ON reCAPTCHA + Google routes: deliberately NOT applied to
 * /google/login or /google/register. Google's own Identity Services flow
 * already requires a real, authenticated Google account to reach this
 * endpoint at all — meaningful bot resistance the email/password form
 * doesn't have on its own. Layering reCAPTCHA on top adds friction
 * without a proportional security gain for this specific vector. This
 * was a deliberate choice, not an oversight — see the "where appropriate"
 * language in the original spec, which left this open.
 * ─────────────────────────────────────────────────────────────────────────────
 */

router.post(
  '/register',
  authLimiter,
  verifyRecaptcha,
  validateBody({
    name:           { required: true, type: 'string', minLength: 1 },
    email:          { required: true, type: 'string', minLength: 3 },
    password:       { required: true, type: 'string', minLength: 8 },
    geminiApiKey:   { required: true, type: 'string', minLength: 20 },
    recaptchaToken: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(authController.register)
);

router.post(
  '/login',
  authLimiter,
  verifyRecaptcha,
  validateBody({
    email:          { required: true, type: 'string', minLength: 1 },
    password:       { required: true, type: 'string', minLength: 1 },
    recaptchaToken: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(authController.login)
);

router.post('/logout', asyncHandler(authController.logout));

router.get('/me', protect, asyncHandler(authController.me));

router.put(
  '/profile',
  protect,
  validateBody({
    name: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(authController.updateProfile)
);

router.put(
  '/password',
  protect,
  validateBody({
    currentPassword: { required: true, type: 'string', minLength: 1 },
    newPassword:     { required: true, type: 'string', minLength: 8 },
  }),
  asyncHandler(authController.changePassword)
);

router.put(
  '/gemini-key',
  protect,
  validateBody({
    geminiApiKey: { required: true, type: 'string', minLength: 20 },
  }),
  asyncHandler(authController.updateGeminiApiKey)
);

router.delete('/account', protect, asyncHandler(authController.deleteAccount));

/* ── Google authentication — all new ── */

router.post(
  '/google/login',
  authLimiter,
  validateBody({
    credential: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(googleAuthController.googleLogin)
);

router.post(
  '/google/register',
  authLimiter,
  validateBody({
    credential: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(googleAuthController.googleRegister)
);

router.post(
  '/google/complete-registration',
  authLimiter,
  protectPendingGoogle,
  validateBody({
    geminiApiKey: { required: true, type: 'string', minLength: 20 },
  }),
  asyncHandler(googleAuthController.completeGoogleRegistration)
);

module.exports = router;
