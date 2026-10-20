import './AnalyticsControls.css';

/* ─── AnalyticsControls ───────────────────────────────────────────────────────
   Bundles three logically-distinct controls into one file rather than
   three separate files (the suggested structure lists them as
   DayWeekMonthSelector / CalendarDateRangeSelector / PeriodNavigation) —
   they're small and tightly coupled to the same state in Progress.jsx, a
   reasonable, common React organization choice at this size.

   No calendar-picker dependency added — native <input type="date">
   already provides full keyboard accessibility and correct behavior
   across browsers and mobile, satisfying every functional requirement
   (select start/end, clear/reset) without a new dependency.

   ASSUMPTION WORTH FLAGGING: the spec's Requirement 6 examples show a
   single-period nav label ("September 2026"), while Requirement 7
   explicitly defaults to an 8-WEEK range — necessarily multiple periods.
   This implementation resolves that by having Previous/Next shift the
   ENTIRE currently-displayed range by its own length, with the nav label
   showing the full range's actual start–end dates. This stays consistent
   with the multi-period default and generalizes uniformly across all
   three groupings, rather than needing special-cased single-period logic.
────────────────────────────────────────────────────────────────────────────── */

const GROUP_OPTIONS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AnalyticsControls({
  groupBy, onGroupByChange,
  startDate, endDate, onRangeChange,
  onReset,
  rangeLabel,
  onPrevious, onNext, isNextDisabled,
  isRefetching,
}) {
  return (
    <div className="progress-controls">

      <div className="progress-controls__row">
        {/* DayWeekMonthSelector */}
        <div className="progress-controls__group" role="group" aria-label="Group performance by">
          {GROUP_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`progress-controls__group-btn${groupBy === opt.key ? ' progress-controls__group-btn--active' : ''}`}
              aria-pressed={groupBy === opt.key}
              onClick={() => onGroupByChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* CalendarDateRangeSelector */}
        <div className="progress-controls__dates">
          <label className="progress-controls__date-field">
            <span>From</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={e => onRangeChange(e.target.value, endDate)}
              aria-label="Range start date"
            />
          </label>
          <label className="progress-controls__date-field">
            <span>To</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayIso()}
              onChange={e => onRangeChange(startDate, e.target.value)}
              aria-label="Range end date"
            />
          </label>
          <button type="button" className="btn btn--primary btn--sm" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      {/* PeriodNavigation */}
      <div className="progress-controls__nav">
        <button
          type="button"
          className="progress-controls__nav-btn"
          onClick={onPrevious}
          aria-label="Previous period"
        >
          <ChevronLeftIcon /> Previous
        </button>
        <span className="progress-controls__nav-label">
          {rangeLabel}
          {isRefetching && <span className="progress-controls__updating"> · Updating…</span>}
        </span>
        <button
          type="button"
          className="progress-controls__nav-btn"
          onClick={onNext}
          disabled={isNextDisabled}
          aria-label="Next period"
          title={isNextDisabled ? "Can't navigate into the future" : undefined}
        >
          Next <ChevronRightIcon />
        </button>
      </div>

    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
