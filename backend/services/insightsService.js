const { callAI } = require('./aiClient');
const AppError = require('../utils/AppError');
const attemptService = require('./attemptService');
const authService = require('./authService');

/**
 * insightsService.js — UPDATED
 * generateInsights() now resolves the caller's effective Gemini API key
 * before the AI call at the end. Every deterministic calculation above
 * that point (attempt count, average score, trend, topic performance) is
 * completely unchanged — this update only touches which key gets used
 * for the one AI call this function makes.
 */

const MIN_ATTEMPTS_FOR_INSIGHTS = 3;

const SYSTEM_PROMPT = `You are an encouraging, specific study coach. You will be given a student's REAL, already-calculated practice statistics. Write a short performance insight — 2 to 3 sentences, plain prose, no markdown. Use ONLY the numbers given to you; never invent a statistic, topic, or fact that wasn't provided. Be specific (reference the actual numbers and topics given) and encouraging, not generic filler.`;

function buildPrompt(stats) {
  const topicLines = stats.topicPerformance.length > 0
    ? stats.topicPerformance.map(t => `- ${t.topic}: ${t.accuracy}% accuracy (${t.correct}/${t.totalQuestions})`).join('\n')
    : '(no topic-tagged data available yet)';

  return `Total tests completed: ${stats.totalAttempts}
Average score: ${stats.averagePercentage}%
Recent trend: ${stats.trendDirection}

Topic performance (weakest first):
${topicLines}

Write the insight now.`;
}

async function generateInsights(userId) {
  const attempts = await attemptService.listAttemptsForUser(userId);
  const completed = attempts.filter(a => a.status !== 'in_progress' && a.results);

  if (completed.length < MIN_ATTEMPTS_FOR_INSIGHTS) {
    throw new AppError(
      400,
      `Complete at least ${MIN_ATTEMPTS_FOR_INSIGHTS} tests to unlock personalized insights.`
    );
  }

  const percentages = completed.map(a => a.results.percentage);
  const averagePercentage = round1(percentages.reduce((s, p) => s + p, 0) / percentages.length);

  const chronological = [...completed].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const midpoint = Math.floor(chronological.length / 2) || 1;
  const firstHalfAvg  = average(chronological.slice(0, midpoint).map(a => a.results.percentage));
  const secondHalfAvg = average(chronological.slice(midpoint).map(a => a.results.percentage));
  const trendDirection = secondHalfAvg >= firstHalfAvg ? 'improving' : 'declining';

  const topicPerformance = await attemptService.getTopicPerformance(userId);

  const stats = {
    totalAttempts: completed.length,
    averagePercentage,
    trendDirection,
    topicPerformance: topicPerformance.slice(0, 5),
  };

  const apiKey = await authService.getEffectiveGeminiApiKey(userId);
  const prompt = buildPrompt(stats);
  const text = await callAI({
    system: SYSTEM_PROMPT,
    prompt,
    maxTokens: 250,
    jsonMode: false,
    apiKey,
  });

  return { insight: text.trim(), basedOn: stats };
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = { generateInsights };
