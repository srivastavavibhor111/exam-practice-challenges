import { useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import * as testService from '../../services/testService';
import './ScoringRules.css';
import * as sharedTestService from '../../services/sharedTestService';

/* ─── ScoringRules — "Set Scoring Rules" ──────────────────────────────────────
   New step in the Create Test flow:
     Create Test → Review/Edit → Set Scoring Rules → Timer/Test Settings → Take Test

   This page is where the ACTUAL test creation now happens — Review.jsx no
   longer persists anything itself; it just navigates here carrying the
   approved questions/title. This page's "Continue" button is what finally
   calls testService.createSourceAndTest, now including the scoring config,
   then routes into Test.jsx's existing setup screen for duration.

   Full round-trip state preservation: clicking Back carries the
   currently-entered (even if not yet valid) scoring values back to
   Review via location.state — if the user edits a question and clicks
   Continue again, THIS page re-reads those same values instead of
   resetting to defaults. See handleBack/the state initializers below.
────────────────────────────────────────────────────────────────────────────── */

const RULE_OPTIONS = [
  {
    value: 'negative_only',
    label: 'Negative Marks Only',
    description: 'Only the specified negative-marking value is deducted for an incorrect answer.',
  },
  {
    value: 'full_marks_plus_penalty',
    label: 'Full Marks Forfeited + Additional Penalty',
    description: 'For an incorrect answer, the marks that would have been awarded for a correct answer are forfeited, and the specified negative-marking penalty is additionally deducted.',
  },
];

function formatMarks(n) {
  if (!Number.isFinite(n)) return '0';
  // Trim trailing zeros (2 not 2.00, 0.5 not 0.50) while still allowing decimals.
  return Number(n.toFixed(2)).toString();
}

export default function ScoringRules() {
  const navigate = useNavigate();
  const location = useLocation();

  const { method, content, sourceUrl, questions, title } = location.state || {};
  const incomingScoring = location.state?.scoring;
  const mode = location.state?.mode === 'shared' ? 'shared' : 'personal';

  const [marksPerCorrect, setMarksPerCorrect] = useState(
    incomingScoring?.marksPerCorrect != null ? String(incomingScoring.marksPerCorrect) : '1'
  );
  const [negativeMarks, setNegativeMarks] = useState(
    incomingScoring?.negativeMarksPerIncorrect != null ? String(incomingScoring.negativeMarksPerIncorrect) : '0'
  );
  const [negativeMarkingRule, setNegativeMarkingRule] = useState(
    incomingScoring?.negativeMarkingRule || 'negative_only'
  );

  const [durationMinutes, setDurationMinutes] = useState(30);
  const [customDuration, setCustomDuration] = useState('');

  // A typed custom value wins over a selected chip.
  const effectiveMinutes = customDuration.trim() !== ''
    ? Number(customDuration)
    : durationMinutes;

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  // Redirect if arrived without real question data (e.g. direct URL visit).
  if (!questions?.length) {
    navigate('/create', { replace: true });
    return null;
  }

  const marksNum = parseFloat(marksPerCorrect);
  const negativeNum = parseFloat(negativeMarks);
  const validMarks = Number.isFinite(marksNum) && marksNum > 0;
  const validNegative = Number.isFinite(negativeNum) && negativeNum >= 0;

  const incorrectDeduction = useMemo(() => {
    if (!validMarks || !validNegative) return null;
    return negativeMarkingRule === 'full_marks_plus_penalty'
      ? marksNum + negativeNum
      : negativeNum;
  }, [marksNum, negativeNum, negativeMarkingRule, validMarks, validNegative]);

  const selectedRuleLabel = RULE_OPTIONS.find(r => r.value === negativeMarkingRule)?.label;

  function validate() {
    if (marksPerCorrect.trim() === '' || !validMarks) {
      return 'Marks per correct answer must be a number greater than 0.';
    }
    if (negativeMarks.trim() === '' || !validNegative) {
      return 'Negative marking must be a number of 0 or greater.';
    }
    if (!RULE_OPTIONS.some(r => r.value === negativeMarkingRule)) {
      return 'Please select a negative marking rule.';
    }
    if (mode === 'shared') {
      if (!Number.isInteger(effectiveMinutes) || effectiveMinutes < 1 || effectiveMinutes > 300) {
        return 'Timer duration must be a whole number of minutes between 1 and 300.';
      }
    }
    return null;
  }

  function handleBack() {
    // Carry the current in-progress scoring values back to Review, so
    // re-entering this page later (after editing a question) restores
    // them instead of resetting to defaults.
    navigate('/review', {
      state: {
        method, content, sourceUrl, questions, title,
        scoring: { marksPerCorrect: marksNum || 1, negativeMarksPerIncorrect: negativeNum || 0, negativeMarkingRule },
      },
    });
  }

  async function handleContinue() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSaving(true);
      try {
        const scoringConfig = {
          marksPerCorrect: marksNum,
          negativeMarksPerIncorrect: negativeNum,
          negativeMarkingRule,
        };

        if (mode === 'shared') {
          const sharedTest = await sharedTestService.createSharedTest({
            title,
            questions,
            scoring: scoringConfig,
            durationSeconds: effectiveMinutes * 60,
          });
          navigate('/shared-tests', {
            state: { justCreatedTestId: sharedTest.testId },
          });
        } else {
          const savedTest = await testService.createSourceAndTest({
            method,
            rawContent: content,
            sourceUrl,
            questions,
            title,
            scoring: scoringConfig,
          });
          navigate(`/test/${savedTest.id}`);
        }
      } catch (err) {
        setIsSaving(false);
        setError(err.message || 'Something went wrong while saving your test. Please try again.');
      }
  }


  return (
    <main className="page-wrapper">
      <div className="scoring-rules">

        <div className="scoring-rules__topbar">
          <button type="button" className="scoring-rules__back-link" onClick={handleBack}>
            <ArrowLeftIcon /> Back to Review
          </button>
        </div>

        <header className="scoring-rules__header">
          <h1 className="scoring-rules__title">Set Scoring Rules</h1>
          <p className="scoring-rules__subtitle">
            Choose how marks will be awarded and deducted for this test.
          </p>
        </header>

        <div className="scoring-rules__card">

          <div className="scoring-rules__field">
            <label className="scoring-rules__label" htmlFor="marks-per-correct">
              Marks per Correct Answer
            </label>
            <input
              id="marks-per-correct"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              className={`scoring-rules__input${marksPerCorrect && !validMarks ? ' scoring-rules__input--error' : ''}`}
              value={marksPerCorrect}
              onChange={e => setMarksPerCorrect(e.target.value)}
              aria-describedby="marks-per-correct-hint"
            />
            <p className="scoring-rules__hint" id="marks-per-correct-hint">
              Marks awarded for every correctly answered question.
            </p>
          </div>

          <div className="scoring-rules__field">
            <label className="scoring-rules__label" htmlFor="negative-marks">
              Negative Marking
            </label>
            <input
              id="negative-marks"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className={`scoring-rules__input${negativeMarks && !validNegative ? ' scoring-rules__input--error' : ''}`}
              value={negativeMarks}
              onChange={e => setNegativeMarks(e.target.value)}
              aria-describedby="negative-marks-hint"
            />
            <p className="scoring-rules__hint" id="negative-marks-hint">
              Marks deducted for every incorrectly answered question. Enter the
              penalty value as a positive number — 0 means no negative marking
              under "Negative Marks Only" below.
            </p>
          </div>

          <div className="scoring-rules__field">
            <span className="scoring-rules__label">Negative Marking Rule</span>
            <div className="scoring-rules__rule-options" role="radiogroup" aria-label="Negative marking rule">
              {RULE_OPTIONS.map(rule => (
                <label
                  key={rule.value}
                  className={`scoring-rules__rule-card${negativeMarkingRule === rule.value ? ' scoring-rules__rule-card--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="negative-marking-rule"
                    value={rule.value}
                    checked={negativeMarkingRule === rule.value}
                    onChange={() => setNegativeMarkingRule(rule.value)}
                    className="scoring-rules__rule-radio"
                  />
                  <span className="scoring-rules__rule-card-body">
                    <span className="scoring-rules__rule-card-label">{rule.label}</span>
                    <span className="scoring-rules__rule-card-desc">{rule.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {mode === 'shared' && (
            <div className="scoring-rules__field">
              <label className="scoring-rules__label" htmlFor="shared-duration">
                Timer Duration (applies to every participant)
              </label>
              <div className="scoring-rules__duration-chips" role="group" aria-label="Preset duration in minutes">
                {[10, 15, 20, 30, 45, 60, 90].map(m => (
                  <button
                    key={m}
                    type="button"
                    className={`scoring-rules__duration-chip${customDuration.trim() === ''&& durationMinutes === m ? ' scoring-rules__duration-chip--active' : ''}`}
                    onClick={() => { setDurationMinutes(m); setCustomDuration(''); }}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <input
                id="shared-duration"
                type="number"
                inputMode="numeric"
                min="1"
                max="300"
                step="1"
                className="scoring-rules__input"
                value={customDuration}
                onChange={e => setCustomDuration(e.target.value)}
                placeholder="Or enter custom minutes"
              />
              <p className="scoring-rules__hint">
                Unlike a personal test, every participant in a Shared Test gets
                the same fixed time limit. Pick a preset or type your own (1-300 minutes).
              </p>
            </div>
          )}

          <div className="scoring-rules__preview">
            <p className="scoring-rules__preview-label">
              Preview — <strong>{selectedRuleLabel}</strong>
            </p>
            <div className="scoring-rules__preview-row">
              <span>Correct answer</span>
              <span className="scoring-rules__preview-value scoring-rules__preview-value--positive">
                {validMarks ? `+${formatMarks(marksNum)}` : '—'} {marksNum === 1 ? 'mark' : 'marks'}
              </span>
            </div>
            <div className="scoring-rules__preview-row">
              <span>Incorrect answer</span>
              <span className="scoring-rules__preview-value scoring-rules__preview-value--negative">
                {incorrectDeduction !== null ? `\u2212${formatMarks(incorrectDeduction)}` : '—'}{' '}
                {incorrectDeduction === 1 ? 'mark' : 'marks'}
              </span>
            </div>
            <div className="scoring-rules__preview-row">
              <span>Unattempted</span>
              <span className="scoring-rules__preview-value scoring-rules__preview-value--neutral">0 mark</span>
            </div>
            <p className="scoring-rules__preview-note">
              This preview only explains the scoring rules — it is not the final test score.
            </p>
          </div>

          {error && (
            <p className="scoring-rules__error" role="alert">
              <ErrorIcon /> {error}
            </p>
          )}

          <div className="scoring-rules__actions">
            <button type="button" className="btn btn--ghost" onClick={handleBack} disabled={isSaving}>
              Back
            </button>
            <button type="button" className="btn btn--primary btn--lg" onClick={handleContinue} disabled={isSaving}>
              {isSaving
                ? 'Saving…'
                : mode === 'shared' ? 'Create Shared Test' : 'Continue'}
                <ArrowRightIcon />
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}


function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}


