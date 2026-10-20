const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Attempt
 * ─────────────────────────────────────────────────────────────────────────────
 * One user's submission for a Test — created when the countdown starts on
 * the Test setup screen (M5) and finalized on submit (manual or auto).
 *
 * `answers` uses a Map keyed by question ID → selected letter, mirroring the
 * frontend's `answers` state object exactly (Test.jsx: `answers[question.id]`).
 * No transformation needed when this gets wired up in M12.
 *
 * `results` is a SNAPSHOT of scoring.js's output, saved once at submit time —
 * not a live computed value. This is deliberate: if the user later edits the
 * Test's questions (e.g. fixes a typo, changes a correct answer), past
 * Attempts must keep showing what actually happened at the time they were
 * taken. Recomputing on read would silently rewrite history.
 *
 * `status` distinguishes a manual submit from an auto-submit when the
 * countdown hit zero (M5) — useful later for analytics on rushed attempts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const resultsSnapshotSchema = new Schema(
  {
    totalQuestions:  { type: Number, required: true },
    gradedCount:     { type: Number, required: true },
    ungraded:        { type: Number, required: true },
    correct:         { type: Number, required: true },
    incorrect:       { type: Number, required: true },
    unattempted:     { type: Number, required: true },
    score:           { type: Number, required: true },
    percentage:      { type: Number, required: true },
    accuracy:        { type: Number, required: true },
    avgTimePerQuestion: { type: Number, required: true },
    
     // NEW — the weighted score, computed from the test's own scoring
    // rules at submit time (scoringService.js). rawScore can be
    // negative (per the spec's own explicit requirement) — do NOT add
    // a `min: 0` constraint here, that would silently break a
    // legitimate negative score from ever being saved.

    rawScore:        { type: Number },
    maxPossibleScore: { type: Number },

    scoringRules: {
      marksPerCorrect: { type: Number },
      negativeMarksPerIncorrect: { type: Number },
      negativeMarkingRule: {
        type: String,
        enum: ['negative_only', 'full_marks_plus_penalty'],
      },
    },
  },
  { _id: false } // pure snapshot data — doesn't need its own id
);

const attemptSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    test: {
      type: Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },

    // Map<questionId, 'A'|'B'|'C'|'D'> — matches Test.jsx's `answers` state shape.
    answers: {
      type: Map,
      of: String,
      default: () => ({}),
    },

    markedForReview: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],

    durationSeconds:   { type: Number, required: true }, // chosen on the setup screen
    timeSpentSeconds:  { type: Number, default: 0 },      // actual time used

    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'auto_submitted'],
      default: 'in_progress',
    },

    startedAt:   { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },

    // Snapshot of scoring.js's output at submit time. Null while in_progress.
    results: {
      type: resultsSnapshotSchema,
      default: null,
    },
  },
  { timestamps: true }
);

attemptSchema.index({ user: 1, createdAt: -1 });
attemptSchema.index({ test: 1 });

module.exports = mongoose.model('Attempt', attemptSchema);
