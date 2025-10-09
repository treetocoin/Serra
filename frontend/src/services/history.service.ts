import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

type SensorReading = Database['public']['Tables']['sensor_readings']['Row'];

interface AggregatedReading {
  timestamp: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  count: number;
}

export type TimeInterval = 'raw' | 'hourly' | 'daily';

class HistoryService {
  /**
   * Get historical sensor readings for a specific time range
   * Returns raw readings without aggregation
   */
  async getHistoricalReadings(
    sensorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    readings: SensorReading[];
    error: Error | null;
  }> {
    try {
      const { data: readings, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('sensor_id', sensorId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true })
        .limit(10000); // Safety limit

      if (error) throw error;

      return { readings: readings || [], error: null };
    } catch (error) {
      console.error('Error fetching historical readings:', error);
      return { readings: [], error: error as Error };
    }
  }

  /**
   * Get aggregated historical data (avg, min, max per time bucket)
   * Uses PostgreSQL time_bucket for efficient aggregation
   */
  async getAggregatedData(
    sensorId: string,
    interval: TimeInterval,
    startDate: Date,
    endDate: Date
  ): Promise<{
    data: AggregatedReading[];
    error: Error | null;
  }> {
    try {
      // For raw data, just fetch readings directly
      if (interval === 'raw') {
        const { readings, error } = await this.getHistoricalReadings(
          sensorId,
          startDate,
          endDate
        );

        if (error) throw error;

        // Convert to aggregated format (each reading is its own bucket)
        const aggregated: AggregatedReading[] = readings.map((r) => ({
          timestamp: r.timestamp,
          avg_value: r.value,
          min_value: r.value,
          max_value: r.value,
          count: 1,
        }));

        return { data: aggregated, error: null };
      }

      // For aggregated data, use TimescaleDB time_bucket
      // NOTE: This requires a Supabase function to be created
      // For now, fall back to client-side aggregation
      const { readings, error } = await this.getHistoricalReadings(
        sensorId,
        startDate,
        endDate
      );

      if (error) throw error;

      const aggregated = this.aggregateClientSide(readings, interval);

      return { data: aggregated, error: null };
    } catch (error) {
      console.error('Error fetching aggregated data:', error);
      return { data: [], error: error as Error };
    }
  }

  /**
   * Client-side aggregation fallback
   * Groups readings into time buckets and computes avg/min/max
   */
  private aggregateClientSide(
    readings: SensorReading[],
    interval: TimeInterval
  ): AggregatedReading[] {
    if (readings.length === 0) return [];

    const bucketSize = interval === 'hourly' ? 3600000 : 86400000; // ms
    const buckets = new Map<number, SensorReading[]>();

    // Group readings into buckets
    readings.forEach((reading) => {
      const timestamp = new Date(reading.timestamp).getTime();
      const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(reading);
    });

    // Compute aggregates for each bucket
    const aggregated: AggregatedReading[] = [];

    buckets.forEach((bucketReadings, bucketTimestamp) => {
      const values = bucketReadings.map((r) => r.value);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      aggregated.push({
        timestamp: new Date(bucketTimestamp).toISOString(),
        avg_value: avg,
        min_value: min,
        max_value: max,
        count: values.length,
      });
    });

    return aggregated.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Automatically determine best interval based on date range
   */
  getBestInterval(startDate: Date, endDate: Date): TimeInterval {
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 2) return 'raw'; // <= 2 days: show raw data
    if (daysDiff <= 7) return 'hourly'; // <= 7 days: hourly buckets
    return 'daily'; // > 7 days: daily buckets
  }

  /**
   * Export sensor readings to CSV format
   */
  exportToCSV(readings: SensorReading[], sensorName: string): void {
    const headers = ['Timestamp', 'Value'];
    const rows = readings.map((r) => [
      new Date(r.timestamp).toLocaleString(),
      r.value.toString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${sensorName}-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Format timestamp for chart display
   */
  formatTimestamp(timestamp: string, interval: TimeInterval): string {
    const date = new Date(timestamp);

    if (interval === 'raw' || interval === 'hourly') {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

export const historyService = new HistoryService();
