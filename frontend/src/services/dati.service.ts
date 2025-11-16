/**
 * Dati Service - Data fetching and transformation for Pagina Dati
 *
 * Provides high-level data operations specifically tailored for the
 * Dati page requirements, including current readings, time-series data,
 * and comparison charts.
 *
 * @feature 005-lavoriamo-alla-pagina
 * @see ../../../specs/005-lavoriamo-alla-pagina/contracts/service-layer.contract.ts
 */

import { supabase } from '../lib/supabase';
import { sensorsService } from './sensors.service';
import type {
  CurrentReading,
  SensorType,
  TimeRange,
  TimeSeriesDataPoint,
  ComparisonChartData,
  SensorStatus,
  SensorStatusValue,
} from '../types/dati.types';
import {
  createTimeRange,
  alignTimeSeries,
  insertGapMarkers,
  aggregateTimeSeries,
} from '../lib/utils/time-series';

// ============================================================================
// Service: DatiService
// ============================================================================

export const datiService = {
  /**
   * Fetch current readings for all sensors belonging to user's devices
   *
   * T005: Implementation for User Story 1 - View Current Environmental Conditions
   *
   * @param userId - User UUID
   * @returns Array of current readings with UI metadata
   * @throws Error if query fails
   *
   * @see contracts/supabase-queries.contract.ts Query 1
   * @see data-model.md Section 1 (CurrentReading entity)
   * @see data-model.md Transformation 1
   */
  async getCurrentReadings(userId: string): Promise<CurrentReading[]> {
    try {
      // Query sensor_readings with JOIN to sensors and devices
      // Note: Supabase uses foreign key relationships for joins
      const { data, error } = await supabase
        .from('sensor_readings')
        .select(
          `
          reading_sensor_type,
          value,
          timestamp,
          sensors!inner (
            unit,
            device_id,
            devices!inner (
              user_id
            )
          )
        `
        )
        .eq('sensors.devices.user_id', userId)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('[datiService.getCurrentReadings] Query error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by sensor_type and take the latest reading per type
      const latestByType = new Map<SensorType, any>();

      for (const reading of data) {
        const sensorType = reading.reading_sensor_type as SensorType;

        // Only process known sensor types for Dati page
        const knownTypes: SensorType[] = [
          'dht_sopra_temp',
          'dht_sopra_humidity',
          'dht_sotto_temp',
          'dht_sotto_humidity',
          'soil_moisture',
          'water_level',
        ];

        if (knownTypes.includes(sensorType) && !latestByType.has(sensorType)) {
          latestByType.set(sensorType, reading);
        }
      }

      // Transform to CurrentReading with UI metadata
      const currentReadings: CurrentReading[] = Array.from(latestByType.values()).map(
        (reading) => {
          const sensorType = reading.reading_sensor_type as SensorType;
          const config = sensorsService.getSensorConfig(sensorType);
          const timestamp = new Date(reading.timestamp);
          const ageMinutes = (Date.now() - timestamp.getTime()) / (1000 * 60);

          // Extract unit and device_id from nested sensors relationship
          const unit = reading.sensors?.unit || '';
          const deviceId = reading.sensors?.device_id || '';

          return {
            sensorType,
            value: reading.value,
            unit,
            timestamp,
            deviceId,
            isStale: ageMinutes > 15,
            displayName: sensorsService.getDisplayName(sensorType),
            icon: config.icon,
            color: config.color,
          };
        }
      );

      console.log(
        `[datiService.getCurrentReadings] Fetched ${currentReadings.length} current readings`
      );

      return currentReadings;
    } catch (error) {
      console.error('[datiService.getCurrentReadings] Error:', error);
      throw error;
    }
  },

  /**
   * Fetch time-series data for a specific sensor type across all devices
   *
   * T013: Implementation for User Story 2 - View Historical Trends
   *
   * Automatically selects granularity based on time range:
   * - Range <15 days: Full granularity (raw data)
   * - Range >15 days: Client-side aggregation (hourly/daily buckets)
   *
   * @param userId - User UUID
   * @param sensorType - Type of sensor to query
   * @param timeRange - Selected time range with pre-calculated interval
   * @returns Array of time-series data points (may be aggregated)
   * @throws Error if query fails
   *
   * @see contracts/supabase-queries.contract.ts Query 2
   * @see data-model.md Section 2 (TimeSeriesDataPoint entity)
   * @see research.md Section 2 (Downsampling strategy)
   */
  async getTimeSeriesData(
    userId: string,
    sensorType: SensorType,
    timeRange: TimeRange
  ): Promise<TimeSeriesDataPoint[]> {
    try {
      // Query sensor_readings filtered by sensor_type and time range
      const { data, error } = await supabase
        .from('sensor_readings')
        .select(
          `
          timestamp,
          value,
          reading_sensor_type,
          sensors!inner (
            device_id,
            devices!inner (
              user_id
            )
          )
        `
        )
        .eq('reading_sensor_type', sensorType)
        .eq('sensors.devices.user_id', userId)
        .gte('timestamp', timeRange.startDate.toISOString())
        .lte('timestamp', timeRange.endDate.toISOString())
        .order('timestamp', { ascending: true })
        .limit(10000); // Safety limit

      if (error) {
        console.error('[datiService.getTimeSeriesData] Query error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform to TimeSeriesDataPoint
      let timeSeries: TimeSeriesDataPoint[] = data.map((r) => ({
        timestamp: new Date(r.timestamp),
        value: r.value,
        sensorType: r.reading_sensor_type as SensorType,
        isAggregated: false,
      }));

      // Apply aggregation if interval !== 'raw'
      if (timeRange.interval === 'hourly' || timeRange.interval === 'daily') {
        const aggregated = aggregateTimeSeries(
          data.map((r) => ({
            timestamp: new Date(r.timestamp),
            value: r.value,
            sensor_type: r.sensor_type,
          })),
          timeRange.interval
        );

        // Override sensor type (aggregation utility uses 'unconfigured' placeholder)
        timeSeries = aggregated.map((point) => ({
          ...point,
          sensorType,
        }));
      }

      // Insert gap markers for missing data visualization
      // Pass timeRange to ensure full range is shown (e.g., full 24h to "now")
      const timeSeriesWithGaps = insertGapMarkers(timeSeries, 15, timeRange);

      console.log(
        `[datiService.getTimeSeriesData] Fetched ${timeSeriesWithGaps.length} data points for ${sensorType}`
      );

      return timeSeriesWithGaps;
    } catch (error) {
      console.error('[datiService.getTimeSeriesData] Error:', error);
      throw error;
    }
  },

  /**
   * Fetch comparison chart data for two related sensor types
   *
   * T023: Implementation for User Story 3 - Compare Environmental Zones
   *
   * @param userId - User UUID
   * @param primaryType - First sensor type (e.g., 'dht_sopra_temp')
   * @param secondaryType - Second sensor type (e.g., 'dht_sotto_temp')
   * @param timeRange - Selected time range
   * @returns Array of aligned comparison data points
   * @throws Error if query fails
   *
   * @see data-model.md Section 3 (ComparisonChartData entity)
   * @see data-model.md Transformation 3
   */
  async getComparisonChartData(
    userId: string,
    primaryType: SensorType,
    secondaryType: SensorType,
    timeRange: TimeRange
  ): Promise<ComparisonChartData[]> {
    try {
      // Fetch both series in parallel
      const [primaryData, secondaryData] = await Promise.all([
        this.getTimeSeriesData(userId, primaryType, timeRange),
        this.getTimeSeriesData(userId, secondaryType, timeRange),
      ]);

      // Get display labels
      const primaryLabel = sensorsService.getDisplayName(primaryType);
      const secondaryLabel = sensorsService.getDisplayName(secondaryType);

      // Align timestamps
      const comparisonData = alignTimeSeries(
        primaryData,
        secondaryData,
        primaryLabel,
        secondaryLabel
      );

      console.log(
        `[datiService.getComparisonChartData] Aligned ${comparisonData.length} data points for ${primaryType} vs ${secondaryType}`
      );

      return comparisonData;
    } catch (error) {
      console.error('[datiService.getComparisonChartData] Error:', error);
      throw error;
    }
  },

  /**
   * Compute sensor status for all tracked sensor types
   *
   * T028: Implementation for User Story 4 - Identify Data Gaps
   *
   * @param userId - User UUID
   * @returns Map of sensor type to status
   * @throws Error if query fails
   *
   * @see data-model.md Section 5 (SensorStatus entity)
   */
  async getSensorStatuses(userId: string): Promise<Map<SensorType, SensorStatus>> {
    try {
      const readings = await this.getCurrentReadings(userId);
      const statusMap = new Map<SensorType, SensorStatus>();

      // All sensor types we track on Dati page
      const allTypes: SensorType[] = [
        'dht_sopra_temp',
        'dht_sopra_humidity',
        'dht_sotto_temp',
        'dht_sotto_humidity',
        'soil_moisture',
        'water_level',
      ];

      for (const sensorType of allTypes) {
        const reading = readings.find((r) => r.sensorType === sensorType);
        statusMap.set(sensorType, this.computeSensorStatus(sensorType, reading));
      }

      return statusMap;
    } catch (error) {
      console.error('[datiService.getSensorStatuses] Error:', error);
      throw error;
    }
  },

  /**
   * Check if any sensors have stale data (>15 minutes old)
   *
   * T029: Helper for User Story 4 - Identify Data Gaps
   *
   * @param userId - User UUID
   * @returns True if any sensor has stale data
   */
  async hasStaleData(userId: string): Promise<boolean> {
    try {
      const statuses = await this.getSensorStatuses(userId);
      return Array.from(statuses.values()).some(
        (status) => status.status === 'stale' || status.status === 'no_data'
      );
    } catch (error) {
      console.error('[datiService.hasStaleData] Error:', error);
      return false;
    }
  },

  /**
   * Compute individual sensor status from latest reading
   *
   * @param sensorType - Type of sensor
   * @param latestReading - Latest reading (or null if never reported)
   * @returns Sensor status with severity and message
   *
   * @see data-model.md Section 5
   */
  computeSensorStatus(
    sensorType: SensorType,
    latestReading: CurrentReading | null
  ): SensorStatus {
    if (!latestReading) {
      return {
        sensorType,
        status: 'no_data',
        lastSeenAt: null,
        message: 'Nessun dato disponibile',
        severity: 'warning',
      };
    }

    const minutesSinceReading =
      (Date.now() - latestReading.timestamp.getTime()) / (1000 * 60);

    if (minutesSinceReading > 15) {
      return {
        sensorType,
        status: 'stale',
        lastSeenAt: latestReading.timestamp,
        message: `Ultimo aggiornamento ${Math.floor(minutesSinceReading)} minuti fa`,
        severity: 'warning',
      };
    }

    return {
      sensorType,
      status: 'active',
      lastSeenAt: latestReading.timestamp,
      message: 'Aggiornato',
      severity: 'info',
    };
  },
};
