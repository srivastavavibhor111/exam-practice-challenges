const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * FolderItem — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * One document = "this test is in this folder". It is a REFERENCE, never a
 * copy: no title, no questions, no scores are stored here. Everything about
 * the test is read from the original Test / SharedTest at query time, which
 * is why one test can sit in many folders without any duplicated data.
 *
 * Why a separate collection instead of an array of test IDs inside Folder:
 *   • A folder has no cap on size — an embedded array could grow toward
 *     MongoDB's 16 MB document limit.
 *   • The reference is POLYMORPHIC — it points at either a personal Test or a
 *     SharedTest (separate collections), so each item records its type.
 *   • Unorganized and cleanup need reverse lookups ("which folders contain
 *     this test?"), which a separate indexed collection answers directly.
 *
 * `itemType` + `itemId` identify the original record:
 *     'test'       → Test._id
 *     'sharedTest' → SharedTest._id   (the Mongo _id, not the ST-XXXX-YYYY code)
 *
 * `user` is stored redundantly (it equals the folder's owner) so
 * "all of this user's folder items" is a single indexed query, and so every
 * query can be scoped to the user without a join.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const folderItemSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    folder: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      required: true,
    },
    itemType: {
      type: String,
      enum: ['test', 'sharedTest'],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A test can appear in a given folder at most once. Enforced by the database
// itself, so even two simultaneous requests cannot create a duplicate.
// This index's leading field is `folder`, so it also serves "all items of a folder".
folderItemSchema.index({ folder: 1, itemType: 1, itemId: 1 }, { unique: true });

// Reverse lookup: "which of this user's folders contain this test?"
// Powers Unorganized, "In N folders" counts, and cleanup when a test is deleted.
folderItemSchema.index({ user: 1, itemType: 1, itemId: 1 });

module.exports = mongoose.model('FolderItem', folderItemSchema);
