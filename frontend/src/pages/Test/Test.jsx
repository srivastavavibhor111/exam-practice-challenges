import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import * as testTakingService from '../../services/testTakingService';
import Footer from '../../components/Footer/Footer';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBackNavigationGuard } from '../../hooks/useBackNavigationGuard';
import ExitTestDialog from '../../components/ExitTestDialog/ExitTestDialog';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import { applyQuestionOrder } from '../../utils/questionOrder';
import QuestionOrderSelector from '../../components/QuestionOrderSelector/QuestionOrderSelector';
import './Test.css';

/* ─── Test — M5/M9 UI, M12 wiring — Real Test Engine Integration ────────────
   Route: /test/:testId  (was /test/preview with router-state questions)

   Lifecycle:
     'loading'    → fetching the test (answer-stripped) via GET /tests/:id/take
     'load-error' → fetch failed (not found, not yours, network) — clear error, link home
     'setup'      → user picks a duration (unchanged from M9)
     'active'     → countdown running; a real Attempt was created via
                    POST /attempts the moment this phase started
     'finishing'  → submitting for real (either the countdown hit zero, or
                    the user confirmed) — see finalizeSubmission()

   Why the test is fetched via the ANSWER-STRIPPED endpoint (/take), and why
   the FULL test is re-fetched only after submission: see testService.js
   (backend) and testTakingService.js — the short version is that correctAnswer
   must never be visible in the browser while the test is still in progress,
   but Result.jsx (M6, untouched here) needs it for its own client-side
   scoring once the test is over and answers are safe to reveal.

   Every persistence call (starting the attempt, submitting it, re-fetching
   the full test) is wrapped so a network failure degrades gracefully —
   the user always reaches their result, even if nothing could be saved.
────────────────────────────────────────────────────────────────────────────── */

const PRESET_MINUTES = [10, 15, 20, 30, 45, 60, 90];
const MAX_MINUTES     = 300;

const WARNING_THRESHOLD_SEC  = 300;
const CRITICAL_THRESHOLD_SEC = 60;
const TIMEUP_DELAY_MS        = 1800;

