/**
 * Type definitions for Pagina Dati (Sensor Data Page)
 *
 * These types define the domain models for displaying current and historical
 * sensor data in the greenhouse monitoring application.
 *
 * @feature 005-lavoriamo-alla-pagina
 * @see ../../../specs/005-lavoriamo-alla-pagina/data-model.md
 */

// ============================================================================
// Sensor Types
// ============================================================================

export type SensorType =
  | 'dht_sopra_temp'
  | 'dht_sopra_humidity'
  | 'dht_sotto_temp'
  | 'dht_sotto_humidity'
  | 'soil_moisture'
  | 'water_level'
  | 'unconfigured';

export type TimeRangeValue = '24h' | '7d' | '30d';

export type AggregationInterval = 'raw' | 'hourly' | 'daily';

export type SensorStatusValue = 'active' | 'stale' | 'no_data' | 'error';

export type SensorStatusSeverity = 'info' | 'warning' | 'error';

// ============================================================================
// Entity: CurrentReading
// ============================================================================

/**
 * Represents the latest measurement for a specific sensor type,
 * displayed in the "Letture Correnti" (Current Readings) section.
 *
 * @see data-model.md Section 1
 */
export interface CurrentReading {
  sensorType: SensorType;
  value: number;
  unit: string;
  timestamp: Date;
  deviceId: string;
  isStale: boolean;
  displayName: string; // Human-readable name (e.g., "Temperatura Sopra")
  icon: string; // Emoji icon for sensor type
  color: string; // Tailwind color class for UI
}

// ============================================================================
// Entity: TimeSeriesDataPoint
// ============================================================================

/**
 * Represents a single point in a historical chart, supporting both
 * full-granularity and downsampled data.
 *
 * @see data-model.md Section 2
 */
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number | null; // null indicates gap in data
  sensorType: SensorType;
  isAggregated: boolean;
  aggregationMetadata?: {
    min: number;
    max: number;
    sampleCount: number;
  };
}

// ============================================================================
// Entity: ComparisonChartData
// ============================================================================

/**
 * Represents data structure for overlaid comparison charts
 * (temperature sopra vs sotto, humidity sopra vs sotto).
 *
 * @see data-model.md Section 3
 */
export interface ComparisonChartData {
  timestamp: Date;
  primaryValue: number | null; // First series (e.g., temp sopra)
  secondaryValue: number | null; // Second series (e.g., temp sotto)
  primaryLabel: string;
  secondaryLabel: string;
}

// ============================================================================
// Entity: TimeRange
// ============================================================================

/**
 * Represents a user-selected period for viewing historical data.
 *
 * @see data-model.md Section 4
 */
export interface TimeRange {
  value: TimeRangeValue;
  startDate: Date;
  endDate: Date;
  interval: AggregationInterval;
}

// ============================================================================
// Entity: SensorStatus
// ============================================================================

/**
 * Represents the operational state of a sensor, used for alerting
 * and UX feedback.
 *
 * @see data-model.md Section 5
 */
export interface SensorStatus {
  sensorType: SensorType;
  status: SensorStatusValue;
  lastSeenAt: Date | null;
  message: string;
  severity: SensorStatusSeverity;
}

// ============================================================================
// React Query Keys
// ============================================================================

/**
 * Type-safe query key factory for React Query cache management
 *
 * @see contracts/react-query-keys.contract.ts
 */
export const DatiQueryKeys = {
  all: ['dati'] as const,
  currentReadings: (userId: string) => ['dati', 'current', userId] as const,
  sensorStatuses: (userId: string) => ['dati', 'statuses', userId] as const,
  hasStaleData: (userId: string) => ['dati', 'has-stale', userId] as const,
  timeSeries: (userId: string, sensorType: SensorType, timeRange: TimeRangeValue) =>
    ['dati', 'time-series', userId, sensorType, timeRange] as const,
  comparisonChart: (
    userId: string,
    primaryType: SensorType,
    secondaryType: SensorType,
    timeRange: TimeRangeValue
  ) => ['dati', 'comparison', userId, primaryType, secondaryType, timeRange] as const,
  temperatureComparison: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'comparison', userId, 'dht_sopra_temp', 'dht_sotto_temp', timeRange] as const,
  humidityComparison: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'comparison', userId, 'dht_sopra_humidity', 'dht_sotto_humidity', timeRange] as const,
  soilMoistureChart: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'time-series', userId, 'soil_moisture', timeRange] as const,
  tankLevelChart: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'time-series', userId, 'water_level', timeRange] as const,
} as const;

// ============================================================================
// React Query Cache Configurations
// ============================================================================

/**
 * Recommended React Query options for each query type
 *
 * @see contracts/react-query-keys.contract.ts
 */
export const CacheConfigurations = {
  currentReadings: {
    staleTime: 55000, // 55 seconds
    cacheTime: 300000, // 5 minutes
    refetchInterval: 60000, // 60 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  sensorStatuses: {
    staleTime: 55000,
    cacheTime: 300000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  timeSeries: {
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  comparisonCharts: {
    staleTime: 300000,
    cacheTime: 600000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
} as const;
