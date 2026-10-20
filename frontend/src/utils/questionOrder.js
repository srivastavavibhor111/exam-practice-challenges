/**
 * questionOrder.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure, dependency-free shuffling for the "Question & Option Order" step.
 * Never touches the backend — this is purely a client-side, per-attempt
 * display concern. The original fetched question content (text, options,
 * correctAnswer, explanation) is never mutated; only the ORDER things are
 * iterated/rendered in is computed here.
 *
 * WHY OPTION SHUFFLING NEVER NEEDS TO TOUCH SCORING: answers are already
 * keyed by each question's stable `id`, and correctness is already
 * checked by comparing LETTERS (userAnswer === correctAnswer), never by
 * screen position. "Shuffling options" only changes which order the four
 * letters are RENDERED in — the button that was originally option C
 * still reports 'C' when clicked, no matter where it's drawn on screen.
 * Nothing about scoring, submission, or the answers object needs to know
 * this happened.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ORDER_MODES = {
  ORIGINAL: 'original',
  SHUFFLE_QUESTIONS: 'shuffle_questions',
  SHUFFLE_OPTIONS: 'shuffle_options',
  SHUFFLE_BOTH: 'shuffle_both',
};

export const ORDER_MODE_OPTIONS = [
  {
    value: ORDER_MODES.ORIGINAL,
    label: 'Keep Original Order',
    description: 'Keep both questions and options in their original order.',
  },
  {
    value: ORDER_MODES.SHUFFLE_QUESTIONS,
    label: 'Shuffle Questions Only',
    description: 'Randomize the order of questions. Options within each question stay in their original order.',
  },
  {
    value: ORDER_MODES.SHUFFLE_OPTIONS,
    label: 'Shuffle Options Only',
    description: 'Keep questions in their original order. Randomize the options within each question.',
  },
  {
    value: ORDER_MODES.SHUFFLE_BOTH,
    label: 'Shuffle Both',
    description: 'Randomize the order of questions and the options within each question.',
  },
];

// Fisher–Yates — unbiased, standard, no library needed (per the spec's
// own "no unnecessary dependencies" instruction).
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * applyQuestionOrder
 * Call this EXACTLY ONCE per attempt — when the user clicks Continue on
 * the order-selection step. The caller stores the result in state and
 * never calls this again for the same attempt; that discipline (not
 * anything inside this function) is what keeps the order stable across
 * re-renders and navigation between questions.
 *
 * @param {Object[]} questions - the freshly-fetched, unmodified question list
 * @param {string} mode - one of ORDER_MODES
 * @returns {{ orderedQuestions: Object[], optionOrders: Record<string, string[]> }}
 *   orderedQuestions — the SAME question objects, possibly reordered as
 *     an array (each question object itself is never mutated or recreated
 *     with different content — only array position changes)
 *   optionOrders — questionId -> array of option letters in DISPLAY
 *     order. Always contains only letters that have real option text,
 *     matching the existing "filter out empty options" behavior already
 *     used throughout the test-taking and review UI.
 */
export function applyQuestionOrder(questions, mode) {
  const shuffleQuestions = mode === ORDER_MODES.SHUFFLE_QUESTIONS || mode === ORDER_MODES.SHUFFLE_BOTH;
  const shuffleOptions   = mode === ORDER_MODES.SHUFFLE_OPTIONS   || mode === ORDER_MODES.SHUFFLE_BOTH;

  const orderedQuestions = shuffleQuestions ? shuffleArray(questions) : [...questions];

  const optionOrders = {};
  for (const q of orderedQuestions) {
    const availableLetters = ['A', 'B', 'C', 'D'].filter(l => q.options?.[l]?.trim());
    optionOrders[q.id] = shuffleOptions ? shuffleArray(availableLetters) : availableLetters;
  }

  return { orderedQuestions, optionOrders };
}
