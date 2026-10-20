/**
 * validation.js — Question Validation Utilities
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure functions — no side effects, no component state.
 * Used by the Review page (M4), the Test engine (M12), and Results (M13).
 *
 * Issue types:
 *   'error'   — the question is unusable; blocks "Create Test"
 *   'warning' — the question has a problem but can still be used
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * validateQuestion
 * Returns an array of issue objects for a single question.
 *
 * @param  {Object} question — A question object (see parser.js typedef)
 * @returns {{ type: 'error'|'warning', message: string }[]}
 */
export function validateQuestion(question) {
  const issues = [];
  const { text, options, correctAnswer } = question;

  // ── Errors (block Create Test) ────────────────────────────────────────────

  if (!text.trim()) {
    issues.push({ type: 'error', message: 'Question text is empty.' });
  }

  const filledOptions = Object.entries(options)
    .filter(([, v]) => v.trim().length > 0);

  if (filledOptions.length < 2) {
    issues.push({ type: 'error', message: 'Needs at least 2 options.' });
  }

  // Correct answer is set but points to an empty option slot
  if (correctAnswer && !options[correctAnswer]?.trim()) {
    issues.push({ type: 'error', message: `Correct answer is set to ${correctAnswer}, but that option is empty.` });
  }

  // ── Warnings (informational, do not block) ────────────────────────────────

  if (!correctAnswer) {
    issues.push({ type: 'warning', message: 'No correct answer selected — this question will be ungraded.' });
  }

  // Detect duplicate option text (case-insensitive)
  const filledValues = filledOptions.map(([, v]) => v.trim().toLowerCase());
  if (new Set(filledValues).size < filledValues.length) {
    issues.push({ type: 'warning', message: 'Two or more options have identical text.' });
  }

  return issues;
}

/**
 * isQuestionValid
 * Returns true only if the question has zero errors (warnings are allowed).
 */
export function isQuestionValid(question) {
  return !validateQuestion(question).some(i => i.type === 'error');
}

/**
 * validateAll
 * Validates every question in an array.
 * Returns a Map: question.id → issue[]
 */
export function validateAll(questions) {
  const map = new Map();
  for (const q of questions) {
    map.set(q.id, validateQuestion(q));
  }
  return map;
}

/**
 * hasAnyBlockingErrors
 * Returns true if at least one question has an error-level issue.
 */
export function hasAnyBlockingErrors(issueMap) {
  for (const issues of issueMap.values()) {
    if (issues.some(i => i.type === 'error')) return true;
  }
  return false;
}

/**
 * countQuestionsWithIssues
 * Returns the number of questions that have at least one issue (any type).
 */
export function countQuestionsWithIssues(issueMap) {
  let count = 0;
  for (const issues of issueMap.values()) {
    if (issues.length > 0) count++;
  }
  return count;
}