function formatCountdown(totalSeconds) {
  const s   = Math.max(0, totalSeconds);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ── Root component ──────────────────────────────────────────────────────────*/

export default function Test() {
  const { testId } = useParams();

  // ── Fetch the test on mount ─────────────────────────────────────────────────
  const [phase,     setPhase]     = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [rawQuestions, setRawQuestions] = useState([]); // untouched fetch result
  const [questions, setQuestions] = useState([]);       // populated AFTER order-selection — everything downstream reads this exactly as before
  const [optionOrders, setOptionOrders] = useState({}); // questionId -> letters in display order
  const [scoring,   setScoring]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Replaced in M28 Amendement
        // const test = await testTakingService.getTestForTaking(testId);
        // if (cancelled) return;
        // if (!test.questions?.length) {
        //   setLoadError('This test has no questions.');
        //   setPhase('load-error');
        //   return;
        // }
        // setQuestions(test.questions);
        // setPhase('setup');

        const test = await testTakingService.getTestForTaking(testId);
        if (cancelled) return;
        if (!test.questions?.length) {
          setLoadError('This test has no questions.');
          setPhase('load-error');
          return;
        }
        setRawQuestions(test.questions);
        setScoring(test.scoring);
        setPhase('order-selection');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'This test could not be found.');
        setPhase('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, [testId]);

  // ── Timer state ────────────────────────────────────────────────────────────
  const [durationSeconds, setDurationSeconds] = useState(null);
  const [remaining,       setRemaining]       = useState(0);
  const [autoSubmitted,   setAutoSubmitted]   = useState(false);

  // ── Test state ─────────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers,      setAnswers]      = useState({});
  const [marked,       setMarked]       = useState(new Set());
  const [showConfirm,  setShowConfirm]  = useState(false);

  // Back-navigation protection — only while the test is genuinely being
  // attempted (phase === 'active'). It switches itself off the moment the
  // phase becomes 'finishing' (manual OR timer auto-submit), so it can never
  // interfere with submission. See hooks/useBackNavigationGuard.js.
  const {
    isDialogOpen: exitDialogOpen,
    requestExit,
    continueTest,
    confirmExit,
    navigateAway,
  } = useBackNavigationGuard({ enabled: phase === 'active', exitTo: '/my-tests' });

  // Tracks the real, persisted Attempt — created the moment the countdown
  // starts. A ref (not state) because nothing needs to re-render when it
  // resolves; submit just needs the value (or the in-flight promise) later.
  const attemptIdRef = useRef(null);
  const attemptPromiseRef = useRef(null);

  const currentQuestion = questions[currentIndex] || null;
  const selectedAnswer  = currentQuestion ? (answers[currentQuestion.id] ?? null) : null;
  const isMarked         = currentQuestion ? marked.has(currentQuestion.id) : false;
  const answeredCount    = Object.keys(answers).length;

  // ── Start the test ─────────────────────────────────────────────────────────
  function handleOrderSelected(mode) {
      const { orderedQuestions, optionOrders: computedOrders } = applyQuestionOrder(rawQuestions, mode);
      setQuestions(orderedQuestions);
      setOptionOrders(computedOrders);
      setPhase('setup');
  }

  function handleStartTest(minutes) {
    const secs = minutes * 60;
    setDurationSeconds(secs);
    setRemaining(secs);
    setPhase('active');

    // Fire-and-track, deliberately not awaited here — starting the
    // countdown shouldn't wait on a network round-trip. If this fails,
    // the test still runs locally; submission just won't be persisted
    // (see finalizeSubmission's graceful fallback).
    attemptPromiseRef.current = testTakingService
      .startAttempt(testId, secs)
      .then(id => { attemptIdRef.current = id; return id; })
      .catch(err => {
        console.warn('Could not start a tracked attempt — results will still be shown locally.', err);
        attemptIdRef.current = null;
        return null;
      });
  }

  // ── Countdown ──────────────────────────────────────────────────────────────
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

  // ── Finalize submission — real API calls, with graceful fallback ──────────
  const finalizeSubmission = useCallback(async (wasAutoSubmitted) => {
    const finalTimeSpent = wasAutoSubmitted ? durationSeconds : durationSeconds - remaining;

    let attemptId = attemptIdRef.current;
    if (!attemptId && attemptPromiseRef.current) {
      try { attemptId = await attemptPromiseRef.current; } catch { attemptId = null; }
    }

    // 1. Submit for real — this is the authoritative, server-scored record.
    if (attemptId) {
  try {
    await testTakingService.submitAttempt(attemptId, {
      answers,
      markedForReview: [...marked],
      timeSpentSeconds: finalTimeSpent,
      autoSubmitted: wasAutoSubmitted,
    });
  } catch (err) {
    console.warn(
      'Could not save this attempt to the server — showing local results instead.',
      err
    );

    // Backend submission failed, so use the legacy local-result fallback.
    attemptId = null;
  }
}

    // 2. Re-fetch the FULL test (correctAnswer included — safe now that
    //    the test is over) so Result.jsx's existing scoring keeps working
    //    exactly as it always has. Falls back to the stripped questions
    //    already in memory if this fails — Result.jsx handles a missing
    //    correctAnswer gracefully (renders as "ungraded"), so this never
    //    crashes, it just degrades.
    let questionsForResult = questions;
    try {
      const full = await testTakingService.getFullTest(testId);
      questionsForResult = full.questions;
    } catch (err) {
      console.warn('Could not reload full question data for review — some detail may be missing.', err);
    }

     // If persistence succeeded, route by ID — Result.jsx fetches the
      // real, authoritative attempt itself and needs nothing passed
      // through state. If it failed (attemptId is null — see the
      // graceful-degradation handling above), fall back to the legacy
      // state-passing route exactly as M12 did, so the user still reaches
      // a result even though nothing could be saved.
      if (attemptId) {
        navigateAway(`/result/${attemptId}`);
      } else {
        navigateAway('/result', {
          state: {
            questions: questionsForResult,
            answers,
            marked: [...marked],
            timeSpent: finalTimeSpent,
            duration: durationSeconds,
            testId,
            attemptId,
            scoring, // only actually used by Result.jsx's client-side fallback
                   // calculation, on the rare path where a server-fetched
                   // attempt result isn't available (M12 graceful degradation)
          },
        });
      }
  }, [answers, marked, durationSeconds, remaining, questions, testId, navigateAway]);

  useEffect(() => {
    if (phase !== 'finishing') return;
    const delay = autoSubmitted ? TIMEUP_DELAY_MS : 0;
    const timer = setTimeout(() => { finalizeSubmission(autoSubmitted); }, delay);
    return () => clearTimeout(timer);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'active' || showConfirm || exitDialogOpen) return;
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight': goNext();          break;
        case 'ArrowLeft':  goPrev();          break;
        case '1':          selectAnswer('A'); break;
        case '2':          selectAnswer('B'); break;
        case '3':          selectAnswer('C'); break;
        case '4':          selectAnswer('D'); break;
        default: break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, showConfirm, exitDialogOpen, goNext, goPrev, selectAnswer]);

  function handleConfirmSubmit() {
    setShowConfirm(false);
    setAutoSubmitted(false);
    setPhase('finishing');
  }

  // ── Render: loading / error states ─────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="test-root">
        <div className="tload-wrap">
          <span className="tload-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="tload-text">Loading your test…</p>
        </div>
      </div>
    );
  }

  if (phase === 'load-error') {
    return (
      <div className="test-root">
        <div className="tload-wrap">
          <span className="tload-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="tload-title">Couldn't load this test</h1>
          <p className="tload-text">{loadError}</p>
          <Link to="/" className="btn btn--primary">Back to Home</Link>
        </div>
      </div>
    );
  }

  // ── Render: setup screen ───────────────────────────────────────────────────

  if (phase === 'order-selection') {
    return (
      <QuestionOrderSelector
        questionCount={rawQuestions.length}
        onContinue={handleOrderSelected}
      />
    );
  }

  if (phase === 'setup') {
    // replaced in M28 Amendement
    // return <TestSetup questionCount={questions.length} onStart={handleStartTest} />;
    return <TestSetup questionCount={questions.length} scoring={scoring} onStart={handleStartTest} />;
  }

  // ── Render: active / finishing ─────────────────────────────────────────────

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

      {phase === 'finishing' && <SubmittingOverlay autoSubmitted={autoSubmitted} />}

    </div>
  );
}

