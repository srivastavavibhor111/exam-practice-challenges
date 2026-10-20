const attemptService = require('../services/attemptService');

/**
 * analyticsController.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /api/analytics/progress?groupBy=day|week|month&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * req.user.id is only ever set by the `protect` middleware (which this
 * route is mounted behind — see routes/index.js) — this is what
 * guarantees the analytics returned are always the authenticated user's
 * own data, never anyone else's.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_GROUP_BY = ['day', 'week', 'month'];

function parseDateParam(value) {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : value; // ignore malformed dates rather than erroring
}

async function getProgress(req, res) {
  const { groupBy, startDate, endDate } = req.query;

  const validGroupBy = VALID_GROUP_BY.includes(groupBy) ? groupBy : 'week';

  const data = await attemptService.getProgressAnalytics(req.user.id, {
    groupBy: validGroupBy,
    startDate: parseDateParam(startDate),
    endDate: parseDateParam(endDate),
  });

  res.json(data);
}

module.exports = { getProgress };
