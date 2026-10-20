const questionService = require('../services/questionService');

// UPDATED FOR M16 — one new handler: explainQuestion.

async function bulkCreate(req, res) {
  const { sourceId, questions } = req.body;
  const created = await questionService.bulkCreate({ userId: req.user.id, sourceId, questions });
  res.status(201).json({ questions: created });
}

async function listBookmarked(req, res) {
  const questions = await questionService.getBookmarkedQuestions(req.user.id);
  res.json({ questions });
}

async function getQuestion(req, res) {
  const question = await questionService.getQuestionById(req.params.id, req.user.id);
  res.json({ question });
}

async function listBySource(req, res) {
  const { sourceId } = req.query;
  const questions = await questionService.listQuestionsBySource(sourceId, req.user.id);
  res.json({ questions });
}

async function updateQuestion(req, res) {
  const question = await questionService.updateQuestion(req.params.id, req.user.id, req.body);
  res.json({ question });
}

// NEW — generates and saves an AI explanation for this question.
async function explainQuestion(req, res) {
  const question = await questionService.explainQuestion(req.params.id, req.user.id);
  res.json({ question });
}

async function deleteQuestion(req, res) {
  await questionService.deleteQuestion(req.params.id, req.user.id);
  res.status(204).send();
}

module.exports = { bulkCreate, listBookmarked, getQuestion, listBySource, updateQuestion, explainQuestion, deleteQuestion };
