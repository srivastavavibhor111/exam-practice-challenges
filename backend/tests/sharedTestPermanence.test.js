/**
 * sharedTestPermanence.test.js — no deletion path for Shared Tests
 * Run:  node --test tests/sharedTestPermanence.test.js
 *
 * Uses the REAL SharedTest model + Mongoose. No database connection is
 * needed: the guard hooks throw before Mongoose would contact MongoDB.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const SharedTest = require('../models/SharedTest');

const MSG = /permanent and cannot be deleted/;

test('Model.deleteOne is blocked', async () => {
  await assert.rejects(SharedTest.deleteOne({ testId: 'ST-1234-ABCD' }), MSG);
});
test('Model.deleteMany is blocked', async () => {
  await assert.rejects(SharedTest.deleteMany({}), MSG);
});
test('Model.findOneAndDelete is blocked', async () => {
  await assert.rejects(SharedTest.findOneAndDelete({ testId: 'ST-1234-ABCD' }), MSG);
});
test('Model.findByIdAndDelete is blocked', async () => {
  await assert.rejects(SharedTest.findByIdAndDelete('507f1f77bcf86cd799439011'), MSG);
});
test('document.deleteOne() is blocked', async () => {
  const doc = new SharedTest({});
  await assert.rejects(doc.deleteOne(), MSG);
});
test('the schema defines no TTL (expireAfterSeconds) index', () => {
  const ttl = SharedTest.schema.indexes().filter(([, opts]) => opts && 'expireAfterSeconds' in opts);
  assert.equal(ttl.length, 0);
  for (const path of Object.values(SharedTest.schema.paths)) {
    assert.ok(!path.options.expires && !path.options.expireAfterSeconds, `${path.path} must not auto-expire`);
  }
});
