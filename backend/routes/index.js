const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');

/**
 * routes/index.js — UPDATED (+ /folders mount)
 * One new mount: /analytics, protected the same way every other resource
 * router already is.
 */

router.use('/auth', require('./authRoutes')); // public — no protect here, obviously

router.use('/sources',    protect, require('./sourceRoutes'));
router.use('/questions',  protect, require('./questionRoutes'));
router.use('/tests',      protect, require('./testRoutes'));
router.use('/attempts',   protect, require('./attemptRoutes'));
router.use('/extraction', protect, require('./extractionRoutes'));
router.use('/analytics',  protect, require('./analyticsRoutes')); // NEW
router.use('/shared-tests',    protect, require('./sharedTestRoutes'));
router.use('/shared-attempts', protect, require('./sharedAttemptRoutes'));
router.use('/folders',         protect, require('./folderRoutes'));        // NEW — Custom Test Folders


module.exports = router;
