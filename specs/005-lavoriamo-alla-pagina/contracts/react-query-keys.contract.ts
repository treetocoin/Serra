/**
 * React Query Key Patterns for Dati Page
 *
 * Standardized cache key patterns for React Query to ensure consistent
 * caching behavior and enable targeted cache invalidation.
 *
 * @version 1.0.0
 * @feature 005-lavoriamo-alla-pagina
 */

import type { SensorType, TimeRangeValue } from './service-layer.contract';

// ============================================================================
// Query Key Factory Pattern
// ============================================================================

/**
 * DatiQueryKeys: Factory for generating React Query cache keys
 *
 * Benefits:
 * - Type-safe key generation
 * - Centralized key management
 * - Enables wildcard invalidation (e.g., invalidate all 'dati' queries)
 * - Self-documenting cache structure
 */
export const DatiQueryKeys = {
  /**
   * Base key for all Dati page queries
   * Use this to invalidate everything on the page
   */
  all: ['dati'] as const,

  /**
   * Current readings keys
   */
  currentReadings: (userId: string) => ['dati', 'current', userId] as const,

  /**
   * Sensor statuses (derived from current readings, shares cache dependency)
   */
  sensorStatuses: (userId: string) => ['dati', 'statuses', userId] as const,

  /**
   * Time-series data keys (single sensor type)
   */
  timeSeries: (userId: string, sensorType: SensorType, timeRange: TimeRangeValue) =>
    ['dati', 'time-series', userId, sensorType, timeRange] as const,

  /**
   * Comparison chart data keys (two sensor types overlaid)
   */
  comparisonChart: (
    userId: string,
    primaryType: SensorType,
    secondaryType: SensorType,
    timeRange: TimeRangeValue
  ) => ['dati', 'comparison', userId, primaryType, secondaryType, timeRange] as const,

  /**
   * Temperature comparison (sopra vs sotto)
   */
  temperatureComparison: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'comparison', userId, 'dht_sopra_temp', 'dht_sotto_temp', timeRange] as const,

  /**
   * Humidity comparison (sopra vs sotto)
   */
  humidityComparison: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'comparison', userId, 'dht_sopra_humidity', 'dht_sotto_humidity', timeRange] as const,

  /**
   * Soil moisture chart
   */
  soilMoistureChart: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'time-series', userId, 'soil_moisture', timeRange] as const,

  /**
   * Tank level chart
   */
  tankLevelChart: (userId: string, timeRange: TimeRangeValue) =>
    ['dati', 'time-series', userId, 'water_level', timeRange] as const,
} as const;

// ============================================================================
// Cache Invalidation Patterns
// ============================================================================

/**
 * Common invalidation scenarios and their corresponding patterns
 *
 * Usage with React Query:
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * // Invalidate all Dati page queries
 * queryClient.invalidateQueries({ queryKey: DatiQueryKeys.all });
 *
 * // Invalidate only current readings for a user
 * queryClient.invalidateQueries({ queryKey: DatiQueryKeys.currentReadings(userId) });
 *
 * // Invalidate all time-series queries (regardless of sensor type or range)
 * queryClient.invalidateQueries({ queryKey: ['dati', 'time-series'] });
 * ```
 */
export const CacheInvalidationPatterns = {
  /**
   * When new sensor readings arrive (e.g., device sends data)
   * Invalidate: current readings, sensor statuses
   */
  onNewReadings: (userId: string, queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: DatiQueryKeys.currentReadings(userId) });
    queryClient.invalidateQueries({ queryKey: DatiQueryKeys.sensorStatuses(userId) });
  },

  /**
   * When user changes time range selector
   * Invalidate: all chart queries for the new time range
   * (React Query will automatically refetch based on new keys)
   */
  onTimeRangeChange: (userId: string, newTimeRange: TimeRangeValue, queryClient: any) => {
    // No explicit invalidation needed - changing time range changes query keys,
    // triggering automatic refetch. This is just for documentation.
    // If we wanted to prefetch the new range:
    queryClient.prefetchQuery({
      queryKey: DatiQueryKeys.temperatureComparison(userId, newTimeRange),
    });
  },

  /**
   * When user deletes all sensor data
   * Invalidate: everything on the Dati page
   */
  onDeleteAllData: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: DatiQueryKeys.all });
  },

  /**
   * When device goes offline/online (status change)
   * Invalidate: current readings (may affect staleness indicators)
   */
  onDeviceStatusChange: (userId: string, queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: DatiQueryKeys.currentReadings(userId) });
  },
} as const;

// ============================================================================
// Cache Configuration Standards
// ============================================================================

/**
 * Recommended React Query options for each query type
 */
export const CacheConfigurations = {
  /**
   * Current readings: Frequent updates, short stale time
   */
  currentReadings: {
    staleTime: 55000, // 55 seconds (just under 1-minute refetch interval)
    cacheTime: 300000, // 5 minutes (keep in cache even if unmounted)
    refetchInterval: 60000, // 60 seconds (auto-refresh)
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: true, // Refetch after network reconnection
  },

  /**
   * Sensor statuses: Derived from current readings, same config
   */
  sensorStatuses: {
    staleTime: 55000,
    cacheTime: 300000,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },

  /**
   * Time-series data: Less frequent updates, longer stale time
   */
  timeSeries: {
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
    refetchInterval: false, // No auto-refresh (user-triggered via time range change)
    refetchOnWindowFocus: false, // Don't refetch on focus (data rarely changes)
    refetchOnReconnect: true, // Refetch after network reconnection
  },

  /**
   * Comparison charts: Same as time-series
   */
  comparisonCharts: {
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
} as const;

// ============================================================================
// TypeScript Utilities for Query Keys
// ============================================================================

/**
 * Extract userId from a Dati query key (useful for debugging)
 */
export function extractUserIdFromQueryKey(queryKey: readonly unknown[]): string | null {
  if (queryKey[0] !== 'dati') return null;
  if (queryKey.length < 3) return null;
  return typeof queryKey[2] === 'string' ? queryKey[2] : null;
}

/**
 * Check if a query key is a Dati page query
 */
export function isDatiQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'dati';
}

/**
 * Check if a query key is a current readings query
 */
export function isCurrentReadingsQuery(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'dati' && queryKey[1] === 'current';
}

/**
 * Check if a query key is a time-series query
 */
export function isTimeSeriesQuery(queryKey: readonly unknown[]): boolean {
  return (
    queryKey[0] === 'dati' &&
    (queryKey[1] === 'time-series' || queryKey[1] === 'comparison')
  );
}
