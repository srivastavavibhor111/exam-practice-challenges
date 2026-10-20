import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { validateAll, hasAnyBlockingErrors, countQuestionsWithIssues } from '../../utils/validation';
// Below line is no longer required after M28 amendment
// import * as testService from '../../services/testService';
import './Review.css';

/* ─── Review ──────────────────────────────────────────────────────────────────
   M4 UI, M10 wiring — Review now receives already-extracted questions
   directly from CreateTest (M9's real extraction already ran there), and
   "Create Test" persists everything for real via testService.

   Receives from CreateTest:
     location.state = { method, content, sourceUrl?, questions }

   What changed from M4:
     - No more simulated 1.2s loading skeleton — the real extraction delay
       already happened on the Create Test page, before navigation.
     - No more SAMPLE_QUESTIONS fallback for link mode — real link
       extraction either succeeds (and lands here with real questions) or
       fails clearly on the Create Test page (and never reaches Review).
     - Added a test title field — M8's Test schema requires one.
     - "Create Test" now actually saves: Source → Questions → Test, in that
       order (see testService.js), then navigates to /test/preview with the
       real, persisted question set.
   Everything else — editing, validation, add/delete, issue badges — is
   completely unchanged from M4.
────────────────────────────────────────────────────────────────────────────── */

