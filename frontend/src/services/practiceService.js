import { apiRequest } from './api';

/**
 * practiceService.js — Wraps the M15 endpoints:
 * GET /api/questions/bookmarked, GET /api/attempts/mistakes,
 * PUT /api/questions/:id (bookmark toggle), POST /api/tests/practice
 * ─────────────────────────────────────────────────────────────────────────────
 * Same _id → id normalization every other service performs at its own
 * boundary (see extractionService.js, testTakingService.js, resultService.js).
 * ─────────────────────────────────────────────────────────────────────────────
 */

function normalizeQuestion(q) {
  return {
    id: q._id,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    bookmarked: !!q.bookmarked,
  };
}

export async function getBookmarked() {
  const { questions } = await apiRequest('/questions/bookmarked');
  return questions.map(normalizeQuestion);
}

export async function getMistakes() {
  const { mistakes } = await apiRequest('/attempts/mistakes');
  return mistakes.map(m => ({
    ...normalizeQuestion(m),
    testId: m.testId,
    testTitle: m.testTitle,
    lastAttemptedAt: m.lastAttemptedAt,
    yourAnswer: m.yourAnswer,
  }));
}

export async function toggleBookmark(questionId, bookmarked) {
  const { question } = await apiRequest(`/questions/${questionId}`, {
    method: 'PUT',
    body: { bookmarked },
  });
  return question;
}

export async function createPracticeTest(title, questionIds) {
  const { test } = await apiRequest('/tests/practice', {
    method: 'POST',
    body: { title, questionIds },
  });
  return { id: test._id, title: test.title };
}
