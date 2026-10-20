const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Question — UPDATED FOR M15
 * ─────────────────────────────────────────────────────────────────────────────
 * One new field: `bookmarked`. This is deliberately separate from
 * "marked for review" (Attempt.markedForReview, M7) — that's a temporary
 * flag scoped to a single attempt, cleared the moment the attempt ends.
 * `bookmarked` is a persistent, cross-attempt flag on the Question itself:
 * "I want to be able to find this question again later," independent of
 * any specific test-taking session.
 *
 * Everything else is unchanged from M7/M12.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const questionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    source: {
      type: Schema.Types.ObjectId,
      ref: 'Source',
      default: null,
    },
    test: {
      type: Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

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

    explanation: {
      type: String,
      default: '',
      trim: true,
    },

    topic: {
      type: String,
      default: '',
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', null],
      default: null,
    },

    // NEW in M15 — persistent, cross-attempt bookmark. See services/questionService.js
    // for the endpoint that toggles this, and services/testService.js's
    // createPracticeTest for how bookmarked questions become a real
    // practice session without disturbing their original test.
    bookmarked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

questionSchema.index({ user: 1, source: 1 });
questionSchema.index({ test: 1 });
questionSchema.index({ user: 1, bookmarked: 1 });

module.exports = mongoose.model('Question', questionSchema);