function generateId() {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

function blankQuestion() {
  return {
    id:            generateId(),
    text:          '',
    options:       { A: '', B: '', C: '', D: '' },
    correctAnswer: null,
    explanation:   '',
  };
}

function defaultTitle() {
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `Practice Test — ${date}`;
}

/* ─── Page component ─────────────────────────────────────────────────────────*/

export default function Review() {
  const location = useLocation();
  const navigate  = useNavigate();

  const { method, content, sourceUrl, questions: incomingQuestions, scoring: incomingScoring, mode } = location.state || {};

  // Redirect if arrived without real extracted questions (e.g. direct URL visit).
  useEffect(() => {
    if (!incomingQuestions?.length) navigate('/create', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [questions, setQuestions] = useState(incomingQuestions || []);
  const [title,     setTitle]     = useState(defaultTitle());
  // Below lines are not required after M28 Amendment
  // const [isSaving,  setIsSaving]  = useState(false);
  // const [saveError, setSaveError] = useState(null);

  // ── Validation (recalculated whenever questions change) ────────────────────
  const issueMap = useMemo(() => validateAll(questions), [questions]);
  const blockingErrors  = hasAnyBlockingErrors(issueMap);
  const questionsWithIssues = countQuestionsWithIssues(issueMap);

  // ── CRUD operations (unchanged from M4) ────────────────────────────────────

  function updateField(id, field, value) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateOption(id, letter, value) {
    setQuestions(qs =>
      qs.map(q => q.id === id
        ? { ...q, options: { ...q.options, [letter]: value } }
        : q
      )
    );
  }

  function setCorrectAnswer(id, letter) {
    setQuestions(qs => qs.map(q =>
      q.id === id ? { ...q, correctAnswer: letter } : q
    ));
  }

  function deleteQuestion(id) {
    setQuestions(qs => qs.filter(q => q.id !== id));
  }

  function addQuestion() {
    const blank = blankQuestion();
    setQuestions(qs => [...qs, blank]);
    setTimeout(() => {
      document.getElementById(`qcard-${blank.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }

  // ── Create Test — now actually persists everything ─────────────────────────
  // async function handleCreateTest() {
  //   setSaveError(null);
  //   setIsSaving(true);

  //   try {
  //     const savedTest = await testService.createSourceAndTest({
  //       method,
  //       rawContent: content,
  //       sourceUrl,
  //       questions,
  //       title: title.trim() || defaultTitle(),
  //     });

  //     // Same navigation contract Test.jsx has expected since M5 — only the
  //     // source of the questions changed, from local state to a real,
  //     // persisted test.
  //     // Below line is no longer used after M12
  //     // navigate('/test/preview', { state: { questions: savedTest.questions } });
  //     navigate(`/test/${savedTest.id}`);
  //   } catch (err) {
  //     setIsSaving(false);
  //     // Deliberately does NOT clear `questions` or navigate away — the
  //     // user's edits stay exactly as they were, and they can just retry.
  //     setSaveError(err.message || 'Something went wrong while saving your test. Please try again.');
  //   }
  // }

  // M28 Amendment removes above async function with following handleContinue

  function handleContinue() {
    // Persistence no longer happens here — Review's job is purely
    // editing and validating. The actual Test document (including its
    // scoring configuration) is only created once the Scoring Rules
    // step completes, right before test-taking begins.
    navigate('/create/scoring', {
      state: {
        method,
        content,
        sourceUrl,
        questions,
        title: title.trim() || defaultTitle(),
        scoring: incomingScoring, // forwards previously-entered values if the user came back here from Scoring Rules; undefined on a normal first pass, which Scoring Rules' own defaults handle correctly
        mode, // forwarded straight through — Review has no shared-specific UI of its own
      },
    });
  }


  if (!incomingQuestions?.length) return null;

  return (
    <main className="page-wrapper">
      <div className="review">

        {/* ── Top bar: back link + CTA ── */}
        <div className="rv-topbar">
          <Link to="/create" className="rv-back-link">
            <ArrowLeftIcon />
            Back to Create
          </Link>

          {/* Below block is no longer required */}
          {/* {questions.length > 0 && (
            <button
              className="btn btn--primary"
              onClick={handleCreateTest}
              disabled={blockingErrors || isSaving}
            >
              {isSaving ? (
                <><SpinnerIcon /> Saving…</>
              ) : (
                <>Create Test · {questions.length} <ArrowRightIcon /></>
              )}
            </button>
          )} */}

         {questions.length > 0 && (
          <button
            className="btn btn--primary"
            onClick={handleContinue}
            disabled={blockingErrors}
          >
            Continue · {questions.length} <ArrowRightIcon />
          </button>
        )}
 
        </div>

        {/* ── Page title ── */}
        <header className="rv-header">
          <h1 className="rv-title">Review Extracted Questions</h1>
          <p className="rv-subtitle">
            {buildSubtitle(questions.length, questionsWithIssues)}
          </p>
        </header>

        {/* ── Test title input ── */}
        <div className="rv-title-field">
          <label className="rv-title-label" htmlFor="rv-test-title">Test title</label>
          <input
            id="rv-test-title"
            type="text"
            className="rv-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Give your test a name…"
            maxLength={200}
          />
        </div>

        {/* Following block is no longer required After M28 Amendment */}
        {/* ── Save error banner ──
        {saveError && (
          <div className="rv-banner rv-banner--warning" role="alert">
            <WarningIcon />
            <p><strong>Couldn't save your test.</strong> {saveError} Your edits are safe — try again.</p>
          </div>
        )} */}

        {/* ── Extraction status banner ── */}
        {/* {!saveError && ( */}
        <ExtractionBanner
          questionCount={questions.length}
          issueCount={questionsWithIssues}
        />
        {/* )} */}

        {/* ── Question list ── */}
        {questions.length === 0
          ? <EmptyState onAdd={addQuestion} />
          : (
            <ol className="rv-question-list">
              {questions.map((q, idx) => (
                <li key={q.id} id={`qcard-${q.id}`}>
                  <QuestionCard
                    question={q}
                    index={idx}
                    issues={issueMap.get(q.id) || []}
                    onUpdateField={(field, val)  => updateField(q.id, field, val)}
                    onUpdateOption={(letter, val) => updateOption(q.id, letter, val)}
                    onSetCorrect={(letter)        => setCorrectAnswer(q.id, letter)}
                    onDelete={()                  => deleteQuestion(q.id)}
                  />
                </li>
              ))}
            </ol>
          )
        }

        {/* Add question */}
        <button className="rv-add-btn" type="button" onClick={addQuestion}>
          <PlusIcon />
          Add a question
        </button>

        {/* Bottom CTA */}


        {/* Below block is replaced in M28 Amendment */}
        {/* {questions.length > 0 && (
          <div className="rv-footer-cta">
            <button
              className="btn btn--primary btn--lg"
              onClick={handleCreateTest}
              disabled={blockingErrors || isSaving}
            >
              {isSaving ? (
                <><SpinnerIcon /> Saving your test…</>
              ) : (
                <>Create Test · {questions.length} questions <ArrowRightIcon /></>
              )}
            </button>
            {blockingErrors && !isSaving && (
              <p className="rv-footer-error">
                <ErrorIcon />
                Fix the errors above before creating your test.
              </p>
            )}
          </div>
        )} */}

        {questions.length > 0 && (
          <div className="rv-footer-cta">
            <button
              className="btn btn--primary btn--lg"
              onClick={handleContinue}
              disabled={blockingErrors}
            >
              Continue to Scoring Rules · {questions.length} questions <ArrowRightIcon />
            </button>
            {blockingErrors && (
              <p className="rv-footer-error">
                <ErrorIcon />
                Fix the errors above before continuing.
              </p>
            )}
          </div>
        )}


      </div>
    </main>
  );
}

/* ─── ExtractionBanner ────────────────────────────────────────────────────────*/

function ExtractionBanner({ questionCount, issueCount }) {
  if (questionCount === 0) return null;

  if (issueCount > 0) {
    return (
      <div className="rv-banner rv-banner--warning">
        <WarningIcon />
        <p>
          <strong>{issueCount} {issueCount === 1 ? 'question has' : 'questions have'} issues</strong>
          {' '}— review them below before creating your test.
        </p>
      </div>
    );
  }

  return (
    <div className="rv-banner rv-banner--success">
      <CheckIcon />
      <p>
        <strong>{questionCount} questions extracted</strong> — everything looks good.
        Edit anything below, then create your test.
      </p>
    </div>
  );
}

/* ─── LoadingSkeleton is no longer used — kept out entirely.
   The real extraction delay now happens on the Create Test page, before
   the user ever navigates here. Nothing to fake-wait for anymore. ── */

/* ─── EmptyState ──────────────────────────────────────────────────────────────*/

function EmptyState({ onAdd }) {
  return (
    <div className="rv-empty">
      <p className="rv-empty__title">No questions yet</p>
      <p className="rv-empty__body">Add a question manually to get started.</p>
      <button className="btn btn--primary" onClick={onAdd}>
        <PlusIcon /> Add a question
      </button>
    </div>
  );
}

/* ─── QuestionCard (unchanged from M4) ────────────────────────────────────────*/

function QuestionCard({ question, index, issues, onUpdateField, onUpdateOption, onSetCorrect, onDelete }) {
  const [showExplanation, setShowExplanation] = useState(!!question.explanation);

  const errors   = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const hasError = errors.length > 0;
  const hasWarn  = warnings.length > 0 && !hasError;

  const cardClass = [
    'qcard',
    hasError ? 'qcard--error'   : '',
    hasWarn  ? 'qcard--warning' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>

      <div className="qcard__header">
        <div className="qcard__header-left">
          <span className="qcard__num">Q{index + 1}</span>

          {hasError && (
            <span className="qcard__badge qcard__badge--error">
              <ErrorIcon />
              {errors.length} {errors.length === 1 ? 'error' : 'errors'}
            </span>
          )}
          {hasWarn && (
            <span className="qcard__badge qcard__badge--warning">
              <WarningIcon />
              {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
            </span>
          )}
        </div>

        <button
          className="qcard__delete-btn"
          type="button"
          onClick={onDelete}
          aria-label={`Delete question ${index + 1}`}
        >
          <TrashIcon />
          <span>Delete</span>
        </button>
      </div>

      {issues.length > 0 && (
        <ul className="qcard__issues">
          {issues.map((issue, i) => (
            <li key={i} className={`qcard__issue qcard__issue--${issue.type}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="qcard__section">
        <label className="qcard__label" htmlFor={`qt-${question.id}`}>
          Question
        </label>
        <AutoResizeTextarea
          id={`qt-${question.id}`}
          className={`qcard__question-input${!question.text.trim() ? ' qcard__input--empty' : ''}`}
          value={question.text}
          onChange={e => onUpdateField('text', e.target.value)}
          placeholder="Enter the question text…"
        />
      </div>

      <div className="qcard__section">
        <div className="qcard__options-header">
          <span className="qcard__label">Options</span>
          <span className="qcard__options-hint">
            Click <RadioHintIcon /> to mark the correct answer
          </span>
        </div>
        <div className="qcard__options">
          {['A', 'B', 'C', 'D'].map(letter => (
            <OptionRow
              key={letter}
              letter={letter}
              value={question.options[letter]}
              isCorrect={question.correctAnswer === letter}
              questionId={question.id}
              onChange={val  => onUpdateOption(letter, val)}
              onSetCorrect={() => onSetCorrect(letter)}
            />
          ))}
        </div>
      </div>

      <div className="qcard__section qcard__section--explanation">
        {showExplanation ? (
          <>
            <div className="qcard__explanation-header">
              <label className="qcard__label" htmlFor={`qe-${question.id}`}>
                Explanation <span className="qcard__label-optional">(optional)</span>
              </label>
              <button
                className="qcard__text-btn"
                type="button"
                onClick={() => { setShowExplanation(false); onUpdateField('explanation', ''); }}
              >
                Remove
              </button>
            </div>
            <AutoResizeTextarea
              id={`qe-${question.id}`}
              className="qcard__explanation-input"
              value={question.explanation}
              onChange={e => onUpdateField('explanation', e.target.value)}
              placeholder="Explain why the correct answer is right…"
            />
          </>
        ) : (
          <button
            className="qcard__text-btn qcard__text-btn--add"
            type="button"
            onClick={() => setShowExplanation(true)}
          >
            <PlusSmIcon /> Add explanation
          </button>
        )}
      </div>

    </div>
  );
}

/* ─── OptionRow (unchanged from M4) ───────────────────────────────────────────*/

function OptionRow({ letter, value, isCorrect, questionId, onChange, onSetCorrect }) {
  return (
    <div className={`option-row${isCorrect ? ' option-row--correct' : ''}`}>
      <label className="option-row__radio-label" title="Mark as correct answer">
        <input
          type="radio"
          name={`answer-${questionId}`}
          value={letter}
          checked={isCorrect}
          onChange={onSetCorrect}
          className="option-row__radio-input"
        />
        <span className="option-row__radio-visual" aria-hidden="true">
          {isCorrect && <span className="option-row__radio-dot" />}
        </span>
      </label>

      <span className="option-row__letter">{letter}</span>

      <input
        type="text"
        className="option-row__text-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Option ${letter}…`}
        aria-label={`Option ${letter}`}
      />
    </div>
  );
}

/* ─── AutoResizeTextarea (unchanged from M4) ──────────────────────────────────*/

function AutoResizeTextarea({ value, onChange, className, ...props }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      rows={2}
      {...props}
    />
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────────*/

function buildSubtitle(count, issueCount) {
  if (count === 0) {
    return 'No questions found. Add one manually below.';
  }
  if (issueCount === 0) {
    return `${count} ${count === 1 ? 'question' : 'questions'} extracted — all look good.`;
  }
  return `${count} ${count === 1 ? 'question' : 'questions'} extracted — ${issueCount} ${issueCount === 1 ? 'has' : 'have'} issues.`;
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────────*/

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
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

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
    </svg>
  );
}

function PlusSmIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M6.5 2.5v8M2.5 6.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M11.5 3.5l-.75 8a.5.5 0 01-.5.5H3.75a.5.5 0 01-.5-.5L2.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6.5 3.5V7M6.5 9v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6.5 1.5L12 11H1L6.5 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6.5 5v2.5M6.5 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 5v.5M7.5 7v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function RadioHintIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ display:'inline', verticalAlign:'middle', margin:'0 1px' }}>
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="6" cy="6" r="2.5" fill="currentColor"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="rv-spinner" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/>
      <path d="M13.5 7.5a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
