/**
 * sharedTestRemoval.test.js — "Delete from my account"
 * ─────────────────────────────────────────────────────────────────────────────
 * Run:  node --test tests/sharedTestRemoval.test.js     (Node 18+, no extra deps)
 *
 * Same approach as sharedTestExpiry.test.js: real service code, in-memory
 * fake models. The fake SharedTest deliberately has NO delete methods, so
 * if the removal code ever tried to delete the test document itself, these
 * tests would crash instead of passing.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let seq = 0;
const newId = () => ({ n: ++seq, toString() { return `id${this.n}`; } });
const idStr = v => String(v?._id ?? v);
const same = (a, b) => idStr(a) === idStr(b);

const db = { tests: [], attempts: [], bookmarks: [], folderItems: [] };

function makeTest({ creator, expiresInMs, testId = 'ST-1234-ABCD' }) {
  const t = {
    _id: newId(), testId, creator, title: 'Fake test', durationSeconds: 600,
    scoring: { marksPerCorrect: 1, negativeMarksPerIncorrect: 0, negativeMarkingRule: 'negative_only' },
    createdAt: new Date(Date.now() - 49 * 3600 * 1000),
    expiresAt: new Date(Date.now() + expiresInMs),
    creatorRemovedAt: null,
    questions: [{ _id: newId(), text: 'Q1', options: { A: 'a', B: 'b', C: '', D: '' }, correctAnswer: 'A' }],
  };
  t.toObject = () => ({ ...t, toObject: undefined });
  db.tests.push(t);
  return t;
}
const addAttempt = (t, user, status = 'submitted') => {
  const a = { _id: newId(), sharedTest: t._id, user, status, submittedAt: new Date() };
  db.attempts.push(a);
  return a;
};

const FakeSharedTest = {
  findOne: async ({ testId }) => db.tests.find(x => x.testId === testId) || null,
  findById: async id => db.tests.find(x => same(x, id)) || null,
  find: q => {
    const rows = db.tests.filter(x => same(x.creator, q.creator) && (q.creatorRemovedAt === null ? !x.creatorRemovedAt : true));
    return { sort: async () => rows };
  },
  updateOne: async (filter, update) => {
    const doc = db.tests.find(x => same(x, filter._id) && (!filter.creator || same(x.creator, filter.creator)));
    if (doc) Object.assign(doc, update.$set);
  },
  // NOTE: no deleteOne / deleteMany / findOneAndDelete on purpose.
};

const FakeSharedAttempt = {
  exists: async ({ sharedTest, user }) =>
    db.attempts.some(a => same(a.sharedTest, sharedTest) && same(a.user, user)) ? { _id: 1 } : null,
  create: async data => {
    const a = { _id: newId(), answers: {}, ...data, save: async function () { return this; } };
    db.attempts.push(a);
    return a;
  },
  deleteMany: async ({ sharedTest, user }) => {
    assert.ok(sharedTest && user, 'deleteMany must always be scoped by test AND user');
    const before = db.attempts.length;
    db.attempts = db.attempts.filter(a => !(same(a.sharedTest, sharedTest) && same(a.user, user)));
    return { deletedCount: before - db.attempts.length };
  },
  find: q => {
    const rows = db.attempts.filter(a =>
      same(a.sharedTest, q.sharedTest) && same(a.user, q.user) && q.status.$in.includes(a.status));
    const chain = { select: () => chain, sort: async () => rows };
    return chain;
  },
};

const FakeBookmark = {
  deleteMany: async ({ sharedTest, user }) => {
    assert.ok(sharedTest && user, 'bookmark delete must be scoped by test AND user');
    db.bookmarks = db.bookmarks.filter(b => !(same(b.sharedTest, sharedTest) && same(b.user, user)));
  },
};

const FakeFolderItem = {
  deleteMany: async ({ user, itemType, itemId }) => {
    assert.ok(user && itemType === 'sharedTest' && itemId, 'folder delete must be scoped by user, type and item');
    db.folderItems = db.folderItems.filter(f => !(same(f.user, user) && f.itemType === itemType && same(f.itemId, itemId)));
  },
};

const modelsPath = require.resolve(path.join(__dirname, '../models'));
require.cache[modelsPath] = {
  id: modelsPath, filename: modelsPath, loaded: true,
  exports: {
    SharedTest: FakeSharedTest, SharedAttempt: FakeSharedAttempt,
    SharedTestBookmark: FakeBookmark, FolderItem: FakeFolderItem,
  },
};
const svc = require('../services/sharedTestService');

const CREATOR = newId(), ALICE = newId(), BOB = newId(), STRANGER = newId();
const HOUR = 3600 * 1000;
const reset = () => { db.tests = []; db.attempts = []; db.bookmarks = []; db.folderItems = []; };
const attemptsOf = (t, u) => db.attempts.filter(a => same(a.sharedTest, t._id) && same(a.user, u)).length;

async function rejectsWith(promise, status) {
  await assert.rejects(promise, err => { assert.equal(err.statusCode, status); return true; });
}

test('R1: a participant removes ONLY their own attempts; the test and everyone else\'s data stay', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  addAttempt(t, ALICE); addAttempt(t, ALICE); addAttempt(t, ALICE, 'in_progress');
  addAttempt(t, BOB); addAttempt(t, BOB);
  addAttempt(t, CREATOR);

  const res = await svc.removeSharedTestFromMyAccount(t.testId, ALICE);

  assert.equal(res.deletedAttempts, 3);
  assert.equal(res.removedFromCreated, false);
  assert.equal(attemptsOf(t, ALICE), 0);
  assert.equal(attemptsOf(t, BOB), 2, "Bob's attempts untouched");
  assert.equal(attemptsOf(t, CREATOR), 1, "creator's attempts untouched");
  assert.equal(db.tests.length, 1, 'the Shared Test itself still exists');
});

test('R2: other participants keep full access to the test (details still open, test still takeable)', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR }); // expired
  addAttempt(t, ALICE); addAttempt(t, BOB);
  await svc.removeSharedTestFromMyAccount(t.testId, ALICE);

  const bobDetails = await svc.getSharedTestDetails(t.testId, BOB);
  assert.equal(bobDetails.attempts.length, 1);
  const bobStart = await svc.startSharedAttempt({ userId: BOB, testId: t.testId });
  assert.equal(bobStart.status, 'in_progress');
  assert.equal((await svc.getSharedTestForTaking(t.testId, CREATOR)).testId, t.testId);
});

test('R3: after removal on an EXPIRED test the user is a "new participant" again (rejected)', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  addAttempt(t, ALICE);
  await svc.removeSharedTestFromMyAccount(t.testId, ALICE);

  await rejectsWith(svc.getSharedTestDetails(t.testId, ALICE), 410);
  await rejectsWith(svc.lookupSharedTestForJoin(t.testId, ALICE), 410);
  await rejectsWith(svc.startSharedAttempt({ userId: ALICE, testId: t.testId }), 410);
  assert.equal(attemptsOf(t, ALICE), 0, 'no attempt recreated');
});

test('R4: after removal on an ACTIVE test the user can join again as a fresh participant', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  addAttempt(t, ALICE);
  await svc.removeSharedTestFromMyAccount(t.testId, ALICE);
  const a = await svc.startSharedAttempt({ userId: ALICE, testId: t.testId });
  assert.equal(a.status, 'in_progress');
  assert.equal(attemptsOf(t, ALICE), 1);
});

test('R5: a removal also clears THIS user\'s bookmarks and folder links for the test only', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  const other = makeTest({ creator: CREATOR, expiresInMs: +HOUR, testId: 'ST-9999-ZZZZ' });
  addAttempt(t, ALICE); addAttempt(other, ALICE); addAttempt(t, BOB);
  db.bookmarks.push(
    { user: ALICE, sharedTest: t._id }, { user: BOB, sharedTest: t._id }, { user: ALICE, sharedTest: other._id },
  );
  db.folderItems.push(
    { user: ALICE, itemType: 'sharedTest', itemId: t._id },
    { user: BOB, itemType: 'sharedTest', itemId: t._id },
    { user: ALICE, itemType: 'sharedTest', itemId: other._id },
    { user: ALICE, itemType: 'test', itemId: t._id }, // a personal test that happens to share an id value
  );
  await svc.removeSharedTestFromMyAccount(t.testId, ALICE);

  assert.equal(db.bookmarks.length, 2, "only Alice's bookmark on THIS test removed");
  assert.equal(db.folderItems.length, 3, "only Alice's shared-test link to THIS test removed");
  assert.equal(attemptsOf(other, ALICE), 1, "Alice's other test untouched");
});

test('R6: an unrelated user gets 404 and nothing changes', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  addAttempt(t, ALICE);
  await rejectsWith(svc.removeSharedTestFromMyAccount(t.testId, STRANGER), 404);
  assert.equal(attemptsOf(t, ALICE), 1);
  assert.equal(db.tests[0].creatorRemovedAt, null);
});

test('R7: removing twice is safe — the second call is a clean 404', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  addAttempt(t, ALICE);
  await svc.removeSharedTestFromMyAccount(t.testId, ALICE);
  await rejectsWith(svc.removeSharedTestFromMyAccount(t.testId, ALICE), 404);
});

test('R8: unknown and malformed Test IDs are rejected', async () => {
  reset();
  await rejectsWith(svc.removeSharedTestFromMyAccount('ST-0000-0000', ALICE), 404);
  await rejectsWith(svc.removeSharedTestFromMyAccount('nonsense', ALICE), 400);
});

test('R9: a creator removal hides the test from "Created by me" but keeps it for participants', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  addAttempt(t, CREATOR); addAttempt(t, ALICE);

  assert.equal((await svc.listSharedTestsCreatedByUser(CREATOR)).length, 1);
  const res = await svc.removeSharedTestFromMyAccount(t.testId, CREATOR);

  assert.equal(res.removedFromCreated, true);
  assert.equal(res.deletedAttempts, 1);
  assert.ok(t.creatorRemovedAt instanceof Date);
  assert.equal((await svc.listSharedTestsCreatedByUser(CREATOR)).length, 0);
  assert.equal(attemptsOf(t, ALICE), 1, "Alice's attempt untouched");
  assert.equal(db.tests.length, 1, 'test document still exists');
  assert.equal((await svc.getSharedTestDetails(t.testId, ALICE)).attempts.length, 1);
});

test('R10: a creator who removed an EXPIRED test loses access; participants do not', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: -HOUR });
  addAttempt(t, ALICE);
  await svc.removeSharedTestFromMyAccount(t.testId, CREATOR); // creator with zero attempts
  await rejectsWith(svc.getSharedTestDetails(t.testId, CREATOR), 410);
  await rejectsWith(svc.startSharedAttempt({ userId: CREATOR, testId: t.testId }), 410);
  assert.ok((await svc.getSharedTestDetails(t.testId, ALICE)).attempts !== undefined);
});

test('R11: a creator who removed an ACTIVE test and rejoins gets it back in "Created by me"', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  await svc.removeSharedTestFromMyAccount(t.testId, CREATOR);
  assert.equal((await svc.listSharedTestsCreatedByUser(CREATOR)).length, 0);
  await svc.startSharedAttempt({ userId: CREATOR, testId: t.testId });
  assert.equal(t.creatorRemovedAt, null);
  assert.equal((await svc.listSharedTestsCreatedByUser(CREATOR)).length, 1);
});

test('R12: removing a test never deletes the SharedTest document (fake has no delete methods)', async () => {
  reset();
  const t = makeTest({ creator: CREATOR, expiresInMs: +HOUR });
  addAttempt(t, CREATOR);
  await svc.removeSharedTestFromMyAccount(t.testId, CREATOR);
  assert.equal(db.tests.length, 1);
});
