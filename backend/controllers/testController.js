const testService = require('../services/testService');

// UPDATED — createTest passes through req.body.scoring.

async function createTest(req, res) {
  const { title, sourceId, questionIds, settings, scoring } = req.body;
  const test = await testService.createTest({ userId: req.user.id, title, sourceId, questionIds, settings, scoring });
  res.status(201).json({ test });
}

async function createPracticeTest(req, res) {
  const { title, questionIds } = req.body;
  const test = await testService.createPracticeTest({ userId: req.user.id, title, questionIds });
  res.status(201).json({ test });
}

async function getTest(req, res) {
  const test = await testService.getTestById(req.params.id, req.user.id);
  res.json({ test });
}

async function getTestForTaking(req, res) {
  const test = await testService.getTestForTaking(req.params.id, req.user.id);
  res.json({ test });
}

async function listTests(req, res) {
  const tests = await testService.listTestsForUser(req.user.id);
  res.json({ tests });
}

async function updateTest(req, res) {
  const { title, settings } = req.body;
  const test = await testService.updateTestSettings(req.params.id, req.user.id, { title, settings });
  res.json({ test });
}

async function deleteTest(req, res) {
  await testService.deleteTest(req.params.id, req.user.id);
  res.status(204).send();
}

module.exports = { createTest, createPracticeTest, getTest, getTestForTaking, listTests, updateTest, deleteTest };
