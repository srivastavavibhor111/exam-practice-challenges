import { apiRequest } from './api';

/**
 * resultService.js — UPDATED FOR M15
 * ─────────────────────────────────────────────────────────────────────────────
 * One field added: `bookmarked` is now included when normalizing each
 * question, so Result.jsx (M15's other change) can show the current
 * bookmark state on each review card and let the user toggle it right
 * there — bookmarking a question is meant to happen exactly where you'd
 * naturally think to do it: while reviewing whether you got it right.
 * Everything else is unchanged from M13.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function normalizeQuestion(q) {
  return {
    id: q._id,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer ?? null,
    explanation: q.explanation,
    bookmarked: !!q.bookmarked,
  };
}

export async function getAttemptResult(attemptId) {
  const { attempt } = await apiRequest(`/attempts/${attemptId}`);

  return {
    questions:     attempt.test.questions.map(normalizeQuestion),
    answers:       attempt.answers || {},
    marked:        attempt.markedForReview || [],
    timeSpent:     attempt.timeSpentSeconds || 0,
    duration:      attempt.durationSeconds,
    testId:        attempt.test._id,
    status:        attempt.status,
    serverResults: attempt.results,
  };
}
