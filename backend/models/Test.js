const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Test — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * `settings.negativeMarking` (a stub added in M15 — {enabled, value} — that
 * never had any UI or logic built on it, flagged in the project's own
 * README as a known "next feature") is REPLACED by a proper top-level
 * `scoring` field, matching the actual feature now being built. This is
 * safe: nothing in the app ever read or wrote the old stub, so there's no
 * real data or behavior depending on its exact shape.
 *
 * `scoring` sits as a sibling to `settings`, not nested inside it — the
 * Create Test flow treats "Scoring Rules" and "Timer/Test Settings" as
 * two distinct steps, and the schema now reflects that same structure.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const testSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
      },
    ],

    // NEW/REPLACED — see file header. Every test now carries an explicit,
    // complete scoring configuration — set once at creation (Set Scoring
    // Rules step) and read again, unchanged, at every submission.
    scoring: {
      marksPerCorrect: { type: Number, default: 1, min: 0.01 },
      negativeMarksPerIncorrect: { type: Number, default: 0, min: 0 },
      negativeMarkingRule: {
        type: String,
        enum: ['negative_only', 'full_marks_plus_penalty'],
        default: 'negative_only',
      },
    },

    settings: {
      randomizeOrder: { type: Boolean, default: false },
      showExplanationsImmediately: { type: Boolean, default: false },
    },

    isPracticeSet: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

testSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Test', testSchema);
