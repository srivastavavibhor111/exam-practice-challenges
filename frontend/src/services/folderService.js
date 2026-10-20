import { apiRequest } from './api';

/**
 * folderService.js — NEW (Custom Test Folders)
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin wrappers around the /api/folders endpoints, in the same style as
 * dashboardService.js / sharedTestService.js. No business logic lives here —
 * the backend (folderService.js on the server) decides what is allowed; this
 * file only sends requests and unwraps the JSON.
 *
 * Errors: apiRequest() throws an ApiError whose `.message` is the server's
 * own message (e.g. 'You already have a folder named "Python".'), so UI code
 * can show `err.message` directly.
 *
 * An "item" is always identified by { itemType, itemId }:
 *     itemType 'test'       → a personal Test
 *     itemType 'sharedTest' → a SharedTest (itemId is its Mongo id, NOT the
 *                              ST-XXXX-YYYY code)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// The server requires this exact word in the delete request as a guard against
// accidental calls. The user-facing "type DELETE" check happens in the dialog.
const DELETE_CONFIRM_PHRASE = 'DELETE';

export async function getFolders() {
  const { folders } = await apiRequest('/folders');
  return folders;
}

/** Every test shown in My Tests (attempted or not), each with `folderCount`. */
export async function getLibrary() {
  const { items } = await apiRequest('/folders/library/all');
  return items;
}

/** → { folder, items } */
export async function getFolder(folderId) {
  return apiRequest(`/folders/${folderId}`);
}

export async function createFolder(name) {
  const { folder } = await apiRequest('/folders', { method: 'POST', body: { name } });
  return folder;
}

export async function renameFolder(folderId, name) {
  const { folder } = await apiRequest(`/folders/${folderId}`, { method: 'PUT', body: { name } });
  return folder;
}

/** → { added, alreadyPresent, rejected: [{ itemType, itemId, reason, message }] } */
export async function addItems(folderId, items) {
  return apiRequest(`/folders/${folderId}/items`, { method: 'POST', body: { items } });
}

/** → { removed } — removes only the folder link, never the test itself. */
export async function removeItems(folderId, items) {
  return apiRequest(`/folders/${folderId}/items/remove`, { method: 'POST', body: { items } });
}

/** → { moved, alreadyInDestination, rejected } */
export async function moveItems(fromFolderId, toFolderId, items) {
  return apiRequest(`/folders/${fromFolderId}/items/move`, {
    method: 'POST',
    body: { toFolderId, items },
  });
}

/** → { folder, totalItems, deletableTests, attemptsAffected, alsoInOtherFolders, sharedCount, missingCount } */
export async function getDeletionPreview(folderId) {
  const { preview } = await apiRequest(`/folders/${folderId}/deletion-preview`);
  return preview;
}

/**
 * @param {'folder_only'|'folder_and_tests'} mode
 * → { mode, deletedTests, unlinkedItems }
 */
export async function deleteFolder(folderId, mode) {
  return apiRequest(`/folders/${folderId}`, {
    method: 'DELETE',
    body: { mode, confirmation: DELETE_CONFIRM_PHRASE },
  });
}
