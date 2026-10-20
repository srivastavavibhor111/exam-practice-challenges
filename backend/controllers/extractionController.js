const extractionService = require('../services/extractionService');

/**
 * extractionController.js — UPDATED
 * Passes req.user.id through so extractionService can resolve which
 * Gemini API key to use for this request (the caller's own, or the
 * server's fallback).
 */

async function extractText(req, res) {
  const { rawText } = req.body;
  const result = await extractionService.extractFromText(rawText, req.user.id);
  const status = result.success ? 200 : 422;
  res.status(status).json(result);
}

async function extractLink(req, res) {
  const { url } = req.body;
  const result = await extractionService.extractFromLink(url, req.user.id);
  const status = result.success ? 200 : 422;
  res.status(status).json(result);
}

module.exports = { extractText, extractLink };
