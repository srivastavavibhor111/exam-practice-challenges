/**
 * chartUtils.js — NEW
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared between PerformanceTrendChart and TestComparisonChart, so both
 * charts thin out their x-axis labels the same way rather than solving
 * the same overlap problem twice, slightly differently, in two files.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * computeTickInterval
 * Recharts' XAxis `interval` prop means "skip this many ticks between
 * each one actually shown" — 0 shows every tick, 1 shows every other,
 * etc. This computes whichever interval keeps the number of VISIBLE
 * labels at or under `maxLabels`, regardless of how many data points
 * exist. This is the actual fix for the mobile overlap bug: the bar
 * chart previously hard-coded interval={0} (show every label, always),
 * which is fine for 5 bars and unreadable for 25 — especially once each
 * label is also rotated, which multiplies how much horizontal space it
 * needs.
 */
export function computeTickInterval(count, maxLabels) {
  if (count <= maxLabels) return 0;
  return Math.ceil(count / maxLabels) - 1;
}

export function truncateLabel(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}\u2026` : str;
}

export function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
