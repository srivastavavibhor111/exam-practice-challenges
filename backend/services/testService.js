const mongoose = require('mongoose');
const { Test, Question, Attempt, FolderItem } = require('../models');
const AppError = require('../utils/AppError');
const assertOwnership = require('../utils/assertOwnership');

/**
 * testService.js — UPDATED (Custom Test Folders: deleteTestCascade helper, see its comment)
 * ─────────────────────────────────────────────────────────────────────────────
 * createTest() now accepts and validates a `scoring` object — this is
 * where a bad request gets REJECTED outright (400), as opposed to
 * scoringService's resolveScoringRules(), which is a defensive fallback
 * for calculation time, not a substitute for real input validation here.
 *
 * createPracticeTest() (M15 — Bookmarks/Mistakes practice sessions)
 * deliberately does NOT accept a scoring param at all: a practice set can
 * be assembled from questions spanning several original tests, which may
 * have had different scoring rules — there's no single "correct" one to
 * inherit. It always uses the plain default (1 mark per correct, no
 * penalty), which is what validateAndNormalizeScoring(undefined) returns.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_NEGATIVE_MARKING_RULES = ['negative_only', 'full_marks_plus_penalty'];

function validateAndNormalizeScoring(scoring) {
  if (scoring === undefined) {
    // No scoring config provided at all — used by createPracticeTest and
    // any other caller that doesn't collect this from the user.
    return { marksPerCorrect: 1, negativeMarksPerIncorrect: 0, negativeMarkingRule: 'negative_only' };
  }

  const marksPerCorrect = Number(scoring.marksPerCorrect);
  const negativeMarksPerIncorrect = Number(scoring.negativeMarksPerIncorrect);
  const negativeMarkingRule = scoring.negativeMarkingRule;

  if (!Number.isFinite(marksPerCorrect) || marksPerCorrect <= 0) {
    throw new AppError(400, 'Marks per correct answer must be a number greater than 0.');
  }
  if (!Number.isFinite(negativeMarksPerIncorrect) || negativeMarksPerIncorrect < 0) {
    throw new AppError(400, 'Negative marking must be a number of 0 or greater.');
  }
  if (!VALID_NEGATIVE_MARKING_RULES.includes(negativeMarkingRule)) {
    throw new AppError(400, `negativeMarkingRule must be one of: ${VALID_NEGATIVE_MARKING_RULES.join(', ')}`);
  }

  return { marksPerCorrect, negativeMarksPerIncorrect, negativeMarkingRule };
}

async function createTest({ userId, title, sourceId, questionIds, settings, scoring }) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new AppError(400, 'A test needs at least one question');
  }

  const normalizedScoring = validateAndNormalizeScoring(scoring);

  const session = await mongoose.startSession();
  try {
    let test;
    await session.withTransaction(async () => {
      const questions = await Question.find({
        _id: { $in: questionIds },
        user: userId,
      }).session(session);

      if (questions.length !== questionIds.length) {
        throw new AppError(400, 'One or more questions were not found or do not belong to you');
      }

      const [created] = await Test.create(
        [{
          user: userId,
          source: sourceId || null,
          title,
          questions: questionIds,
          settings: settings || {},
          scoring: normalizedScoring,
        }],
        { session }
      );

      await Question.updateMany(
        { _id: { $in: questionIds } },
        { $set: { test: created._id } },
        { session }
      );

      test = created;
    });

    return getTestById(test._id, userId);
  } finally {
    session.endSession();
  }
}

async function createPracticeTest({ userId, title, questionIds }) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new AppError(400, 'Need at least one question to build a practice session');
  }

  const questions = await Question.find({ _id: { $in: questionIds }, user: userId });
  if (questions.length !== questionIds.length) {
    throw new AppError(400, 'One or more questions were not found or do not belong to you');
  }

  const test = await Test.create({
    user: userId,
    source: null,
    title,
    questions: questionIds,
    isPracticeSet: true,
    scoring: validateAndNormalizeScoring(undefined), // always the plain default — see file header
  });

  return getTestById(test._id, userId);
}

async function getTestById(id, userId) {
  const test = await Test.findById(id).populate('questions');
  assertOwnership(test, userId, 'Test');
  return test;
}

async function getTestForTaking(id, userId) {
  const test = await Test.findById(id).populate('questions');
  assertOwnership(test, userId, 'Test');

  const plain = test.toObject();
  plain.questions = plain.questions.map(({ correctAnswer, ...rest }) => rest);
  // `scoring` is a test-level field, untouched by the per-question
  // answer-stripping above — a test-taker seeing the scoring rules
  // before starting doesn't compromise anything (it's the SCORING
  // FORMULA, not the answer key).
  return plain;
}

async function listTestsForUser(userId) {
  return Test.find({ user: userId, isPracticeSet: { $ne: true } }).sort({ createdAt: -1 });
}

async function updateTestSettings(id, userId, { title, settings }) {
  const test = await Test.findById(id);
  assertOwnership(test, userId, 'Test');

  if (title !== undefined) test.title = title;
  if (settings !== undefined) test.settings = { ...test.settings.toObject(), ...settings };

  await test.save();
  return test;
}

/**
 * deleteTestCascade — NEW (extracted from deleteTest, one line added)
 * The single place that knows everything that must go when a personal Test is
 * deleted. It must be called INSIDE an already-open transaction — it never
 * opens its own — so a caller can combine it with other writes atomically
 * (folderService uses it for "Delete folder and its tests").
 *
 * The FolderItem cleanup is the one new line: without it, a deleted test
 * would leave dangling references in the user's folders.
 */
async function deleteTestCascade(test, session) {
  await Question.deleteMany({ test: test._id }).session(session);
  await Attempt.deleteMany({ test: test._id }).session(session);
  await FolderItem.deleteMany({ itemType: 'test', itemId: test._id }).session(session); // NEW
  await test.deleteOne({ session });
}

async function deleteTest(id, userId) {
  const test = await Test.findById(id);
  assertOwnership(test, userId, 'Test');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await deleteTestCascade(test, session);
    });
  } finally {
    session.endSession();
  }
}

module.exports = {
  createTest,
  createPracticeTest,
  getTestById,
  getTestForTaking,
  listTestsForUser,
  updateTestSettings,
  deleteTest,
  deleteTestCascade,
};
