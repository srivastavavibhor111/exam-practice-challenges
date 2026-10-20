const mongoose = require('mongoose');
const {
  Folder, FolderItem, Test, Attempt, SharedTest, SharedAttempt,
} = require('../models');
const AppError = require('../utils/AppError');
const testService = require('./testService');
const {
  MAX_FOLDERS_PER_USER,
  DELETE_MODES,
  validateFolderName,
  validateItemRefs,
  isDeleteConfirmation,
  isValidObjectIdString,
  itemKey,
  filterUnorganized,
} = require('../utils/folderValidation');

/**
 * folderService.js — NEW (Custom Test Folders)
 * ─────────────────────────────────────────────────────────────────────────────
 * ALL folder business logic lives here; the controller only translates
 * HTTP ↔ these functions (same layering as the rest of the backend).
 *
 * The central idea: folders hold REFERENCES (FolderItem), and "what is a test
 * the user can organize?" is COMPUTED on demand from the real Test / Attempt /
 * SharedTest / SharedAttempt data by loadLibraryEntries(). Nothing about
 * tests, questions or attempts is ever copied or modified here — with one
 * explicit exception, deleteFolder(mode: 'folder_and_tests'), which reuses
 * testService.deleteTestCascade so the cascade rules live in exactly one place.
 *
 * Security stance, applied in every function:
 *   • every query is scoped to the authenticated user's id;
 *   • a folder that is not yours looks identical to one that does not exist
 *     (404, never 403) so IDs cannot be probed;
 *   • eligibility is verified against attempt records in the database, never
 *     against anything the client claims.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const COMPLETED = ['submitted', 'auto_submitted'];

/* ─── small helpers ───────────────────────────────────────────────────────── */

