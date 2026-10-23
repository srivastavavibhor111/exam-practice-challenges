import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { TestHeader, QuestionPanel, QuestionNavigator, SubmitModal } from '../Test/Test';
import { useBackNavigationGuard } from '../../hooks/useBackNavigationGuard';
import ExitTestDialog from '../../components/ExitTestDialog/ExitTestDialog';
import { applyQuestionOrder } from '../../utils/questionOrder';
import QuestionOrderSelector from '../../components/QuestionOrderSelector/QuestionOrderSelector';
import * as sharedTestService from '../../services/sharedTestService';
import '../Test/Test.css';
import './SharedTestTaking.css';

/* ─── SharedTestTaking — reuses the REAL Test.jsx sub-components ────────────
   UPDATED — adds the same "Question & Option Order" step Test.jsx now
   has, inserted between 'loading' and 'ready' (which itself still sits
   before 'active', unchanged — shared tests still skip the duration
   picker since duration is fixed by the creator).

   Phase flow is now:
     loading → order-selection → ready → active → finishing

   Same safe pattern as Test.jsx's patch: `testInfo` holds the untouched
   fetch result, and two NEW pieces of state (`orderedQuestions`,
   `optionOrders`) are computed exactly once, when the user continues
   past order-selection — never recomputed on re-render or navigation.

   TestHeader, QuestionPanel, QuestionNavigator, and SubmitModal are the
   exact same components personal test-taking uses — genuinely reused,
   not recreated in a similar style.

   KNOWN SIMPLIFICATION: unlike the personal flow's M12 graceful-
   degradation fallback (submit fails to persist → still show a result
   from locally-held data), a failed shared-attempt submission here shows
   a clear error and lets the user retry submitting — it does not attempt
   a parallel client-side-only result path.
────────────────────────────────────────────────────────────────────────────── */

const TIMEUP_DELAY_MS = 1800;

