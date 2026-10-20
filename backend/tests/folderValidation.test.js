const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FOLDER_NAME_MAX_LENGTH,
  MAX_ITEMS_PER_REQUEST,
  validateFolderName,
  validateItemRefs,
  isDeleteConfirmation,
  itemKey,
  filterUnorganized,
} = require('../utils/folderValidation');

const ID_A = 'a'.repeat(24);
const ID_B = 'b'.repeat(24);
const ID_C = '0123456789abcdef01234567';

/* ── validateFolderName ── */

test('folder name: trims leading and trailing whitespace', () => {
  assert.equal(validateFolderName('  Python Revision  '), 'Python Revision');
});

test('folder name: case is preserved (names are case-sensitive)', () => {
  assert.equal(validateFolderName('Python'), 'Python');
  assert.equal(validateFolderName('python'), 'python');
  assert.notEqual(validateFolderName('Python'), validateFolderName('python'));
});

test('folder name: empty and whitespace-only names are rejected', () => {
  assert.throws(() => validateFolderName(''), { statusCode: 400 });
  assert.throws(() => validateFolderName('    '), { statusCode: 400 });
});

test('folder name: non-strings are rejected', () => {
  for (const bad of [undefined, null, 42, {}, [], true]) {
    assert.throws(() => validateFolderName(bad), { statusCode: 400 });
  }
});

test('folder name: length limit is enforced after trimming', () => {
  assert.equal(validateFolderName('x'.repeat(FOLDER_NAME_MAX_LENGTH)).length, FOLDER_NAME_MAX_LENGTH);
  assert.throws(() => validateFolderName('x'.repeat(FOLDER_NAME_MAX_LENGTH + 1)), { statusCode: 400 });
  // 50 characters plus surrounding spaces is still fine — spaces are trimmed first
  assert.doesNotThrow(() => validateFolderName(` ${'x'.repeat(FOLDER_NAME_MAX_LENGTH)} `));
});

test('folder name: control characters are rejected', () => {
  assert.throws(() => validateFolderName('Line\nBreak'), { statusCode: 400 });
  assert.throws(() => validateFolderName('Tab\tName'), { statusCode: 400 });
  assert.throws(() => validateFolderName('Nul\u0000Name'), { statusCode: 400 });
});

test('folder name: ordinary punctuation and unicode are allowed', () => {
  assert.equal(validateFolderName('DSA – Unit 1 (2026)'), 'DSA – Unit 1 (2026)');
  assert.equal(validateFolderName('गणित'), 'गणित');
});

/* ── validateItemRefs ── */

test('item refs: valid items are normalized', () => {
  const refs = validateItemRefs([
    { itemType: 'test', itemId: ID_A },
    { itemType: 'sharedTest', itemId: ID_C.toUpperCase() },
  ]);
  assert.deepEqual(refs, [
    { itemType: 'test', itemId: ID_A },
    { itemType: 'sharedTest', itemId: ID_C },
  ]);
});

test('item refs: the same item listed twice in one request is de-duplicated', () => {
  const refs = validateItemRefs([
    { itemType: 'test', itemId: ID_A },
    { itemType: 'test', itemId: ID_A },
  ]);
  assert.equal(refs.length, 1);
});

test('item refs: same id with a different type is NOT a duplicate', () => {
  const refs = validateItemRefs([
    { itemType: 'test', itemId: ID_A },
    { itemType: 'sharedTest', itemId: ID_A },
  ]);
  assert.equal(refs.length, 2);
});

test('item refs: empty, non-array, and oversized lists are rejected', () => {
  assert.throws(() => validateItemRefs([]), { statusCode: 400 });
  assert.throws(() => validateItemRefs('nope'), { statusCode: 400 });
  assert.throws(() => validateItemRefs(undefined), { statusCode: 400 });
  const tooMany = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, i) => ({
    itemType: 'test',
    itemId: i.toString(16).padStart(24, '0'),
  }));
  assert.throws(() => validateItemRefs(tooMany), { statusCode: 400 });
});

test('item refs: exactly the maximum number is accepted', () => {
  const atLimit = Array.from({ length: MAX_ITEMS_PER_REQUEST }, (_, i) => ({
    itemType: 'test',
    itemId: i.toString(16).padStart(24, '0'),
  }));
  assert.equal(validateItemRefs(atLimit).length, MAX_ITEMS_PER_REQUEST);
});

