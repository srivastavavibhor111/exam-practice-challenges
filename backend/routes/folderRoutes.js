const express = require('express');
const router = express.Router();

const folderController = require('../controllers/folderController');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validateBody } = require('../middleware/validation');
const { isValidObjectIdString } = require('../utils/folderValidation');
const { DELETE_MODES } = require('../utils/folderValidation');

/**
 * folderRoutes.js — NEW, mounted at /api/folders
 * `protect` is applied at the mount point in routes/index.js, same as every
 * other resource router — not repeated here.
 *
 * Route order matters: the literal paths ('/library/...') are registered
 * BEFORE the '/:id' routes, otherwise Express would treat "library" as an id.
 *
 * Two small guards run first:
 *   1. Express 5 leaves req.body undefined when a request has no JSON body;
 *      validateBody reads req.body[field], so default it to {} to get a clean
 *      400 ("name is required") instead of a crash.
 *   2. router.param('id') rejects a malformed folder id up front.
 */

router.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

router.param('id', (req, res, next, value) => {
  if (!isValidObjectIdString(value)) {
    return next(new AppError(400, 'Invalid folder ID.'));
  }
  next();
});

const itemsRule = { required: true, type: 'array', minLength: 1 };

// Folders
router.get('/', asyncHandler(folderController.listFolders));
router.post(
  '/',
  validateBody({ name: { required: true, type: 'string' } }),
  asyncHandler(folderController.createFolder)
);

// The two library views (All Tests / Unorganized) — literal paths first
router.get('/library/all', asyncHandler(folderController.listLibraryAll));
router.get('/library/unorganized', asyncHandler(folderController.listLibraryUnorganized));

// One folder
router.get('/:id', asyncHandler(folderController.getFolder));
router.put(
  '/:id',
  validateBody({ name: { required: true, type: 'string' } }),
  asyncHandler(folderController.renameFolder)
);
router.get('/:id/deletion-preview', asyncHandler(folderController.getDeletionPreview));

// Folder contents. Remove uses POST (not DELETE-with-body) because some
// proxies strip request bodies from DELETE requests.
router.post('/:id/items', validateBody({ items: itemsRule }), asyncHandler(folderController.addItems));
router.post('/:id/items/remove', validateBody({ items: itemsRule }), asyncHandler(folderController.removeItems));
router.post(
  '/:id/items/move',
  validateBody({
    toFolderId: { required: true, type: 'string', objectId: true },
    items: itemsRule,
  }),
  asyncHandler(folderController.moveItems)
);

// Delete the folder (two modes). The mode and the DELETE confirmation are
// re-validated in the service; this is just the first, cheap shape check.
router.delete(
  '/:id',
  validateBody({
    mode: { required: true, type: 'string', enum: DELETE_MODES },
    confirmation: { required: true, type: 'string' },
  }),
  asyncHandler(folderController.deleteFolder)
);

module.exports = router;
