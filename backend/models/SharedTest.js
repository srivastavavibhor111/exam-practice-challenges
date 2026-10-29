const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SharedTest — NEW model, ENTIRELY SEPARATE from the personal Test model
 * ─────────────────────────────────────────────────────────────────────────────
 * Questions are embedded directly as subdocuments — NOT a reference to
 * the personal Question collection, and not a separate SharedQuestion
 * collection either. Two reasons: (1) this is "the one central copy" the
 * spec requires — embedding IS that single stored copy, referenced by
 * every attempt against it, never duplicated; (2) shared-test questions
 * don't need the independent lifecycle/reuse that personal Questions do
 * (editable across multiple tests, bookmarkable outside any one test) —
 * once a shared test is created, its questions are fixed.
 *
 * Each embedded question automatically gets its own Mongoose-assigned
 * `_id` (default subdocument behavior) — that's what SharedAttempt's
 * `answers` map keys against, and what SharedTestBookmark's `questionId`
 * refers to.
 *
 * `createdAt`/`expiresAt` are explicit, real schema fields — NOT relying
 * on Mongoose's automatic `{ timestamps: true }` behavior, so the exact
 * 48-hour calculation is fully deterministic and set once, together, at
 * creation time in sharedTestService.js. `status` (Active/Expired) is
 * deliberately NOT stored anywhere — it's computed fresh on every read by
 * comparing the current time to `expiresAt` (see toPublicSharedTest() in
 * sharedTestService.js). A stored status field would need a cron job or
 * background process to stay accurate, which this app has no
 * infrastructure for and doesn't need — computing it on read is simpler
 * and always correct.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const sharedQuestionSchema = new Schema({
  text: { type: String, required: true, trim: true },
  options: {
    A: { type: String, default: '', trim: true },
    B: { type: String, default: '', trim: true },
    C: { type: String, default: '', trim: true },
    D: { type: String, default: '', trim: true },
  },
  correctAnswer: {
    type: String,
    enum: ['A', 'B', 'C', 'D', null],
    default: null,
  },
  explanation: { type: String, default: '', trim: true },
  topic: { type: String, default: '', trim: true },
});

const sharedTestSchema = new Schema({
  testId: {
    type: String,
    required: true,
    unique: true, // enforced at the DB level too — not just the application-level uniqueness check
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Set when the CREATOR uses "Delete from my account". The test itself is
  // never deleted (other participants keep it); this only hides it from the
  // creator's own account and ends their creator-based access. Optional, so
  // every existing document is simply "not removed" — no migration needed.
  // Cleared again if the creator rejoins while the test is still active.
  creatorRemovedAt: {
    type: Date,
    default: null,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },

  questions: [sharedQuestionSchema],

  scoring: {
    marksPerCorrect: { type: Number, default: 1, min: 0.01 },
    negativeMarksPerIncorrect: { type: Number, default: 0, min: 0 },
    negativeMarkingRule: {
      type: String,
      enum: ['negative_only', 'full_marks_plus_penalty'],
      default: 'negative_only',
    },
  },

  // Fixed by the creator at creation time — applies identically to every
  // participant. Unlike personal tests, a shared test's duration is NOT
  // chosen fresh by each user; fairness across participants requires
  // everyone getting the same time limit.
  durationSeconds: {
    type: Number,
    required: true,
    min: 60,
  },

  createdAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

sharedTestSchema.index({ creator: 1, createdAt: -1 });

/**
 * Permanence guard — defense in depth.
 * A Shared Test must never be deleted through the application: not by its
 * creator, not by expiry, not by a cascade from some other feature. There
 * is no TTL index on this schema and no route that deletes one; these
 * hooks make any accidental future call (Model.deleteOne, deleteMany,
 * findOneAndDelete, doc.deleteOne) throw instead of silently removing
 * data. Note: hooks only cover Mongoose calls — direct database access
 * (mongosh, Atlas UI) is outside the application and unaffected.
 */
function blockDeletion() {
  // Throwing (rather than calling next(err)) works on every Mongoose
  // version; newer versions no longer pass a `next` callback to hooks.
  throw new Error('Shared Tests are permanent and cannot be deleted.');
}
sharedTestSchema.pre('deleteOne', { document: true, query: true }, blockDeletion);
sharedTestSchema.pre('deleteMany', blockDeletion);
sharedTestSchema.pre('findOneAndDelete', blockDeletion);

module.exports = mongoose.model('SharedTest', sharedTestSchema);
