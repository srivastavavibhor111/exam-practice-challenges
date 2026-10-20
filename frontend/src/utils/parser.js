/**
 * parser.js — Basic MCQ Text Parser
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses raw pasted MCQ text into structured question objects.
 *
 * This is a rule-based parser for M4. It handles the most common MCQ formats
 * produced by ChatGPT and standard study materials. In M9, this file will be
 * replaced/augmented by an AI-powered extraction engine that handles edge cases,
 * ambiguous formatting, and other input variations far more robustly.
 *
 * Supported question number formats:
 *   Q1.  Q1)  1.  1)  Question 1:  Question 1.
 *
 * Supported option formats:
 *   A)  A.  A:  (A)  A -
 *
 * Supported answer formats:
 *   Answer: C    Ans: C    Answer is C    Correct Answer: C
 *   Correct: C   Ans(C)    Answer - C
 *
 * Supported explanation formats:
 *   Explanation: …    Rationale: …    Reason: …    Note: …
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── ID generator ─────────────────────────────────────────────────────────────

function generateId() {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// Matches the START of a new question:  "Q1." / "1." / "1)" / "Question 1:"
const RE_QUESTION_START =
  /^(?:Q\.?\s*\d+\s*[.):\s]|\d+\s*[.)]\s*|[Qq]uestion\s+\d+\s*[.:)]\s*)/;

// Matches an option line:  "A)" / "A." / "(A)" / "A -"
const RE_OPTION =
  /^(?:\(([A-Da-d])\)|([A-Da-d])\s*[).:\-–]\s*)(.+)/;

// Matches an answer declaration:  "Answer: C"
const RE_ANSWER =
  /^(?:Answer|Ans(?:wer)?|Correct(?:\s+Answer)?)\s*[:\-–(]?\s*([A-Da-d])/i;

// Matches an explanation prefix
const RE_EXPLANATION =
  /^(?:Explanation|Rationale|Reason(?:ing)?|Note)\s*[:\-–]\s*/i;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * parseRawMCQText
 * Converts raw pasted MCQ text into an array of structured question objects.
 *
 * @param  {string} rawText  — The full text content pasted by the user.
 * @returns {QuestionObject[]}
 *
 * @typedef {Object} QuestionObject
 * @property {string}  id            — Unique client-side ID
 * @property {string}  text          — Question text
 * @property {Object}  options       — { A, B, C, D } — empty strings where absent
 * @property {string|null} correctAnswer — 'A' | 'B' | 'C' | 'D' | null
 * @property {string}  explanation   — Optional explanation text
 */
export function parseRawMCQText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines  = rawText.split('\n').map(l => l.trim());
  const result = [];
  let current  = null;

  function commitCurrent() {
    if (current && current.text.trim()) {
      result.push(finalise(current));
    }
    current = null;
  }

  for (const line of lines) {
    if (!line) continue;

    // ── New question ─────────────────────────────────────────────────────────
    if (RE_QUESTION_START.test(line)) {
      commitCurrent();
      const text = line.replace(RE_QUESTION_START, '').trim();
      current = { text, options: { A: '', B: '', C: '', D: '' }, correctAnswer: null, explanation: '' };
      continue;
    }

    if (!current) continue; // Text before the first question — ignore

    // ── Option line ──────────────────────────────────────────────────────────
    const optMatch = line.match(RE_OPTION);
    if (optMatch) {
      const letter     = (optMatch[1] || optMatch[2]).toUpperCase();
      const optionText = optMatch[3].trim();
      if ('ABCD'.includes(letter)) {
        current.options[letter] = optionText;
      }
      continue;
    }

    // ── Answer line ──────────────────────────────────────────────────────────
    const ansMatch = line.match(RE_ANSWER);
    if (ansMatch) {
      current.correctAnswer = ansMatch[1].toUpperCase();
      continue;
    }

    // ── Explanation line ─────────────────────────────────────────────────────
    if (RE_EXPLANATION.test(line)) {
      current.explanation = line.replace(RE_EXPLANATION, '').trim();
      continue;
    }

    // ── Continuation lines ───────────────────────────────────────────────────
    const hasOptions      = Object.values(current.options).some(Boolean);
    const hasAnswer       = current.correctAnswer !== null;
    const hasExplanation  = current.explanation.length > 0;

    if (hasExplanation) {
      // Append to explanation
      current.explanation += ' ' + line;
    } else if (!hasOptions && !hasAnswer) {
      // Still in question text before any option
      current.text += ' ' + line;
    }
    // Lines between options and answer (e.g. blank labels) are skipped
  }

  commitCurrent();
  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function finalise(raw) {
  return {
    id:            generateId(),
    text:          raw.text.trim(),
    options: {
      A: (raw.options.A || '').trim(),
      B: (raw.options.B || '').trim(),
      C: (raw.options.C || '').trim(),
      D: (raw.options.D || '').trim(),
    },
    correctAnswer: raw.correctAnswer,
    explanation:   raw.explanation.trim(),
  };
}
