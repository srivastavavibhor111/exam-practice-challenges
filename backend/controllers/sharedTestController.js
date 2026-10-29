const sharedTestService = require('../services/sharedTestService');

async function createSharedTest(req, res) {
  const { title, questions, scoring, durationSeconds } = req.body;
  const sharedTest = await sharedTestService.createSharedTest({
    creatorId: req.user.id, title, questions, scoring, durationSeconds,
  });
  res.status(201).json({ sharedTest });
}

async function lookupSharedTest(req, res) {
  const sharedTest = await sharedTestService.lookupSharedTestForJoin(req.params.testId, req.user.id);
  res.json({ sharedTest });
}

async function getSharedTestForTaking(req, res) {
  const sharedTest = await sharedTestService.getSharedTestForTaking(req.params.testId, req.user.id);
  res.json({ sharedTest });
}

async function listMine(req, res) {
  const sharedTests = await sharedTestService.listSharedTestsCreatedByUser(req.user.id);
  res.json({ sharedTests });
}

async function getDetails(req, res) {
  const details = await sharedTestService.getSharedTestDetails(req.params.testId, req.user.id);
  res.json(details);
}

async function removeFromMyAccount(req, res) {
  const result = await sharedTestService.removeSharedTestFromMyAccount(req.params.testId, req.user.id);
  res.json(result);
}

async function listJoined(req, res) {
  const sharedTests = await sharedTestService.listJoinedSharedTests(req.user.id);
  res.json({ sharedTests });
}

async function listMyBookmarks(req, res) {
  const questions = await sharedTestService.getBookmarkedSharedQuestions(req.user.id);
  res.json({ questions });
}

async function listMyMistakes(req, res) {
  const mistakes = await sharedTestService.getSharedMistakes(req.user.id);
  res.json({ mistakes });
}

async function toggleBookmark(req, res) {
  const { sharedTestObjectId, questionId } = req.params;
  const { bookmarked } = req.body;
  await sharedTestService.toggleSharedBookmark({
    userId: req.user.id, sharedTestObjectId, questionId, bookmarked,
  });
  res.json({ message: 'Bookmark updated.' });
}

module.exports = {
  createSharedTest,
  lookupSharedTest,
  getSharedTestForTaking,
  listMine,
  listJoined,
  removeFromMyAccount,
  getDetails,
  listMyBookmarks,
  listMyMistakes,
  toggleBookmark,
};
