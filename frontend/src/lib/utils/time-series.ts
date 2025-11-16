/**
 * Time-series transformation utilities
 *
 * Provides functions for time range creation, series alignment,
 * and gap detection for historical data visualization.
 *
 * @feature 005-lavoriamo-alla-pagina
 * @see ../../../specs/005-lavoriamo-alla-pagina/data-model.md
 */

import type {
  TimeRange,
  TimeRangeValue,
  AggregationInterval,
  TimeSeriesDataPoint,
  ComparisonChartData,
} from '../../types/dati.types';

// ============================================================================
// Time Range Creation
// ============================================================================

/**
 * Create TimeRange object from TimeRangeValue selector
 *
 * Automatically selects appropriate aggregation interval:
 * - <= 2 days: 'raw' (full granularity)
 * - <= 7 days: 'hourly' (1-hour buckets)
 * - > 7 days: 'daily' (1-day buckets)
 *
 * @param value - Time range selector value ('24h' | '7d' | '30d')
 * @returns TimeRange with calculated dates and interval
 *
 * @see data-model.md Section 4
 */
export function createTimeRange(value: TimeRangeValue): TimeRange {
  const now = new Date();
  const startDate = new Date(now);

  switch (value) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      return {
        value,
        startDate,
        endDate: now,
        interval: 'raw',
      };

    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      return {
        value,
        startDate,
        endDate: now,
        interval: 'hourly',
      };

    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      return {
        value,
        startDate,
        endDate: now,
        interval: 'daily',
      };

    default:
      // Fallback to 24h
      startDate.setHours(startDate.getHours() - 24);
      return {
        value: '24h',
        startDate,
        endDate: now,
        interval: 'raw',
      };
  }
}

// ============================================================================
// Time Series Alignment
// ============================================================================

/**
 * Align two time-series by timestamp for comparison charts
 *
 * Merges two separate sensor time-series (e.g., temp sopra and temp sotto)
 * into a single comparison dataset with aligned timestamps. Handles cases
 * where series have different data points.
 *
 * @param primarySeries - First time-series data (e.g., sopra)
 * @param secondarySeries - Second time-series data (e.g., sotto)
 * @param primaryLabel - Display name for primary series
 * @param secondaryLabel - Display name for secondary series
 * @returns Aligned comparison chart data
 *
 * @see data-model.md Transformation 3
 */
export function alignTimeSeries(
  primarySeries: TimeSeriesDataPoint[],
  secondarySeries: TimeSeriesDataPoint[],
  primaryLabel: string,
  secondaryLabel: string
): ComparisonChartData[] {
  // Create a map of all unique timestamps
  const timestampMap = new Map<
    number,
    { primary: number | null; secondary: number | null }
  >();

  // Add primary series timestamps
  for (const point of primarySeries) {
    const ts = point.timestamp.getTime();
    timestampMap.set(ts, { primary: point.value, secondary: null });
  }

  // Merge secondary series timestamps
  for (const point of secondarySeries) {
    const ts = point.timestamp.getTime();
    const existing = timestampMap.get(ts);
    if (existing) {
      existing.secondary = point.value;
    } else {
      timestampMap.set(ts, { primary: null, secondary: point.value });
    }
  }

  // Convert to sorted ComparisonChartData array
  return Array.from(timestampMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, values]) => ({
      timestamp: new Date(timestamp),
      primaryValue: values.primary,
      secondaryValue: values.secondary,
      primaryLabel,
      secondaryLabel,
    }));
}

// ============================================================================
// Gap Detection and Marking
// ============================================================================

/**
 * Insert null markers for visualization of data gaps
 *
 * Analyzes time-series for gaps >15 minutes (default threshold) and inserts
 * explicit null data points to create visual breaks in line charts. This
 * enables dotted/dashed line rendering through gap periods.
 *
 * IMPORTANT: Also extends the timeline to "now" if the last data point is old,
 * making it visually clear that the sensor has stopped reporting.
 *
 * @param timeSeries - Original time-series data
 * @param gapThresholdMinutes - Minimum gap size to mark (default: 15)
 * @returns Time-series with gap markers inserted
 *
 * @see data-model.md Transformation 4
 * @see research.md Section 3.3 for Recharts gap visualization
 */
