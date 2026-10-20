const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBody } = require('../middleware/validation');

/**
 * validation.test.js — NEW for M17
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the validateBody middleware factory directly, without spinning up a
 * real HTTP server — call it with a mock req/res/next exactly as Express
 * would, and inspect what next() got called with.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function runMiddleware(rules, body) {
  const req = { body };
  let error = null;
  let calledCleanly = false;

  const next = (err) => {
    if (err) error = err;
    else calledCleanly = true;
  };

  validateBody(rules)(req, {}, next);
  return { error, calledCleanly };
}

test('valid input passes through to next() with no error', () => {
  const { calledCleanly, error } = runMiddleware(
    { name: { required: true, type: 'string' } },
    { name: 'Alice' }
  );
  assert.equal(calledCleanly, true);
  assert.equal(error, null);
});

test('missing required field produces a 400 AppError', () => {
  const { error } = runMiddleware(
    { name: { required: true, type: 'string' } },
    {}
  );
  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test('wrong type is rejected', () => {
  const { error } = runMiddleware(
    { age: { required: true, type: 'number' } },
    { age: 'not a number' }
  );
  assert.ok(error);
});

test('value outside an enum is rejected', () => {
  const { error } = runMiddleware(
    { status: { required: true, type: 'string', enum: ['active', 'inactive'] } },
    { status: 'deleted' }
  );
  assert.ok(error);
});

test('an optional field can be omitted entirely', () => {
  const { calledCleanly } = runMiddleware(
    { nickname: { required: false, type: 'string' } },
    {}
  );
  assert.equal(calledCleanly, true);
});

test('minLength is enforced on strings', () => {
  const { error } = runMiddleware(
    { password: { required: true, type: 'string', minLength: 8 } },
    { password: 'short' }
  );
  assert.ok(error);
});

test('minLength is enforced on arrays too (item count, not string length)', () => {
  const { error } = runMiddleware(
    { questionIds: { required: true, type: 'array', minLength: 1 } },
    { questionIds: [] }
  );
  assert.ok(error);
});

test('an invalid ObjectId string is rejected when objectId: true', () => {
  const { error } = runMiddleware(
    { userId: { required: true, type: 'string', objectId: true } },
    { userId: 'not-a-valid-mongo-id' }
  );
  assert.ok(error);
});

test('a valid-looking ObjectId string passes', () => {
  const { calledCleanly } = runMiddleware(
    { userId: { required: true, type: 'string', objectId: true } },
    { userId: '507f1f77bcf86cd799439011' }
  );
  assert.equal(calledCleanly, true);
});
