const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateResult } = require('../services/scoringService');

/**
 * scoringService.test.js — NEW for M17
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the single most important piece of logic in the entire app to get
 * right — it's literally what a student's score is. Deliberately tested
 * with plain objects, no database, no mocking — calculateResult() is a
 * pure function, which is exactly why it's easy to test thoroughly and
 * exactly why it was built that way from the start (M8).
 *
 * Run with: node --test  (from the backend/ folder)
 * ─────────────────────────────────────────────────────────────────────────────
 */

test('all questions correct → 100%', () => {
  const questions = [
    { _id: '1', correctAnswer: 'A' },
    { _id: '2', correctAnswer: 'B' },
  ];
  const answers = { '1': 'A', '2': 'B' };
  const result = calculateResult(questions, answers, 60);

  assert.equal(result.correct, 2);
  assert.equal(result.incorrect, 0);
  assert.equal(result.unattempted, 0);
  assert.equal(result.percentage, 100);
});

test('mix of correct, incorrect, unattempted, and ungraded', () => {
  const questions = [
    { _id: '1', correctAnswer: 'A' },    // will be answered correctly
    { _id: '2', correctAnswer: 'B' },    // will be answered incorrectly
    { _id: '3', correctAnswer: 'C' },    // will be left unattempted
    { _id: '4', correctAnswer: null },   // has no answer key at all — ungraded
  ];
  const answers = { '1': 'A', '2': 'D' };
  const result = calculateResult(questions, answers, 120);

  assert.equal(result.correct, 1);
  assert.equal(result.incorrect, 1);
  assert.equal(result.unattempted, 1);
  assert.equal(result.ungraded, 1);
  assert.equal(result.gradedCount, 3); // total (4) minus ungraded (1)
  assert.equal(result.percentage, Math.round((1 / 3) * 1000) / 10);
});

test('accuracy only counts ATTEMPTED graded questions, not all graded ones', () => {
  const questions = [
    { _id: '1', correctAnswer: 'A' },
    { _id: '2', correctAnswer: 'B' },
    { _id: '3', correctAnswer: 'C' }, // left unattempted — excluded from accuracy
  ];
  const answers = { '1': 'A', '2': 'X' };
  const result = calculateResult(questions, answers, 90);

  // 1 correct out of 2 ATTEMPTED (question 3 doesn't count toward accuracy)
  assert.equal(result.accuracy, 50);
  // but percentage is out of all 3 graded questions
  assert.equal(result.percentage, Math.round((1 / 3) * 1000) / 10);
});

test('an ungraded question can still be "answered" without affecting the score', () => {
  const questions = [{ _id: '1', correctAnswer: null }];
  const answers = { '1': 'A' }; // user picked something, but there's no answer key
  const result = calculateResult(questions, answers, 30);

  assert.equal(result.ungraded, 1);
  assert.equal(result.correct, 0);
  assert.equal(result.incorrect, 0);
  assert.equal(result.gradedCount, 0);
  assert.equal(result.percentage, 0); // 0 out of 0 graded — never divides by zero
});

test('empty question set does not throw and returns all zeros', () => {
  const result = calculateResult([], {}, 0);

  assert.equal(result.totalQuestions, 0);
  assert.equal(result.percentage, 0);
  assert.equal(result.accuracy, 0);
  assert.equal(result.avgTimePerQuestion, 0);
});

test('accepts answers as a Map, not just a plain object (Mongoose Map compatibility)', () => {
  const questions = [{ _id: '1', correctAnswer: 'A' }];
  const answers = new Map([['1', 'A']]);
  const result = calculateResult(questions, answers, 30);

  assert.equal(result.correct, 1);
});

test('question objects using `id` instead of `_id` still work (frontend-shape compatibility)', () => {
  const questions = [{ id: '1', correctAnswer: 'A' }];
  const answers = { '1': 'A' };
  const result = calculateResult(questions, answers, 15);

  assert.equal(result.correct, 1);
});
