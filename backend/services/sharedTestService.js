const mongoose = require('mongoose');
const { SharedTest, SharedAttempt, SharedTestBookmark } = require('../models');
const AppError = require('../utils/AppError');
const scoringService = require('./scoringService');
const { generateCandidateId, isValidTestIdFormat } = require('../utils/sharedTestId');

/**
 * sharedTestService.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Every function here operates ONLY on SharedTest/SharedAttempt/
 * SharedTestBookmark — never touches the personal Test/Question/Attempt
 * collections at all. That's what makes the "separate ecosystem"
 * requirement structurally true rather than a matter of remembering to
 * filter correctly everywhere.
 *
 * Grading reuses scoringService.calculateResult() DIRECTLY — the exact
 * same function the personal test-taking flow uses. No parallel scoring
 * logic exists; a shared test with marksPerCorrect: 2 and
 * negativeMarkingRule: 'full_marks_plus_penalty' is graded identically
 * to a personal test with the same configuration, because it's the same
 * code doing the grading.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MAX_ID_GENERATION_ATTEMPTS = 10;
const VALIDITY_HOURS = 48;
const VALIDITY_MS = VALIDITY_HOURS * 60 * 60 * 1000;

async function generateUniqueTestId() {
  for (let attempt = 0; attempt < MAX_ID_GENERATION_ATTEMPTS; attempt++) {
    const candidate = generateCandidateId();
    const existing = await SharedTest.findOne({ testId: candidate }).select('_id');
    if (!existing) return candidate;
  }
  throw new AppError(500, 'Could not generate a unique Shared Test ID. Please try again.');
}

/**
 * toPublicSharedTest
 * Adds a computed `status` ('active' | 'expired') to a SharedTest,
 * derived fresh from the current time vs expiresAt — never stored, never
 * stale. This is what makes the backend "authoritative" about expiration
 * the way the spec requires: there's no cached status anywhere that
 * could disagree with reality.
 */
function toPublicSharedTest(sharedTestDoc) {
  const plain = sharedTestDoc.toObject ? sharedTestDoc.toObject() : sharedTestDoc;
  const status = Date.now() < new Date(plain.expiresAt).getTime() ? 'active' : 'expired';
  return { ...plain, status };
}

/**
 * toPublicSharedTestSummary
 * Same as toPublicSharedTest but WITHOUT the questions array — used for
 * list/detail views where answers must not be sent (a details page never
 * needs the correct answers, and an expired test's questions should only
 * reach the client through the answer-stripped /take endpoint or through
 * the user's own result).
 */
function toPublicSharedTestSummary(sharedTestDoc) {
  const { questions, ...rest } = toPublicSharedTest(sharedTestDoc);
  return { ...rest, questionCount: Array.isArray(questions) ? questions.length : 0 };
}

/**
 * isEligibleParticipant
 * Server-side eligibility: the creator, or anyone who has ANY attempt
 * record on this test (in-progress, submitted or auto-submitted). Starting
 * an attempt is what "joining" means in this app — the join lookup itself
 * stores nothing — so an attempt document is the membership record.
 *
 * `userId` always comes from the verified JWT (req.user.id), never from
 * the request body, so this can't be spoofed by the client.
 */
async function isEligibleParticipant(userId, sharedTest) {
  if (sharedTest.creator.toString() === String(userId)) return true;
  const attempt = await SharedAttempt.exists({ sharedTest: sharedTest._id, user: userId });
  return Boolean(attempt);
}

/**
 * assertCanAccess
 * The ONE place the expiry rule lives:
 *   active  → anyone logged in may proceed (existing behaviour, unchanged)
 *   expired → only eligible participants may proceed
 * Expiration only closes the door to NEW participants. It never blocks
 * someone who is already in.
 */
async function assertCanAccess(userId, sharedTest) {
  const expired = Date.now() >= new Date(sharedTest.expiresAt).getTime();
  if (!expired) return;
  if (await isEligibleParticipant(userId, sharedTest)) return;
  throw new AppError(
    410,
    'This Shared Test has expired and is no longer accepting new participants.'
  );
}

/**
 * createSharedTest
 * createdAt/expiresAt are computed together, explicitly, right here —
 * not relying on any automatic Mongoose timestamp behavior, so the exact
 * 48-hour window is set deterministically in one place.
 */
