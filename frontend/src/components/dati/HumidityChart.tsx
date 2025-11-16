/**
 * HumidityChart Component
 *
 * Humidity chart with support for both single and comparison modes.
 * Phase 3 (T017): Basic single sensor visualization.
 * Phase 4 (T026): Extended for comparison overlay (sopra vs sotto).
 *
 * @feature 005-lavoriamo-alla-pagina T017, T026
 * @see ../../../specs/005-lavoriamo-alla-pagina/research.md Section 3
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { TimeSeriesDataPoint, ComparisonChartData } from '../../types/dati.types';

// ============================================================================
// Component Props
// ============================================================================

export interface HumidityChartProps {
  data: TimeSeriesDataPoint[] | ComparisonChartData[];
  timeRangeValue?: '24h' | '7d' | '30d';
  comparisonMode?: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

function isComparisonData(
  data: TimeSeriesDataPoint[] | ComparisonChartData[]
): data is ComparisonChartData[] {
  return data.length > 0 && 'primaryValue' in data[0];
}

// ============================================================================
// Component
// ============================================================================

export function HumidityChart({
  data,
  timeRangeValue = '24h',
  comparisonMode = false,
}: HumidityChartProps) {
  const isComparison = comparisonMode || isComparisonData(data);

  // Calculate explicit domain for X-axis to ensure full time range is shown
  const now = Date.now();
  const getDomainStart = () => {
    switch (timeRangeValue) {
      case '24h':
        return now - 24 * 60 * 60 * 1000;
      case '7d':
        return now - 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return now - 30 * 24 * 60 * 60 * 1000;
      default:
        return now - 24 * 60 * 60 * 1000;
    }
  };
  const xAxisDomain: [number, number] = [getDomainStart(), now];

  // Format X-axis based on time range
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeRangeValue === '24h') {
      return format(date, 'HH:mm', { locale: it });
    } else {
      return format(date, 'dd/MM', { locale: it });
    }
  };

  // Format tooltip timestamp
  const formatTooltipLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    return format(date, 'dd MMM yyyy, HH:mm', { locale: it });
  };

  // Prepare data for Recharts
  const chartData = data.map((point) => ({
    timestamp: point.timestamp.getTime(),
    ...(isComparison
      ? {
          primaryValue: (point as ComparisonChartData).primaryValue,
          secondaryValue: (point as ComparisonChartData).secondaryValue,
          primaryLabel: (point as ComparisonChartData).primaryLabel,
          secondaryLabel: (point as ComparisonChartData).secondaryLabel,
        }
      : {
          value: (point as TimeSeriesDataPoint).value,
        }),
  }));

  const showDots = chartData.length <= 100;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

        <XAxis
          dataKey="timestamp"
          domain={xAxisDomain}
          type="number"
          scale="time"
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          stroke="#9ca3af"
        />

        <YAxis
          label={{
            value: '%',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 14, fill: '#6b7280' },
          }}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          stroke="#9ca3af"
        />

        <Tooltip
          labelFormatter={formatTooltipLabel}
          formatter={(value: number | null) =>
            value !== null ? [Math.round(value) + ' %'] : ['--']
          }
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '8px 12px',
          }}
        />

        {isComparison && <Legend verticalAlign="top" height={36} iconType="line" />}

        {isComparison ? (
          <>
            <Line
              type="monotone"
              dataKey="primaryValue"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={showDots}
              connectNulls={false}
              name={chartData[0]?.primaryLabel || 'Umidità Sopra'}
            />
            <Line
              type="monotone"
              dataKey="secondaryValue"
              stroke="#0891b2"
              strokeWidth={2}
              dot={showDots}
              connectNulls={false}
              name={chartData[0]?.secondaryLabel || 'Umidità Sotto'}
            />
          </>
        ) : (
          <Line
            type="monotone"
            dataKey="value"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={showDots}
            connectNulls={false}
            name="Umidità"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function HumidityChartSkeleton() {
  return (
    <div
      className="w-full bg-gray-100 animate-pulse rounded"
      style={{ height: 300 }}
    />
  );
}
