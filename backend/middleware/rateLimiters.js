const rateLimit = require('express-rate-limit');

/**
 * rateLimiters.js — NEW for M17
 * ─────────────────────────────────────────────────────────────────────────────
 * Three tiers, because "too many requests" means very different things
 * depending on the endpoint:
 *
 *   generalLimiter — applied to the whole API. Generous — this exists to
 *   catch abuse (a script gone wrong, a scraper), not to throttle normal use.
 *
 *   authLimiter — applied only to /auth/login and /auth/register. Strict —
 *   this is brute-force protection. Ten attempts per 15 minutes is enough
 *   for a real person who mistyped a password twice, not enough for a
 *   credential-stuffing script.
 *
 *   aiLimiter — applied to every endpoint that calls the Gemini API
 *   (extraction, explanations, insights — M9/M16). These cost real money
 *   per request; this exists specifically to bound that cost if something
 *   starts hammering these routes, deliberately or by a runaway retry loop.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const jsonMessage = (message) => ({ error: { message } });

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many requests. Please slow down and try again shortly.'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('Too many attempts. Please wait a few minutes before trying again.'),
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: jsonMessage('You have made too many AI requests this hour. Please try again later.'),
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