async function createSharedTest({ creatorId, title, questions, scoring, durationSeconds }) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new AppError(400, 'A shared test needs at least one question.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 60) {
    throw new AppError(400, 'Duration must be at least 60 seconds.');
  }

  const testId = await generateUniqueTestId();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + VALIDITY_MS);

  const sharedTest = await SharedTest.create({
    testId,
    creator: creatorId,
    title,
    questions: questions.map(q => ({
      text: q.text,
      options: q.options || { A: '', B: '', C: '', D: '' },
      correctAnswer: q.correctAnswer || null,
      explanation: q.explanation || '',
      topic: q.topic || '',
    })),
    scoring: scoring || undefined, // schema defaults apply if omitted
    durationSeconds,
    createdAt,
    expiresAt,
  });

  return toPublicSharedTest(sharedTest);
}

async function getSharedTestByTestId(testId) {
  return SharedTest.findOne({ testId: testId.trim().toUpperCase() });
}

/**
 * lookupSharedTestForJoin
 * The "Join a Shared Test" action's validation step — format check,
 * existence check, then the expiry rule (expired → only existing
 * participants pass), in that order, each with its own clear error message. Does NOT create an attempt yet; that's a
 * deliberate separate step (startSharedAttempt), re-validating
 * expiration again right before actually starting — the same
 * defense-in-depth pattern used elsewhere in this app (e.g. Google
 * registration's race-condition re-check).
 */
async function lookupSharedTestForJoin(testId, userId) {
  if (!isValidTestIdFormat(testId)) {
    throw new AppError(400, 'That doesn\'t look like a valid Test ID. Expected format: ST-XXXX-YYYY.');
  }

  const sharedTest = await getSharedTestByTestId(testId);
  if (!sharedTest) {
    throw new AppError(404, 'No Shared Test was found with that Test ID.');
  }

  // Expired + not already a participant → rejected here, and NOTHING is
  // created. Expired + existing participant → returned with
  // status: 'expired' so the client can open the details page.
  await assertCanAccess(userId, sharedTest);

  return toPublicSharedTestSummary(sharedTest);
}

/**
 * getSharedTestForTaking
 * Answer-stripped, same integrity principle as the personal test-taking
 * flow's GET /api/tests/:id/take — correctAnswer is never present in the
 * response while a test is in progress. Also re-checks expiration.
 */
async function getSharedTestForTaking(testId, userId) {
  const sharedTest = await getSharedTestByTestId(testId);
  if (!sharedTest) {
    throw new AppError(404, 'No Shared Test was found with that Test ID.');
  }

  await assertCanAccess(userId, sharedTest);

  const publicTest = toPublicSharedTest(sharedTest);
  publicTest.questions = publicTest.questions.map(({ correctAnswer, ...rest }) => rest);
  return publicTest;
}

/**
 * startSharedAttempt
 * Re-checks access one more time, right before creating the attempt —
 * a real edge case (a NEW user looks up an ID that's about to expire,
 * waits, then clicks Start a minute after it expired) that a single check
 * at lookup time wouldn't catch. There is deliberately NO cap on how many
 * attempts one eligible user can create.
 */
async function startSharedAttempt({ userId, testId }) {
  const sharedTest = await getSharedTestByTestId(testId);
  if (!sharedTest) {
    throw new AppError(404, 'No Shared Test was found with that Test ID.');
  }

  // Active → anyone may start (this is how a new participant joins).
  // Expired → only an existing participant may start a fresh attempt;
  // a new user is rejected BEFORE any attempt document is created.
  await assertCanAccess(userId, sharedTest);

  const attempt = await SharedAttempt.create({
    sharedTest: sharedTest._id,
    user: userId,
    durationSeconds: sharedTest.durationSeconds,
    status: 'in_progress',
    startedAt: new Date(),
  });

  return attempt;
}