export default function SharedTestTaking() {
  const { sharedTestId } = useParams();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [phase,     setPhase]     = useState('loading'); // loading | load-error | order-selection | ready | active | finishing
  const [loadError, setLoadError] = useState('');
  const [testInfo,  setTestInfo]  = useState(null); // untouched fetch result: { title, questionCount, durationSeconds, scoring, questions }

  const [orderedQuestions, setOrderedQuestions] = useState([]); // populated once, after order-selection
  const [optionOrders,     setOptionOrders]     = useState({}); // questionId -> letters in display order

  const [durationSeconds, setDurationSeconds] = useState(0);
  const [remaining,       setRemaining]       = useState(0);
  const [autoSubmitted,   setAutoSubmitted]   = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers,      setAnswers]      = useState({});
  const [marked,       setMarked]       = useState(new Set());
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [submitError,  setSubmitError]  = useState('');

  // Back-navigation protection — only while the shared test is actively being
  // attempted. If a failed submit reverts the phase to 'active', the guard
  // switches itself back on. See hooks/useBackNavigationGuard.js.
  const {
    isDialogOpen: exitDialogOpen,
    requestExit,
    continueTest,
    confirmExit,
    navigateAway,
  } = useBackNavigationGuard({ enabled: phase === 'active', exitTo: '/shared-tests' });

  const attemptIdRef = useRef(null);
  const attemptPromiseRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const test = await sharedTestService.getSharedTestForTaking(sharedTestId);
        if (cancelled) return;
        if (!test.questions?.length) {
          setLoadError('This Shared Test has no questions.');
          setPhase('load-error');
          return;
        }
        setTestInfo(test);
        setDurationSeconds(test.durationSeconds);
        setPhase('order-selection');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'This Shared Test could not be found.');
        setPhase('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, [sharedTestId]);

  function handleOrderSelected(mode) {
    const { orderedQuestions: ordered, optionOrders: computedOrders } = applyQuestionOrder(testInfo.questions, mode);
    setOrderedQuestions(ordered);
    setOptionOrders(computedOrders);
    setPhase('ready');
  }

  const questions = orderedQuestions;
  const currentQuestion = questions[currentIndex] || null;
  const selectedAnswer  = currentQuestion ? (answers[currentQuestion.id] ?? null) : null;
  const isMarked        = currentQuestion ? marked.has(currentQuestion.id) : false;
  const answeredCount   = Object.keys(answers).length;

  function handleStart() {
    setRemaining(durationSeconds);
    setPhase('active');

    attemptPromiseRef.current = sharedTestService
      .startSharedAttempt(sharedTestId)
      .then(id => { attemptIdRef.current = id; return id; })
      .catch(err => {
        console.error('Could not start shared attempt.', err);
        attemptIdRef.current = null;
        return null;
      });
  }

  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      setRemaining(r => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'active' && remaining === 0) {
      setAutoSubmitted(true);
      setPhase('finishing');
    }
  }, [remaining, phase]);

  const finalizeSubmission = useCallback(async (wasAutoSubmitted) => {
    const finalTimeSpent = wasAutoSubmitted ? durationSeconds : durationSeconds - remaining;

    let attemptId = attemptIdRef.current;
    if (!attemptId && attemptPromiseRef.current) {
      try { attemptId = await attemptPromiseRef.current; } catch { attemptId = null; }
    }

    if (!attemptId) {
      setPhase('active'); // revert — nothing to submit against
      setSubmitError('Could not start a tracked attempt for this Shared Test. Please refresh and try again.');
      return;
    }

    try {
      await sharedTestService.submitSharedAttempt(attemptId, {
        answers,
        markedForReview: [...marked],
        timeSpentSeconds: finalTimeSpent,
        autoSubmitted: wasAutoSubmitted,
      });
      navigateAway(`/shared-tests/result/${attemptId}`);
    } catch (err) {
      setPhase('active');
      setSubmitError(err.message || 'Could not submit your Shared Test attempt. Please try again.');
    }
  }, [answers, marked, durationSeconds, remaining, navigateAway]);

  useEffect(() => {
    if (phase !== 'finishing') return;
    const delay = autoSubmitted ? TIMEUP_DELAY_MS : 0;
    const timer = setTimeout(() => { finalizeSubmission(autoSubmitted); }, delay);
    return () => clearTimeout(timer);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectAnswer = useCallback((letter) => {
    if (!currentQuestion) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: letter }));
  }, [currentQuestion]);

  const toggleMark = useCallback(() => {
    if (!currentQuestion) return;
    setMarked(prev => {
      const next = new Set(prev);
      next.has(currentQuestion.id) ? next.delete(currentQuestion.id) : next.add(currentQuestion.id);
      return next;
    });
  }, [currentQuestion]);

  const goTo   = useCallback((idx) => { if (idx >= 0 && idx < questions.length) setCurrentIndex(idx); }, [questions.length]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  function handleConfirmSubmit() {
    setShowConfirm(false);
    setAutoSubmitted(false);
    setPhase('finishing');
  }

  if (phase === 'loading') {
    return (
      <div className="test-root">
        <div className="tload-wrap">
          <span className="tload-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="tload-text">Loading Shared Test…</p>
        </div>
      </div>
    );
  }

  if (phase === 'load-error') {
    return (
      <div className="test-root">
        <div className="tload-wrap">
          <span className="tload-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="tload-title">Couldn't load this Shared Test</h1>
          <p className="tload-text">{loadError}</p>
          <Link to="/shared-tests" className="btn btn--primary">
            <ArrowLeftIcon />
            Back to Shared Tests
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'order-selection') {
    return (
      <QuestionOrderSelector
        questionCount={testInfo.questions.length}
        onContinue={handleOrderSelected}
      />
    );
  }

  if (phase === 'ready') {
    return (
      <div className="test-root">
        <header className="tsetup-header">
          <div className="test-header__logo">
            <span className="test-header__logo-mark">EPC</span>
            <span className="test-header__logo-name">Exam Practice</span>
          </div>
          <button
            className="test-theme-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </header>

        <div className="tsetup-card-wrap">
          <div className="tsetup-card">
            <h1 className="tsetup-title">{testInfo.title}</h1>
            <p className="tsetup-subtitle">
              {testInfo.questionCount} questions · {Math.round(testInfo.durationSeconds / 60)} minutes,
              fixed for every participant.
            </p>

            {testInfo.scoring && (
              <div className="shared-taking-scoring-summary">
                <span className="shared-taking-scoring-summary__item shared-taking-scoring-summary__item--positive">
                  +{testInfo.scoring.marksPerCorrect} correct
                </span>
                <span className="shared-taking-scoring-summary__item shared-taking-scoring-summary__item--negative">
                  &minus;{testInfo.scoring.negativeMarkingRule === 'full_marks_plus_penalty'
                    ? (testInfo.scoring.marksPerCorrect + testInfo.scoring.negativeMarksPerIncorrect)
                    : testInfo.scoring.negativeMarksPerIncorrect} incorrect
                </span>
                <span className="shared-taking-scoring-summary__item shared-taking-scoring-summary__item--neutral">
                  0 unattempted
                </span>
              </div>
            )}

            <button className="btn btn--primary btn--lg tsetup-start-btn" onClick={handleStart}>
              Start Test <ArrowRightIcon />
            </button>

            <p className="tsetup-note">
              <InfoIcon /> Once started, the timer counts down and cannot be paused.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="test-root">
      <TestHeader
        remaining={remaining}
        answered={answeredCount}
        total={questions.length}
        onSubmit={() => setShowConfirm(true)}
        onExit={requestExit}
        disabled={phase !== 'active'}
      />

      <div className="test-body">
        <div className="test-main">
          <div className="test-progress-track" aria-hidden="true">
            <div className="test-progress-fill" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
          </div>

          {submitError && (
            <p className="shared-taking-submit-error" role="alert">
              <ErrorIcon /> {submitError}
            </p>
          )}

          <QuestionPanel
            question={currentQuestion}
            index={currentIndex}
            total={questions.length}
            selectedAnswer={selectedAnswer}
            isMarked={isMarked}
            onSelectAnswer={selectAnswer}
            onToggleMark={toggleMark}
            onPrev={goPrev}
            onNext={goNext}
            isFirst={currentIndex === 0}
            isLast={currentIndex === questions.length - 1}
            optionOrder={currentQuestion ? optionOrders[currentQuestion.id] : undefined}
          />
        </div>

        <aside className="test-sidebar" aria-label="Question navigator">
          <QuestionNavigator
            questions={questions}
            currentIndex={currentIndex}
            answers={answers}
            marked={marked}
            onNavigate={goTo}
          />
        </aside>
      </div>

      {showConfirm && !exitDialogOpen && (
        <SubmitModal
          total={questions.length}
          answered={answeredCount}
          markedCount={marked.size}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {exitDialogOpen && (
        <ExitTestDialog onContinue={continueTest} onExit={confirmExit} />
      )}

      {phase === 'finishing' && (
        <div className="tmodal-backdrop" role="alertdialog" aria-modal="true">
          <div className="tmodal-card tmodal-card--timeup">
            <span className="tmodal-timeup-icon" aria-hidden="true">
              {autoSubmitted ? <AlarmIcon /> : <SpinnerIcon />}
            </span>
            <h2 className="tmodal-title">{autoSubmitted ? "Time's Up!" : 'Submitting Your Test'}</h2>
            <p className="tmodal-subtitle">
              {autoSubmitted ? 'Your Shared Test is being submitted automatically…' : 'Just a moment while we save your results…'}
            </p>
            <span className="tmodal-spinner" aria-hidden="true"><SpinnerIcon /></span>
          </div>
        </div>
      )}
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="test-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2.2" strokeOpacity="0.25" />
      <path d="M17.5 10a7.5 7.5 0 00-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function ErrorBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2" />
      <path d="M20 12v10M20 26v1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4.5V5M7 6.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function AlarmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 5.5V8h2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M11.54 4.46l1.06-1.06M3.4 12.6l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.5 10.5A6.5 6.5 0 015.5 2.5a6.5 6.5 0 100 11 6.5 6.5 0 008-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}