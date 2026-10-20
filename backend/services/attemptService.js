const { Attempt, Test } = require('../models');
const AppError = require('../utils/AppError');
const assertOwnership = require('../utils/assertOwnership');
const scoringService = require('./scoringService');

/**
 * attemptService.js — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * submitAttempt() now passes test.scoring to calculateResult(). This is
 * the ONLY change in this file. Notice what does NOT change: the client
 * never sends scoring rules at submit time, and never could — the
 * backend always reads them fresh from ITS OWN freshly-fetched Test
 * document, the same one already being used to grade the answers. A test
 * cannot be scored under rules the client made up; it's always scored
 * under whatever rules were actually stored on the Test at creation time.
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function startAttempt({ userId, testId, durationSeconds }) {
  const test = await Test.findById(testId);
  assertOwnership(test, userId, 'Test');

  if (!durationSeconds || durationSeconds <= 0) {
    throw new AppError(400, 'durationSeconds must be a positive number');
  }

  return Attempt.create({
    user: userId,
    test: testId,
    durationSeconds,
    status: 'in_progress',
    startedAt: new Date(),
  });
}

async function submitAttempt(attemptId, userId, { answers, markedForReview, timeSpentSeconds, autoSubmitted }) {
  const attempt = await Attempt.findById(attemptId);
  assertOwnership(attempt, userId, 'Attempt');

  if (attempt.status !== 'in_progress') {
    throw new AppError(400, 'This attempt has already been submitted');
  }

  const test = await Test.findById(attempt.test).populate('questions');
  if (!test) {
    throw new AppError(404, 'The test for this attempt no longer exists');
  }

  const results = scoringService.calculateResult(
    test.questions,
    answers || {},
    timeSpentSeconds || 0,
    test.scoring // NEW — the test's own stored scoring rules, read fresh right here
  );

  attempt.answers = answers || {};
  attempt.markedForReview = markedForReview || [];
  attempt.timeSpentSeconds = timeSpentSeconds || 0;
  attempt.status = autoSubmitted ? 'auto_submitted' : 'submitted';
  attempt.submittedAt = new Date();
  attempt.results = results;

  await attempt.save();
  return attempt;
}

async function getAttemptById(id, userId) {
  const attempt = await Attempt.findById(id).populate({
    path: 'test',
    populate: { path: 'questions' },
  });
  assertOwnership(attempt, userId, 'Attempt');
  return attempt;
}

async function listAttemptsForTest(testId, userId) {
  return Attempt.find({ test: testId, user: userId })
    .populate('test', 'title')
    .sort({ createdAt: -1 });
}

async function listAttemptsForUser(userId) {
  return Attempt.find({ user: userId })
    .populate('test', 'title')
    .sort({ createdAt: -1 });
}

async function getLatestAttemptPerTest(userId) {
  const attempts = await Attempt.find({
    user: userId,
    status: { $in: ['submitted', 'auto_submitted'] },
  })
    .populate({ path: 'test', populate: { path: 'questions' } })
    .sort({ submittedAt: -1 });

  const latestByTest = new Map();
  for (const attempt of attempts) {
    if (!attempt.test) continue;
    const testId = attempt.test._id.toString();
    if (!latestByTest.has(testId)) {
      latestByTest.set(testId, attempt);
    }
  }
  return [...latestByTest.values()];
}

async function getMistakes(userId) {
  const latestAttempts = await getLatestAttemptPerTest(userId);
  const mistakes = [];

  for (const attempt of latestAttempts) {
    const answersMap = attempt.answers;
    for (const question of attempt.test.questions) {
      const userAnswer = answersMap.get(question._id.toString());
      const isIncorrect = question.correctAnswer && userAnswer && userAnswer !== question.correctAnswer;

      if (isIncorrect) {
        mistakes.push({
          ...question.toObject(),
          testId: attempt.test._id,
          testTitle: attempt.test.title,
          lastAttemptedAt: attempt.submittedAt,
          yourAnswer: userAnswer,
        });
      }
    }
  }

  return mistakes;
}

async function getTopicPerformance(userId) {
  const latestAttempts = await getLatestAttemptPerTest(userId);
  const byTopic = new Map();

  for (const attempt of latestAttempts) {
    const answersMap = attempt.answers;
    for (const question of attempt.test.questions) {
      const topic = (question.topic || '').trim();
      if (!topic) continue;

      const userAnswer = answersMap.get(question._id.toString());
      if (!question.correctAnswer || !userAnswer) continue;

      const entry = byTopic.get(topic) || { correct: 0, total: 0 };
      entry.total += 1;
      if (userAnswer === question.correctAnswer) entry.correct += 1;
      byTopic.set(topic, entry);
    }
  }

  const results = [...byTopic.entries()].map(([topic, { correct, total }]) => ({
    topic,
    correct,
    totalQuestions: total,
    accuracy: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
  }));

  results.sort((a, b) => a.accuracy - b.accuracy);
  return results;
}

async function getProgressAnalytics(userId, { groupBy = 'week', startDate, endDate }) {
  const dateGrouping = require('../utils/dateGrouping');
  const completedFilter = { user: userId, status: { $in: ['submitted', 'auto_submitted'] } };

  const allCompleted = await Attempt.find(completedFilter)
    .select('submittedAt')
    .sort({ submittedAt: 1 });

  const availableRange = allCompleted.length > 0
    ? { earliest: allCompleted[0].submittedAt, latest: allCompleted[allCompleted.length - 1].submittedAt }
    : { earliest: null, latest: null };

  const query = { ...completedFilter };
  if (startDate || endDate) {
    query.submittedAt = {};
    if (startDate) query.submittedAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      query.submittedAt.$lte = end;
    }
  }

  const attempts = await Attempt.find(query)
    .populate('test', 'title')
    .sort({ submittedAt: 1 });

  const tests = attempts.map(a => ({
    testId: a.test?._id ? a.test._id.toString() : null,
    testName: a.test?.title || 'Untitled Test',
    completedAt: a.submittedAt,
    performancePercentage: a.results?.percentage ?? 0,
    score: a.results?.correct ?? 0,
    maximumScore: a.results?.gradedCount ?? 0,
  }));

  const buckets = new Map();
  for (const attempt of attempts) {
    const key = dateGrouping.groupKeyFor(attempt.submittedAt, groupBy);
    if (!buckets.has(key)) {
      buckets.set(key, { sumPct: 0, count: 0, sortDate: attempt.submittedAt });
    }
    const bucket = buckets.get(key);
    bucket.sumPct += attempt.results?.percentage ?? 0;
    bucket.count += 1;
  }

  const chartData = [...buckets.values()]
    .sort((a, b) => new Date(a.sortDate) - new Date(b.sortDate))
    .map(bucket => {
      let label, rangeStart, rangeEnd;
      if (groupBy === 'day') {
        rangeStart = rangeEnd = dateGrouping.toDateOnlyUTC(bucket.sortDate);
        label = dateGrouping.formatDayLabel(bucket.sortDate);
      } else if (groupBy === 'week') {
        rangeStart = dateGrouping.startOfWeekUTC(bucket.sortDate);
        rangeEnd = dateGrouping.endOfWeekUTC(bucket.sortDate);
        label = dateGrouping.formatWeekLabel(rangeStart);
      } else {
        rangeStart = dateGrouping.startOfMonthUTC(bucket.sortDate);
        rangeEnd = dateGrouping.endOfMonthUTC(bucket.sortDate);
        label = dateGrouping.formatMonthLabel(rangeStart);
      }
      return {
        label,
        startDate: dateGrouping.toIsoDateString(rangeStart),
        endDate: dateGrouping.toIsoDateString(rangeEnd),
        averagePerformance: Math.round((bucket.sumPct / bucket.count) * 10) / 10,
        testsTaken: bucket.count,
      };
    });

  const testsTaken = attempts.length;
  const percentages = attempts.map(a => a.results?.percentage ?? 0);
  const avg = (arr) => (arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length);
  const averagePerformance = testsTaken > 0 ? Math.round(avg(percentages) * 10) / 10 : 0;
  const bestPerformance = testsTaken > 0 ? Math.round(Math.max(...percentages) * 10) / 10 : 0;

  let performanceTrend = { value: 0, direction: 'neutral' };
  if (testsTaken >= 2) {
    const midpoint = Math.floor(testsTaken / 2) || 1;
    const firstHalfAvg = avg(percentages.slice(0, midpoint));
    const secondHalfAvg = avg(percentages.slice(midpoint));
    const change = secondHalfAvg - firstHalfAvg;
    performanceTrend = {
      value: Math.round(Math.abs(change) * 10) / 10,
      direction: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'neutral',
    };
  }

  return {
    summary: { testsTaken, averagePerformance, bestPerformance, performanceTrend },
    chartData,
    tests,
    availableRange,
  };
}

module.exports = {
  startAttempt,
  submitAttempt,
  getAttemptById,
  listAttemptsForTest,
  listAttemptsForUser,
  getMistakes,
  getTopicPerformance,
  getProgressAnalytics,
};
