/**
 * SoilMoistureChart Component
 *
 * Single-line soil moisture chart using Recharts.
 * Adapted from TemperatureChart with soil moisture-specific styling.
 *
 * @feature 005-lavoriamo-alla-pagina T018
 * @see ../../../specs/005-lavoriamo-alla-pagina/research.md Section 3
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { TimeSeriesDataPoint } from '../../types/dati.types';

// ============================================================================
// Component Props
// ============================================================================

export interface SoilMoistureChartProps {
  data: TimeSeriesDataPoint[];
  timeRangeValue?: '24h' | '7d' | '30d';
}

// ============================================================================
// Component
// ============================================================================

export function SoilMoistureChart({
  data,
  timeRangeValue = '24h',
}: SoilMoistureChartProps) {
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
    value: point.value,
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
          formatter={(value: number) => [Math.round(value) + ' %', 'Umidità Terreno']}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '8px 12px',
          }}
        />

        <Line
          type="monotone"
          dataKey="value"
          stroke="#10b981"
          strokeWidth={2}
          dot={showDots}
          connectNulls={false}
          name="Umidità Terreno"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function SoilMoistureChartSkeleton() {
  return (
    <div
      className="w-full bg-gray-100 animate-pulse rounded"
      style={{ height: 300 }}
    />
  );
}
