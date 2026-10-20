import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as dashboardService from '../../services/dashboardService';
import * as practiceService from '../../services/practiceService';
import * as aiEnhancementsService from '../../services/aiEnhancementsService';
import './Dashboard.css';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/* ─── Dashboard — M14 base, M15 Practice Tools, M16 Weak Areas + AI Insights ──
   This file merges three milestones' worth of additions into one complete,
   ready-to-use version rather than layering a third patch on top of two
   previous ones.

   NEW IN M16:
     - Weak Areas: deterministic, code-computed topic accuracy (attemptService.
       getTopicPerformance, backend) — fetched automatically alongside
       everything else, since it costs nothing (no AI involved).
     - AI Insights: an explicit "Get My Insights" button — NOT auto-fetched
       on load, since every click is a real AI API call. The user decides
       when that's worth it, not the page.
────────────────────────────────────────────────────────────────────────────── */

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreVariant(pct) {
  if (pct >= 75) return 'good';
  if (pct >= 50) return 'ok';
  return 'low';
}

export default function Dashboard() {
  const { user } = useAuth();

  const [status,    setStatus]    = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [tests,     setTests]     = useState([]);
  const [attempts,  setAttempts]  = useState([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [mistakeCount,  setMistakeCount]  = useState(0);
  const [topics,        setTopics]        = useState([]); // M16 — weak areas

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);
  const [deleteError,  setDeleteError]  = useState('');

  // M16 — AI Insights, explicit-trigger only.
  const [insightsState, setInsightsState] = useState('idle'); // idle | loading | ready | error
  const [insightText,   setInsightText]   = useState('');
  const [insightsError, setInsightsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [testsData, attemptsData, bookmarksData, mistakesData, topicsData] = await Promise.all([
          dashboardService.getTests(),
          dashboardService.getAttempts(),
          practiceService.getBookmarked(),
          practiceService.getMistakes(),
          aiEnhancementsService.getTopicPerformance(), // deterministic, no AI cost — safe to auto-fetch
        ]);
        if (cancelled) return;
        setTests(testsData);
        setAttempts(attemptsData);
        setBookmarkCount(bookmarksData.length);
        setMistakeCount(mistakesData.length);
        setTopics(topicsData);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load your dashboard.');
        setStatus('load-error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => dashboardService.computeStats(tests, attempts), [tests, attempts]);

  const recentTests = tests.slice(0, 6);
  const recentAttempts = useMemo(() => (
    [...attempts]
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
      .slice(0, 8)
  ), [attempts]);

  const weakestTopics = useMemo(() => topics.slice(0, 5), [topics]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await dashboardService.deleteTest(deleteTarget.id);
      setTests(prev => prev.filter(t => t.id !== deleteTarget.id));
      setAttempts(prev => prev.filter(a => a.testId !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete this test. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleGetInsights() {
    setInsightsState('loading');
    setInsightsError('');
    try {
      const data = await aiEnhancementsService.getInsights();
      setInsightText(data.insight);
      setInsightsState('ready');
    } catch (err) {
      setInsightsError(err.message || 'Could not generate insights right now.');
      setInsightsState('error');
    }
  }

  if (status === 'loading') {
    return (
      <main className="page-wrapper">
        <div className="dash-load-wrap">
          <span className="dash-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="dash-load-text">Loading your dashboard…</p>
        </div>
      </main>
    );
  }

  if (status === 'load-error') {
    return (
      <main className="page-wrapper">
        <div className="dash-load-wrap">
          <span className="dash-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="dash-load-title">Couldn't load your dashboard</h1>
          <p className="dash-load-text">{loadError}</p>
          <Link to="/" className="btn btn--primary">Back to Home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrapper">
      <div className="dash">

        {/* ── Header ── */}
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
            <p className="dash-subtitle">Your personal practice workspace.</p>
          </div>
          <Link to="/create" className="btn btn--primary">
            <PlusIcon /> Create New Test
          </Link>
        </header>

        {/* ── Stat cards ── */}
        <div className="dash-stats">
          <StatCard icon={<TestIcon />}     label="Total Tests"          value={stats.totalTests} />
          <StatCard icon={<AttemptIcon />}  label="Total Attempts"       value={stats.totalAttempts} />
          <StatCard icon={<QuestionIcon />} label="Questions Practiced"  value={stats.totalQuestionsPracticed} />
          <StatCard icon={<TargetIcon />}   label="Average Score"        value={`${stats.averagePercentage}%`} />
        </div>

        {/* ── Practice Tools (M15) ── */}
        <section className="dash-section">
          <h2 className="dash-section__title">Practice Tools</h2>
          <div className="dash-practice-grid">
            <Link to="/bookmarks" className="dash-practice-card">
              <span className="dash-practice-card__icon"><BookmarkIcon /></span>
              <div>
                <p className="dash-practice-card__title">Bookmarked Questions</p>
                <p className="dash-practice-card__count">{bookmarkCount} saved</p>
              </div>
            </Link>
            <Link to="/mistakes" className="dash-practice-card">
              <span className="dash-practice-card__icon"><MistakeIcon /></span>
              <div>
                <p className="dash-practice-card__title">Recent Mistakes</p>
                <p className="dash-practice-card__count">{mistakeCount} to review</p>
              </div>
            </Link>
          </div>
        </section>

        {/* ── Weak Areas (M16 — deterministic, no AI) ── */}
        <section className="dash-section">
          <h2 className="dash-section__title">Weak Areas</h2>
          <div className="dash-weak-card">
            {weakestTopics.length === 0 ? (
              <p className="dash-weak-empty">
                Not enough topic-tagged questions yet to show weak areas. This fills in
                automatically as you complete tests whose questions were extracted with topics.
              </p>
            ) : (
              <div className="dash-weak-list">
                {weakestTopics.map(t => (
                  <div key={t.topic} className="dash-weak-item">
                    <div className="dash-weak-item__header">
                      <span className="dash-weak-item__topic">{t.topic}</span>
                      <span className={`dash-weak-item__pct dash-weak-item__pct--${scoreVariant(t.accuracy)}`}>
                        {t.accuracy}%
                      </span>
                    </div>
                    <div className="dash-weak-item__bar-track">
                      <div
                        className={`dash-weak-item__bar-fill dash-weak-item__bar-fill--${scoreVariant(t.accuracy)}`}
                        style={{ width: `${t.accuracy}%` }}
                      />
                    </div>
                    <span className="dash-weak-item__count">{t.correct}/{t.totalQuestions} correct</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── AI Insights (M16 — explicit trigger only) ── */}
        <section className="dash-section">
          <h2 className="dash-section__title">AI Insights</h2>
          <div className="dash-insights-card">
            {insightsState === 'idle' && (
              <>
                <p className="dash-insights-prompt">
                  Get a personalized summary of how you're doing, written from your real practice data.
                </p>
                <button className="btn btn--primary" onClick={handleGetInsights}>
                  <SparkleIcon /> Get My Insights
                </button>
              </>
            )}
            {insightsState === 'loading' && (
              <p className="dash-insights-loading"><span className="dash-insights-spin"><SpinnerIcon /></span> Thinking…</p>
            )}
            {insightsState === 'ready' && (
              <>
                <p className="dash-insights-text">{insightText}</p>
                <button className="btn btn--primary" onClick={handleGetInsights}>
                  Regenerate
                </button>
              </>
            )}
            {insightsState === 'error' && (
              <>
                <p className="dash-insights-error"><ErrorIcon /> {insightsError}</p>
                <button className="btn btn--ghost btn--sm" onClick={handleGetInsights}>
                  Try Again
                </button>
              </>
            )}
          </div>
        </section>

        {/* ── Performance trend ── */}
        <section className="dash-section">
          <h2 className="dash-section__title">Performance Trend</h2>
          <div className="dash-trend-card">
            <TrendSparkline values={stats.trend} />
          </div>
        </section>

        {/* ── Recent Tests ── */}
        <section className="dash-section">
          <div className="dash-section__header">
            <h2 className="dash-section__title">Recent Tests</h2>
            {tests.length > 6 && (
              <span className="dash-section__count">Showing 6 of {tests.length}</span>
            )}
          </div>

          {recentTests.length === 0 ? (
            <div className="dash-empty">
              <p className="dash-empty__title">No tests yet</p>
              <p className="dash-empty__body">Create your first test to get started.</p>
              <Link to="/create" className="btn btn--primary btn--sm">Create Your First Test</Link>
            </div>
          ) : (
            <div className="dash-tests-grid">
              {recentTests.map(t => (
                <TestCard key={t.id} test={t} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </section>

        {/* ── Recent Attempts ── */}
        <section className="dash-section">
          <h2 className="dash-section__title">Recent Attempts</h2>

          {recentAttempts.length === 0 ? (
            <div className="dash-empty">
              <p className="dash-empty__title">No attempts yet</p>
              <p className="dash-empty__body">Take a test to see your results here.</p>
            </div>
          ) : (
            <div className="dash-attempts-list">
              {recentAttempts.map(a => (
                <AttemptCard key={a.id} attempt={a} />
              ))}
            </div>
          )}
        </section>

      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          test={deleteTarget}
          error={deleteError}
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(''); }}
        />
      )}
    </main>
  );
}

/* ─── StatCard (unchanged from M14) ───────────────────────────────────────*/

function StatCard({ icon, label, value }) {
  return (
    <div className="dash-stat-card">
      <span className="dash-stat-card__icon">{icon}</span>
      <span className="dash-stat-card__value">{value}</span>
      <span className="dash-stat-card__label">{label}</span>
    </div>
  );
}

/* ─── TrendSparkline (unchanged from M14) ─────────────────────────────────*/

function TrendSparkline({ values }) {
  if (values.length < 2) {
    return (
      <div className="dash-trend-empty">
        <p>Take a few more tests to see your performance trend here.</p>
      </div>
    );
  }

  const width  = 100;
  const height = 32;
  const stepX  = width / (values.length - 1);

  const points = values
    .map((v, i) => `${i * stepX},${height - (v / 100) * height}`)
    .join(' ');

  const isImproving = values[values.length - 1] >= values[0];
  const lineColor = isImproving ? 'var(--color-success, #059669)' : 'var(--color-error)';

  return (
    <div className="dash-trend-wrap">
      <svg
        className="dash-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Performance trend, ${isImproving ? 'improving' : 'declining'}, from ${values[0]}% to ${values[values.length - 1]}%`}
      >
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="dash-trend-labels">
        <span>{values[0]}%</span>
        <span className={`dash-trend-latest dash-trend-latest--${isImproving ? 'up' : 'down'}`}>
          {isImproving ? <TrendUpIcon /> : <TrendDownIcon />} {values[values.length - 1]}%
        </span>
      </div>
    </div>
  );
}

/* ─── TestCard (unchanged from M14) ───────────────────────────────────────*/

function TestCard({ test, onDelete }) {
  return (
    <div className="dash-test-card">
      <div className="dash-test-card__main">
        <h3 className="dash-test-card__title">{test.title}</h3>
        <p className="dash-test-card__meta">
          {test.questionCount} {test.questionCount === 1 ? 'question' : 'questions'} · {formatDate(test.createdAt)}
        </p>
      </div>
      <div className="dash-test-card__actions">
        <Link to={`/test/${test.id}`} className="btn btn--primary btn--sm">
          Take Test
        </Link>
        <button
          className="dash-test-card__delete"
          onClick={() => onDelete(test)}
          aria-label={`Delete ${test.title}`}
          title="Delete this test"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

/* ─── AttemptCard (unchanged from M14) ────────────────────────────────────*/

function AttemptCard({ attempt }) {
  const pct = attempt.results?.percentage ?? 0;
  return (
    <Link to={`/result/${attempt.id}`} className="dash-attempt-card">
      <div className="dash-attempt-card__main">
        <p className="dash-attempt-card__title">{attempt.testTitle}</p>
        <p className="dash-attempt-card__meta">
          {formatDate(attempt.submittedAt || attempt.createdAt)}
          {attempt.status === 'auto_submitted' && <span className="dash-attempt-card__auto"> · auto-submitted</span>}
        </p>
      </div>
      <span className={`dash-attempt-card__score dash-attempt-card__score--${scoreVariant(pct)}`}>
        {pct}%
      </span>
    </Link>
  );
}

/* ─── DeleteConfirmModal (unchanged from M14) ─────────────────────────────*/

function DeleteConfirmModal({ test, error, isDeleting, onConfirm, onCancel }) {
  // Don't let Escape close the modal WHILE a delete is in flight —
  // same reasoning as the backdrop click guard already has.
  const trapRef = useFocusTrap(true, isDeleting ? null : onCancel);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      ref={trapRef}
      className="dmodal-backdrop"
      onClick={e => e.target === e.currentTarget && !isDeleting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >

      <div className="dmodal-card">
        <div className="dmodal-content">
          <h2 className="dmodal-title" id="delete-modal-title">Delete "{test.title}"?</h2>
          <p className="dmodal-body">
            This will permanently delete this test, its {test.questionCount} {test.questionCount === 1 ? 'question' : 'questions'},
            and any attempts you've made on it. This can't be undone.
          </p>

          {error && (
            <p className="dmodal-error" role="alert">
              <ErrorIcon /> {error}
            </p>
          )}
        </div>
        <div className="dmodal-actions">
          <button className="btn btn--ghost" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button className="dmodal-btn dmodal-btn--delete" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SVG Icons ───────────────────────────────────────────────────────────*/

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 2.5v10M2.5 7.5h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function TestIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function AttemptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 8l1.8 1.8L10.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 6.2a2 2 0 113.6.9c-.35.6-1.2.85-1.5 1.5-.1.25-.1.5-.1.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="8" cy="11.3" r="0.6" fill="currentColor"/>
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6"   stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="3"   stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="0.9" fill="currentColor"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M2.5 4h10M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.8 4l-.7 8.5a1 1 0 01-1 .9H4.9a1 1 0 01-1-.9L3.2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1.5 9L5 5.5l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 4h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1.5 3L5 6.5l2-2 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 8h3V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 2.5h8a.5.5 0 01.5.5v10.5l-4.5-3-4.5 3V3a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function MistakeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 4v4M7 10v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
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

function SpinnerIcon() {
  return (
    <svg className="dash-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" strokeOpacity="0.25"/>
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}
