/**
 * scoringService.js — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * The single most important file in this app to get exactly right — it's
 * literally what a student's score is. This update is STRICTLY ADDITIVE:
 * every existing field in the returned object (totalQuestions, gradedCount,
 * ungraded, correct, incorrect, unattempted, score, percentage, accuracy,
 * avgTimePerQuestion) keeps its exact original meaning, unchanged. Every
 * existing caller across the app — Result.jsx, Dashboard, Progress
 * analytics, AI Insights, the M17 test suite — continues to work exactly
 * as before, whether or not it ever passes scoring rules at all.
 *
 * NEW: an optional 4th parameter, scoringRules. When omitted (or given
 * partial/invalid data), this defaults to marksPerCorrect: 1,
 * negativeMarksPerIncorrect: 0, negativeMarkingRule: 'negative_only' —
 * i.e. exactly the old implicit behavior (1 mark per correct answer, no
 * penalty). Nothing that doesn't opt into custom scoring rules changes
 * behavior at all.
 *
 * Two negative-marking rules, chosen explicitly per test:
 *   'negative_only'           — deduct only the stated negative value
 *   'full_marks_plus_penalty' — forfeit the full correct-answer marks
 *                                AND additionally deduct the stated value
 *
 * IMPORTANT SEMANTIC NOTE: under 'full_marks_plus_penalty', setting
 * negativeMarksPerIncorrect to 0 does NOT mean "no penalty" — it still
 * forfeits the full marksPerCorrect value for every wrong answer, with
 * zero *additional* penalty on top. Only 'negative_only' with a value of
 * 0 means a genuinely zero deduction. This is why the default rule is
 * 'negative_only' — it's what makes "enter 0 for no negative marking"
 * literally true unless a test explicitly opts into the stricter rule.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_NEGATIVE_MARKING_RULES = ['negative_only', 'full_marks_plus_penalty'];

const DEFAULT_SCORING_RULES = {
  marksPerCorrect: 1,
  negativeMarksPerIncorrect: 0,
  negativeMarkingRule: 'negative_only',
};

/**
 * resolveScoringRules
 * Defensive normalization — never throws, always returns a complete,
 * valid rules object. Anything missing or invalid silently falls back
 * to the corresponding default, rather than propagating bad data into
 * an actual score calculation. (Real input VALIDATION — rejecting a bad
 * request outright — happens earlier, in testService.createTest; this
 * is a last-resort safety net for calculateResult itself.)
 */
function resolveScoringRules(scoring) {
  const marksPerCorrect =
    typeof scoring?.marksPerCorrect === 'number' && scoring.marksPerCorrect > 0
      ? scoring.marksPerCorrect
      : DEFAULT_SCORING_RULES.marksPerCorrect;

  const negativeMarksPerIncorrect =
    typeof scoring?.negativeMarksPerIncorrect === 'number' && scoring.negativeMarksPerIncorrect >= 0
      ? scoring.negativeMarksPerIncorrect
      : DEFAULT_SCORING_RULES.negativeMarksPerIncorrect;

  const negativeMarkingRule = VALID_NEGATIVE_MARKING_RULES.includes(scoring?.negativeMarkingRule)
    ? scoring.negativeMarkingRule
    : DEFAULT_SCORING_RULES.negativeMarkingRule;

  return { marksPerCorrect, negativeMarksPerIncorrect, negativeMarkingRule };
}

/**
 * incorrectPenaltyPerQuestion
 * The one piece of logic that actually differs between the two rules.
 */
function incorrectPenaltyPerQuestion(rules) {
  if (rules.negativeMarkingRule === 'full_marks_plus_penalty') {
    return rules.marksPerCorrect + rules.negativeMarksPerIncorrect;
  }
  return rules.negativeMarksPerIncorrect; // 'negative_only'
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * calculateResult — UPDATED (backward-compatible signature)
 * @param {Object[]} questions
 * @param {Object|Map} answers
 * @param {number} timeSpentSeconds
 * @param {Object} [scoringRules] — { marksPerCorrect, negativeMarksPerIncorrect, negativeMarkingRule }
 *   Omit entirely for the old implicit behavior (1 mark per correct, no penalty).
 */
function calculateResult(questions, answers, timeSpentSeconds, scoringRules) {
  const answerFor = (id) => (answers instanceof Map ? answers.get(id) : answers?.[id]);

  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let ungraded = 0;

  const breakdown = questions.map((q) => {
    const id = (q._id || q.id).toString();
    const userAnswer = answerFor(id) ?? null;
    const hasCorrectAnswer = q.correctAnswer !== null && q.correctAnswer !== undefined;

    let status;
    if (!hasCorrectAnswer) {
      status = 'ungraded';
      ungraded += 1;
    } else if (!userAnswer) {
      status = 'unattempted';
      unattempted += 1;
    } else if (userAnswer === q.correctAnswer) {
      status = 'correct';
      correct += 1;
    } else {
      status = 'incorrect';
      incorrect += 1;
    }

    return {
      id,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer ?? null,
      explanation: q.explanation,
      userAnswer,
      status,
    };
  });

  const totalQuestions = questions.length;
  const gradedCount = totalQuestions - ungraded;
  const attemptedGraded = correct + incorrect;

  const percentage = gradedCount > 0 ? round2((correct / gradedCount) * 100) : 0;
  const accuracy = attemptedGraded > 0 ? round2((correct / attemptedGraded) * 100) : 0;
  const avgTimePerQuestion = totalQuestions > 0 ? round2(timeSpentSeconds / totalQuestions) : 0;

  // ── NEW — weighted scoring, using whichever rules were resolved ──
  const rules = resolveScoringRules(scoringRules);
  const penaltyPerIncorrect = incorrectPenaltyPerQuestion(rules);
  const rawScore = round2(correct * rules.marksPerCorrect - incorrect * penaltyPerIncorrect);
  const maxPossibleScore = round2(gradedCount * rules.marksPerCorrect);

  return {
    totalQuestions,
    gradedCount,
    ungraded,
    correct,
    incorrect,
    unattempted,
    score: correct,          // UNCHANGED — existing meaning preserved exactly
    percentage,               // UNCHANGED
    accuracy,                 // UNCHANGED
    avgTimePerQuestion,       // UNCHANGED
    breakdown,                 // UNCHANGED shape
    // NEW fields — additive only, never replacing anything above
    rawScore,
    maxPossibleScore,
    scoringRules: rules,
  };
}

module.exports = {
  calculateResult,
  resolveScoringRules,
  incorrectPenaltyPerQuestion,
  DEFAULT_SCORING_RULES,
  VALID_NEGATIVE_MARKING_RULES,
};
