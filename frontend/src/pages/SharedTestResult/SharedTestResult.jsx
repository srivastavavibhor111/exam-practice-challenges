import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { calculateResult, formatDuration } from '../../utils/scoring';
import { ResultHero, StatGrid, ReviewCard } from '../Result/Result';
import * as sharedTestService from '../../services/sharedTestService';
import '../Result/Result.css';
import './SharedTestResult.css';

/* ─── SharedTestResult — reuses the REAL Result.jsx sub-components ──────────
   ResultHero, StatGrid, and ReviewCard are the exact same components
   personal results use — genuinely reused, not recreated. This page
   supplies its own data-fetching (against SharedAttempt, not personal
   Attempt) and its own filter-tab orchestration, matching the same
   pattern Result.jsx itself uses internally.

   No "legacy fallback" path here (unlike personal Result.jsx's M12
   graceful-degradation route) — a shared attempt result is always
   fetched fresh by its real ID; there's no equivalent scenario where
   this page would need to fall back to router-state-only data.

   KNOWN GAP, FLAGGED HONESTLY: "Generate Explanation" (M16) has no
   backend support for Shared Test questions yet — there's no equivalent
   of questionService.explainQuestion() for embedded shared questions.
   Clicking it here shows a clear "not yet available" message via
   ReviewCard's own existing error-display path, rather than crashing.
────────────────────────────────────────────────────────────────────────────── */

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'correct',     label: 'Correct' },
  { key: 'incorrect',   label: 'Incorrect' },
  { key: 'unattempted', label: 'Unattempted' },
  { key: 'marked',      label: 'Marked' },
];

export default function SharedTestResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [status,   setStatus]   = useState('loading');
  const [error,    setError]    = useState('');
  const [attempt,  setAttempt]  = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fetchedAttempt, allBookmarks] = await Promise.all([
          sharedTestService.getSharedAttempt(attemptId),
          sharedTestService.getSharedBookmarks(),
        ]);
        if (cancelled) return;
        if (!fetchedAttempt.results) {
          setError("This Shared Test attempt hasn't been completed yet.");
          setStatus('error');
          return;
        }
        setAttempt(fetchedAttempt);
        setBookmarkedIds(new Set(
          allBookmarks
            .filter(b => b.sharedTestId === fetchedAttempt.sharedTestId)
            .map(b => b.id)
        ));
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'This result could not be found.');
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  const result = useMemo(() => {
    if (!attempt) return null;
    const clientComputed = calculateResult(attempt.questions, attempt.answers, attempt.timeSpentSeconds, attempt.results?.scoringRules);
    return { ...clientComputed, ...attempt.results, breakdown: clientComputed.breakdown };
  }, [attempt]);

  const markedSet = useMemo(() => new Set(attempt?.markedForReview || []), [attempt]);

  async function handleToggleBookmark(questionId) {
    const wasBookmarked = bookmarkedIds.has(questionId);
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      wasBookmarked ? next.delete(questionId) : next.add(questionId);
      return next;
    });
    try {
      await sharedTestService.toggleSharedBookmark(attempt.sharedTestObjectId, questionId, !wasBookmarked);
    } catch (err) {
      console.warn('Could not save bookmark — reverting.', err);
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        wasBookmarked ? next.add(questionId) : next.delete(questionId);
        return next;
      });
    }
  }

  async function handleGenerateExplanation() {
    // No backend endpoint exists yet for AI-explaining a Shared Test
    // question — see file header. ReviewCard's own try/catch (M16)
    // displays this as an inline error rather than crashing.
    throw new Error('AI-generated explanations are not yet available for Shared Test questions.');
  }

  if (status === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="rs-load-wrap">
          <span className="rs-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="rs-load-text">Loading your Shared Test result…</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="page-wrapper">
        <div className="rs-load-wrap">
          <span className="rs-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="rs-load-title">Couldn't load this result</h1>
          <p className="rs-load-text">{error}</p>
          <Link to="/shared-tests" className="btn btn--primary">Back to Shared Tests</Link>
        </div>
      </main>
    );
  }

  const filteredBreakdown = result.breakdown.filter(q => {
    if (filter === 'all') return true;
    if (filter === 'marked') return markedSet.has(q.id);
    return q.status === filter;
  });

  const availableFilters = FILTERS.filter(f => {
    if (f.key === 'all') return true;
    if (f.key === 'marked') return markedSet.size > 0;
    const countForKey = { correct: result.correct, incorrect: result.incorrect, unattempted: result.unattempted }[f.key];
    return countForKey > 0;
  });

  return (
    <main className="page-wrapper">
      <div className="result">

        <div className="rs-topbar">
          <Link to="/shared-tests" className="rs-back-link">
            <ArrowLeftIcon /> Back to Shared Tests
          </Link>
          <div className="rs-topbar__actions">
            <span className="shared-result-test-id">{attempt.sharedTestId}</span>
          </div>
        </div>

        {result.rawScore !== undefined && (
          <p className="shared-result-marks">
            <strong>{result.rawScore}</strong> out of <strong>{result.maxPossibleScore}</strong> marks
            {' '}under this Shared Test's scoring rules.
          </p>
        )}

        <ResultHero result={result} duration={attempt.durationSeconds} />

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
                    onGenerateExplanation={handleGenerateExplanation}
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
          <Link to="/shared-tests" className="btn btn--ghost">Back to Shared Tests</Link>
          <button className="btn btn--primary btn--sm" onClick={() => navigate(`/shared-tests/details/${attempt.sharedTestId}`)}>
            Test details &amp; reattempt
          </button>
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
function SpinnerIcon() {
  return (
    <svg className="rs-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
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
