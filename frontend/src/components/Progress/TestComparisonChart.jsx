import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import { computeTickInterval, truncateLabel, formatShortDate } from './chartUtils';
import './Charts.css';

/* ─── TestComparisonChart — FIXED ─────────────────────────────────────────────
   BUG FIXED: the x-axis previously used interval={0}, forcing Recharts to
   render a label for EVERY bar regardless of how many existed. With a
   realistic number of practice-session tests (each Bookmarks/Mistakes
   practice run creates its own Test — see M15), that's easily 20+ rotated
   labels fighting for space, which is unreadable on any screen and
   completely broken on mobile width.

   FIX: the number of VISIBLE labels is now capped (5 on mobile, 14 on
   desktop) via computeTickInterval() — Recharts still renders every BAR,
   just not every label, skipping evenly so the shown ones stay spread
   across the full width. Truncation is also more aggressive on mobile,
   and rotation angle steepens slightly to pack remaining labels tighter.
   The full test name and date are always available via the tooltip
   regardless of how many labels are actually shown on the axis.
────────────────────────────────────────────────────────────────────────────── */

export default function TestComparisonChart({ tests }) {
  const isMobile = useIsMobile();

  if (!tests || tests.length === 0) {
    return (
      <div className="progress-chart-card">
        <h2 className="progress-chart-card__title">Test-by-Test Performance</h2>
        <EmptyChartState />
      </div>
    );
  }

  const truncateLength = isMobile ? 8 : 14;
  const maxLabels = isMobile ? 5 : 14;

  const data = tests.map(t => ({
    ...t,
    shortName: truncateLabel(t.testName, truncateLength),
    dateLabel: formatShortDate(t.completedAt),
  }));

  const tickInterval = computeTickInterval(data.length, maxLabels);
  const labelsAreThinned = data.length > maxLabels;

  return (
    <div className="progress-chart-card">
      <h2 className="progress-chart-card__title">Test-by-Test Performance</h2>
      <ResponsiveContainer width="100%" height={isMobile ? 260 : 300}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: isMobile ? 46 : 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="shortName"
            tick={{ fill: 'var(--color-text-muted)', fontSize: isMobile ? 10 : 11 }}
            tickLine={false}
            interval={tickInterval}
            angle={isMobile ? -45 : -25}
            textAnchor="end"
            height={isMobile ? 52 : 55}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<ComparisonTooltip />} />
          <Bar dataKey="performancePercentage" fill="var(--color-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {labelsAreThinned && (
        <p className="progress-chart-hint">
          Showing every bar — tap or hover a bar to see its full test name and date.
        </p>
      )}
    </div>
  );
}

function ComparisonTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const t = payload[0].payload;
  return (
    <div className="progress-chart-tooltip">
      <p className="progress-chart-tooltip__title">{t.testName}</p>
      <p>{t.dateLabel}</p>
      <p>Performance: <strong>{t.performancePercentage}%</strong></p>
      <p>Score: <strong>{t.score}/{t.maximumScore}</strong></p>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="progress-chart-empty">
      <p>No completed tests were found during this period.</p>
      <p className="progress-chart-empty__hint">Try selecting a different date range.</p>
    </div>
  );
}
