const folderService = require('../services/folderService');

/**
 * folderController.js — NEW
 * Thin HTTP layer: pull values off the request, call folderService, shape the
 * response. No business logic here (same rule as every other controller).
 * `req.user.id` is set by the `protect` middleware from the verified session —
 * it is never taken from the request body.
 */

async function listFolders(req, res) {
  const folders = await folderService.listFolders(req.user.id);
  res.json({ folders });
}

async function createFolder(req, res) {
  const folder = await folderService.createFolder(req.user.id, req.body.name);
  res.status(201).json({ folder });
}

async function listLibraryAll(req, res) {
  const items = await folderService.listLibrary(req.user.id, 'all');
  res.json({ items });
}

async function listLibraryUnorganized(req, res) {
  const items = await folderService.listLibrary(req.user.id, 'unorganized');
  res.json({ items });
}

async function getFolder(req, res) {
  const result = await folderService.getFolder(req.user.id, req.params.id);
  res.json(result); // { folder, items }
}

async function renameFolder(req, res) {
  const folder = await folderService.renameFolder(req.user.id, req.params.id, req.body.name);
  res.json({ folder });
}

async function getDeletionPreview(req, res) {
  const preview = await folderService.getDeletionPreview(req.user.id, req.params.id);
  res.json({ preview });
}

async function addItems(req, res) {
  const result = await folderService.addItems(req.user.id, req.params.id, req.body.items);
  res.json(result); // { added, alreadyPresent, rejected }
}

async function removeItems(req, res) {
  const result = await folderService.removeItems(req.user.id, req.params.id, req.body.items);
  res.json(result); // { removed }
}

async function moveItems(req, res) {
  const { toFolderId, items } = req.body;
  const result = await folderService.moveItems(req.user.id, req.params.id, { toFolderId, items });
  res.json(result); // { moved, alreadyInDestination, rejected }
}

async function deleteFolder(req, res) {
  const { mode, confirmation } = req.body;
  const result = await folderService.deleteFolder(req.user.id, req.params.id, { mode, confirmation });
  res.json(result); // { mode, deletedTests, unlinkedItems }
}

module.exports = {
  listFolders,
  createFolder,
  listLibraryAll,
  listLibraryUnorganized,
  getFolder,
  renameFolder,
  getDeletionPreview,
  addItems,
  removeItems,
  moveItems,
  deleteFolder,
};
