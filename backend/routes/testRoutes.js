const express = require('express');
const router = express.Router();

const testController = require('../controllers/testController');
const asyncHandler = require('../utils/asyncHandler');
const { validateBody } = require('../middleware/validation');

// UPDATED — /  now accepts an optional `scoring` object. Its internal
// shape (marksPerCorrect, negativeMarksPerIncorrect, negativeMarkingRule)
// is validated inside testService.createTest, not here — consistent with
// how this app already validates other nested/domain-specific values
// (e.g. Gemini API key length) at the service layer rather than in the
// generic validateBody rules.

router.post(
  '/',
  validateBody({
    title:       { required: true, type: 'string', minLength: 1 },
    sourceId:    { required: false, type: 'string', objectId: true },
    questionIds: { required: true, type: 'array', minLength: 1 },
    settings:    { required: false, type: 'object' },
    scoring:     { required: false, type: 'object' },
  }),
  asyncHandler(testController.createTest)
);

router.post(
  '/practice',
  validateBody({
    title:       { required: true, type: 'string', minLength: 1 },
    questionIds: { required: true, type: 'array', minLength: 1 },
  }),
  asyncHandler(testController.createPracticeTest)
);

router.get('/', asyncHandler(testController.listTests));
router.get('/:id/take', asyncHandler(testController.getTestForTaking));
router.get('/:id', asyncHandler(testController.getTest));
router.put('/:id', asyncHandler(testController.updateTest));
router.delete('/:id', asyncHandler(testController.deleteTest));

module.exports = router;
