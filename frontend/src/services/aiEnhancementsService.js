import { apiRequest } from './api';

/**
 * aiEnhancementsService.js — NEW for M16
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the three M16 endpoints. Every function here corresponds to an
 * explicit user action (a button click) — nothing in this file is ever
 * called automatically on page load, deliberately. AI calls cost real
 * money; the user should always be the one who decides to spend it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function explainQuestion(questionId) {
  const { question } = await apiRequest(`/questions/${questionId}/explain`, { method: 'POST' });
  return question.explanation;
}

export async function getTopicPerformance() {
  const { topics } = await apiRequest('/attempts/topic-performance');
  return topics;
}

export async function getInsights() {
  // On success: { insight: string, basedOn: {...} }
  // On failure (e.g. not enough attempts yet): throws an ApiError with a
  // friendly message — see insightsService.js's MIN_ATTEMPTS_FOR_INSIGHTS check.
  return apiRequest('/attempts/insights');
}
