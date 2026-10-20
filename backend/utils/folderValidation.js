const AppError = require('./AppError');

/**
 * folderValidation.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure helper functions for the Custom Test Folder feature. Deliberately has
 * NO database or Mongoose dependency, which is what lets tests/folderValidation
 * .test.js exercise every rule here for real, with no database running.
 *
 * Contents:
 *   • Limits (name length, folders per user, items per request)
 *   • validateFolderName()   — trim + length + control-character rules
 *   • validateItemRefs()     — shape/ID/duplicate/size checks on item lists
 *   • isDeleteConfirmation() — the EXACT "DELETE" comparison (no trimming)
 *   • filterUnorganized()    — set arithmetic behind the Unorganized view
 * ─────────────────────────────────────────────────────────────────────────────
 */

const FOLDER_NAME_MAX_LENGTH = 50;
const MAX_FOLDERS_PER_USER = 100;
const MAX_ITEMS_PER_REQUEST = 100;

const ITEM_TYPES = ['test', 'sharedTest'];
const DELETE_MODES = ['folder_only', 'folder_and_tests'];
const DELETE_CONFIRMATION_PHRASE = 'DELETE';

// Stricter than mongoose.Types.ObjectId.isValid(), which also accepts any
// 12-character string. We only want real 24-character hex ObjectIds.
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

// ASCII control characters (newlines, tabs, NUL, DEL…) have no place in a name.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function isValidObjectIdString(value) {
  return typeof value === 'string' && OBJECT_ID_PATTERN.test(value);
}

/**
 * validateFolderName
 * Trims leading/trailing whitespace, then enforces 1–50 characters and no
 * control characters. Case is PRESERVED — folder names are case-sensitive,
 * so "Python" and "python" are two different, valid names.
 * Returns the cleaned name, or throws a 400 AppError with a clear message.
 */
function validateFolderName(raw) {
  if (typeof raw !== 'string') {
    throw new AppError(400, 'Folder name must be text.');
  }
  const name = raw.trim();
  if (name.length === 0) {
    throw new AppError(400, 'Folder name cannot be empty.');
  }
  if (name.length > FOLDER_NAME_MAX_LENGTH) {
    throw new AppError(400, `Folder name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer.`);
  }
  if (CONTROL_CHARS.test(name)) {
    throw new AppError(400, 'Folder name contains invalid characters.');
  }
  return name;
}

/**
 * validateItemRefs
 * Takes the raw `items` array from a request body and returns a clean,
 * de-duplicated list of { itemType, itemId }. Anything malformed rejects the
 * WHOLE request (400) — a structurally broken list means a buggy or hostile
 * client, not a user error worth partially honoring.
 */
function validateItemRefs(items, max = MAX_ITEMS_PER_REQUEST) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'Select at least one test.');
  }
  if (items.length > max) {
    throw new AppError(400, `You can process at most ${max} tests at a time.`);
  }

  const seen = new Set();
  const refs = [];

  for (const entry of items) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new AppError(400, 'Each item must be an object with itemType and itemId.');
    }
    const { itemType, itemId } = entry;
    if (!ITEM_TYPES.includes(itemType)) {
      throw new AppError(400, `itemType must be one of: ${ITEM_TYPES.join(', ')}.`);
    }
    if (!isValidObjectIdString(itemId)) {
      throw new AppError(400, 'Each item needs a valid itemId.');
    }
    const key = `${itemType}:${itemId.toLowerCase()}`;
    if (seen.has(key)) continue; // same item listed twice in one request — ignore the repeat
    seen.add(key);
    refs.push({ itemType, itemId: itemId.toLowerCase() });
  }

  return refs;
}

/**
 * isDeleteConfirmation
 * EXACT, case-sensitive, whitespace-sensitive comparison. Deliberately does
 * no trimming and no case-folding: " DELETE", "DELETE ", "delete" and
 * "Delete" must all fail.
 */
function isDeleteConfirmation(value) {
  return value === DELETE_CONFIRMATION_PHRASE;
}

function itemKey(itemType, itemId) {
  return `${itemType}:${String(itemId)}`;
}

/**
 * filterUnorganized
 * Unorganized = attempted library entries whose key appears in NO folder.
 * `organizedKeys` is a Set of `${itemType}:${itemId}` strings built from the
 * user's FolderItem records. Nothing is stored for Unorganized — it is
 * recomputed from the real data on every request, so it can never drift.
 */
function filterUnorganized(entries, organizedKeys) {
  return entries.filter(entry => entry.attempted && !organizedKeys.has(entry.key));
}

module.exports = {
  FOLDER_NAME_MAX_LENGTH,
  MAX_FOLDERS_PER_USER,
  MAX_ITEMS_PER_REQUEST,
  ITEM_TYPES,
  DELETE_MODES,
  DELETE_CONFIRMATION_PHRASE,
  isValidObjectIdString,
  validateFolderName,
  validateItemRefs,
  isDeleteConfirmation,
  itemKey,
  filterUnorganized,
};
