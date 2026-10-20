import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { calculateResult, formatDuration } from '../../utils/scoring';
import * as resultService from '../../services/resultService';
import * as practiceService from '../../services/practiceService';
import * as aiEnhancementsService from '../../services/aiEnhancementsService';
import './Result.css';

/* ─── Result — M13 data-fetching, M15 bookmarks, M16 AI explanations ────────
   NEW in M16: any review card missing an explanation now shows a
   "Generate Explanation" button, calling the AI (via aiEnhancementsService,
   an explicit click — never automatic) and persisting the result so it
   isn't regenerated on every future view of this question.

   Everything about data-fetching (M13) and bookmarking (M15) is unchanged.
────────────────────────────────────────────────────────────────────────────── */

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'correct',     label: 'Correct' },
  { key: 'incorrect',   label: 'Incorrect' },
  { key: 'unattempted', label: 'Unattempted' },
  { key: 'marked',      label: 'Marked' },
];

function scoreMessage(pct) {
  if (pct >= 90) return 'Excellent work!';
  if (pct >= 75) return 'Great job!';
  if (pct >= 50) return 'Good effort!';
  if (pct >= 25) return 'Keep practicing!';
  return 'Room to grow — try again.';
}

export default function Result() {
  const { attemptId } = useParams();
  const location = useLocation();
  const navigate  = useNavigate();

  const hasAttemptId = !!attemptId;

  const [status,     setStatus]     = useState(hasAttemptId ? 'loading' : 'ready');
  const [loadError,  setLoadError]  = useState('');
  const [remoteData, setRemoteData] = useState(null);

  useEffect(() => {
    if (!hasAttemptId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await resultService.getAttemptResult(attemptId);
        if (cancelled) return;
        if (!data.serverResults) {
          setLoadError("This attempt hasn't been completed yet.");
          setStatus('load-error');
          return;
        }
        setRemoteData(data);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'This result could not be found.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId, hasAttemptId]);

  useEffect(() => {
    if (!hasAttemptId && !location.state) navigate('/create', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filter, setFilter] = useState('all');

  if (hasAttemptId && status === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="rs-load-wrap">
          <span className="rs-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="rs-load-text">Loading your result…</p>
        </div>
      </main>
    );
  }

  if (hasAttemptId && status === 'load-error') {
    return (
      <main className="page-wrapper">
        <div className="rs-load-wrap">
          <span className="rs-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="rs-load-title">Couldn't load this result</h1>
          <p className="rs-load-text">{loadError}</p>
          <Link to="/" className="btn btn--primary">Back to Home</Link>
        </div>
      </main>
    );
  }

  if (!hasAttemptId && !location.state) return null;

  // Updated in M28 Amendment
  // const data = hasAttemptId ? remoteData : location.state;
  // const { questions, answers, marked, timeSpent, duration, testId } = data;
  const data = hasAttemptId ? remoteData : location.state;
  const { questions, answers, marked, timeSpent, duration, testId, scoring } = data;



  return (
    <ResultContent
      questions={questions}
      answers={answers}
      marked={marked}
      timeSpent={timeSpent}
      duration={duration}
      testId={testId}
      scoring={scoring}
      hasAttemptId={hasAttemptId}
      remoteData={remoteData}
      filter={filter}
      setFilter={setFilter}
      navigate={navigate}
    />
  );
}

/* ─── ResultContent ───────────────────────────────────────────────────────*/

function ResultContent({ questions, answers, marked, timeSpent, duration, testId, scoring, hasAttemptId, remoteData, filter, setFilter, navigate }) {
  const markedSet = useMemo(() => new Set(marked || []), [marked]);

  const [bookmarkedIds, setBookmarkedIds] = useState(
    () => new Set(questions.filter(q => q.bookmarked).map(q => q.id))
  );

  // NEW in M16 — locally overrides a question's explanation once generated,
  // so the card updates immediately without a full data refetch.
  const [explanationOverrides, setExplanationOverrides] = useState({});

  async function handleToggleBookmark(questionId) {
    const wasBookmarked = bookmarkedIds.has(questionId);
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      wasBookmarked ? next.delete(questionId) : next.add(questionId);
      return next;
    });
    try {
      await practiceService.toggleBookmark(questionId, !wasBookmarked);
    } catch (err) {
      console.warn('Could not save bookmark — reverting.', err);
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        wasBookmarked ? next.add(questionId) : next.delete(questionId);
        return next;
      });
    }
  }

  async function handleGenerateExplanation(questionId) {
    try {
      const explanation = await aiEnhancementsService.explainQuestion(questionId);
      setExplanationOverrides(prev => ({ ...prev, [questionId]: explanation }));
    } catch (err) {
      throw err; // re-thrown so the calling ReviewCard can show its own inline error
    }
  }

  const result = useMemo(() => {
    const clientComputed = calculateResult(questions, answers || {}, timeSpent || 0, scoring);
    const merged = (hasAttemptId && remoteData?.serverResults)
      ? { ...clientComputed, ...remoteData.serverResults, breakdown: clientComputed.breakdown }
      : clientComputed;

    // Apply any AI-generated explanations to the breakdown used for display.
    merged.breakdown = merged.breakdown.map(q =>
      explanationOverrides[q.id] !== undefined
        ? { ...q, explanation: explanationOverrides[q.id] }
        : q
    );
    return merged;
  }, [questions, answers, timeSpent, hasAttemptId, remoteData, explanationOverrides]);

  const filteredBreakdown = result.breakdown.filter(q => {
    if (filter === 'all')  return true;
    if (filter === 'marked') return markedSet.has(q.id);
    return q.status === filter;
  });

  const availableFilters = FILTERS.filter(f => {
    if (f.key === 'all') return true;
    if (f.key === 'marked') return markedSet.size > 0;
    const countForKey = { correct: result.correct, incorrect: result.incorrect, unattempted: result.unattempted }[f.key];
    return countForKey > 0;
  });

  function handleRetake() {
    if (testId) {
      navigate(`/test/${testId}`);
    } else {
      navigate('/create');
    }
  }

  function handleNewTest() {
    navigate('/create');
  }

  return (
    <main className="page-wrapper">
      <div className="result">

        <div className="rs-topbar">
          <Link to="/" className="rs-back-link">
            <ArrowLeftIcon /> Back to Home
          </Link>
          <div className="rs-topbar__actions">
            <button className="btn btn--primary btn--sm" onClick={handleNewTest}>
              New Test
            </button>
            <button className="btn btn--primary" onClick={handleRetake}>
              <RetakeIcon /> Retake Test
            </button>
          </div>
        </div>

        <ResultHero result={result} duration={duration} />

        <StatGrid result={result} />

        <section className="rs-review" aria-label="Question review">
          <div className="rs-review__header">
            <h2 className="rs-review__title">Question Review</h2>
            <div className="rs-filter-tabs" role="tablist" aria-label="Filter questions">
              {availableFilters.map(f => {
                const count = f.key === 'all' ? result.totalQuestions
                  : f.key === 'marked' ? markedSet.size
                  : { correct: result.correct, incorrect: result.incorrect, unattempted: result.unattempted }[f.key];
                return (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={filter === f.key}
                    className={`rs-filter-tab${filter === f.key ? ' rs-filter-tab--active' : ''}`}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label} <span className="rs-filter-tab__count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <ol className="rs-review-list">
            {filteredBreakdown.map((q) => {
              const originalIndex = result.breakdown.findIndex(bq => bq.id === q.id);
              return (
                <li key={q.id}>
                  <ReviewCard
                    question={q}
                    index={originalIndex}
                    isMarked={markedSet.has(q.id)}
                    isBookmarked={bookmarkedIds.has(q.id)}
                    onToggleBookmark={() => handleToggleBookmark(q.id)}
                    onGenerateExplanation={() => handleGenerateExplanation(q.id)}
                  />
                </li>
              );
            })}
          </ol>

          {filteredBreakdown.length === 0 && (
            <div className="rs-empty-filter">
              <p>No questions match this filter.</p>
            </div>
          )}
        </section>

        <div className="rs-footer-actions">
          <button className="btn btn--primary" onClick={handleNewTest}>
            New Test
          </button>
          <button className="btn btn--primary " onClick={handleRetake}>
            <RetakeIcon /> Retake This Test
          </button>
        </div>

      </div>
    </main>
  );
}

/* ─── ResultHero (unchanged from M6) ──────────────────────────────────────*/

export function ResultHero({ result, duration }) {
  return (
    <div className="rs-hero">
      <div className="rs-hero__chart-wrap">
        <ScoreDonut
          correct={result.correct}
          incorrect={result.incorrect}
          unattempted={result.unattempted}
          ungraded={result.ungraded}
        />
        <div className="rs-hero__chart-center">
          <span className="rs-hero__percentage">{result.percentage}%</span>
          <span className="rs-hero__percentage-label">Score</span>
        </div>
      </div>

      <div className="rs-hero__summary">
        <h1 className="rs-hero__title">{scoreMessage(result.percentage)}</h1>
        <p className="rs-hero__sub">
          You scored <strong>{result.correct}</strong> out of{' '}
          <strong>{result.gradedCount}</strong> graded {result.gradedCount === 1 ? 'question' : 'questions'}.
          {result.ungraded > 0 && (
            <> {result.ungraded} {result.ungraded === 1 ? 'question was' : 'questions were'} excluded — no
            correct answer had been set for {result.ungraded === 1 ? 'it' : 'them'}.</>
          )}
        </p>

        {result.rawScore !== undefined && (
          <p className="rs-hero__marks">
            <strong>{result.rawScore}</strong> out of <strong>{result.maxPossibleScore}</strong> marks
            {' '}under this test's scoring rules.
          </p>
        )}


        <div className="rs-hero__meta">
          <span className="rs-hero__meta-item">
            <ClockIcon />
            {formatDuration(result.timeSpent)}
            {duration ? <span className="rs-hero__meta-sub"> of {formatDuration(duration)}</span> : null}
          </span>
          <span className="rs-hero__meta-item">
            <TargetIcon />
            {result.accuracy}% accuracy
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── ScoreDonut (unchanged from M6) ──────────────────────────────────────*/

export function ScoreDonut({ correct, incorrect, unattempted, ungraded, size = 176, strokeWidth = 16 }) {
  const total = correct + incorrect + unattempted + ungraded;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: correct,     colorVar: 'var(--color-success, #059669)' },
    { value: incorrect,   colorVar: 'var(--color-error)' },
    { value: unattempted, colorVar: 'var(--color-border-strong)' },
    { value: ungraded,    colorVar: 'var(--color-text-subtle)' },
  ].filter(s => s.value > 0);

  let cumulative = 0;
  const label = `${correct} correct, ${incorrect} incorrect, ${unattempted} unattempted` +
    (ungraded > 0 ? `, ${ungraded} ungraded` : '') + ` out of ${total} questions`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth} />
      {total > 0 && segments.map((seg, i) => {
        const fraction = seg.value / total;
        const dash   = fraction * circumference;
        const gap    = circumference - dash;
        const offset = -cumulative;
        cumulative += dash;
        return (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={seg.colorVar}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}

/* ─── StatGrid (unchanged from M6) ────────────────────────────────────────*/

export function StatGrid({ result }) {
  const stats = [
    { key: 'correct',     label: 'Correct',      value: result.correct,     icon: <CheckIcon />,   variant: 'correct' },
    { key: 'incorrect',   label: 'Incorrect',    value: result.incorrect,   icon: <XIcon />,       variant: 'incorrect' },
    { key: 'unattempted', label: 'Unattempted',  value: result.unattempted, icon: <DashIcon />,    variant: 'unattempted' },
  ];

  if (result.ungraded > 0) {
    stats.push({ key: 'ungraded', label: 'Ungraded', value: result.ungraded, icon: <QuestionIcon />, variant: 'ungraded' });
  }

  stats.push(
    { key: 'accuracy', label: 'Accuracy',      value: `${result.accuracy}%`, icon: <TargetIcon />, variant: 'neutral' },
    { key: 'avgtime',  label: 'Avg. per Q',    value: formatDuration(result.avgTimePerQuestion), icon: <ClockIcon />, variant: 'neutral' },
  );

  return (
    <div className="rs-stat-grid">
      {stats.map(s => (
        <div key={s.key} className={`rs-stat-card rs-stat-card--${s.variant}`}>
          <span className="rs-stat-card__icon">{s.icon}</span>
          <span className="rs-stat-card__value">{s.value}</span>
          <span className="rs-stat-card__label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── StatusBadge (unchanged from M6) ─────────────────────────────────────*/

function StatusBadge({ status }) {
  const config = {
    correct:     { label: 'Correct',     icon: <CheckIcon />,    cls: 'rcard-badge--correct' },
    incorrect:   { label: 'Incorrect',   icon: <XIcon />,        cls: 'rcard-badge--incorrect' },
    unattempted: { label: 'Unattempted', icon: <DashIcon />,     cls: 'rcard-badge--unattempted' },
    ungraded:    { label: 'Ungraded',    icon: <QuestionIcon />, cls: 'rcard-badge--ungraded' },
  }[status];

  return (
    <span className={`rcard-badge ${config.cls}`}>
      {config.icon} {config.label}
    </span>
  );
}

/* ─── ReviewCard — UPDATED FOR M16: "Generate Explanation" added ─────────*/

export function ReviewCard({ question, index, isMarked, isBookmarked, onToggleBookmark, onGenerateExplanation }) {
  const visibleOptions = ['A', 'B', 'C', 'D'].filter(l => question.options[l]?.trim());

  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  async function handleGenerateClick() {
    setIsGenerating(true);
    setGenError('');
    try {
      await onGenerateExplanation();
    } catch (err) {
      setGenError(err.message || 'Could not generate an explanation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className={`rcard rcard--${question.status}`}>

      <div className="rcard__header">
        <div className="rcard__header-left">
          <span className="rcard__num">Q{index + 1}</span>
          <StatusBadge status={question.status} />
          {isMarked && (
            <span className="rcard__marked-tag">
              <FlagIcon /> Marked
            </span>
          )}
        </div>
        <button
          className={`rcard__bookmark-btn${isBookmarked ? ' rcard__bookmark-btn--active' : ''}`}
          onClick={onToggleBookmark}
          aria-pressed={isBookmarked}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}
        >
          {isBookmarked ? <BookmarkFilledIcon /> : <BookmarkIcon />}
        </button>
      </div>

      <p className="rcard__text">{question.text}</p>

      <div className="rcard__options">
        {visibleOptions.map(letter => {
          const isUser    = question.userAnswer === letter;
          const isCorrect = question.correctAnswer === letter;

          const cls = [
            'rcard-opt',
            isCorrect ? 'rcard-opt--correct' : '',
            isUser && !isCorrect ? 'rcard-opt--wrong' : '',
          ].filter(Boolean).join(' ');

          return (
            <div key={letter} className={cls}>
              <span className="rcard-opt__letter">{letter}</span>
              <span className="rcard-opt__text">{question.options[letter]}</span>

              <span className="rcard-opt__tags">
                {isUser && (
                  <span className="rcard-opt__tag rcard-opt__tag--user">
                    {isCorrect ? <CheckIcon /> : <XIcon />} Your answer
                  </span>
                )}
                {isCorrect && !isUser && (
                  <span className="rcard-opt__tag rcard-opt__tag--correct">
                    <CheckIcon /> Correct answer
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {question.status === 'unattempted' && (
        <p className="rcard__note">
          <InfoIcon /> You didn't answer this question.
        </p>
      )}

      {question.status === 'ungraded' && (
        <p className="rcard__note">
          <InfoIcon /> No correct answer was set for this question, so it wasn't scored.
        </p>
      )}

      {question.explanation ? (
        <div className="rcard__explanation">
          <p className="rcard__explanation-label">Explanation</p>
          <p className="rcard__explanation-text">{question.explanation}</p>
        </div>
      ) : question.correctAnswer && (
        <div className="rcard__explain-cta">
          {genError && (
            <p className="rcard__explain-error" role="alert"><InfoIcon /> {genError}</p>
          )}
          <button className="rcard__explain-btn" onClick={handleGenerateClick} disabled={isGenerating}>
            <SparkleIcon /> {isGenerating ? 'Generating…' : 'Generate Explanation'}
          </button>
        </div>
      )}

    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────*/

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function RetakeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M12.5 7.5a5 5 0 11-1.5-3.57" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      <path d="M12.5 2v3.5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 6.5l1.8 1.8L9.2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 6.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4.9 5a1.6 1.6 0 113 .7c-.3.5-1 .7-1.2 1.3-.1.2-.1.5-.1.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="6.5" cy="9.3" r="0.5" fill="currentColor"/>
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

function FlagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 1.5v11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M2.5 2.5h8l-2 3 2 3H2.5V2.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.5h8a.5.5 0 01.5.5v10.5l-4.5-3-4.5 3V3a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function BookmarkFilledIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.5h8a.5.5 0 01.5.5v10.5l-4.5-3-4.5 3V3a.5.5 0 01.5-.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1.5l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor"/>
      <path d="M11.5 8.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z" fill="currentColor"/>
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 4.5V7.5l2.2 2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6"   stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="7.5" cy="7.5" r="3"   stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="7.5" cy="7.5" r="0.75" fill="currentColor"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="rs-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25"/>
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
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
