/**
 * utils/scoring.js (frontend) — UPDATED
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ PROVENANCE NOTE: unlike the backend files in this change, I don't
 * have perfect certainty of every exact detail of your CURRENT version of
 * this file — I've referenced its behavior in comments many times across
 * this build but haven't had reason to output its complete content as a
 * turn's primary deliverable before now. This is a complete, careful
 * reference implementation matching everything consistently described
 * throughout this project (the same partition logic, field names, and
 * `formatDuration` helper Result.jsx has always relied on). If your real
 * file differs in some small way, diff against this rather than blindly
 * overwriting — the part that actually matters for THIS feature is just
 * the new `scoringRules` parameter and the two new returned fields
 * (rawScore, maxPossibleScore); graft those onto whatever your real
 * calculateResult() currently returns if the rest doesn't match exactly.
 *
 * Mirrors the backend's scoringService.js exactly — same partition logic,
 * same two negative-marking rules, same defaults. This is what lets
 * Result.jsx show an instant, correct breakdown even in the rare fallback
 * path (M12's graceful degradation) where a fetched server result isn't
 * available.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const VALID_NEGATIVE_MARKING_RULES = ['negative_only', 'full_marks_plus_penalty'];

const DEFAULT_SCORING_RULES = {
  marksPerCorrect: 1,
  negativeMarksPerIncorrect: 0,
  negativeMarkingRule: 'negative_only',
};

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

function incorrectPenaltyPerQuestion(rules) {
  if (rules.negativeMarkingRule === 'full_marks_plus_penalty') {
    return rules.marksPerCorrect + rules.negativeMarksPerIncorrect;
  }
  return rules.negativeMarksPerIncorrect;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * calculateResult — UPDATED (backward-compatible signature)
 * @param {Object[]} questions
 * @param {Object} answers — plain object keyed by question id
 * @param {number} timeSpentSeconds
 * @param {Object} [scoringRules] — omit for the old implicit behavior
 */
export function calculateResult(questions, answers, timeSpentSeconds, scoringRules) {
  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  let ungraded = 0;

  const breakdown = questions.map((q) => {
    const userAnswer = answers?.[q.id] ?? null;
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

    return { ...q, userAnswer, status };
  });

  const totalQuestions = questions.length;
  const gradedCount = totalQuestions - ungraded;
  const attemptedGraded = correct + incorrect;

  const percentage = gradedCount > 0 ? round2((correct / gradedCount) * 100) : 0;
  const accuracy = attemptedGraded > 0 ? round2((correct / attemptedGraded) * 100) : 0;
  const avgTimePerQuestion = totalQuestions > 0 ? round2(timeSpentSeconds / totalQuestions) : 0;

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
    timeSpent: timeSpentSeconds,
    percentage,
    accuracy,
    avgTimePerQuestion,
    breakdown,
    // NEW — additive only
    rawScore,
    maxPossibleScore,
    scoringRules: rules,
  };
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
