import { apiRequest } from './api';

/**
 * testTakingService.js — UPDATED
 * normalizeTest() now surfaces `scoring` from the API response, so Test.jsx
 * can show the marking scheme on the setup screen before the user starts —
 * a test-taker should know the scoring rules going in, same as a real exam
 * states its marking scheme. `scoring` is a test-level field, unrelated to
 * the per-question correctAnswer-stripping this endpoint already does for
 * integrity (see testService.js backend, getTestForTaking) — showing the
 * marking FORMULA doesn't reveal any answer.
 */

function normalizeTest(test) {
  return {
    id: test._id,
    title: test.title,
    scoring: test.scoring || null,
    questions: test.questions.map(q => ({
      id: q._id,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer ?? null,
      explanation: q.explanation,
      bookmarked: !!q.bookmarked,
    })),
  };
}

export async function getTestForTaking(testId) {
  const { test } = await apiRequest(`/tests/${testId}/take`);
  return normalizeTest(test);
}

export async function getFullTest(testId) {
  const { test } = await apiRequest(`/tests/${testId}`);
  return normalizeTest(test);
}

export async function startAttempt(testId, durationSeconds) {
  const { attempt } = await apiRequest('/attempts', {
    method: 'POST',
    body: { testId, durationSeconds },
  });
  return attempt._id;
}

export async function submitAttempt(attemptId, { answers, markedForReview, timeSpentSeconds, autoSubmitted }) {
  const { attempt } = await apiRequest(`/attempts/${attemptId}/submit`, {
    method: 'POST',
    body: { answers, markedForReview, timeSpentSeconds, autoSubmitted },
  });
  return attempt;
}
