const { callAI } = require('./aiClient');
const AppError = require('../utils/AppError');

const EXTRACTION_MAX_OUTPUT_TOKENS = 65_536; // Gemini Flash maximum output tokens
const EXTRACTION_TIMEOUT_MS = 180_000;       // large outputs take minutes, not seconds


/**
 * aiExtractionService.js — UPDATED
 * extractQuestions() now accepts and threads through an apiKey param to
 * both callAI() calls (the initial attempt and the retry-on-bad-JSON).
 * Everything else — the prompt, topic tagging, normalization — is unchanged.
 */

const SYSTEM_PROMPT = `You are an MCQ (multiple-choice question) extraction engine. Your only job is to read raw text and extract every multiple-choice question it contains into structured JSON.

Rules you must follow exactly:
- Output ONLY a JSON array. No prose, no markdown code fences, no commentary before or after.
- Each element must have exactly this shape:
  {
    "text": string,
    "options": { "A": string, "B": string, "C": string, "D": string },
    "correctAnswer": "A"|"B"|"C"|"D"|null,
    "explanation": string,
    "topic": string
  }
- Never fabricate a question, option, correct answer, or explanation that isn't actually present in the source text.
- If the source text states a correct answer, extract it. If it doesn't, correctAnswer must be null — do not infer or guess which option seems right.
- Some questions may have fewer than 4 options, or more informal formatting. Extract them anyway, doing your best to identify the question and its options.
- If the text contains no recognizable MCQs at all, output an empty array: []`;

function buildPrompt(rawText) {
  return `Extract every multiple-choice question from the following text. Remember: JSON array only, no other output.\n\n---\n${rawText}\n---`;
}

function stripCodeFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function normalizeQuestions(rawQuestions) {
  return rawQuestions.map(q => ({
    text: typeof q.text === 'string' ? q.text.trim() : '',
    options: {
      A: typeof q.options?.A === 'string' ? q.options.A.trim() : '',
      B: typeof q.options?.B === 'string' ? q.options.B.trim() : '',
      C: typeof q.options?.C === 'string' ? q.options.C.trim() : '',
      D: typeof q.options?.D === 'string' ? q.options.D.trim() : '',
    },
    correctAnswer: ['A', 'B', 'C', 'D'].includes(q.correctAnswer) ? q.correctAnswer : null,
    explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
    topic: typeof q.topic === 'string' ? q.topic.trim() : '',
  }));
}

async function extractQuestions(rawText, apiKey) {
  const prompt = buildPrompt(rawText);

  const attempt = await callAI({
          system: SYSTEM_PROMPT, prompt, jsonMode: true, apiKey,
          maxTokens: EXTRACTION_MAX_OUTPUT_TOKENS, timeoutMs: EXTRACTION_TIMEOUT_MS,
        });

  const parsed = tryParse(attempt);

  if (parsed) return normalizeQuestions(parsed);

  const retryPrompt = `${prompt}\n\nYour previous response was not valid JSON. Respond with ONLY a JSON array — nothing else, not even a single word of explanation.`;
  const retryAttempt = await callAI({
          system: SYSTEM_PROMPT, prompt: retryPrompt, jsonMode: true, apiKey,
          maxTokens: EXTRACTION_MAX_OUTPUT_TOKENS, timeoutMs: EXTRACTION_TIMEOUT_MS,
        });
  const retryParsed = tryParse(retryAttempt);

  if (retryParsed) return normalizeQuestions(retryParsed);

  throw new AppError(422, 'The AI extraction response could not be understood as valid question data.');
}

function tryParse(text) {
  try {
    const cleaned = stripCodeFences(text);
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = { extractQuestions };
