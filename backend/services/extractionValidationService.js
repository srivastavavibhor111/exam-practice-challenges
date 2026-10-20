/**
 * extractionValidationService.js — Deterministic Extraction Validation
 * ─────────────────────────────────────────────────────────────────────────────
 * AI extraction can make mistakes (architecture section 7). This layer never
 * calls the AI again — it's pure, deterministic code that checks each
 * extracted question against a fixed set of rules and annotates problems.
 *
 * This is intentionally similar to the frontend's utils/validation.js (M4).
 * That's not duplication for no reason: this is what makes the API response
 * self-describing. When M10 wires this up, the exact same issue-rendering
 * UI already built into Review.jsx's QuestionCard (the { type, message }
 * shape, the error/warning badges) can display these issues with no changes
 * — the API is speaking the frontend's language on purpose.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function validateExtractedQuestion(q) {
  const issues = [];
  const filledOptions = Object.entries(q.options).filter(([, v]) => v && v.trim());

  if (!q.text || !q.text.trim()) {
    issues.push({ type: 'error', message: 'Question text is missing.' });
  }

  if (filledOptions.length < 2) {
    issues.push({ type: 'error', message: 'Fewer than 2 options were extracted.' });
  } 
  // else if (filledOptions.length < 4) {
  //   issues.push({ type: 'warning', message: `Only ${filledOptions.length} option(s) extracted — expected up to 4.` });
  // }

  if (q.correctAnswer && !q.options[q.correctAnswer]?.trim()) {
    issues.push({ type: 'error', message: `Correct answer "${q.correctAnswer}" does not match any extracted option.` });
  }

  if (!q.correctAnswer) {
    issues.push({ type: 'warning', message: 'No correct answer could be identified for this question.' });
  }

  const values = filledOptions.map(([, v]) => v.trim().toLowerCase());
  if (new Set(values).size < values.length) {
    issues.push({ type: 'warning', message: 'Duplicate option text detected.' });
  }

  return issues;
}

/**
 * validateExtractedQuestions
 * Annotates every question with an `issues` array. Nothing is dropped or
 * blocked here — per architecture rule #33, the user stays in control and
 * reviews everything, even flawed extractions, before a test is created.
 */
function validateExtractedQuestions(questions) {
  return questions.map(q => ({
    ...q,
    issues: validateExtractedQuestion(q),
  }));
}

/**
 * summarize
 * A quick-glance count used in the API response's `summary` field, so a
 * caller doesn't need to walk every question to know the overall extraction
 * quality.
 */
function summarize(annotatedQuestions) {
  const withErrors = annotatedQuestions.filter(q => q.issues.some(i => i.type === 'error')).length;
  const withWarningsOnly = annotatedQuestions.filter(
    q => q.issues.some(i => i.type === 'warning') && !q.issues.some(i => i.type === 'error')
  ).length;
  const clean = annotatedQuestions.length - withErrors - withWarningsOnly;

  return {
    total: annotatedQuestions.length,
    clean,
    withWarnings: withWarningsOnly,
    withErrors,
  };
}

module.exports = { validateExtractedQuestions, summarize };
