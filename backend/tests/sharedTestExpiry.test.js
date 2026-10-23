/**
 * sharedTestExpiry.test.js — Shared Test expiry / reattempt / permanence
 * ─────────────────────────────────────────────────────────────────────────────
 * Run:  node --test tests/sharedTestExpiry.test.js     (Node 18+, no extra deps)
 *
 * SERVICE-LEVEL tests: the real sharedTestService, scoringService and
 * AppError run, but the Mongoose models are replaced with tiny in-memory
 * fakes, so no MongoDB server is needed. They prove the access RULES; they
 * do not prove real Mongo queries — see the manual checklist for that.
 * "Time travel" is done by creating a test whose expiresAt is already in
 * the past, never by waiting 48 hours.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

/* ── in-memory fakes ───────────────────────────────────────────────────── */
let seq = 0;
const newId = () => ({ n: ++seq, toString() { return `id${this.n}`; } });
const idStr = v => String(v?._id ?? v);

const db = { tests: [], attempts: [], bookmarks: [] };

function makeTest({ creator, expiresInMs, testId = 'ST-1234-ABCD' }) {
  const t = {
    _id: newId(),
    testId,
    creator,
    title: 'Fake test',
    durationSeconds: 600,
    scoring: { marksPerCorrect: 2, negativeMarksPerIncorrect: 0.5, negativeMarkingRule: 'negative_only' },
    createdAt: new Date(Date.now() - 49 * 3600 * 1000),
    expiresAt: new Date(Date.now() + expiresInMs),
    questions: [
      { _id: newId(), text: 'Q1', options: { A: 'a', B: 'b', C: '', D: '' }, correctAnswer: 'A', explanation: 'e1' },
      { _id: newId(), text: 'Q2', options: { A: 'a', B: 'b', C: '', D: '' }, correctAnswer: 'B', explanation: 'e2' },
    ],
  };
  t.toObject = () => ({ ...t, toObject: undefined });
  db.tests.push(t);
  return t;
}

const FakeSharedTest = {
  findOne: async ({ testId }) => db.tests.find(t => t.testId === testId) || null,
  findById: async id => db.tests.find(t => idStr(t) === idStr(id)) || null,
};

const FakeSharedAttempt = {
  exists: async ({ sharedTest, user }) =>
    db.attempts.some(a => idStr(a.sharedTest) === idStr(sharedTest) && idStr(a.user) === idStr(user))
      ? { _id: 1 } : null,
  create: async data => {
    const a = {
      _id: newId(), answers: {}, markedForReview: [], timeSpentSeconds: 0,
      submittedAt: null, results: undefined, ...data,
      save: async function () { return this; },
    };
    db.attempts.push(a);
    return a;
  },
  findById: async id => db.attempts.find(a => idStr(a) === idStr(id)) || null,
  find: q => {
    const rows = db.attempts.filter(a =>
      idStr(a.sharedTest) === idStr(q.sharedTest) &&
      idStr(a.user) === idStr(q.user) &&
      q.status.$in.includes(a.status));
    const chain = { select: () => chain, sort: async () => rows };
    return chain;
  },
};

const FakeBookmark = {
  updateOne: async (...args) => { db.bookmarks.push(args); },
  deleteOne: async () => {},
};

// Inject the fakes BEFORE the service is loaded.
const modelsPath = require.resolve(path.join(__dirname, '../models'));
require.cache[modelsPath] = {
  id: modelsPath, filename: modelsPath, loaded: true,
  exports: { SharedTest: FakeSharedTest, SharedAttempt: FakeSharedAttempt, SharedTestBookmark: FakeBookmark },
};
const svc = require('../services/sharedTestService');

const CREATOR = newId();
const PARTICIPANT = newId();
const STRANGER = newId();
const HOUR = 3600 * 1000;
const reset = () => { db.tests.length = 0; db.attempts.length = 0; db.bookmarks.length = 0; };

async function rejectsWith(promise, status) {
  await assert.rejects(promise, err => { assert.equal(err.statusCode, status); return true; });
}

/* ── A. active test ────────────────────────────────────────────────────── */
test('A: a new user can join and start an attempt on an ACTIVE test', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  const found = await svc.lookupSharedTestForJoin(t.testId, STRANGER);
  assert.equal(found.status, 'active');
  const attempt = await svc.startSharedAttempt({ userId: STRANGER, testId: t.testId });
  assert.equal(attempt.status, 'in_progress');
  assert.equal(db.attempts.length, 1);
});

