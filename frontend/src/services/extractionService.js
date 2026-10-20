import { apiRequest } from './api';

/**
 * extractionService.js (frontend) — UPDATED FOR M16
 * ─────────────────────────────────────────────────────────────────────────────
 * One field added: `topic`, carried through from the backend's now-topic-
 * tagging extraction (aiExtractionService.js). This flows silently through
 * Review.jsx (no new UI there — topic isn't shown or editable in this
 * milestone, just carried along) and into testService.js's bulk-create
 * payload, which is what actually gets it saved to each Question document.
 * Everything else is unchanged from M10.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function generateId() {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeExtractedQuestion(q) {
  return {
    id: generateId(),
    text: q.text || '',
    options: {
      A: q.options?.A || '',
      B: q.options?.B || '',
      C: q.options?.C || '',
      D: q.options?.D || '',
    },
    correctAnswer: q.correctAnswer || null,
    explanation: q.explanation || '',
    topic: q.topic || '',
  };
}

function normalizeResult(result) {
  if (!result || !result.success) {
    return result;
  }
  return {
    success: true,
    questions: result.questions.map(normalizeExtractedQuestion),
    summary: result.summary,
    meta: result.meta,
    content: result.content,
  };
}

export async function extractFromText(rawText) {
  const result = await apiRequest('/extraction/text', {
    method: 'POST',
    body: { rawText },
  });
  return normalizeResult(result);
}

export async function extractFromLink(url) {
  const result = await apiRequest('/extraction/link', {
    method: 'POST',
    body: { url },
  });
  return normalizeResult(result);
}
