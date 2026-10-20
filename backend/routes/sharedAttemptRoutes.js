const express = require('express');
const router = express.Router();

const sharedAttemptController = require('../controllers/sharedAttemptController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');

/**
 * sharedAttemptRoutes.js — NEW, mounted at /api/shared-attempts
 * Mirrors the personal attemptRoutes.js structure exactly — same
 * start/submit/get/list shape, same `protect`-at-mount-point pattern.
 *
 * Route ordering note: '/mine' (literal) is registered BEFORE '/:id'
 * (param) — required here, since both are single-segment GET routes and
 * Express would otherwise let '/:id' swallow a request to '/mine'.
 */

router.post(
  '/',
  validateBody({
    testId: { required: true, type: 'string', minLength: 1 }, // the ST-XXXX-YYYY string, not a Mongo ObjectId
  }),
  asyncHandler(sharedAttemptController.startAttempt)
);

router.post(
  '/:id/submit',
  validateBody({
    answers:          { required: true, type: 'object' },
    markedForReview:  { required: false, type: 'array' },
    timeSpentSeconds: { required: true, type: 'number' },
    autoSubmitted:    { required: false, type: 'boolean' },
  }),
  asyncHandler(sharedAttemptController.submitAttempt)
);

router.get('/mine', asyncHandler(sharedAttemptController.listMine));
router.get('/:id', asyncHandler(sharedAttemptController.getAttempt));

module.exports = router;