async function submitSharedAttempt(attemptId, userId, { answers, markedForReview, timeSpentSeconds, autoSubmitted }) {
  const attempt = await SharedAttempt.findById(attemptId);
  if (!attempt || attempt.user.toString() !== userId.toString()) {
    throw new AppError(404, 'Shared attempt not found.');
  }
  if (attempt.status !== 'in_progress') {
    throw new AppError(400, 'This attempt has already been submitted.');
  }

  const sharedTest = await SharedTest.findById(attempt.sharedTest);
  if (!sharedTest) {
    throw new AppError(404, 'The Shared Test for this attempt no longer exists.');
  }

  // The SAME scoring engine the personal test-taking flow uses —
  // reused directly, not reimplemented.
  const results = scoringService.calculateResult(
    sharedTest.questions,
    answers || {},
    timeSpentSeconds || 0,
    sharedTest.scoring
  );

  attempt.answers = answers || {};
  attempt.markedForReview = markedForReview || [];
  attempt.timeSpentSeconds = timeSpentSeconds || 0;
  attempt.status = autoSubmitted ? 'auto_submitted' : 'submitted';
  attempt.submittedAt = new Date();
  attempt.results = results;

  await attempt.save();
  return attempt;
}

/**
 * getSharedAttemptById
 * Ownership-checked against the ATTEMPT's own user — NOT the underlying
 * SharedTest's creator. Anyone who attempted a shared test can view
 * their own result; the creator has no special access to OTHER
 * participants' results through this function (a real, deliberate
 * privacy boundary the spec doesn't explicitly call out but is the only
 * sensible default — "shared" means the TEST is shared, not each
 * person's individual performance on it).
 */
async function getSharedAttemptById(attemptId, userId) {
  const attempt = await SharedAttempt.findById(attemptId).populate('sharedTest');
  if (!attempt || attempt.user.toString() !== userId.toString()) {
    throw new AppError(404, 'Shared attempt not found.');
  }
  return attempt;
}

/**
 * getSharedTestDetails
 * Backs the details page. Returns the test's metadata (no questions, no
 * answers) plus ONLY the requesting user's own attempts — another
 * participant's attempt history is never included.
 */
async function getSharedTestDetails(testId, userId) {
  if (!isValidTestIdFormat(testId)) {
    throw new AppError(400, 'That doesn\'t look like a valid Test ID. Expected format: ST-XXXX-YYYY.');
  }
  const sharedTest = await getSharedTestByTestId(testId);
  if (!sharedTest) {
    throw new AppError(404, 'No Shared Test was found with that Test ID.');
  }
  await assertCanAccess(userId, sharedTest);

  const attempts = await SharedAttempt.find({
    sharedTest: sharedTest._id,
    user: userId,
    status: { $in: ['submitted', 'auto_submitted'] },
  })
    .select('status durationSeconds timeSpentSeconds submittedAt results')
    .sort({ submittedAt: -1 });

  return {
    sharedTest: toPublicSharedTestSummary(sharedTest),
    isCreator: sharedTest.creator.toString() === String(userId),
    attempts,
  };
}

/**
 * listJoinedSharedTests
 * Tests the user has attempted but did NOT create — so an expired test
 * they participated in stays reachable from the hub instead of only by
 * retyping an old ID. Built from the user's own attempt records.
 */
async function listJoinedSharedTests(userId) {
  const stats = await SharedAttempt.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: '$sharedTest',
        attemptCount: {
          $sum: { $cond: [{ $in: ['$status', ['submitted', 'auto_submitted']] }, 1, 0] },
        },
        lastAttemptAt: { $max: '$submittedAt' },
      },
    },
  ]);
  if (stats.length === 0) return [];

  const tests = await SharedTest.find({
    _id: { $in: stats.map(s => s._id) },
    creator: { $ne: userId },
  });
  const statsById = new Map(stats.map(s => [s._id.toString(), s]));

  return tests
    .map(t => ({
      ...toPublicSharedTestSummary(t),
      attemptCount: statsById.get(t._id.toString())?.attemptCount || 0,
      lastAttemptAt: statsById.get(t._id.toString())?.lastAttemptAt || null,
    }))
    .sort((a, b) => new Date(b.lastAttemptAt || b.createdAt) - new Date(a.lastAttemptAt || a.createdAt));
}

async function listSharedTestsCreatedByUser(userId) {
  const tests = await SharedTest.find({ creator: userId }).sort({ createdAt: -1 });
  return tests.map(toPublicSharedTest);
}

