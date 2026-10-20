/**
 * dateGrouping.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure date-bucketing helpers for the Progress analytics feature. Every
 * function here operates in UTC, deliberately — using local-timezone Date
 * getters would make grouping depend on whatever timezone the Node
 * process happens to be running in (which can differ between local dev
 * and a deployed host), silently shifting which "day" a test lands in.
 * UTC-based boundaries are deterministic regardless of server environment.
 *
 * Known simplification: this means a "day" boundary is UTC midnight, not
 * necessarily the user's own local midnight — a test submitted late at
 * night could theoretically land in what the user perceives as the "next
 * day." Acceptable precision for practice-test trend analytics; worth
 * knowing about rather than silently getting wrong.
 *
 * Weeks are Monday-start (ISO 8601 convention).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateOnlyUTC(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfWeekUTC(date) {
  const d = toDateOnlyUTC(date);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function endOfWeekUTC(date) {
  const start = startOfWeekUTC(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

function startOfMonthUTC(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonthUTC(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function dayKey(date) {
  const d = toDateOnlyUTC(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function weekKey(date) {
  return dayKey(startOfWeekUTC(date)); // keyed by the Monday of that week
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function groupKeyFor(date, groupBy) {
  if (groupBy === 'day') return dayKey(date);
  if (groupBy === 'week') return weekKey(date);
  return monthKey(date);
}

function toIsoDateString(date) {
  return dayKey(date);
}

function formatDayLabel(date) {
  const d = toDateOnlyUTC(date);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatWeekLabel(weekStartDate) {
  const start = toDateOnlyUTC(weekStartDate);
  const end = endOfWeekUTC(start);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();

  if (sameMonth) {
    return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()}\u2013${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  const startStr = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endStr = `${MONTH_NAMES[end.getUTCMonth()]} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  return `${startStr} \u2013 ${endStr}`;
}

function formatMonthLabel(date) {
  const d = new Date(date);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

module.exports = {
  toDateOnlyUTC,
  startOfWeekUTC,
  endOfWeekUTC,
  startOfMonthUTC,
  endOfMonthUTC,
  dayKey,
  weekKey,
  monthKey,
  groupKeyFor,
  toIsoDateString,
  formatDayLabel,
  formatWeekLabel,
  formatMonthLabel,
};