function toOid(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function toOids(ids) {
  return ids.map(toOid);
}

function toPublicFolder(folder, itemCount) {
  return {
    id: folder._id.toString(),
    name: folder.name,
    itemCount,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

function isDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

/** Loads a folder only if it belongs to this user. Not yours === not found. */
async function getOwnedFolder(userId, folderId, session = null) {
  if (!isValidObjectIdString(folderId)) {
    throw new AppError(404, 'Folder not found.');
  }
  const query = Folder.findOne({ _id: folderId, user: userId });
  if (session) query.session(session);
  const folder = await query;
  if (!folder) {
    throw new AppError(404, 'Folder not found.');
  }
  return folder;
}

function splitRefs(refs) {
  return {
    testIds: refs.filter(r => r.itemType === 'test').map(r => r.itemId),
    sharedIds: refs.filter(r => r.itemType === 'sharedTest').map(r => r.itemId),
  };
}

/* ─── the "library": every test the user can see in My Tests ──────────────── */

/**
 * loadLibraryEntries
 * Builds normalized entries for the user's tests, entirely from existing
 * collections — NOTHING here is stored.
 *
 *   Personal tests : every Test the user owns (practice sets included),
 *                    attempted or not.
 *   Shared tests   : only those the user has completed at least once (a
 *                    SharedTest you merely created but never attempted
 *                    belongs on the Shared Tests page, not here).
 *
 * `attempted` means ≥ 1 submitted/auto_submitted attempt — the same
 * definition the Dashboard uses. In-progress attempts do not count.
 *
 * When `testIds` / `sharedIds` are provided, only those records are
 * loaded (a targeted query); when omitted, the whole library is loaded.
 * Question text and answers are never loaded — only a computed question count.
 */
async function loadLibraryEntries(userId, { testIds, sharedIds } = {}) {
  const userOid = toOid(userId);

  /* ── personal tests ── */
  const loadPersonal = !testIds || testIds.length > 0;
  const personalMatch = { user: userOid };
  const attemptMatch = { user: userOid, status: { $in: COMPLETED } };
  if (testIds) {
    personalMatch._id = { $in: toOids(testIds) };
    attemptMatch.test = { $in: toOids(testIds) };
  }

  const [tests, personalStats] = loadPersonal
    ? await Promise.all([
        Test.aggregate([
          { $match: personalMatch },
          {
            $project: {
              title: 1,
              createdAt: 1,
              isPracticeSet: 1,
              questionCount: { $size: { $ifNull: ['$questions', []] } },
            },
          },
        ]),
        Attempt.aggregate([
          { $match: attemptMatch },
          { $sort: { submittedAt: -1, createdAt: -1 } },
          {
            $group: {
              _id: '$test',
              attemptCount: { $sum: 1 },
              lastAttemptedAt: { $first: '$submittedAt' },
              latestAttemptId: { $first: '$_id' },
            },
          },
        ]),
      ])
    : [[], []];

  const personalStatsById = new Map(personalStats.map(s => [s._id.toString(), s]));

  const personalEntries = tests.map(t => {
    const id = t._id.toString();
    const stats = personalStatsById.get(id);
    return {
      key: itemKey('test', id),
      itemType: 'test',
      itemId: id,
      title: t.title,
      questionCount: t.questionCount,
      createdAt: t.createdAt,
      isPracticeSet: !!t.isPracticeSet,
      attempted: !!stats,
      attemptCount: stats ? stats.attemptCount : 0,
      lastAttemptedAt: stats ? stats.lastAttemptedAt : null,
      latestAttemptId: stats ? stats.latestAttemptId.toString() : null,
    };
  });

  /* ── shared tests (only ones this user has completed) ── */
  const loadShared = !sharedIds || sharedIds.length > 0;
  const sharedAttemptMatch = { user: userOid, status: { $in: COMPLETED } };
  if (sharedIds) sharedAttemptMatch.sharedTest = { $in: toOids(sharedIds) };

  const sharedStats = loadShared
    ? await SharedAttempt.aggregate([
        { $match: sharedAttemptMatch },
        { $sort: { submittedAt: -1, createdAt: -1 } },
        {
          $group: {
            _id: '$sharedTest',
            attemptCount: { $sum: 1 },
            lastAttemptedAt: { $first: '$submittedAt' },
            latestAttemptId: { $first: '$_id' },
          },
        },
      ])
    : [];

  const sharedTests = sharedStats.length > 0
    ? await SharedTest.aggregate([
        { $match: { _id: { $in: sharedStats.map(s => s._id) } } },
        {
          $project: {
            testId: 1,
            title: 1,
            createdAt: 1,
            expiresAt: 1,
            questionCount: { $size: { $ifNull: ['$questions', []] } },
          },
        },
      ])
    : [];

  const sharedStatsById = new Map(sharedStats.map(s => [s._id.toString(), s]));
  const now = Date.now();

  const sharedEntries = sharedTests.map(t => {
    const id = t._id.toString();
    const stats = sharedStatsById.get(id);
    return {
      key: itemKey('sharedTest', id),
      itemType: 'sharedTest',
      itemId: id,
      sharedTestCode: t.testId, // the ST-XXXX-YYYY code used by the take route
      title: t.title,
      questionCount: t.questionCount,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      status: now < new Date(t.expiresAt).getTime() ? 'active' : 'expired',
      attempted: true,
      attemptCount: stats.attemptCount,
      lastAttemptedAt: stats.lastAttemptedAt,
      latestAttemptId: stats.latestAttemptId.toString(),
    };
  });

  return [...personalEntries, ...sharedEntries].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/** Map<key, number of this user's folders containing it> + the Set of keys. */
async function loadMemberships(userId) {
  const rows = await FolderItem.find({ user: userId })
    .select('itemType itemId')
    .lean();
  const counts = new Map();
  for (const row of rows) {
    const key = itemKey(row.itemType, row.itemId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * listLibrary — backs the "All Tests" and "Unorganized" sections.
 *   view 'all'          → every entry (attempted or not; each carries `attempted`)
 *   view 'unorganized'  → attempted entries that are in no folder
 * Each entry also carries `folderCount` (how many folders contain it).
 */
async function listLibrary(userId, view) {
  const [entries, counts] = await Promise.all([
    loadLibraryEntries(userId),
    loadMemberships(userId),
  ]);

  const annotated = entries.map(e => ({ ...e, folderCount: counts.get(e.key) || 0 }));
  if (view === 'unorganized') {
    return filterUnorganized(annotated, new Set(counts.keys()));
  }
  return annotated;
}

/* ─── folders: create / list / rename / view ──────────────────────────────── */

async function listFolders(userId) {
  const [folders, counts] = await Promise.all([
    Folder.find({ user: userId }).sort({ name: 1 }).collation({ locale: 'en', strength: 2 }).lean(),
    FolderItem.aggregate([
      { $match: { user: toOid(userId) } },
      { $group: { _id: '$folder', count: { $sum: 1 } } },
    ]),
  ]);
  const countById = new Map(counts.map(c => [c._id.toString(), c.count]));
  return folders.map(f => toPublicFolder(f, countById.get(f._id.toString()) || 0));
}

async function createFolder(userId, rawName) {
  const name = validateFolderName(rawName);

  const existingCount = await Folder.countDocuments({ user: userId });
  if (existingCount >= MAX_FOLDERS_PER_USER) {
    throw new AppError(400, `You can have at most ${MAX_FOLDERS_PER_USER} folders.`);
  }

  try {
    const folder = await Folder.create({ user: userId, name });
    return toPublicFolder(folder, 0);
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError(409, `You already have a folder named "${name}".`);
    }
    throw err;
  }
}

async function renameFolder(userId, folderId, rawName) {
  const name = validateFolderName(rawName);
  const folder = await getOwnedFolder(userId, folderId);

  if (folder.name !== name) {
    folder.name = name;
    try {
      await folder.save();
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new AppError(409, `You already have a folder named "${name}".`);
      }
      throw err;
    }
  }

  const itemCount = await FolderItem.countDocuments({ folder: folder._id });
  return toPublicFolder(folder, itemCount);
}

/**
 * getFolder — the folder plus its tests.
 * Items are resolved with a TARGETED query (only the referenced tests are
 * loaded). A reference whose original test can no longer be found is skipped,
 * and `itemCount` reflects what is actually shown.
 */
async function getFolder(userId, folderId) {
  const folder = await getOwnedFolder(userId, folderId);

  const rows = await FolderItem.find({ folder: folder._id }).select('itemType itemId createdAt').lean();
  const { testIds, sharedIds } = splitRefs(
    rows.map(r => ({ itemType: r.itemType, itemId: r.itemId.toString() }))
  );

  const entries = await loadLibraryEntries(userId, { testIds, sharedIds });
  const addedAtByKey = new Map(rows.map(r => [itemKey(r.itemType, r.itemId), r.createdAt]));
  const membershipCounts = await loadMemberships(userId);

  const items = entries
    .filter(e => addedAtByKey.has(e.key))
    .map(e => ({
      ...e,
      addedAt: addedAtByKey.get(e.key),
      folderCount: membershipCounts.get(e.key) || 0,
    }));

  return { folder: toPublicFolder(folder, items.length), items };
}

/* ─── folder contents: add / remove / move ────────────────────────────────── */

/**
 * addItems
 * For each requested item: it must exist, belong to / be accessible to the
 * user, and have ≥ 1 COMPLETED attempt by the user (verified from the DB).
 * Anything that fails is reported in `rejected` with a reason; the rest are
 * added. Adding an item that is already in the folder is a harmless no-op
 * (`alreadyPresent`), enforced by an upsert plus the unique index.
 */
async function addItems(userId, folderId, rawItems) {
  const folder = await getOwnedFolder(userId, folderId);
  const refs = validateItemRefs(rawItems);

  const { testIds, sharedIds } = splitRefs(refs);
  const entries = await loadLibraryEntries(userId, { testIds, sharedIds });
  const entryByKey = new Map(entries.map(e => [e.key, e]));

  const rejected = [];
  const eligible = [];

  for (const ref of refs) {
    const entry = entryByKey.get(itemKey(ref.itemType, ref.itemId));
    if (!entry) {
      // Deliberately one message for "doesn't exist" and "not yours / not attempted
      // by you" — never reveal whether someone else's test exists.
      rejected.push({ ...ref, reason: 'not_found', message: 'This test was not found or is not available to you.' });
    } else if (!entry.attempted) {
      rejected.push({ ...ref, reason: 'not_attempted', message: `"${entry.title}" has not been attempted yet.` });
    } else {
      eligible.push(ref);
    }
  }

  let added = 0;
  if (eligible.length > 0) {
    try {
      const result = await FolderItem.bulkWrite(
        eligible.map(ref => ({
          updateOne: {
            filter: { folder: folder._id, itemType: ref.itemType, itemId: toOid(ref.itemId) },
            update: { $setOnInsert: { user: toOid(userId) } },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      added = result.upsertedCount;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new AppError(409, 'Some tests were being added at the same time. Please refresh and try again.');
      }
      throw err;
    }
  }

  return {
    added,
    alreadyPresent: eligible.length - added,
    rejected,
  };
}

/**
 * removeItems — deletes ONLY the FolderItem links. The original tests,
 * their questions, attempts and results, and the test's links to OTHER
 * folders are untouched. A test left with no folders automatically shows
 * up in Unorganized again, because that view is computed.
 */
async function removeItems(userId, folderId, rawItems) {
  const folder = await getOwnedFolder(userId, folderId);
  const refs = validateItemRefs(rawItems);

  const result = await FolderItem.deleteMany({
    folder: folder._id,
    $or: refs.map(r => ({ itemType: r.itemType, itemId: toOid(r.itemId) })),
  });

  return { removed: result.deletedCount };
}

/**
 * moveItems — "add to B, remove from A" as ONE atomic operation.
 * Different from "add": the source link is removed. Links to any other
 * folders are preserved. Runs in a transaction so a failure part-way cannot
 * leave an item in neither folder (or only half-moved).
 */
async function moveItems(userId, fromFolderId, { toFolderId, items: rawItems }) {
  const refs = validateItemRefs(rawItems);

  if (!isValidObjectIdString(toFolderId)) {
    throw new AppError(400, 'Choose a valid destination folder.');
  }
  if (String(fromFolderId).toLowerCase() === String(toFolderId).toLowerCase()) {
    throw new AppError(400, 'Choose a different destination folder.');
  }

  const session = await mongoose.startSession();
  try {
    let summary;
    await session.withTransaction(async () => {
      summary = { moved: 0, alreadyInDestination: 0, rejected: [] };

      const from = await getOwnedFolder(userId, fromFolderId, session);
      const to = await getOwnedFolder(userId, toFolderId, session);

      const inSource = await FolderItem.find({
        folder: from._id,
        $or: refs.map(r => ({ itemType: r.itemType, itemId: toOid(r.itemId) })),
      }).select('itemType itemId').session(session).lean();
      const inSourceKeys = new Set(inSource.map(r => itemKey(r.itemType, r.itemId)));

      const movable = [];
      for (const ref of refs) {
        if (inSourceKeys.has(itemKey(ref.itemType, ref.itemId))) {
          movable.push(ref);
        } else {
          summary.rejected.push({ ...ref, reason: 'not_in_folder', message: 'This test is not in the source folder.' });
        }
      }

      if (movable.length > 0) {
        const result = await FolderItem.bulkWrite(
          movable.map(ref => ({
            updateOne: {
              filter: { folder: to._id, itemType: ref.itemType, itemId: toOid(ref.itemId) },
              update: { $setOnInsert: { user: toOid(userId) } },
              upsert: true,
            },
          })),
          { ordered: false, session }
        );

        await FolderItem.deleteMany({
          folder: from._id,
          $or: movable.map(r => ({ itemType: r.itemType, itemId: toOid(r.itemId) })),
        }).session(session);

        summary.moved = result.upsertedCount;
        summary.alreadyInDestination = movable.length - result.upsertedCount;
      }
    });
    return summary;
  } finally {
    session.endSession();
  }
}

/* ─── deleting a folder ───────────────────────────────────────────────────── */

/**
 * getDeletionPreview — read-only. Tells the confirmation dialog exactly what
 * "Delete folder and its tests" WOULD do, so the user decides with the facts:
 *   • deletableTests    : personal tests that would be permanently deleted
 *   • attemptsAffected  : how many of your attempts go with them
 *   • alsoInOtherFolders: how many of those tests also sit in other folders
 *                         (they would disappear from there too)
 *   • sharedCount       : shared tests — these only ever lose the folder link
 *   • missingCount      : references whose original test no longer exists
 */
async function getDeletionPreview(userId, folderId) {
  const folder = await getOwnedFolder(userId, folderId);

  const rows = await FolderItem.find({ folder: folder._id }).select('itemType itemId').lean();
  const personalIds = rows.filter(r => r.itemType === 'test').map(r => r.itemId);
  const sharedCount = rows.filter(r => r.itemType === 'sharedTest').length;

  // `user: userId` here is the authorization rule for hard deletion:
  // only tests YOU own can ever be listed as deletable.
  const deletable = personalIds.length > 0
    ? await Test.find({ _id: { $in: personalIds }, user: userId }).select('title').lean()
    : [];
  const deletableIds = deletable.map(t => t._id);

  const [attemptsAffected, otherFolderTestIds] = deletableIds.length > 0
    ? await Promise.all([
        Attempt.countDocuments({ test: { $in: deletableIds } }),
        FolderItem.distinct('itemId', {
          user: userId,
          itemType: 'test',
          itemId: { $in: deletableIds },
          folder: { $ne: folder._id },
        }),
      ])
    : [0, []];

  return {
    folder: { id: folder._id.toString(), name: folder.name },
    totalItems: rows.length,
    deletableTests: deletable.map(t => ({ id: t._id.toString(), title: t.title })),
    attemptsAffected,
    alsoInOtherFolders: otherFolderTestIds.length,
    sharedCount,
    missingCount: rows.length - deletable.length - sharedCount,
  };
}

/**
 * deleteFolder
 *   mode 'folder_only'      : delete the Folder and its FolderItems. Nothing
 *                             else is touched.
 *   mode 'folder_and_tests' : additionally hard-delete the PERSONAL tests in
 *                             the folder that the user owns, via
 *                             testService.deleteTestCascade (questions,
 *                             attempts, links in every folder, the test).
 *                             Shared tests are never deleted — they only lose
 *                             the link.
 *
 * `confirmation` must equal "DELETE". The server can't see what the user
 * typed, so this is an intent guard against accidental or scripted calls —
 * NOT the security boundary. The real protections are authentication,
 * ownership of the folder, and the `user: userId` filter on Test below.
 *
 * Everything runs in one transaction: either all of it happens or none of it.
 */
async function deleteFolder(userId, folderId, { mode, confirmation }) {
  if (!DELETE_MODES.includes(mode)) {
    throw new AppError(400, `mode must be one of: ${DELETE_MODES.join(', ')}.`);
  }
  if (!isDeleteConfirmation(confirmation)) {
    throw new AppError(400, 'Deletion was not confirmed.');
  }

  const session = await mongoose.startSession();
  try {
    let summary;
    await session.withTransaction(async () => {
      summary = { mode, deletedTests: 0, unlinkedItems: 0 };

      const folder = await getOwnedFolder(userId, folderId, session);

      if (mode === 'folder_and_tests') {
        const rows = await FolderItem.find({ folder: folder._id }).select('itemType itemId').session(session).lean();
        const personalIds = rows.filter(r => r.itemType === 'test').map(r => r.itemId);

        if (personalIds.length > 0) {
          const ownedTests = await Test.find({ _id: { $in: personalIds }, user: userId }).session(session);
          for (const test of ownedTests) {
            await testService.deleteTestCascade(test, session);
          }
          summary.deletedTests = ownedTests.length;
        }
      }

      const unlinked = await FolderItem.deleteMany({ folder: folder._id }).session(session);
      summary.unlinkedItems = unlinked.deletedCount;
      await Folder.deleteOne({ _id: folder._id }).session(session);
    });
    return summary;
  } finally {
    session.endSession();
  }
}

module.exports = {
  listLibrary,
  listFolders,
  createFolder,
  renameFolder,
  getFolder,
  addItems,
  removeItems,
  moveItems,
  getDeletionPreview,
  deleteFolder,
};