/* ─── TestSetup (unchanged from M9) ────────────────────────────────────────*/

function TestSetup({ questionCount, scoring, onStart }) {
  // const { theme, toggleTheme } = useTheme();
  // const isDark = theme === 'dark';

  const [minutes,    setMinutes]    = useState(null);
  const [customText, setCustomText] = useState('');
  const [error,      setError]      = useState('');

  function selectPreset(m) {
    setMinutes(m);
    setCustomText('');
    setError('');
  }

  function handleCustomChange(e) {
    const val = e.target.value;
    setCustomText(val);
    setError('');
    const parsed = parseInt(val, 10);
    setMinutes(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }

  function handleStart() {
    if (!minutes || minutes < 1) {
      setError('Please choose or enter a valid duration.');
      return;
    }
    if (minutes > MAX_MINUTES) {
      setError(`Maximum test duration is ${MAX_MINUTES} minutes.`);
      return;
    }
    onStart(minutes);
  }

  return (
    <div className="tsetup-root">
      <header className="tsetup-header">
        <div className="test-header__logo">
          <span className="test-header__logo-mark">EPC</span>
          <span className="test-header__logo-name">Exam Practice</span>
        </div>
        {/* Correcting theme toggle button in test page */}
        <ThemeToggle />
      </header>

      <div className="tsetup-card-wrap">
        <div className="tsetup-card">
          <span className="tsetup-icon" aria-hidden="true"><TimerBigIcon /></span>
          <h1 className="tsetup-title">Set Your Test Timer</h1>
          <p className="tsetup-subtitle">
            You're about to start a {questionCount}-question test. Choose how much
            time you want — the test submits automatically when time runs out.
          </p>

          {scoring && (
            <div className="tsetup-scoring-summary">
              <span className="tsetup-scoring-summary__item tsetup-scoring-summary__item--positive">
                +{scoring.marksPerCorrect} correct
              </span>
              <span className="tsetup-scoring-summary__item tsetup-scoring-summary__item--negative">
                &minus;{scoring.negativeMarkingRule === 'full_marks_plus_penalty'
                  ? (scoring.marksPerCorrect + scoring.negativeMarksPerIncorrect)
                  : scoring.negativeMarksPerIncorrect} incorrect
              </span>
              <span className="tsetup-scoring-summary__item tsetup-scoring-summary__item--neutral">
                0 unattempted
              </span>
            </div>
          )}


          <div className="tsetup-presets" role="group" aria-label="Preset durations">
            {PRESET_MINUTES.map(m => (
              <button
                key={m}
                type="button"
                className={`tsetup-chip${minutes === m && !customText ? ' tsetup-chip--active' : ''}`}
                onClick={() => selectPreset(m)}
              >
                {m} min
              </button>
            ))}
          </div>

          <div className="tsetup-custom">
            <label className="tsetup-custom-label" htmlFor="tsetup-custom-input">
              Or enter a custom duration (minutes)
            </label>
            <input
              id="tsetup-custom-input"
              type="number"
              min="1"
              max={MAX_MINUTES}
              className="tsetup-custom-input"
              value={customText}
              onChange={handleCustomChange}
              placeholder="e.g. 25"
            />
          </div>

          {error && (
            <p className="tsetup-error" role="alert">
              <ErrorIcon /> {error}
            </p>
          )}

          <button className="btn btn--primary btn--lg tsetup-start-btn" onClick={handleStart}>
            Start Test <ArrowRightIcon />
          </button>

          <p className="tsetup-note">
            <InfoIcon /> Once started, the timer counts down and cannot be paused.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

/* ─── TestHeader (unchanged from M9) ──────────────────────────────────────*/

export function TestHeader({ remaining, answered, total, onSubmit, onExit, disabled }) {
  // const { theme, toggleTheme } = useTheme();
  // const isDark = theme === 'dark';

  const isCritical = remaining <= CRITICAL_THRESHOLD_SEC;
  const isWarning  = remaining <= WARNING_THRESHOLD_SEC && !isCritical;

  const timerClass = [
    'test-header__timer',
    isCritical ? 'test-header__timer--critical' : '',
    isWarning  ? 'test-header__timer--warning'  : '',
  ].filter(Boolean).join(' ');

  return (
    <header className="test-header">
      <div className="test-header__logo">
        <span className="test-header__logo-mark">EPC</span>
        <span className="test-header__logo-name">Exam Practice</span>
      </div>

      <div className="test-header__center">
        <span
          className={timerClass}
          aria-label={`Time remaining: ${formatCountdown(remaining)}`}
          aria-live={isCritical ? 'assertive' : 'off'}
        >
          {isCritical ? <AlarmIcon /> : <TimerIcon />}
          <span className="test-header__time">{formatCountdown(remaining)}</span>
          {isCritical && <span className="test-header__time-label">Hurry!</span>}
          {isWarning  && <span className="test-header__time-label">Time low</span>}
        </span>
        <span className="test-header__answered" aria-live="polite">
          {answered} <span className="test-header__answered-of">/ {total}</span>
        </span>
      </div>

      <div className="test-header__actions">
        {/* <button
          className="test-theme-btn"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button> */}

        <ThemeToggle />
        {onExit && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onExit} disabled={disabled}>
            Exit
          </button>
        )}
        <button className="btn btn--primary btn--sm" onClick={onSubmit} disabled={disabled}>
          Submit <CheckIcon />
        </button>
      </div>
    </header>
  );
}

/* ─── QuestionPanel (unchanged from M5) ───────────────────────────────────*/

export function QuestionPanel({
  question, index, total,
  selectedAnswer, isMarked,
  onSelectAnswer, onToggleMark,
  onPrev, onNext,
  isFirst, isLast,
  optionOrder
}) {
  if (!question) return null;

  const visibleOptions = optionOrder || ['A', 'B', 'C', 'D'].filter(l => question.options[l]?.trim());

  return (
    <div className="qp">
      <div className="qp__meta">
        <span className="qp__counter">
          Question <strong>{index + 1}</strong>
          <span className="qp__counter-of"> of {total}</span>
        </span>
        {isMarked && (
          <span className="qp__marked-badge" aria-label="Marked for review">
            <FlagFilledIcon /> Marked for review
          </span>
        )}
      </div>

      <p className="qp__text">{question.text}</p>

      <div className="qp__options" role="radiogroup" aria-label="Select your answer">
        {visibleOptions.map(letter => (
          <OptionButton
            key={letter}
            letter={letter}
            text={question.options[letter]}
            selected={selectedAnswer === letter}
            onClick={() => onSelectAnswer(letter)}
          />
        ))}
      </div>

      <div className="qp__controls">
        <button className="btn btn--primary qp__nav-btn" onClick={onPrev} disabled={isFirst} aria-label="Previous question">
          <ArrowLeftIcon /> Previous
        </button>

        <button
          className={`qp__mark-btn${isMarked ? ' qp__mark-btn--active' : ''}`}
          onClick={onToggleMark}
          aria-pressed={isMarked}
        >
          {isMarked ? <FlagFilledIcon /> : <FlagIcon />}
          {isMarked ? 'Marked' : 'Mark for Review'}
        </button>

        <button className="btn btn--primary qp__nav-btn" onClick={onNext} disabled={isLast} aria-label="Next question">
          Next <ArrowRightIcon />
        </button>
      </div>

      <p className="qp__kbd-hint" aria-hidden="true">
        <kbd>1</kbd>–<kbd>4</kbd> to select &nbsp;·&nbsp; <kbd>←</kbd> <kbd>→</kbd> to navigate
      </p>
    </div>
  );
}

/* ─── OptionButton (unchanged from M5) ────────────────────────────────────*/

function OptionButton({ letter, text, selected, onClick }) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      className={`test-option${selected ? ' test-option--selected' : ''}`}
      onClick={onClick}
    >
      <span className="test-option__radio" aria-hidden="true">
        {selected ? <RadioFilledIcon /> : <RadioEmptyIcon />}
      </span>
      <span className="test-option__letter" aria-hidden="true">{letter}</span>
      <span className="test-option__text">{text}</span>
    </button>
  );
}

