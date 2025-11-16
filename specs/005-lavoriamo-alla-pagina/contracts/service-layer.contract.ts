/**
 * Service Layer Contracts for Dati Page
 *
 * These interfaces define the public API of service modules that the Dati page
 * will use for data fetching and transformation.
 *
 * @version 1.0.0
 * @feature 005-lavoriamo-alla-pagina
 */

import type {
  SensorType,
  CurrentReadingQueryResult,
  TimeSeriesQueryResult,
  DeviceQueryResult,
  SensorQueryResult,
} from './supabase-queries.contract';

// ============================================================================
// Domain Models (Frontend Representation)
// ============================================================================

export interface CurrentReading {
  sensorType: SensorType;
  value: number;
  unit: string;
  timestamp: Date;
  deviceId: string;
  isStale: boolean;
  displayName: string;
  icon: string;
  color: string;
}

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number | null;
  sensorType: SensorType;
  isAggregated: boolean;
  aggregationMetadata?: {
    min: number;
    max: number;
    sampleCount: number;
  };
}

export interface ComparisonChartData {
  timestamp: Date;
  primaryValue: number | null;
  secondaryValue: number | null;
  primaryLabel: string;
  secondaryLabel: string;
}

export type TimeRangeValue = '24h' | '7d' | '30d';
export type AggregationInterval = 'raw' | 'hourly' | 'daily';

export interface TimeRange {
  value: TimeRangeValue;
  startDate: Date;
  endDate: Date;
  interval: AggregationInterval;
}

export type SensorStatusValue = 'active' | 'stale' | 'no_data' | 'error';
export type SensorStatusSeverity = 'info' | 'warning' | 'error';

export interface SensorStatus {
  sensorType: SensorType;
  status: SensorStatusValue;
  lastSeenAt: Date | null;
  message: string;
  severity: SensorStatusSeverity;
}

// ============================================================================
// Service: DatiService
// ============================================================================

/**
 * DatiService: New service module for Dati page data operations
 *
 * Location: frontend/src/services/dati.service.ts
 *
 * This service provides high-level data fetching and transformation
 * specifically tailored for the Dati page requirements.
 */
export interface IDatiService {
  /**
   * Fetch current readings for all sensors belonging to user's devices
   *
   * @param userId - User UUID
   * @returns Array of current readings with UI metadata
   * @throws Error if query fails
   *
   * Cache Strategy: React Query with 55s staleTime, 60s refetchInterval
   */
  getCurrentReadings(userId: string): Promise<CurrentReading[]>;

  /**
   * Fetch time-series data for a specific sensor type across all devices
   *
   * @param userId - User UUID
   * @param sensorType - Type of sensor to query
   * @param timeRange - Selected time range
   * @returns Array of time-series data points (may be aggregated based on range)
   * @throws Error if query fails
   *
   * Cache Strategy: React Query with 5min staleTime, manual invalidation on time range change
   */
  getTimeSeriesData(
    userId: string,
    sensorType: SensorType,
    timeRange: TimeRange
  ): Promise<TimeSeriesDataPoint[]>;

  /**
   * Fetch comparison chart data for two related sensor types (e.g., temp sopra vs sotto)
   *
   * @param userId - User UUID
   * @param primaryType - First sensor type (e.g., 'dht_sopra_temp')
   * @param secondaryType - Second sensor type (e.g., 'dht_sotto_temp')
   * @param timeRange - Selected time range
   * @returns Array of aligned comparison data points
   * @throws Error if query fails
   *
   * Cache Strategy: React Query with 5min staleTime
   */
  getComparisonChartData(
    userId: string,
    primaryType: SensorType,
    secondaryType: SensorType,
    timeRange: TimeRange
  ): Promise<ComparisonChartData[]>;

  /**
   * Compute sensor status for all tracked sensor types
   *
   * @param userId - User UUID
   * @returns Map of sensor type to status
   * @throws Error if query fails
   *
   * Cache Strategy: Derived from getCurrentReadings, same cache key
   */
  getSensorStatuses(userId: string): Promise<Map<SensorType, SensorStatus>>;

  /**
   * Check if any sensors have stale data (>15 minutes old)
   *
   * @param userId - User UUID
   * @returns True if any sensor has stale data
   *
   * Cache Strategy: Derived from getCurrentReadings
   */
  hasStaleData(userId: string): Promise<boolean>;
}

// ============================================================================
// Service: DevicesService (Extension)
// ============================================================================

/**
 * DevicesService: Existing service, may need minor extensions
 *
 * Location: frontend/src/services/devices.service.ts
 *
 * Current functionality:
 * - getDevices(userId: string): Promise<{ devices: Device[] }>
 *
 * No changes required for this feature.
 */
export interface IDevicesService {
  getDevices(userId: string): Promise<{ devices: DeviceQueryResult[] }>;
}

// ============================================================================
// Service: SensorsService (Extension)
// ============================================================================

/**
 * SensorsService: Existing service, may need minor extensions
 *
 * Location: frontend/src/services/sensors.service.ts
 *
 * Current functionality:
 * - getSensorsByDevice(deviceId: string): Promise<{ sensors: Sensor[] }>
 * - getSensorConfig(sensorType: string): { icon: string, color: string, bgColor: string }
 *
 * Extensions needed:
 * - getDisplayName(sensorType: SensorType): string
 */
export interface ISensorsService {
  getSensorsByDevice(deviceId: string): Promise<{ sensors: SensorQueryResult[] }>;

