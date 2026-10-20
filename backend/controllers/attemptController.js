const attemptService = require('../services/attemptService');
const insightsService = require('../services/insightsService');

// UPDATED FOR M16 — two new handlers: topicPerformance, insights.

async function startAttempt(req, res) {
  const { testId, durationSeconds } = req.body;
  const attempt = await attemptService.startAttempt({ userId: req.user.id, testId, durationSeconds });
  res.status(201).json({ attempt });
}

async function submitAttempt(req, res) {
  const { answers, markedForReview, timeSpentSeconds, autoSubmitted } = req.body;
  const attempt = await attemptService.submitAttempt(req.params.id, req.user.id, {
    answers, markedForReview, timeSpentSeconds, autoSubmitted,
  });
  res.json({ attempt });
}

async function getAttempt(req, res) {
  const attempt = await attemptService.getAttemptById(req.params.id, req.user.id);
  res.json({ attempt });
}

async function listAttempts(req, res) {
  const { testId } = req.query;
  const attempts = testId
    ? await attemptService.listAttemptsForTest(testId, req.user.id)
    : await attemptService.listAttemptsForUser(req.user.id);
  res.json({ attempts });
}

async function listMistakes(req, res) {
  const mistakes = await attemptService.getMistakes(req.user.id);
  res.json({ mistakes });
}

// NEW — deterministic, code-computed accuracy per topic (weakest first).
async function topicPerformance(req, res) {
  const topics = await attemptService.getTopicPerformance(req.user.id);
  res.json({ topics });
}

// NEW — AI-written narrative over already-computed stats. See
// insightsService.js for the deterministic-first, AI-narrates-only split.
async function insights(req, res) {
  const result = await insightsService.generateInsights(req.user.id);
  res.json(result);
}

module.exports = { startAttempt, submitAttempt, getAttempt, listAttempts, listMistakes, topicPerformance, insights };
