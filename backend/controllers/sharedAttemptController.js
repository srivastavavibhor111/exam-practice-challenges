const sharedTestService = require('../services/sharedTestService');

async function startAttempt(req, res) {
  const { testId } = req.body;
  const attempt = await sharedTestService.startSharedAttempt({ userId: req.user.id, testId });
  res.status(201).json({ attempt });
}

async function submitAttempt(req, res) {
  const { answers, markedForReview, timeSpentSeconds, autoSubmitted } = req.body;
  const attempt = await sharedTestService.submitSharedAttempt(req.params.id, req.user.id, {
    answers, markedForReview, timeSpentSeconds, autoSubmitted,
  });
  res.json({ attempt });
}

async function getAttempt(req, res) {
  const attempt = await sharedTestService.getSharedAttemptById(req.params.id, req.user.id);
  res.json({ attempt });
}

async function listMine(req, res) {
  const attempts = await sharedTestService.listSharedAttemptsForUser(req.user.id);
  res.json({ attempts });
}

module.exports = { startAttempt, submitAttempt, getAttempt, listMine };
