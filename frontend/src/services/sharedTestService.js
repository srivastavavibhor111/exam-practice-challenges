import { apiRequest } from './api';

/**
 * sharedTestService.js (frontend) — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps every /api/shared-tests and /api/shared-attempts endpoint. Same
 * _id → id normalization every other service file in this app performs
 * at its own boundary.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function normalizeSharedQuestion(q) {
  return {
    id: q._id,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer ?? null,
    explanation: q.explanation,
  };
}

function normalizeSharedTest(t) {
  return {
    id: t._id,
    testId: t.testId,
    title: t.title,
    scoring: t.scoring,
    durationSeconds: t.durationSeconds,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    status: t.status, // 'active' | 'expired' — computed server-side, always trusted from there
    questions: Array.isArray(t.questions) ? t.questions.map(normalizeSharedQuestion) : [],
    questionCount: Array.isArray(t.questions) ? t.questions.length : 0,
  };
}

function normalizeSharedAttempt(a) {
  return {
    id: a._id,
    sharedTestObjectId: a.sharedTest?._id || a.sharedTest,
    sharedTestId: a.sharedTest?.testId,
    sharedTestTitle: a.sharedTest?.title,
    answers: a.answers || {},
    markedForReview: a.markedForReview || [],
    status: a.status,
    durationSeconds: a.durationSeconds,
    timeSpentSeconds: a.timeSpentSeconds,
    submittedAt: a.submittedAt,
    results: a.results,
    questions: a.sharedTest?.questions ? a.sharedTest.questions.map(normalizeSharedQuestion) : undefined,
  };
}

// ── Creating & configuring ──

export async function createSharedTest({ title, questions, scoring, durationSeconds }) {
  const { sharedTest } = await apiRequest('/shared-tests', {
    method: 'POST',
    body: {
      title,
      questions: questions.map(q => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic || '',
      })),
      scoring,
      durationSeconds,
    },
  });
  return normalizeSharedTest(sharedTest);
}

// ── Joining & taking ──

export async function lookupSharedTest(testId) {
  const { sharedTest } = await apiRequest(`/shared-tests/lookup/${encodeURIComponent(testId.trim())}`);
  return normalizeSharedTest(sharedTest);
}

export async function getSharedTestForTaking(testId) {
  const { sharedTest } = await apiRequest(`/shared-tests/${encodeURIComponent(testId)}/take`);
  return normalizeSharedTest(sharedTest);
}

export async function startSharedAttempt(testId) {
  const { attempt } = await apiRequest('/shared-attempts', {
    method: 'POST',
    body: { testId },
  });
  return attempt._id;
}

export async function submitSharedAttempt(attemptId, { answers, markedForReview, timeSpentSeconds, autoSubmitted }) {
  const { attempt } = await apiRequest(`/shared-attempts/${attemptId}/submit`, {
    method: 'POST',
    body: { answers, markedForReview, timeSpentSeconds, autoSubmitted },
  });
  return normalizeSharedAttempt(attempt);
}

export async function getSharedAttempt(attemptId) {
  const { attempt } = await apiRequest(`/shared-attempts/${attemptId}`);
  return normalizeSharedAttempt(attempt);
}

// ── Lists ──

export async function listMySharedTests() {
  const { sharedTests } = await apiRequest('/shared-tests/mine');
  return sharedTests.map(normalizeSharedTest);
}

export async function listMySharedAttempts() {
  const { attempts } = await apiRequest('/shared-attempts/mine');
  return attempts.map(normalizeSharedAttempt);
}

export async function getSharedBookmarks() {
  const { questions } = await apiRequest('/shared-tests/bookmarks');
  return questions.map(q => ({
    id: q.id,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    sharedTestId: q.sharedTestId,
    sharedTestTitle: q.sharedTestTitle,
  }));
}

export async function getSharedMistakes() {
  const { mistakes } = await apiRequest('/shared-tests/mistakes');
  return mistakes.map(m => ({
    id: m.id,
    text: m.text,
    options: m.options,
    correctAnswer: m.correctAnswer,
    explanation: m.explanation,
    yourAnswer: m.yourAnswer,
    sharedTestId: m.sharedTestId,
    sharedTestTitle: m.sharedTestTitle,
    lastAttemptedAt: m.lastAttemptedAt,
  }));
}

export async function toggleSharedBookmark(sharedTestObjectId, questionId, bookmarked) {
  return apiRequest(`/shared-tests/${sharedTestObjectId}/questions/${questionId}/bookmark`, {
    method: 'PUT',
    body: { bookmarked },
  });
}
