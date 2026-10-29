const express = require('express');
const router = express.Router();

const sharedTestController = require('../controllers/sharedTestController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');
const AppError = require('../utils/AppError');

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
router.get('/joined', asyncHandler(sharedTestController.listJoined));
router.get('/bookmarks', asyncHandler(sharedTestController.listMyBookmarks));
router.get('/mistakes', asyncHandler(sharedTestController.listMyMistakes));

// Join-validation lookup — format/existence/expiration check, does NOT
// start an attempt (see sharedAttemptRoutes.js's POST / for that).
router.get('/lookup/:testId', asyncHandler(sharedTestController.lookupSharedTest));

// Answer-stripped fetch, used right before starting — same integrity
// principle as the personal GET /api/tests/:id/take.
router.get('/:testId/take', asyncHandler(sharedTestController.getSharedTestForTaking));

// Details for the expired/active details page: metadata + the caller's OWN
// attempts only. Access (expired → participants only) is enforced in the service.
router.get('/:testId/details', asyncHandler(sharedTestController.getDetails));

// "Delete from my account": removes ONLY the caller's own attempts, bookmarks,
// folder links (and the creator's "Created by me" entry). The Shared Test
// itself and every other user's data are untouched.
router.delete('/:testId/my-data', asyncHandler(sharedTestController.removeFromMyAccount));

// Shared Tests are permanent: no user, creator included, can delete one.
// No delete route ever existed — this explicit handler makes that a stated
// rule (a clear 405) rather than an accident of routing, and stops a future
// careless route from quietly adding deletion.
router.delete('/:testId', (req, res, next) => {
  next(new AppError(405, 'Shared Tests cannot be deleted.'));
});

router.put(
  '/:sharedTestObjectId/questions/:questionId/bookmark',
  validateBody({
    bookmarked: { required: true, type: 'boolean' },
  }),
  asyncHandler(sharedTestController.toggleBookmark)
);

module.exports = router;
