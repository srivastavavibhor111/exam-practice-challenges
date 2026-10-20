const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const asyncHandler = require('../utils/asyncHandler');

// `protect` is applied at the mount point in routes/index.js, same
// pattern as every other resource router in this app — not repeated here.
router.get('/progress', asyncHandler(analyticsController.getProgress));

module.exports = router;