async function listSharedAttemptsForUser(userId) {
  // Naturally includes BOTH "created by me, then attempted by me" and
  // "joined from someone else's Test ID" — both are just SharedAttempt
  // documents where user === userId, regardless of who created the
  // underlying SharedTest.
  return SharedAttempt.find({
    user: userId,
    status: { $in: ['submitted', 'auto_submitted'] },
  })
    .populate('sharedTest', 'testId title')
    .sort({ submittedAt: -1 });
}

/**
 * getLatestSharedAttemptPerTest — internal helper, mirrors the personal
 * Mistakes feature's getLatestAttemptPerTest (M15) exactly, just against
 * the Shared* models.
 */
async function getLatestSharedAttemptPerTest(userId) {
  const attempts = await SharedAttempt.find({
    user: userId,
    status: { $in: ['submitted', 'auto_submitted'] },
  })
    .populate('sharedTest')
    .sort({ submittedAt: -1 });

  const latestByTest = new Map();
  for (const attempt of attempts) {
    if (!attempt.sharedTest) continue;
    const key = attempt.sharedTest._id.toString();
    if (!latestByTest.has(key)) {
      latestByTest.set(key, attempt);
    }
  }
  return [...latestByTest.values()];
}

/**
 * getSharedMistakes
 * Same definition as personal Mistakes (M15): incorrect in the most
 * recent attempt of each shared test, not permanent history.
 */
async function getSharedMistakes(userId) {
  const latestAttempts = await getLatestSharedAttemptPerTest(userId);
  const mistakes = [];

  for (const attempt of latestAttempts) {
    const answersMap = attempt.answers;
    for (const question of attempt.sharedTest.questions) {
      const qid = question._id.toString();
      const userAnswer = answersMap.get(qid);
      const isIncorrect = question.correctAnswer && userAnswer && userAnswer !== question.correctAnswer;

      if (isIncorrect) {
        mistakes.push({
          id: qid,
          text: question.text,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          yourAnswer: userAnswer,
          sharedTestId: attempt.sharedTest.testId,
          sharedTestTitle: attempt.sharedTest.title,
          lastAttemptedAt: attempt.submittedAt,
        });
      }
    }
  }

  return mistakes;
}

async function getBookmarkedSharedQuestions(userId) {
  const bookmarks = await SharedTestBookmark.find({ user: userId })
    .populate('sharedTest')
    .sort({ createdAt: -1 });

  return bookmarks
    .filter(b => b.sharedTest) // defensively skip any orphaned bookmark
    .map(b => {
      const question = b.sharedTest.questions.id(b.questionId);
      if (!question) return null; // shouldn't happen, but never crash on stale data
      return {
        id: b.questionId,
        text: question.text,
        options: question.options,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        sharedTestId: b.sharedTest.testId,
        sharedTestTitle: b.sharedTest.title,
      };
    })
    .filter(Boolean);
}

async function toggleSharedBookmark({ userId, sharedTestObjectId, questionId, bookmarked }) {
  if (bookmarked) {
    // Only an eligible participant may bookmark (and thereby read back the
    // answer to) a question — an ObjectId alone is not enough.
    const sharedTest = await SharedTest.findById(sharedTestObjectId);
    if (!sharedTest || !(await isEligibleParticipant(userId, sharedTest))) {
      throw new AppError(404, 'Shared Test not found.');
    }
    await SharedTestBookmark.updateOne(
      { user: userId, sharedTest: sharedTestObjectId, questionId },
      { $setOnInsert: { user: userId, sharedTest: sharedTestObjectId, questionId } },
      { upsert: true }
    );
  } else {
    await SharedTestBookmark.deleteOne({ user: userId, sharedTest: sharedTestObjectId, questionId });
  }
}

module.exports = {
  createSharedTest,
  getSharedTestByTestId,
  lookupSharedTestForJoin,
  getSharedTestForTaking,
  startSharedAttempt,
  submitSharedAttempt,
  getSharedAttemptById,
  getSharedTestDetails,
  listJoinedSharedTests,
  isEligibleParticipant,
  listSharedTestsCreatedByUser,
  listSharedAttemptsForUser,
  getSharedMistakes,
  getBookmarkedSharedQuestions,
  toggleSharedBookmark,
  toPublicSharedTest,
};
