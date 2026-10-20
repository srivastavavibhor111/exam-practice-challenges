const recaptchaService = require('../services/recaptchaService');
const AppError = require('../utils/AppError');

/**
 * verifyRecaptcha.js — NEW middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * THE key piece that lets authController.js's existing register()/login()
 * functions stay completely unmodified. reCAPTCHA verification happens
 * entirely here, as a precondition BEFORE the request ever reaches the
 * controller — the controller has no idea this check even exists. This
 * is what "additional security layer" means architecturally, not just
 * as a phrase: it's inserted into the route's middleware chain, not
 * woven into the business logic it's protecting.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function verifyRecaptchaMiddleware(req, res, next) {
  try {
    const { recaptchaToken } = req.body;
    const isValid = await recaptchaService.verifyRecaptcha(recaptchaToken);

    if (!isValid) {
      return next(new AppError(400, 'reCAPTCHA verification failed. Please try again.'));
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = verifyRecaptchaMiddleware;
