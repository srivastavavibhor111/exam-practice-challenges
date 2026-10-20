const AppError = require('./AppError');

/**
 * assertOwnership — Ownership Guard
 * ─────────────────────────────────────────────────────────────────────────────
 * Confirms a document belongs to the requesting user before letting them
 * read, edit, or delete it. Every service function that touches a specific
 * resource (a Source, Question, Test, or Attempt) calls this first.
 *
 * IMPORTANT — pre-auth caveat (until M11):
 * Right now, `userId` comes from whatever the client sends in the request
 * body/query — there's no verified identity behind it yet. This function
 * still matters today because it keeps data logically separated and catches
 * bugs (e.g. accidentally operating on the wrong user's Test). Once M11
 * adds real authentication, `userId` will come from a verified JWT instead
 * of a client-supplied value, and this exact same check becomes a genuine
 * security boundary rather than just a data-integrity one — no other code
 * needs to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function assertOwnership(doc, userId, resourceName = 'Resource') {
  if (!doc) {
    throw new AppError(404, `${resourceName} not found`);
  }
  if (doc.user.toString() !== String(userId)) {
    throw new AppError(403, `You don't have access to this ${resourceName.toLowerCase()}`);
  }
}

module.exports = assertOwnership;
