const crypto = require('crypto');

/**
 * sharedTestId.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates candidate Shared Test IDs in the exact format ST-XXXX-YYYY
 * (4 random digits, 4 random uppercase alphanumeric characters). This
 * file only generates CANDIDATES — actual uniqueness checking against the
 * database happens in sharedTestService.js, since that's the only place
 * that can actually know what IDs already exist. Generating a random
 * string and simply trusting it's unique would be a real correctness
 * bug at any meaningful scale, per the spec's own explicit warning.
 *
 * Uses crypto.randomInt (cryptographically strong) rather than
 * Math.random() — not because these IDs are security-sensitive exactly,
 * but because Math.random() is a weaker generator with no reason to
 * prefer it here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TEST_ID_PATTERN = /^ST-\d{4}-[A-Z0-9]{4}$/;

function randomDigits(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += crypto.randomInt(0, 10).toString();
  return out;
}

function randomAlphanumeric(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHANUMERIC[crypto.randomInt(0, ALPHANUMERIC.length)];
  return out;
}

function generateCandidateId() {
  return `ST-${randomDigits(4)}-${randomAlphanumeric(4)}`;
}

function isValidTestIdFormat(value) {
  return typeof value === 'string' && TEST_ID_PATTERN.test(value.trim());
}

module.exports = { generateCandidateId, isValidTestIdFormat, TEST_ID_PATTERN };
