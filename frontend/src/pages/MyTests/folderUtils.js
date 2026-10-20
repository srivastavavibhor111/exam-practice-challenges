/**
 * folderUtils.js — NEW (Custom Test Folders, My Tests page)
 * Small pure helpers shared by the folder components. No React, no network —
 * which keeps them easy to read and easy to test.
 */

export const DELETE_CONFIRM_PHRASE = 'DELETE';

export function pluralize(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The { itemType, itemId } pair the API expects, from a library item. */
export function toRef(item) {
  return { itemType: item.itemType, itemId: item.itemId };
}

/**
 * The delete-confirmation rule: EXACT match, nothing normalized.
 * "delete", "Delete", " DELETE", "DELETE " and "DEL ETE" are all rejected.
 */
export function isExactDeletePhrase(value) {
  return value === DELETE_CONFIRM_PHRASE;
}

/** Turns an add-items API result into a { type, text } notice. */
export function describeAddResult({ added, alreadyPresent, rejected }, folderName) {
  const parts = [];
  if (added > 0) {
    parts.push(`Added ${pluralize(added, 'test')} to “${folderName}”.`);
  }
  if (alreadyPresent > 0) {
    parts.push(`${pluralize(alreadyPresent, 'test')} ${alreadyPresent === 1 ? 'was' : 'were'} already in the folder.`);
  }
  if (rejected.length > 0) {
    const reasons = rejected.slice(0, 2).map(r => r.message).join(' ');
    parts.push(`${pluralize(rejected.length, 'test')} could not be added. ${reasons}${rejected.length > 2 ? ' …' : ''}`);
  }

  const somethingWorked = added > 0 || alreadyPresent > 0;
  let type = 'success';
  if (rejected.length > 0) type = somethingWorked ? 'warning' : 'error';
  return { type, text: parts.join(' ') };
}

/** Turns a move-items API result into a { type, text } notice. */
export function describeMoveResult({ moved, alreadyInDestination, rejected }, destinationName) {
  const parts = [];
  const done = moved + alreadyInDestination;
  if (done > 0) parts.push(`Moved ${pluralize(done, 'test')} to “${destinationName}”.`);
  if (rejected.length > 0) {
    parts.push(`${pluralize(rejected.length, 'test')} could not be moved. ${rejected[0].message}`);
  }
  const type = rejected.length > 0 ? (done > 0 ? 'warning' : 'error') : 'success';
  return { type, text: parts.join(' ') };
}

/** Turns a delete-folder API result into a success notice text. */
export function describeDeleteResult({ mode, deletedTests, unlinkedItems }, folderName) {
  if (mode === 'folder_and_tests') {
    let text = `Folder “${folderName}” deleted along with ${pluralize(deletedTests, 'test')}.`;
    if (unlinkedItems > 0) {
      text += ` ${pluralize(unlinkedItems, 'other test')} ${unlinkedItems === 1 ? 'was' : 'were'} only removed from the folder and kept.`;
    }
    return text;
  }
  return `Folder “${folderName}” deleted. Your tests were kept.`;
}
