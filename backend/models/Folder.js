const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Folder — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * A user-created, named collection used to organize tests in My Tests.
 * A Folder holds ONLY its own metadata (owner + name). Which tests are inside
 * it lives in the separate FolderItem collection — see FolderItem.js for why.
 *
 * Identity: every folder has its own stable _id. Renaming changes only
 * `name`; the _id and every FolderItem pointing at it stay exactly as they
 * were. Folders are never identified by name alone.
 *
 * Uniqueness: (user, name) is unique and CASE-SENSITIVE — "Python" and
 * "python" are two different folders. MongoDB's default string comparison is
 * case-sensitive, so a plain unique index gives exactly this policy with no
 * custom collation. The service also catches the duplicate-key error (11000)
 * and turns it into a friendly 409 message.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const folderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
  },
  { timestamps: true }
);

folderSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);