  getSensorConfig(
    sensorType: string
  ): { icon: string; color: string; bgColor: string };

  /**
   * Get human-readable display name for sensor type
   *
   * @param sensorType - Sensor type from database
   * @returns Italian display name (e.g., "Temperatura Sopra")
   *
   * NEW METHOD - Required for this feature
   */
  getDisplayName(sensorType: SensorType): string;
}

// ============================================================================
// Service: HistoryService (Extension)
// ============================================================================

/**
 * HistoryService: Existing service, requires refactoring
 *
 * Location: frontend/src/services/history.service.ts
 *
 * Current functionality (to be refactored):
 * - getHistoricalReadings(sensorId, startDate, endDate): Promise<Reading[]>
 * - getAggregatedData(sensorId, interval, startDate, endDate): Promise<AggregatedReading[]>
 *
 * Refactoring needed:
 * - Change from sensor_id-based queries to sensor_type-based queries
 * - Add smart interval selection logic
 * - Add gap detection logic
 */
export interface IHistoryService {
  /**
   * Fetch historical readings with automatic granularity selection
   *
   * REFACTORED METHOD - Changes from existing implementation:
   * - Accepts sensorType instead of sensorId
   * - Automatically selects raw vs aggregated based on timeRange.interval
   * - Inserts gap markers for missing data visualization
   *
   * @param userId - User UUID
   * @param sensorType - Type of sensor to query
   * @param timeRange - Time range with pre-selected interval
   * @returns Array of time-series data points with gaps marked
   * @throws Error if query fails
   */
  getHistoricalData(
    userId: string,
    sensorType: SensorType,
    timeRange: TimeRange
  ): Promise<TimeSeriesDataPoint[]>;

  /**
   * Aggregate time-series data client-side
   *
   * INTERNAL METHOD - Used when database aggregation RPC is not available
   *
   * @param readings - Raw readings from database
   * @param interval - Aggregation granularity
   * @returns Aggregated time-series data
   */
  aggregateClientSide(
    readings: TimeSeriesQueryResult[],
    interval: 'hourly' | 'daily'
  ): TimeSeriesDataPoint[];
}

// ============================================================================
// Utility Functions Contract
// ============================================================================

/**
 * Formatting utilities for sensor values
 *
 * Location: frontend/src/lib/utils/formatting.ts
 */
export interface IFormattingUtils {
  /**
   * Format sensor value with appropriate decimal precision
   *
   * @param value - Numeric value
   * @param sensorType - Type of sensor
   * @param unit - Unit of measurement (optional, for tank level edge cases)
   * @returns Formatted string (e.g., "22.5" or "45")
   */
  formatSensorValue(value: number, sensorType: SensorType, unit?: string): string;

  /**
   * Format timestamp for display
   *
   * @param timestamp - Date object
   * @param format - 'short' | 'long' | 'relative'
   * @returns Formatted string (e.g., "14:30" or "2 minuti fa")
   */
  formatTimestamp(timestamp: Date, format: 'short' | 'long' | 'relative'): string;
}

/**
 * Time-series transformation utilities
 *
 * Location: frontend/src/lib/utils/time-series.ts
 */
export interface ITimeSeriesUtils {
  /**
   * Create TimeRange object from TimeRangeValue
   *
   * @param value - Range selector value ('24h' | '7d' | '30d')
   * @returns TimeRange with calculated dates and interval
   */
  createTimeRange(value: TimeRangeValue): TimeRange;

  /**
   * Align two time-series by timestamp for comparison charts
   *
   * @param primarySeries - First time-series data
   * @param secondarySeries - Second time-series data
   * @param primaryLabel - Label for first series
   * @param secondaryLabel - Label for second series
   * @returns Aligned comparison chart data
   */
  alignTimeSeries(
    primarySeries: TimeSeriesDataPoint[],
    secondarySeries: TimeSeriesDataPoint[],
    primaryLabel: string,
    secondaryLabel: string
  ): ComparisonChartData[];

  /**
   * Insert null markers for visualization of data gaps
   *
   * @param timeSeries - Time-series data
   * @param gapThresholdMinutes - Minimum gap size to mark (default: 15)
   * @returns Time-series with gap markers inserted
   */
  insertGapMarkers(
    timeSeries: TimeSeriesDataPoint[],
    gapThresholdMinutes?: number
  ): TimeSeriesDataPoint[];
}

// ============================================================================
// React Hooks Contract (Custom Hooks)
// ============================================================================

/**
 * Custom hook for Dati page data
 *
 * Location: frontend/src/lib/hooks/useDatiData.ts
 */
export interface IUseDatiData {
  currentReadings: CurrentReading[] | undefined;
  sensorStatuses: Map<SensorType, SensorStatus> | undefined;
  hasStaleData: boolean;
  isLoadingCurrent: boolean;
  errorCurrent: Error | null;

  timeRange: TimeRange;
  setTimeRangeValue: (value: TimeRangeValue) => void;

  temperatureData: ComparisonChartData[] | undefined;
  humidityData: ComparisonChartData[] | undefined;
  soilMoistureData: TimeSeriesDataPoint[] | undefined;
  tankLevelData: TimeSeriesDataPoint[] | undefined;
  isLoadingCharts: boolean;
  errorCharts: Error | null;

  refetchAll: () => Promise<void>;
}

/**
 * Hook return signature
 */
export type UseDatiDataReturn = IUseDatiData;
