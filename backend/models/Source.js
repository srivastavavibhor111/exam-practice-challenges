const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Source
 * ─────────────────────────────────────────────────────────────────────────────
 * The original content a user provided — before any extraction happened.
 * Per architecture rule #31 ("Extraction Should Not Destroy Original Data"),
 * `rawContent` is preserved permanently, even after Questions have been
 * extracted from it. This lets a future milestone re-run extraction on the
 * same source (e.g. after the extraction engine improves in M9) without the
 * user needing to paste their content again.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const sourceSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sourceType: {
      type: String,
      enum: ['text', 'chatgpt_link'],
      required: true,
    },
    // The pasted URL, only present when sourceType === 'chatgpt_link'
    sourceReference: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    // The full original content — pasted text, or the retrieved conversation
    // text once M9's link-retrieval is built. Never overwritten.
    rawContent: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

sourceSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Source', sourceSchema);
