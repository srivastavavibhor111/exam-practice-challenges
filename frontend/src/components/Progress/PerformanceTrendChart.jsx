import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useIsMobile } from '../../hooks/useIsMobile';
import { computeTickInterval } from './chartUtils';
import './Charts.css';

/* ─── PerformanceTrendChart — UPDATED ────────────────────────────────────────
   Applies the same responsive label-thinning fix as TestComparisonChart,
   proactively rather than reactively — this chart has the identical
   underlying risk (many data points, narrow screen) even though it
   wasn't the one reported broken. Leaving one chart fixed and the other
   still fragile would just mean the next bug report is this one instead.
────────────────────────────────────────────────────────────────────────────── */

export default function PerformanceTrendChart({ chartData }) {
  const isMobile = useIsMobile();

  if (!chartData || chartData.length === 0) {
    return (
      <div className="progress-chart-card">
        <h2 className="progress-chart-card__title">Performance Trend</h2>
        <EmptyChartState />
      </div>
    );
  }

  const maxLabels = isMobile ? 4 : 10;
  const tickInterval = computeTickInterval(chartData.length, maxLabels);

  return (
    <div className="progress-chart-card">
      <h2 className="progress-chart-card__title">Performance Trend</h2>
      <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--color-text-muted)', fontSize: isMobile ? 10 : 12 }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="averagePerformance"
            stroke="var(--color-primary)"
            strokeWidth={2.5}
            dot={{ r: isMobile ? 3 : 4, fill: 'var(--color-primary)' }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="progress-chart-tooltip">
      <p className="progress-chart-tooltip__title">{point.label}</p>
      <p>Average Performance: <strong>{point.averagePerformance}%</strong></p>
      <p>Tests Completed: <strong>{point.testsTaken}</strong></p>
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