test('item refs: unknown type, bad id, and malformed entries are rejected', () => {
  assert.throws(() => validateItemRefs([{ itemType: 'folder', itemId: ID_A }]), { statusCode: 400 });
  assert.throws(() => validateItemRefs([{ itemType: 'test', itemId: 'not-an-id' }]), { statusCode: 400 });
  assert.throws(() => validateItemRefs([{ itemType: 'test', itemId: 'a'.repeat(12) }]), { statusCode: 400 }); // 12 chars is not a real ObjectId here
  assert.throws(() => validateItemRefs([{ itemType: 'test', itemId: { $ne: null } }]), { statusCode: 400 }); // operator injection attempt
  assert.throws(() => validateItemRefs([null]), { statusCode: 400 });
  assert.throws(() => validateItemRefs(['x']), { statusCode: 400 });
  assert.throws(() => validateItemRefs([[]]), { statusCode: 400 });
});

/* ── isDeleteConfirmation: the exact table from the spec ── */

test('delete confirmation: only the exact uppercase word passes', () => {
  assert.equal(isDeleteConfirmation('DELETE'), true);
  assert.equal(isDeleteConfirmation('delete'), false);
  assert.equal(isDeleteConfirmation('Delete'), false);
  assert.equal(isDeleteConfirmation(' DELETE'), false);
  assert.equal(isDeleteConfirmation('DELETE '), false);
  assert.equal(isDeleteConfirmation('DEL ETE'), false);
  assert.equal(isDeleteConfirmation('DELETE\n'), false);
  assert.equal(isDeleteConfirmation(''), false);
  assert.equal(isDeleteConfirmation(undefined), false);
  assert.equal(isDeleteConfirmation(null), false);
  assert.equal(isDeleteConfirmation(['DELETE']), false);
});

/* ── filterUnorganized: Cases A–F from the spec ── */

function entry(itemType, itemId, attempted = true) {
  return { key: itemKey(itemType, itemId), itemType, itemId, attempted };
}

test('unorganized — Case A: attempted test with no folder appears', () => {
  const entries = [entry('test', ID_A)];
  assert.equal(filterUnorganized(entries, new Set()).length, 1);
});

test('unorganized — Case B: test added to its first folder disappears', () => {
  const entries = [entry('test', ID_A)];
  const organized = new Set([itemKey('test', ID_A)]);
  assert.equal(filterUnorganized(entries, organized).length, 0);
});

test('unorganized — Case C: test in two folders does not appear (membership is by key, not count)', () => {
  const entries = [entry('test', ID_A)];
  // two FolderItem rows for the same test still collapse to one key in the Set
  const organized = new Set([itemKey('test', ID_A), itemKey('test', ID_A)]);
  assert.equal(filterUnorganized(entries, organized).length, 0);
});

test('unorganized — Cases D/E: remaining association keeps it out; losing the last brings it back', () => {
  const entries = [entry('test', ID_A)];
  // D: removed from one of two folders → still has a key
  assert.equal(filterUnorganized(entries, new Set([itemKey('test', ID_A)])).length, 0);
  // E: removed from its last folder → no key left
  assert.equal(filterUnorganized(entries, new Set()).length, 1);
});

test('unorganized — Case F: after a folder is deleted, tests with no remaining folder return', () => {
  const entries = [entry('test', ID_A), entry('test', ID_B), entry('sharedTest', ID_C)];
  // B and the shared test were only in the deleted folder; A is still in another
  const organizedAfterDelete = new Set([itemKey('test', ID_A)]);
  const result = filterUnorganized(entries, organizedAfterDelete).map(e => e.itemId);
  assert.deepEqual(result.sort(), [ID_B, ID_C].sort());
});

test('unorganized: never-attempted tests are excluded even with no folder', () => {
  const entries = [entry('test', ID_A, false), entry('test', ID_B, true)];
  const result = filterUnorganized(entries, new Set());
  assert.deepEqual(result.map(e => e.itemId), [ID_B]);
});

test('unorganized: a personal test and a shared test with the same id do not collide', () => {
  const entries = [entry('test', ID_A), entry('sharedTest', ID_A)];
  const organized = new Set([itemKey('test', ID_A)]);
  const result = filterUnorganized(entries, organized);
  assert.deepEqual(result.map(e => e.itemType), ['sharedTest']);
});