/* ── C. reattempt after expiry, no cap ─────────────────────────────────── */
test('C: an existing participant can reattempt an EXPIRED test indefinitely, each attempt stored separately', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  const first = await svc.startSharedAttempt({ userId: PARTICIPANT, testId: t.testId });
  await svc.submitSharedAttempt(first._id, PARTICIPANT, {
    answers: { [t.questions[0]._id]: 'A' }, timeSpentSeconds: 10,
  });

  t.expiresAt = new Date(Date.now() - HOUR); // the test now expires

  const info = await svc.lookupSharedTestForJoin(t.testId, PARTICIPANT);
  assert.equal(info.status, 'expired');
  assert.equal(info.questions, undefined, 'summary must not carry questions');

  const taking = await svc.getSharedTestForTaking(t.testId, PARTICIPANT);
  assert.ok(taking.questions.every(q => !('correctAnswer' in q)), 'answers must stay stripped');

  const ids = new Set([idStr(first)]);
  for (let i = 0; i < 6; i++) {
    const a = await svc.startSharedAttempt({ userId: PARTICIPANT, testId: t.testId });
    const submitted = await svc.submitSharedAttempt(a._id, PARTICIPANT, {
      answers: { [t.questions[1]._id]: 'B' }, timeSpentSeconds: 5,
    });
    assert.equal(submitted.status, 'submitted');
    assert.ok(submitted.results, 'each attempt has its own results');
    ids.add(idStr(a));
  }
  assert.equal(ids.size, 7, 'seven distinct attempt records');
  assert.equal(db.attempts.length, 7);
  assert.equal(db.attempts[0].answers[t.questions[0]._id], 'A', 'earlier attempt untouched');
});

test('C2: an attempt started before expiry can still be submitted after expiry', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  const a = await svc.startSharedAttempt({ userId: PARTICIPANT, testId: t.testId });
  t.expiresAt = new Date(Date.now() - 1000);
  const done = await svc.submitSharedAttempt(a._id, PARTICIPANT, { answers: {}, timeSpentSeconds: 1 });
  assert.equal(done.status, 'submitted');
});

test("C3: a reattempt after expiry is scored with the test's stored rules", async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  db.attempts.push({ _id: newId(), sharedTest: t._id, user: PARTICIPANT, status: 'submitted' });
  const a = await svc.startSharedAttempt({ userId: PARTICIPANT, testId: t.testId });
  const done = await svc.submitSharedAttempt(a._id, PARTICIPANT, {
    answers: { [t.questions[0]._id]: 'A', [t.questions[1]._id]: 'A' }, timeSpentSeconds: 3,
  });
  assert.equal(done.results.correct, 1);
  assert.equal(done.results.incorrect, 1);
  assert.equal(done.results.rawScore, 1.5); // 2 marks - 0.5 penalty
});

/* ── D. new user after expiry ──────────────────────────────────────────── */
test('D: a NEW user is rejected on every path for an expired test and nothing is created', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  await rejectsWith(svc.lookupSharedTestForJoin(t.testId, STRANGER), 410);
  await rejectsWith(svc.getSharedTestForTaking(t.testId, STRANGER), 410);
  await rejectsWith(svc.startSharedAttempt({ userId: STRANGER, testId: t.testId }), 410);
  await rejectsWith(svc.getSharedTestDetails(t.testId, STRANGER), 410);
  assert.equal(db.attempts.length, 0, 'no attempt record may be created');
});

test('D2: the rejection explains the test no longer accepts new participants', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  await assert.rejects(svc.lookupSharedTestForJoin(t.testId, STRANGER), /no longer accepting new participants/);
});

test('D3: client-supplied flags like canReattempt/isCreator are ignored', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  db.attempts.push({ _id: newId(), sharedTest: t._id, user: PARTICIPANT, status: 'submitted' });
  await rejectsWith(
    svc.startSharedAttempt({ userId: STRANGER, testId: t.testId, canReattempt: true, isCreator: true }),
    410
  );
});

/* ── E. creator ────────────────────────────────────────────────────────── */
test('E: the creator keeps access and can reattempt after expiry', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  const info = await svc.lookupSharedTestForJoin(t.testId, CREATOR);
  assert.equal(info.status, 'expired');
  const a = await svc.startSharedAttempt({ userId: CREATOR, testId: t.testId });
  assert.equal(a.status, 'in_progress');
});

/* ── F. other-user authorization ───────────────────────────────────────── */
test("F: details return ONLY the caller's own attempts", async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  db.attempts.push(
    { _id: newId(), sharedTest: t._id, user: PARTICIPANT, status: 'submitted', submittedAt: new Date() },
    { _id: newId(), sharedTest: t._id, user: CREATOR, status: 'submitted', submittedAt: new Date() },
  );
  const d = await svc.getSharedTestDetails(t.testId, PARTICIPANT);
  assert.equal(d.attempts.length, 1);
  assert.equal(idStr(d.attempts[0].user), idStr(PARTICIPANT));
  assert.equal(d.sharedTest.status, 'expired');
  assert.equal(d.sharedTest.questions, undefined);
});

test('F2: a participant with no completed attempt gets an empty history, not fabricated data', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  db.attempts.push({ _id: newId(), sharedTest: t._id, user: PARTICIPANT, status: 'in_progress' });
  const d = await svc.getSharedTestDetails(t.testId, PARTICIPANT);
  assert.deepEqual(d.attempts, []);
});

test('F3: an ineligible user cannot bookmark (and so read back) a question', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  await rejectsWith(svc.toggleSharedBookmark({
    userId: STRANGER, sharedTestObjectId: t._id, questionId: t.questions[0]._id, bookmarked: true,
  }), 404);
  assert.equal(db.bookmarks.length, 0);
});

test('F4: a malformed Test ID is rejected before any lookup', async () => {
  await rejectsWith(svc.getSharedTestDetails('nonsense', PARTICIPANT), 400);
});
