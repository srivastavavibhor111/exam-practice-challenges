const express = require('express');
const router = express.Router();

const sharedTestController = require('../controllers/sharedTestController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');

/**
 * sharedTestRoutes.js — NEW, mounted at /api/shared-tests
 * `protect` is applied at the mount point in routes/index.js, same
 * pattern as every other resource router — not repeated here.
 *
 * Route ordering note: '/mine', '/bookmarks', '/mistakes' are all
 * single-segment LITERAL paths (not :param routes), so they don't
 * collide with the two-segment '/:testId/take' or three-segment bookmark
 * toggle route regardless of registration order. Kept in this order for
 * readability, not because it's required for correctness here.
 */

router.post(
  '/',
  validateBody({
    title:           { required: true, type: 'string', minLength: 1 },
    questions:       { required: true, type: 'array', minLength: 1 },
    scoring:         { required: false, type: 'object' },
    durationSeconds: { required: true, type: 'number' },
  }),
  asyncHandler(sharedTestController.createSharedTest)
);

router.get('/mine', asyncHandler(sharedTestController.listMine));
router.get('/bookmarks', asyncHandler(sharedTestController.listMyBookmarks));
router.get('/mistakes', asyncHandler(sharedTestController.listMyMistakes));

// Join-validation lookup — format/existence/expiration check, does NOT
// start an attempt (see sharedAttemptRoutes.js's POST / for that).
router.get('/lookup/:testId', asyncHandler(sharedTestController.lookupSharedTest));

// Answer-stripped fetch, used right before starting — same integrity
// principle as the personal GET /api/tests/:id/take.
router.get('/:testId/take', asyncHandler(sharedTestController.getSharedTestForTaking));

router.put(
  '/:sharedTestObjectId/questions/:questionId/bookmark',
  validateBody({
    bookmarked: { required: true, type: 'boolean' },
  }),
  asyncHandler(sharedTestController.toggleBookmark)
);

module.exports = router;
