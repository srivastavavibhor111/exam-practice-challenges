const express = require('express');
const router = express.Router();

const attemptController = require('../controllers/attemptController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');
const { aiLimiter } = require('../middleware/rateLimiters');

// UPDATED FOR M17 — aiLimiter applied to /insights (M16's AI call).
// /topic-performance is NOT AI-limited — it's pure deterministic DB
// aggregation, no external API call, so the general limiter is sufficient.

router.post(
  '/',
  validateBody({
    testId:          { required: true, type: 'string', objectId: true },
    durationSeconds: { required: true, type: 'number' },
  }),
  asyncHandler(attemptController.startAttempt)
);

router.post(
  '/:id/submit',
  validateBody({
    answers:          { required: true, type: 'object' },
    markedForReview:  { required: false, type: 'array' },
    timeSpentSeconds: { required: true, type: 'number' },
    autoSubmitted:    { required: false, type: 'boolean' },
  }),
  asyncHandler(attemptController.submitAttempt)
);

router.get('/', asyncHandler(attemptController.listAttempts));
router.get('/mistakes', asyncHandler(attemptController.listMistakes));
router.get('/topic-performance', asyncHandler(attemptController.topicPerformance));
router.get('/insights', aiLimiter, asyncHandler(attemptController.insights));
router.get('/:id', asyncHandler(attemptController.getAttempt));

module.exports = router;
