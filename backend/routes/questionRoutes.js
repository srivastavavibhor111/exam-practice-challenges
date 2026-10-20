const express = require('express');
const router = express.Router();

const questionController = require('../controllers/questionController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');
const { aiLimiter } = require('../middleware/rateLimiters');

// UPDATED FOR M17 — aiLimiter applied to /:id/explain (M16's AI call).

router.post(
  '/bulk',
  validateBody({
    sourceId:  { required: false, type: 'string', objectId: true },
    questions: { required: true, type: 'array', minLength: 1 },
  }),
  asyncHandler(questionController.bulkCreate)
);

router.get('/', asyncHandler(questionController.listBySource));
router.get('/bookmarked', asyncHandler(questionController.listBookmarked));
router.get('/:id', asyncHandler(questionController.getQuestion));
router.put('/:id', asyncHandler(questionController.updateQuestion));
router.post('/:id/explain', aiLimiter, asyncHandler(questionController.explainQuestion));
router.delete('/:id', asyncHandler(questionController.deleteQuestion));

module.exports = router;
