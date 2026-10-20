const sourceService = require('../services/sourceService');

/**
 * sourceController.js — UPDATED FOR M11
 * userId now comes from req.user.id (set by the `protect` middleware),
 * never from the request body or query string. sourceService.js itself is
 * completely unchanged from M8 — it always just took userId as a parameter.
 */

async function createSource(req, res) {
  const { sourceType, sourceReference, rawContent } = req.body;
  const source = await sourceService.createSource({ userId: req.user.id, sourceType, sourceReference, rawContent });
  res.status(201).json({ source });
}

async function getSource(req, res) {
  const source = await sourceService.getSourceById(req.params.id, req.user.id);
  res.json({ source });
}

async function listSources(req, res) {
  const sources = await sourceService.listSourcesForUser(req.user.id);
  res.json({ sources });
}

async function deleteSource(req, res) {
  await sourceService.deleteSource(req.params.id, req.user.id);
  res.status(204).send();
}

module.exports = { createSource, getSource, listSources, deleteSource };
