const { Source } = require('../models');
const AppError = require('../utils/AppError');
const assertOwnership = require('../utils/assertOwnership');

/**
 * sourceService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Business logic for Source (the raw pasted text / ChatGPT link a user
 * provides). Kept deliberately thin at this milestone — M9's extraction
 * engine will call into this when it needs to fetch/store source content,
 * but the extraction logic itself lives in its own service, not here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function createSource({ userId, sourceType, sourceReference, rawContent }) {
  return Source.create({
    user: userId,
    sourceType,
    sourceReference: sourceReference || undefined,
    rawContent,
  });
}

async function getSourceById(id, userId) {
  const source = await Source.findById(id);
  assertOwnership(source, userId, 'Source');
  return source;
}

async function listSourcesForUser(userId) {
  return Source.find({ user: userId }).sort({ createdAt: -1 });
}

async function deleteSource(id, userId) {
  const source = await Source.findById(id);
  assertOwnership(source, userId, 'Source');
  await source.deleteOne();
}

module.exports = { createSource, getSourceById, listSourcesForUser, deleteSource };
