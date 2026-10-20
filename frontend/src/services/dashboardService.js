import { apiRequest } from './api';

/**
 * dashboardService.js — Wraps GET /api/tests, GET /api/attempts,
 * DELETE /api/tests/:id, plus deterministic stat computation.
 * ─────────────────────────────────────────────────────────────────────────────
 * computeStats() is pure, synchronous, and touches no AI — per architecture
 * rule #13, "basic analytics must be calculated using deterministic
 * application logic." It runs entirely on data already fetched from the
 * two list endpoints; there's no dedicated backend aggregation route,
 * because at this app's scale (a personal practice tool, not an analytics
 * platform) reducing over a user's own tests/attempts client-side is simpler
 * than standing up new backend surface for the same result.
 *
 * Deliberately NOT computed here: "weak areas" or topic-based insight.
 * Question.topic (M7) is never populated by extraction today — building
 * that would mean fabricating a feature the data can't actually support
 * yet. That's explicitly M16 territory ("AI Enhancements — personalized
 * recommendations, performance insights"), not this milestone's job.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function normalizeTest(t) {
  return {
    id: t._id,
    title: t.title,
    questionCount: Array.isArray(t.questions) ? t.questions.length : 0,
    createdAt: t.createdAt,
  };
}

function normalizeAttempt(a) {
  return {
    id: a._id,
    testId: a.test?._id || a.test,
    testTitle: a.test?.title || 'Untitled Test',
    status: a.status,
    results: a.results,
    submittedAt: a.submittedAt,
    createdAt: a.createdAt,
  };
}

export async function getTests() {
  const { tests } = await apiRequest('/tests');
  return tests.map(normalizeTest);
}

export async function getAttempts() {
  const { attempts } = await apiRequest('/attempts');
  // Only completed attempts are meaningful here — an 'in_progress' attempt
  // (one the user started but never finished) has no `results` to show.
  return attempts.map(normalizeAttempt).filter(a => a.status !== 'in_progress' && a.results);
}

export async function deleteTest(testId) {
  await apiRequest(`/tests/${testId}`, { method: 'DELETE' });
}

/**
 * computeStats
 * @param {Object[]} tests
 * @param {Object[]} attempts — already filtered to completed attempts only
 * @returns {{ totalTests, totalAttempts, totalQuestionsPracticed, averagePercentage, trend }}
 */
export function computeStats(tests, attempts) {
  const totalTests = tests.length;
  const totalAttempts = attempts.length;

  const totalQuestionsPracticed = attempts.reduce(
    (sum, a) => sum + (a.results?.totalQuestions || 0), 0
  );

  const percentages = attempts.map(a => a.results?.percentage).filter(p => typeof p === 'number');
  const averagePercentage = percentages.length > 0
    ? round1(percentages.reduce((sum, p) => sum + p, 0) / percentages.length)
    : 0;

  // Chronological (oldest → newest), last 10 — a simple, real trend line
  // built entirely from stored scores. No fabricated insight, just the
  // actual numbers in order.
  const trend = [...attempts]
    .sort((a, b) => new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt))
    .slice(-10)
    .map(a => a.results?.percentage ?? 0);

  return { totalTests, totalAttempts, totalQuestionsPracticed, averagePercentage, trend };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