export function insertGapMarkers(
  timeSeries: TimeSeriesDataPoint[],
  gapThresholdMinutes: number = 15,
  timeRange?: TimeRange
): TimeSeriesDataPoint[] {
  const now = Date.now();

  // Handle empty series - create placeholder points at start and end of range
  if (!timeSeries || timeSeries.length === 0) {
    if (timeRange) {
      // Return two null points to show the full time range with no data
      return [
        {
          timestamp: timeRange.startDate,
          value: null,
          sensorType: 'unconfigured',
          isAggregated: false,
        },
        {
          timestamp: new Date(now),
          value: null,
          sensorType: 'unconfigured',
          isAggregated: false,
        },
      ];
    }
    return [];
  }

  const result: TimeSeriesDataPoint[] = [];
  const sortedSeries = [...timeSeries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  // Add null point at start of range if first data point is after range start
  if (timeRange) {
    const firstPoint = sortedSeries[0];
    const rangeStart = timeRange.startDate.getTime();
    const minutesFromRangeStart = (firstPoint.timestamp.getTime() - rangeStart) / (1000 * 60);

    if (minutesFromRangeStart > gapThresholdMinutes) {
      result.push({
        timestamp: timeRange.startDate,
        value: null,
        sensorType: firstPoint.sensorType,
        isAggregated: false,
      });
      result.push({
        timestamp: new Date(firstPoint.timestamp.getTime() - 1000),
        value: null,
        sensorType: firstPoint.sensorType,
        isAggregated: false,
      });
    }
  }

  // Process all data points and insert gap markers
  for (let i = 0; i < sortedSeries.length; i++) {
    result.push(sortedSeries[i]);

    // Check if there's a gap to the next point
    if (i < sortedSeries.length - 1) {
      const current = sortedSeries[i].timestamp.getTime();
      const next = sortedSeries[i + 1].timestamp.getTime();
      const gapMinutes = (next - current) / (1000 * 60);

      if (gapMinutes > gapThresholdMinutes) {
        // Insert a null point to create a visual break
        result.push({
          timestamp: new Date(current + 1000),
          value: null,
          sensorType: sortedSeries[i].sensorType,
          isAggregated: false,
        });
      }
    }
  }

  // CRITICAL: Always extend timeline to "now" if last data is old
  // This ensures the full 24h range is always visible
  if (sortedSeries.length > 0) {
    const lastPoint = sortedSeries[sortedSeries.length - 1];
    const minutesSinceLastPoint = (now - lastPoint.timestamp.getTime()) / (1000 * 60);

    // Always extend to "now" if there's any significant gap
    if (minutesSinceLastPoint > gapThresholdMinutes) {
      // Add null point right after last real point to start the gap
      result.push({
        timestamp: new Date(lastPoint.timestamp.getTime() + 1000),
        value: null,
        sensorType: lastPoint.sensorType,
        isAggregated: false,
      });

      // Add null point at "now" to extend timeline to current time
      result.push({
        timestamp: new Date(now),
        value: null,
        sensorType: lastPoint.sensorType,
        isAggregated: false,
      });
    }
  }

  return result;
}

// ============================================================================
// Client-Side Aggregation
// ============================================================================

/**
 * Aggregate time-series data client-side into hourly or daily buckets
 *
 * Used as fallback when database-side aggregation is not available.
 * Groups readings into time buckets and calculates avg/min/max per bucket.
 *
 * @param readings - Raw sensor readings
 * @param interval - Aggregation granularity ('hourly' | 'daily')
 * @returns Aggregated time-series data points
 *
 * @see data-model.md Transformation 2
 * @see research.md Section 2 for downsampling strategy
 */
export function aggregateTimeSeries(
  readings: Array<{ timestamp: Date | string; value: number; sensor_type?: string }>,
  interval: 'hourly' | 'daily'
): TimeSeriesDataPoint[] {
  if (!readings || readings.length === 0) {
    return [];
  }

  // Determine bucket size in milliseconds
  const bucketSize =
    interval === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  // Group readings by time bucket
  const buckets = new Map<number, Array<{ timestamp: Date; value: number }>>();

  for (const reading of readings) {
    const timestamp =
      reading.timestamp instanceof Date
        ? reading.timestamp
        : new Date(reading.timestamp);
    const bucketTimestamp = Math.floor(timestamp.getTime() / bucketSize) * bucketSize;

    if (!buckets.has(bucketTimestamp)) {
      buckets.set(bucketTimestamp, []);
    }

    buckets.get(bucketTimestamp)!.push({ timestamp, value: reading.value });
  }

  // Aggregate each bucket
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketTimestamp, bucketReadings]) => {
      const values = bucketReadings.map(r => r.value);
      const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);

      return {
        timestamp: new Date(bucketTimestamp),
        value: avgValue,
        sensorType: 'unconfigured', // Will be overridden by caller
        isAggregated: true,
        aggregationMetadata: {
          min: minValue,
          max: maxValue,
          sampleCount: values.length,
        },
      };
    });
}

// ============================================================================
// Time Range Utilities
// ============================================================================

/**
 * Check if a time range spans the 15-day boundary for downsampling
 *
 * @param timeRange - Time range to check
 * @returns true if range requires mixed granularity data
 */
export function spansFifteenDayBoundary(timeRange: TimeRange): boolean {
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  return (
    timeRange.startDate < fifteenDaysAgo && timeRange.endDate >= fifteenDaysAgo
  );
}

/**
 * Get interval in milliseconds for a given aggregation interval
 *
 * @param interval - Aggregation interval type
 * @returns Interval duration in milliseconds
 */
export function getIntervalMilliseconds(interval: AggregationInterval): number {
  switch (interval) {
    case 'raw':
      return 5 * 60 * 1000; // 5 minutes
    case 'hourly':
      return 60 * 60 * 1000; // 1 hour
    case 'daily':
      return 24 * 60 * 60 * 1000; // 1 day
    default:
      return 5 * 60 * 1000;
  }
}
