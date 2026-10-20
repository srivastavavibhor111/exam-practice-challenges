const test = require('node:test');
const assert = require('node:assert/strict');
const { validateExtractedQuestions, summarize } = require('../services/extractionValidationService');

/**
 * extractionValidationService.test.js — NEW for M17
 * ─────────────────────────────────────────────────────────────────────────────
 * Covers the deterministic issue-detection rules from architecture section 7
 * — the code that decides whether an AI-extracted question is trustworthy
 * enough to show the user without a warning.
 * ─────────────────────────────────────────────────────────────────────────────
 */

test('missing question text is flagged as an error', () => {
  const [q] = validateExtractedQuestions([
    { text: '', options: { A: 'x', B: 'y', C: '', D: '' }, correctAnswer: 'A' },
  ]);
  assert.ok(q.issues.some(i => i.type === 'error' && /missing/i.test(i.message)));
});

test('fewer than 2 filled options is flagged as an error', () => {
  const [q] = validateExtractedQuestions([
    { text: 'Q?', options: { A: 'x', B: '', C: '', D: '' }, correctAnswer: 'A' },
  ]);
  assert.ok(q.issues.some(i => i.type === 'error'));
});

test('correctAnswer pointing at an empty option is flagged as an error', () => {
  const [q] = validateExtractedQuestions([
    { text: 'Q?', options: { A: 'x', B: 'y', C: '', D: '' }, correctAnswer: 'C' },
  ]);
  assert.ok(q.issues.some(i => i.type === 'error' && /does not match/i.test(i.message)));
});

test('missing correctAnswer is a warning, not an error — never blocks the user', () => {
  const [q] = validateExtractedQuestions([
    { text: 'Q?', options: { A: 'x', B: 'y', C: '', D: '' }, correctAnswer: null },
  ]);
  assert.ok(q.issues.some(i => i.type === 'warning'));
  assert.ok(!q.issues.some(i => i.type === 'error'));
});

test('duplicate option text is flagged as a warning', () => {
  const [q] = validateExtractedQuestions([
    { text: 'Q?', options: { A: 'Paris', B: 'Paris', C: 'London', D: '' }, correctAnswer: 'A' },
  ]);
  assert.ok(q.issues.some(i => i.type === 'warning' && /duplicate/i.test(i.message)));
});

test('a fully clean question has zero issues', () => {
  const [q] = validateExtractedQuestions([
    { text: 'Q?', options: { A: 'x', B: 'y', C: 'z', D: 'w' }, correctAnswer: 'B' },
  ]);
  assert.equal(q.issues.length, 0);
});

test('summarize() correctly buckets clean / warning-only / error questions', () => {
  const annotated = validateExtractedQuestions([
    { text: 'Q1', options: { A: 'a', B: 'b', C: '', D: '' }, correctAnswer: 'A' },  // clean
    { text: '',   options: { A: 'a', B: 'b', C: '', D: '' }, correctAnswer: 'A' },  // has an error
    { text: 'Q3', options: { A: 'a', B: 'b', C: '', D: '' }, correctAnswer: null }, // warning only
  ]);
  const summary = summarize(annotated);

  assert.equal(summary.total, 3);
  assert.equal(summary.clean, 1);
  assert.equal(summary.withErrors, 1);
  assert.equal(summary.withWarnings, 1);
});