/* ─── QuestionNavigator (unchanged from M5) ───────────────────────────────*/

export function QuestionNavigator({ questions, currentIndex, answers, marked, onNavigate }) {
  const answeredCount = Object.keys(answers).length;
  const markedCount   = marked.size;

  return (
    <div className="qnav">
      <p className="qnav__heading">Questions</p>

      <div className="qnav__grid">
        {questions.map((q, idx) => {
          const isAnswered = !!answers[q.id];
          const isMarkedQ  = marked.has(q.id);
          const isCurrent  = idx === currentIndex;

          const classes = [
            'qnav-btn',
            isAnswered ? 'qnav-btn--answered' : '',
            isMarkedQ  ? 'qnav-btn--marked'   : '',
            isCurrent  ? 'qnav-btn--current'  : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={q.id}
              className={classes}
              onClick={() => onNavigate(idx)}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={[
                `Question ${idx + 1}`,
                isAnswered ? 'answered'          : 'not answered',
                isMarkedQ  ? 'marked for review' : '',
              ].filter(Boolean).join(', ')}
            >
              {idx + 1}
              {isMarkedQ && <span className="qnav-btn__flag" aria-hidden="true">⚑</span>}
            </button>
          );
        })}
      </div>

      <div className="qnav__legend">
        <div className="qnav__legend-item">
          <span className="qnav__legend-swatch qnav__legend-swatch--answered" aria-hidden="true" />
          Answered ({answeredCount})
        </div>
        <div className="qnav__legend-item">
          <span className="qnav__legend-swatch" aria-hidden="true" />
          Not answered ({questions.length - answeredCount})
        </div>
        {markedCount > 0 && (
          <div className="qnav__legend-item">
            <span className="qnav__legend-swatch qnav__legend-swatch--marked" aria-hidden="true" />
            Marked ({markedCount})
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SubmitModal (unchanged from M5) ─────────────────────────────────────*/

export function SubmitModal({ total, answered, markedCount, onConfirm, onCancel }) {
  const unanswered = total - answered;
  const trapRef = useFocusTrap(true, onCancel); // handles Tab-cycling AND Escape

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      ref={trapRef}
      className="tmodal-backdrop"
      onClick={e => e.target === e.currentTarget && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
    >

      <div className="tmodal-card">
        <h2 className="tmodal-title" id="submit-modal-title">Submit Test?</h2>
        <p className="tmodal-subtitle">Review your progress before submitting.</p>

        <div className="tmodal-stats">
          <div className="tmodal-stat tmodal-stat--answered">
            <span className="tmodal-stat__value">{answered}</span>
            <span className="tmodal-stat__label">{answered === 1 ? 'question' : 'questions'} answered</span>
          </div>
          {unanswered > 0 && (
            <div className="tmodal-stat tmodal-stat--unanswered">
              <span className="tmodal-stat__value">{unanswered}</span>
              <span className="tmodal-stat__label">{unanswered === 1 ? 'question' : 'questions'} unanswered</span>
            </div>
          )}
          {markedCount > 0 && (
            <div className="tmodal-stat tmodal-stat--marked">
              <span className="tmodal-stat__value">{markedCount}</span>
              <span className="tmodal-stat__label">marked for review</span>
            </div>
          )}
        </div>

        {unanswered > 0 && (
          <p className="tmodal-warning">
            <WarningIcon />
            Unanswered questions will be counted as unattempted.
          </p>
        )}

        <div className="tmodal-actions">
          <button className="btn btn--ghost" onClick={onCancel}>Keep going</button>
          <button className="btn btn--primary" onClick={onConfirm}>Submit Test <CheckIcon /></button>
        </div>
      </div>
    </div>
  );
}

/* ─── SubmittingOverlay — REPLACES M9's TimeUpModal ───────────────────────
   Now covers both real submission paths: the countdown hitting zero
   (autoSubmitted=true), and a manual confirm (autoSubmitted=false) — both
   now involve genuine network round-trips (submit + re-fetch), so both get
   a brief, honest "this is happening" overlay instead of an instant jump.
────────────────────────────────────────────────────────────────────────────── */

function SubmittingOverlay({ autoSubmitted }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="tmodal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="submitting-title">
      <div className="tmodal-card tmodal-card--timeup">
        <span className="tmodal-timeup-icon" aria-hidden="true">
          {autoSubmitted ? <AlarmIcon /> : <SpinnerIcon />}
        </span>
        <h2 className="tmodal-title" id="submitting-title">
          {autoSubmitted ? "Time's Up!" : 'Submitting Your Test'}
        </h2>
        <p className="tmodal-subtitle">
          {autoSubmitted
            ? 'Your test is being submitted automatically…'
            : 'Just a moment while we save your results…'}
        </p>
        <span className="tmodal-spinner" aria-hidden="true"><SpinnerIcon /></span>
      </div>
    </div>
  );
}

/* ─── SVG Icons ────────────────────────────────────────────────────────────*/

function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 5.5V8l1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 1.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function TimerBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="22" r="15" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 14v8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 4h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M20 4v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function AlarmIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 5.5V8h2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2.5 2.5L4 4M11.5 2.5L10 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ErrorBigIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 12v10M20 26v1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M12 7.5H3M6.5 4L3 7.5l3.5 3.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3 7.5h9M8.5 4l3.5 3.5L8.5 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 1.5v11M2.5 2.5h8l-2 3 2 3H2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FlagFilledIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 1.5v11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2.5 2.5h8l-2 3 2 3H2.5V2.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function RadioEmptyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="7.25" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function RadioFilledIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="7.25" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8.5" cy="8.5" r="4"   fill="currentColor"/>
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7 1.5L13 12H1L7 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M7 5.5v3M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 4.5V5M7 6.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="test-spinner" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="2.2" strokeOpacity="0.25"/>
      <path d="M17.5 10a7.5 7.5 0 00-7.5-7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

// No longer needed after using ThemeToggle component fom ThemeToggle.jsx

// function SunIcon() {
//   return (
//     <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
//       <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.5"/>
//       <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M11.54 4.46l1.06-1.06M3.4 12.6l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
//     </svg>
//   );
// }

// function MoonIcon() {
//   return (
//     <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
//       <path d="M13.5 10.5A6.5 6.5 0 015.5 2.5a6.5 6.5 0 100 11 6.5 6.5 0 008-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
//     </svg>
//   );
// }
