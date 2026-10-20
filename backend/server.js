require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const sanitizeInputs = require('./middleware/sanitize');
const { generalLimiter } = require('./middleware/rateLimiters');

/**
 * server.js — UPDATED FOR M17
 * ─────────────────────────────────────────────────────────────────────────────
 * Three additions from the M11 version, in the order they're applied:
 *
 *   1. helmet() — sets a standard set of security-related HTTP headers
 *      (X-Content-Type-Options, X-Frame-Options, etc.) that were simply
 *      never set before. One line, no configuration needed for this app's
 *      needs.
 *
 *   2. sanitizeInputs — strips MongoDB-operator-shaped keys ('$...', keys
 *      containing '.') from every request's body/query/params, closing
 *      the NoSQL injection surface described in middleware/sanitize.js.
 *      Placed AFTER express.json() (needs a parsed body to sanitize) but
 *      BEFORE the routes.
 *
 *   3. generalLimiter — applied globally, catches abusive request volume
 *      before it reaches any route. Stricter limiters (auth, AI) are
 *      applied at the specific routes that need them — see
 *      routes/authRoutes.js and the AI-calling routes.
 *
 * Also added: process-level safety nets. An unhandled promise rejection or
 * uncaught exception used to fail silently or crash without any log —
 * now both are logged clearly, and an uncaught exception still exits the
 * process (continuing to run after one is riskier than restarting, since
 * the process's state may be corrupted in ways that are hard to reason about).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * server.js — UPDATED FOR M18
 * ─────────────────────────────────────────────────────────────────────────────
 * Two additions from the M17 version:
 *
 *   1. app.set('trust proxy', 1) — Render (and virtually every hosting
 *      platform) sits a reverse proxy in front of your app. Without this,
 *      Express sees every request as coming from the proxy's IP, not the
 *      real visitor's — which breaks express-rate-limit (M17): every user
 *      would share one rate-limit bucket, meaning one busy user could get
 *      everyone else rate-limited. Harmless to set locally too (no proxy
 *      in front in dev, so this is a no-op there).
 *
 *   2. GET /health — a trivial, unauthenticated endpoint that just confirms
 *      the server is alive. Render's free tier spins the app down after 15
 *      minutes of inactivity and takes 30-60 seconds to cold-start on the
 *      next request. Pinging this endpoint every few minutes from a free
 *      uptime monitor (e.g. UptimeRobot, cron-job.org — see DEPLOYMENT.md)
 *      keeps the app warm, trading a little bit of "always-on-ish" free
 *      hosting for zero cost. Placed before the rate limiter so monitoring
 *      pings never count against or get blocked by it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();

app.set('trust proxy', 1);

connectDB();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(sanitizeInputs);

// Health check — before rate limiting, so uptime pings are never throttled.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(generalLimiter);

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
});

app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
