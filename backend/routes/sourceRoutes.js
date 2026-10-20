const express = require('express');
const router = express.Router();

const sourceController = require('../controllers/sourceController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');

/**
 * sourceRoutes.js — /api/sources — UPDATED FOR M11
 * `userId` removed from validation entirely — it's no longer client input.
 * `protect` is applied once, at the mount point in routes/index.js, not here.
 */

router.post(
  '/',
  validateBody({
    sourceType:      { required: true, type: 'string', enum: ['text', 'chatgpt_link'] },
    sourceReference: { required: false, type: 'string' },
    rawContent:      { required: true, type: 'string', minLength: 1 },
  }),
  asyncHandler(sourceController.createSource)
);

router.get('/', asyncHandler(sourceController.listSources));
router.get('/:id', asyncHandler(sourceController.getSource));
router.delete('/:id', asyncHandler(sourceController.deleteSource));

module.exports = router;
