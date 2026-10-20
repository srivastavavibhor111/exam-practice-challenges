const express = require('express');
const router = express.Router();

const extractionController = require('../controllers/extractionController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');
const { aiLimiter } = require('../middleware/rateLimiters');

// UPDATED FOR M17 — aiLimiter applied to both endpoints: each of these
// calls the Gemini API and costs real money per request.

router.post(
  '/text',
  aiLimiter,
  validateBody({
    rawText: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(extractionController.extractText)
);

router.post(
  '/link',
  aiLimiter,
  validateBody({
    url: { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(extractionController.extractLink)
);

module.exports = router;
