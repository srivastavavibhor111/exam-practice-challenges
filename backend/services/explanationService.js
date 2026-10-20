const { callAI } = require('./aiClient');
const AppError = require('../utils/AppError');

/**
 * explanationService.js — UPDATED
 * generateExplanation() now accepts and forwards an apiKey param to callAI.
 */

const SYSTEM_PROMPT = `You are a helpful, concise tutor. Given a multiple-choice question, its options, and the correct answer, write a clear explanation of why that answer is correct — 2 to 4 sentences, plain prose, no markdown formatting, no restating the question.`;

function buildPrompt(question) {
  const optionsText = ['A', 'B', 'C', 'D']
    .filter(l => question.options?.[l]?.trim())
    .map(l => `${l}) ${question.options[l]}`)
    .join('\n');

  return `Question: ${question.text}\n\nOptions:\n${optionsText}\n\nCorrect answer: ${question.correctAnswer}\n\nWrite the explanation now.`;
}

async function generateExplanation(question, apiKey) {
  if (!question.correctAnswer) {
    throw new AppError(400, 'Cannot generate an explanation without a correct answer set for this question.');
  }

  const prompt = buildPrompt(question);
  const text = await callAI({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 300,
    jsonMode: false,
    apiKey,
  });

  return text.trim();
}

module.exports = { generateExplanation };
