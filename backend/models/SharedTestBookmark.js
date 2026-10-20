const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SharedTestBookmark — NEW model
 * ─────────────────────────────────────────────────────────────────────────────
 * Deliberately its own tiny collection, not a `bookmarked` boolean on the
 * embedded question (the way personal Question.bookmarked works) —
 * embedded subdocuments belong to the SharedTest, which is shared across
 * every participant, so a boolean there would mean "bookmarked by
 * everyone" or require an awkward per-user array on every question.
 * A separate join-style collection (user, sharedTest, questionId) is
 * clean, directly queryable ("all my shared bookmarks across every
 * shared test I've ever attempted"), and doesn't touch the SharedTest
 * document at all when toggled.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const sharedTestBookmarkSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedTest: {
      type: Schema.Types.ObjectId,
      ref: 'SharedTest',
      required: true,
    },
    questionId: {
      type: String, // the embedded question subdocument's own _id, stringified
      required: true,
    },
  },
  { timestamps: true }
);

sharedTestBookmarkSchema.index({ user: 1, sharedTest: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model('SharedTestBookmark', sharedTestBookmarkSchema);
