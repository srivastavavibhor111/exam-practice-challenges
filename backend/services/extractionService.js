const AppError = require('../utils/AppError');
const linkRetrievalService = require('./linkRetrievalService');
const aiExtractionService = require('./aiExtractionService');
const extractionValidationService = require('./extractionValidationService');
const authService = require('./authService');

/**
 * extractionService.js (backend orchestrator) — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * extractFromText/extractFromLink now take a userId, used to resolve
 * WHICH Gemini API key this extraction call should use — the user's own
 * stored key, or the server's default as a fallback (see
 * authService.getEffectiveGeminiApiKey). This resolution happens once,
 * inside runExtraction(), before the actual AI call.
 *
 * If the resolved key turns out to be invalid, aiClient.js now produces
 * a clear "check your key in Profile settings" message (see its own
 * update) rather than a raw API error — that message flows back through
 * the same 'extraction_failed' failure shape already handled below.
 *
 * Everything else is unchanged from M10/M16.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MAX_TEXT_LENGTH = 50_000;
const MIN_TEXT_LENGTH = 20;

async function extractFromText(rawText, userId) {
  const trimmed = (rawText || '').trim();

  if (!trimmed) {
    throw new AppError(400, 'Please provide some text to extract questions from.');
  }
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new AppError(400, 'That text is too short to contain any recognizable questions.');
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new AppError(400, `Text exceeds the ${MAX_TEXT_LENGTH.toLocaleString()}-character limit.`);
  }

  return runExtraction(trimmed, { method: 'text' }, userId);
}

async function extractFromLink(url, userId) {
  if (!url || !url.trim()) {
    throw new AppError(400, 'Please provide a ChatGPT conversation link.');
  }

  const retrieval = await linkRetrievalService.fetchSharedConversation(url.trim());

  if (!retrieval.success) {
    return {
      success: false,
      reason: retrieval.reason,
      message: retrieval.message,
      fallbackToPaste: true,
    };
  }

  return runExtraction(retrieval.content, { method: 'link', sourceUrl: url.trim() }, userId);
}

async function runExtraction(content, meta, userId) {
  const apiKey = await authService.getEffectiveGeminiApiKey(userId);

  let rawQuestions;

  try {
    rawQuestions = await aiExtractionService.extractQuestions(content, apiKey);
  } catch (err) {
    return {
      success: false,
      reason: 'extraction_failed',
      message: err.message?.includes('API key')
        ? err.message
        : "We couldn't confidently extract questions from this content. Please check the format and try again.",
      fallbackToPaste: meta.method === 'link',
    };
  }

  if (!rawQuestions || rawQuestions.length === 0) {
    return {
      success: false,
      reason: 'no_questions_found',
      message: "We couldn't find any recognizable MCQs in this content.",
      fallbackToPaste: meta.method === 'link',
    };
  }

  const annotated = extractionValidationService.validateExtractedQuestions(rawQuestions);
  const summary = extractionValidationService.summarize(annotated);

  return {
    success: true,
    questions: annotated,
    summary,
    meta,
    content,
  };
}

module.exports = { extractFromText, extractFromLink };
