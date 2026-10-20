const { Question } = require('../models');
const AppError = require('../utils/AppError');
const assertOwnership = require('../utils/assertOwnership');
const explanationService = require('./explanationService');
const authService = require('./authService');

/**
 * questionService.js — UPDATED
 * explainQuestion() now resolves the caller's effective Gemini API key
 * (their own stored key, or the server's fallback) before generating the
 * explanation. Everything else is unchanged.
 */

const EDITABLE_FIELDS = ['text', 'options', 'correctAnswer', 'explanation', 'topic', 'difficulty', 'bookmarked'];

async function bulkCreate({ userId, sourceId, questions }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new AppError(400, 'questions must be a non-empty array');
  }

  const docs = questions.map(q => ({
    user: userId,
    source: sourceId || null,
    text: q.text,
    options: q.options || { A: '', B: '', C: '', D: '' },
    correctAnswer: q.correctAnswer || null,
    explanation: q.explanation || '',
    topic: q.topic || '',
    difficulty: q.difficulty || null,
  }));

  return Question.insertMany(docs);
}

async function getQuestionById(id, userId) {
  const question = await Question.findById(id);
  assertOwnership(question, userId, 'Question');
  return question;
}

async function listQuestionsBySource(sourceId, userId) {
  return Question.find({ source: sourceId, user: userId, test: null }).sort({ createdAt: 1 });
}

async function getBookmarkedQuestions(userId) {
  return Question.find({ user: userId, bookmarked: true }).sort({ updatedAt: -1 });
}

async function updateQuestion(id, userId, updates) {
  const question = await Question.findById(id);
  assertOwnership(question, userId, 'Question');

  for (const field of EDITABLE_FIELDS) {
    if (updates[field] !== undefined) {
      question[field] = updates[field];
    }
  }

  await question.save();
  return question;
}

async function explainQuestion(id, userId) {
  const question = await Question.findById(id);
  assertOwnership(question, userId, 'Question');

  const apiKey = await authService.getEffectiveGeminiApiKey(userId);
  const explanation = await explanationService.generateExplanation(question, apiKey);
  question.explanation = explanation;
  await question.save();

  return question;
}

async function deleteQuestion(id, userId) {
  const question = await Question.findById(id);
  assertOwnership(question, userId, 'Question');
  await question.deleteOne();
}

module.exports = {
  bulkCreate,
  getQuestionById,
  listQuestionsBySource,
  getBookmarkedQuestions,
  updateQuestion,
  explainQuestion,
  deleteQuestion,
};
