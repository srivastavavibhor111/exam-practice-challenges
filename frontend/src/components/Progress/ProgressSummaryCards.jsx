import './ProgressSummaryCards.css';

/* ─── ProgressSummaryCards ────────────────────────────────────────────────────
   Four cards: Tests Taken, Average Performance, Best Performance,
   Performance Trend — all sourced directly from the backend's `summary`
   object (already fully computed server-side; no client-side math here).
────────────────────────────────────────────────────────────────────────────── */

export default function ProgressSummaryCards({ summary }) {
  const { testsTaken, averagePerformance, bestPerformance, performanceTrend } = summary;

  return (
    <div className="progress-summary-grid">
      <div className="progress-summary-card">
        <span className="progress-summary-card__icon"><TestIcon /></span>
        <span className="progress-summary-card__value">{testsTaken}</span>
        <span className="progress-summary-card__label">Tests Taken</span>
      </div>

      <div className="progress-summary-card">
        <span className="progress-summary-card__icon"><TargetIcon /></span>
        <span className="progress-summary-card__value">{averagePerformance}%</span>
        <span className="progress-summary-card__label">Average Performance</span>
      </div>

      <div className="progress-summary-card">
        <span className="progress-summary-card__icon"><TrophyIcon /></span>
        <span className="progress-summary-card__value">{bestPerformance}%</span>
        <span className="progress-summary-card__label">Best Performance</span>
      </div>

      <TrendCard trend={performanceTrend} />
    </div>
  );
}

function TrendCard({ trend }) {
  const { value, direction } = trend;

  const display = direction === 'neutral'
    ? '—'
    : `${direction === 'up' ? '+' : '-'}${value}%`;

  return (
    <div className={`progress-summary-card progress-summary-card--trend-${direction}`}>
      <span className="progress-summary-card__icon">
        {direction === 'up' && <TrendUpIcon />}
        {direction === 'down' && <TrendDownIcon />}
        {direction === 'neutral' && <TrendNeutralIcon />}
      </span>
      <span className="progress-summary-card__value">{display}</span>
      <span className="progress-summary-card__label">Performance Trend</span>
    </div>
  );
}

function TestIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3.5" y="2.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 6.5h6M6 9h6M6 11.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M6 3h6v5a3 3 0 01-6 0V3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 4H4a2 2 0 002 4M12 4h2a2 2 0 01-2 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 11v2.5M6.5 15.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 13L7 8.5l3 3 5.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 6h4v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 5L7 9.5l3-3 5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 12h4V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendNeutralIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 9h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
