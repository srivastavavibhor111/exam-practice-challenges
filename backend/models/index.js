/**
 * models/index.js — Barrel Export — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets other files import any model from one place:
 *   const { User, Source, Question, Test, Attempt } = require('../models');
 * instead of five separate require() lines. Purely a convenience — each
 * model is still defined in its own file above.
 *
 * UPDATED: two new exports, Folder and FolderItem (Custom Test Folders).
 * Nothing else in this file changed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {
  User:           require('./User'),
  Source:         require('./Source'),
  Question:       require('./Question'),
  Test:           require('./Test'),
  Attempt:        require('./Attempt'),
  SharedTest:     require('./SharedTest'),
  SharedAttempt:  require('./SharedAttempt'),
  SharedTestBookmark: require('./SharedTestBookmark'),
  Folder:         require('./Folder'),
  FolderItem:     require('./FolderItem'),
};
