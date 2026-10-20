import { useState, useEffect, useCallback, useRef } from 'react';
import * as analyticsService from '../../services/analyticsService';
import AnalyticsControls from '../../components/Progress/AnalyticsControls';
import ProgressSummaryCards from '../../components/Progress/ProgressSummaryCards';
import PerformanceTrendChart from '../../components/Progress/PerformanceTrendChart';
import TestComparisonChart from '../../components/Progress/TestComparisonChart';
import './Progress.css';

/* ─── Progress — "Your Progress" ──────────────────────────────────────────────
   Protected route (wrapped in <ProtectedRoute> in App.jsx, same as every
   other personal page — Dashboard, My Tests, Bookmarks, Mistakes).

   Entirely independent of the existing AI Insights feature (Dashboard) —
   no shared state, no shared endpoint, no shared minimum-attempts gate.
   AI Insights' own 3-test requirement is untouched; this page shows
   whatever visual analytics the data actually supports starting from a
   single completed test.

   ALL chart values come from GET /api/analytics/progress, which computes
   everything server-side from real Attempt records — nothing here is
   AI-generated or fabricated, per the spec's explicit requirement.
────────────────────────────────────────────────────────────────────────────── */

// Default window length per grouping — used both for the initial default
// range and for how far Previous/Next shift. Week's value (56 days = 8
// weeks) is explicitly specified; Day and Month are this app's own
// reasonable, documented extrapolation of that same idea to the other
// two groupings.
const DEFAULT_WINDOW_DAYS = { day: 14, week: 56, month: 183 };

function toIsoDateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeDefaultRange(groupBy) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - DEFAULT_WINDOW_DAYS[groupBy] + 1);
  return { startDate: toIsoDateLocal(start), endDate: toIsoDateLocal(end) };
}

function shiftRange(startDate, endDate, direction) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const spanDays = Math.round((end - start) / 86_400_000) + 1;
  const delta = direction === 'next' ? spanDays : -spanDays;
  start.setDate(start.getDate() + delta);
  end.setDate(end.getDate() + delta);
  return { startDate: toIsoDateLocal(start), endDate: toIsoDateLocal(end) };
}

function formatRangeLabel(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', sameYear
    ? { month: 'long', day: 'numeric' }
    : { month: 'long', day: 'numeric', year: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${startStr} \u2013 ${endStr}`;
}

export default function Progress() {
  const initialRange = computeDefaultRange('week');

  const [groupBy, setGroupBy] = useState('week');
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);

  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const hasAdaptedDefault = useRef(false);

  const fetchData = useCallback(async (gb, sd, ed) => {
    setStatus('loading');
    setError('');
    try {
      const result = await analyticsService.getProgressAnalytics({ groupBy: gb, startDate: sd, endDate: ed });
      setData(result);
      setStatus('ready');

      // One-time adaptive default (Requirement 7): if this is the very
      // first load and the user's real earliest attempt is more recent
      // than our computed default start, narrow the range so the first
      // thing they see isn't a mostly-empty chart.
      if (!hasAdaptedDefault.current) {
        hasAdaptedDefault.current = true;
        if (result.availableRange?.earliest) {
          const earliest = new Date(result.availableRange.earliest);
          const currentStart = new Date(sd);
          if (earliest > currentStart) {
            const newStart = toIsoDateLocal(earliest);
            setStartDate(newStart);
            const refined = await analyticsService.getProgressAnalytics({ groupBy: gb, startDate: newStart, endDate: ed });
            setData(refined);
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load your progress data.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchData(groupBy, startDate, endDate);
    // Initial load only — every subsequent change goes through its own
    // handler below, which calls fetchData directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGroupByChange(newGroupBy) {
    setGroupBy(newGroupBy);
    const range = computeDefaultRange(newGroupBy);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    fetchData(newGroupBy, range.startDate, range.endDate);
  }

  function handleRangeChange(newStart, newEnd) {
    if (!newStart || !newEnd || newStart > newEnd) return;
    setStartDate(newStart);
    setEndDate(newEnd);
    fetchData(groupBy, newStart, newEnd);
  }

  function handleReset() {
    const range = computeDefaultRange(groupBy);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    fetchData(groupBy, range.startDate, range.endDate);
  }

  function handlePrevious() {
    const range = shiftRange(startDate, endDate, 'previous');
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    fetchData(groupBy, range.startDate, range.endDate);
  }

  function handleNext() {
    const range = shiftRange(startDate, endDate, 'next');
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    fetchData(groupBy, range.startDate, range.endDate);
  }

  // Disabled once the window's end has reached today — navigating
  // further forward would only ever show an empty, meaningless future
  // period (Requirement 6's explicit rule).
  const isNextDisabled = (() => {
    const end = new Date(endDate);
    const today = new Date();
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return end >= today;
  })();

  const isInitialLoading = status === 'loading' && !data;
  const isRefetching = status === 'loading' && !!data;

  if (isInitialLoading) {
    return (
      <main className="page-wrapper">
        <div className="progress-load-wrap">
          <span className="progress-load-spinner" aria-hidden="true"><SpinnerIcon /></span>
          <p className="progress-load-text">Loading your progress…</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="page-wrapper">
        <div className="progress-load-wrap">
          <span className="progress-load-error-icon" aria-hidden="true"><ErrorBigIcon /></span>
          <h1 className="progress-load-title">Couldn't load your progress</h1>
          <p className="progress-load-text">{error}</p>
        </div>
      </main>
    );
  }

  const hasEverCompletedATest = data?.availableRange?.earliest != null;
  const hasTestsInRange = data && data.summary.testsTaken > 0;

  return (
    <main className="page-wrapper">
      <div className="progress-page">

        <header className="progress-header">
          <h1 className="progress-title">Your Progress</h1>
          <p className="progress-subtitle">
            Track your performance and progress across your completed tests over time.
          </p>
        </header>

        {!hasEverCompletedATest ? (
          <div className="progress-empty">
            <p className="progress-empty__title">
              Start your first test to begin tracking your progress.
            </p>
          </div>
        ) : (
          <>
            <AnalyticsControls
              groupBy={groupBy}
              onGroupByChange={handleGroupByChange}
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              onReset={handleReset}
              rangeLabel={formatRangeLabel(startDate, endDate)}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isNextDisabled={isNextDisabled}
              isRefetching={isRefetching}
            />

            {!hasTestsInRange ? (
              <div className="progress-empty">
                <p className="progress-empty__title">No completed tests were found during this period.</p>
                <p className="progress-empty__body">Try selecting a different date range.</p>
              </div>
            ) : (
              <>
                <ProgressSummaryCards summary={data.summary} />
                <PerformanceTrendChart chartData={data.chartData} />
                <TestComparisonChart tests={data.tests} />
              </>
            )}
          </>
        )}

      </div>
    </main>
  );
}

function SpinnerIcon() {
  return (
    <svg className="progress-load-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
