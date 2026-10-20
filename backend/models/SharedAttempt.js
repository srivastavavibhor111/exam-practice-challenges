const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SharedAttempt — NEW model, ENTIRELY SEPARATE from the personal Attempt model
 * ─────────────────────────────────────────────────────────────────────────────
 * One document per user per attempt against a SharedTest — many
 * SharedAttempts can reference the same SharedTest, and one user's
 * attempt never touches another's (same isolation guarantee the personal
 * Attempt model already has, just for a different parent).
 *
 * `answers` keys are the embedded question subdocuments' own `_id`
 * values (stringified) — SharedTest.questions[i]._id, not a reference to
 * any personal Question document, since none exists here.
 *
 * `results` mirrors the personal Attempt.results shape exactly (same
 * fields, including the scoring-rules feature's additions rawScore/
 * maxPossibleScore/scoringRules) — because it's computed by the SAME
 * scoringService.calculateResult() function, called directly from
 * sharedTestService.js. No separate scoring logic exists for shared
 * tests; the grading engine doesn't know or care which "ecosystem" it's
 * grading for.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const sharedAttemptSchema = new Schema(
  {
    sharedTest: {
      type: Schema.Types.ObjectId,
      ref: 'SharedTest',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    answers: {
      type: Map,
      of: String,
      default: {},
    },
    markedForReview: [{ type: String }],

    durationSeconds: { type: Number, required: true },
    timeSpentSeconds: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'auto_submitted'],
      default: 'in_progress',
    },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },

    results: {
      totalQuestions: Number,
      gradedCount: Number,
      ungraded: Number,
      correct: Number,
      incorrect: Number,
      unattempted: Number,
      score: Number,
      percentage: Number,
      accuracy: Number,
      avgTimePerQuestion: Number,
      rawScore: Number,
      maxPossibleScore: Number,
      scoringRules: {
        marksPerCorrect: Number,
        negativeMarksPerIncorrect: Number,
        negativeMarkingRule: {
          type: String,
          enum: ['negative_only', 'full_marks_plus_penalty'],
        },
      },
    },
  },
  { timestamps: true }
);

sharedAttemptSchema.index({ user: 1, sharedTest: 1 });
sharedAttemptSchema.index({ user: 1, submittedAt: -1 });

module.exports = mongoose.model('SharedAttempt', sharedAttemptSchema);
