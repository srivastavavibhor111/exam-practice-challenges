const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;

/**
 * rateLimiters.js — UPDATED (auth rate-limit fix)
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG: one shared `authLimiter` (10 requests / 15 min / IP) sat on
 * register, login and all three Google routes. It counted EVERY request —
 * successful ones too — against ONE per-IP bucket, so a few logins, a signup
 * and a Google sign-in from the same network could lock everyone on that IP
 * out of every auth page.
 *
 * WHAT IT IS NOW — separate limiters, each with one clear job:
 *
 *   loginIpLimiter       per IP.      Counts only FAILED login attempts.
 *   loginAccountLimiter  per email.   Counts only FAILED attempts on that
 *                                     account, so one account being hammered
 *                                     never uses up the IP's budget for others.
 *   registerLimiter      per IP.      Counts ALL signup requests (successful
 *                                     too) — account creation is what abuse
 *                                     looks like, so successes must count.
 *   googleFailureLimiter per IP.      Counts only failed Google sign-in calls.
 *
 * "Failed" = HTTP status >= 400. A 429 produced by loginAccountLimiter is
 * deliberately NOT counted against the IP bucket (see requestWasSuccessful).
 *
 * All counters live in memory (express-rate-limit's default store). They reset
 * when the server restarts or Render cold-starts the app — fine for a single
 * instance. If you ever run more than one instance, switch to a shared store.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Tune here. Everything else in this file reads from this one block.
const LIMITS = {
  general:         { windowMs: 15 * MINUTE, max: 300 },
  loginIp:         { windowMs: 15 * MINUTE, max: 30 },  // failed logins per IP
  loginAccount:    { windowMs: 15 * MINUTE, max: 10 },  // failed logins per email
  register:        { windowMs: 1 * HOUR,    max: 20 },  // all signups per IP
  googleFailures:  { windowMs: 15 * MINUTE, max: 30 },  // failed Google calls per IP
  ai:              { windowMs: 1 * HOUR,    max: 30 },
};

const jsonMessage = (message) => ({ error: { message } });

/**
 * Logs WHICH limiter fired and for which IP key — never the email or any
 * credential. This is what lets you confirm on Render whether req.ip is the
 * real visitor IP (see trust proxy in server.js).
 */
function makeHandler(name) {
  return (req, res, next, options) => {
    console.warn(`[rate-limit] "${name}" blocked key-ip=${req.ip} path=${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  };
}

const base = {
  standardHeaders: true,   // RateLimit-* and Retry-After on 429s
  legacyHeaders: false,
};

// Counts only failed requests. 429s from loginAccountLimiter are treated as
// "not the IP's fault" so one hammered account can't drain the shared IP bucket.
const countOnlyFailures = {
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400 || res.statusCode === 429,
};

// Must match authService.login()'s own normalisation (lowercase + trim).
// Capped at the User schema's 254-char email limit so a huge request body
// can't be used to bloat the in-memory counter store.
function normalizeEmail(value) {
  return String(value).toLowerCase().trim().slice(0, 254);
}

const generalLimiter = rateLimit({
  ...base,
  ...LIMITS.general,
  handler: makeHandler('general'),
  message: jsonMessage('Too many requests. Please slow down and try again shortly.'),
});

const loginIpLimiter = rateLimit({
  ...base,
  ...countOnlyFailures,
  ...LIMITS.loginIp,
  handler: makeHandler('loginIp'),
  message: jsonMessage('Too many failed sign-in attempts from this network. Please wait a few minutes and try again.'),
});

// Keyed on the SUBMITTED email, whether or not an account exists, so the
// response never reveals which emails are registered. Mount it AFTER
// validateBody so req.body.email is guaranteed to be a string.
const loginAccountLimiter = rateLimit({
  ...base,
  ...countOnlyFailures,
  ...LIMITS.loginAccount,
  keyGenerator: (req) => {
    const email = req.body?.email;
    return typeof email === 'string' && email.trim()
      ? `acct:${normalizeEmail(email)}`
      : `ip:${ipKeyGenerator(req.ip)}`;
  },
  handler: makeHandler('loginAccount'),
  message: jsonMessage('Too many failed attempts for this account. Please wait a few minutes before trying again.'),
});

const registerLimiter = rateLimit({
  ...base,
  ...LIMITS.register,
  handler: makeHandler('register'),
  message: jsonMessage('Too many sign-up attempts from this network. Please try again later.'),
});

const googleFailureLimiter = rateLimit({
  ...base,
  ...countOnlyFailures,
  ...LIMITS.googleFailures,
  handler: makeHandler('googleFailures'),
  message: jsonMessage('Too many failed Google sign-in attempts. Please wait a few minutes and try again.'),
});

const aiLimiter = rateLimit({
  ...base,
  ...LIMITS.ai,
  handler: makeHandler('ai'),
  message: jsonMessage('You have made too many AI requests this hour. Please try again later.'),
});

module.exports = {
  generalLimiter,
  loginIpLimiter,
  loginAccountLimiter,
  registerLimiter,
  googleFailureLimiter,
  aiLimiter,
  // Kept so any file not shown to me that still imports `authLimiter` doesn't
  // crash on startup. authRoutes.js no longer uses it. Safe to delete once
  // `grep -rn authLimiter backend` shows no other users.
  authLimiter: loginIpLimiter,
};
