/**
 * useDatiData Hook - React Query integration for Pagina Dati
 *
 * Provides data fetching hooks with auto-refresh, caching, and loading states
 * for the Dati page. Phase 2 (T007) implements only current readings.
 *
 * @feature 005-lavoriamo-alla-pagina T007
 * @see ../../../specs/005-lavoriamo-alla-pagina/contracts/react-query.contract.ts
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { datiService } from '../../services/dati.service';
import type {
  CurrentReading,
  SensorStatus,
  SensorType,
  TimeSeriesDataPoint,
  TimeRangeValue,
  TimeRange,
  ComparisonChartData,
} from '../../types/dati.types';
import { DatiQueryKeys, CacheConfigurations } from '../../types/dati.types';
import { createTimeRange } from '../../lib/utils/time-series';

// ============================================================================
// Hook: useCurrentReadings
// ============================================================================

/**
 * Fetch current readings for all sensors with 60-second auto-refresh
 *
 * @returns Query result with array of current readings
 *
 * Features:
 * - Auto-refresh every 60 seconds
 * - Refetch on window focus
 * - 55-second stale time (slightly less than refresh interval)
 * - Automatic error handling
 *
 * @example
 * ```tsx
 * function DatiPage() {
 *   const { data: readings, isLoading, error } = useCurrentReadings();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!readings || readings.length === 0) return <EmptyStateOnboarding />;
 *
 *   return <CurrentReadingsGrid readings={readings} />;
 * }
 * ```
 */
export function useCurrentReadings(): UseQueryResult<CurrentReading[], Error> {
  const { user } = useAuth();

  return useQuery<CurrentReading[], Error>({
    queryKey: DatiQueryKeys.currentReadings(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return await datiService.getCurrentReadings(user.id);
    },
    enabled: !!user?.id,
    ...CacheConfigurations.currentReadings,
  });
}

// ============================================================================
// Hook: useSensorStatuses
// ============================================================================

/**
 * Fetch sensor statuses (active/stale/no_data) for all tracked sensor types
 *
 * @returns Query result with Map of sensor type to status
 *
 * Features:
 * - Auto-refresh every 60 seconds
 * - Useful for health indicators and alert badges
 *
 * @example
 * ```tsx
 * function StatusIndicator() {
 *   const { data: statuses, isLoading } = useSensorStatuses();
 *
 *   if (isLoading) return null;
 *
 *   const staleCount = Array.from(statuses?.values() || [])
 *     .filter(s => s.status === 'stale' || s.status === 'no_data')
 *     .length;
 *
 *   return staleCount > 0 ? <AlertBadge count={staleCount} /> : null;
 * }
 * ```
 */
export function useSensorStatuses(): UseQueryResult<
  Map<SensorType, SensorStatus>,
  Error
> {
  const { user } = useAuth();

  return useQuery<Map<SensorType, SensorStatus>, Error>({
    queryKey: DatiQueryKeys.sensorStatuses(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return await datiService.getSensorStatuses(user.id);
    },
    enabled: !!user?.id,
    ...CacheConfigurations.sensorStatuses,
  });
}

// ============================================================================
// Hook: useHasStaleData
// ============================================================================

/**
 * Check if any sensors have stale data (>15 minutes old)
 *
 * @returns Query result with boolean indicating stale data presence
 *
 * Lightweight alternative to useSensorStatuses when only checking for
 * any stale data without needing full status details.
 *
 * @example
 * ```tsx
 * function PageHeader() {
 *   const { data: hasStale } = useHasStaleData();
 *
 *   return (
 *     <header>
 *       <h1>Dati</h1>
 *       {hasStale && <StaleDataWarning />}
 *     </header>
 *   );
 * }
 * ```
 */
export function useHasStaleData(): UseQueryResult<boolean, Error> {
  const { user } = useAuth();

  return useQuery<boolean, Error>({
    queryKey: DatiQueryKeys.hasStaleData(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) {
        return false;
      }
      return await datiService.hasStaleData(user.id);
    },
    enabled: !!user?.id,
    ...CacheConfigurations.sensorStatuses, // Same refresh rate as statuses
  });
}

// ============================================================================
// Hook: useTimeSeriesData (Phase 3 - T014 & T020)
// ============================================================================

/**
 * Fetch time-series data for a specific sensor type with time range control
 *
 * @param sensorType - Type of sensor to fetch data for
 * @param timeRangeValue - Time range selector ('24h' | '7d' | '30d')
 * @returns Query result with time-series data points
 *
 * Features:
 * - Automatic granularity selection based on time range
 * - 5-minute stale time (no auto-refresh)
 * - Refetch on window focus disabled
 * - Gap markers inserted for missing data
 *
 * @example
 * ```tsx
 * function TemperatureChart() {
 *   const { data, isLoading } = useTimeSeriesData('dht_sopra_temp', '24h');
 *
 *   if (isLoading) return <ChartSkeleton />;
 *   return <LineChart data={data} />;
 * }
 * ```
 */
export function useTimeSeriesData(
  sensorType: SensorType,
  timeRangeValue: TimeRangeValue
): UseQueryResult<TimeSeriesDataPoint[], Error> {
  const { user } = useAuth();
  const timeRange = createTimeRange(timeRangeValue);

  return useQuery<TimeSeriesDataPoint[], Error>({
    queryKey: DatiQueryKeys.timeSeries(user?.id || '', sensorType, timeRangeValue),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return await datiService.getTimeSeriesData(user.id, sensorType, timeRange);
    },
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ============================================================================
// Hook: useComparisonChartData (Phase 4 - T024)
// ============================================================================

/**
 * Fetch comparison chart data for two sensor types (overlaid charts)
 *
 * @param primaryType - First sensor type (e.g., 'dht_sopra_temp')
 * @param secondaryType - Second sensor type (e.g., 'dht_sotto_temp')
 * @param timeRangeValue - Time range selector ('24h' | '7d' | '30d')
 * @returns Query result with aligned comparison data
 *
 * Features:
 * - Fetches and aligns two sensor types by timestamp
 * - 5-minute stale time (no auto-refresh)
 * - Returns aligned data points for overlaid visualization
 *
 * @example
 * ```tsx
 * function ComparisonChart() {
 *   const { data, isLoading } = useComparisonChartData(
 *     'dht_sopra_temp',
 *     'dht_sotto_temp',
 *     '24h'
 *   );
 *
 *   if (isLoading) return <ChartSkeleton />;
 *   return <DualLineChart data={data} />;
 * }
 * ```
 */
export function useComparisonChartData(
  primaryType: SensorType,
  secondaryType: SensorType,
  timeRangeValue: TimeRangeValue
): UseQueryResult<ComparisonChartData[], Error> {
  const { user } = useAuth();
  const timeRange = createTimeRange(timeRangeValue);

  return useQuery<ComparisonChartData[], Error>({
    queryKey: DatiQueryKeys.comparisonChart(
      user?.id || '',
      primaryType,
      secondaryType,
      timeRangeValue
    ),
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      return await datiService.getComparisonChartData(
        user.id,
        primaryType,
        secondaryType,
        timeRange
      );
    },
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// ============================================================================
// Admin Hooks - For viewing other users' data
// ============================================================================

/**
 * Admin version: Fetch current readings for a specific user
 *
 * @param userId - Target user ID to fetch readings for
 * @returns Query result with array of current readings
 */
export function useAdminCurrentReadings(userId: string | null): UseQueryResult<CurrentReading[], Error> {
  return useQuery<CurrentReading[], Error>({
    queryKey: DatiQueryKeys.currentReadings(userId || ''),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return await datiService.getCurrentReadings(userId);
    },
    enabled: !!userId,
    ...CacheConfigurations.currentReadings,
  });
}

/**
 * Admin version: Fetch time-series data for a specific user and sensor type
 *
 * @param userId - Target user ID
 * @param sensorType - Type of sensor to fetch data for
 * @param timeRangeValue - Time range selector
 * @returns Query result with time-series data points
 */
export function useAdminTimeSeriesData(
  userId: string | null,
  sensorType: SensorType,
  timeRangeValue: TimeRangeValue
): UseQueryResult<TimeSeriesDataPoint[], Error> {
  const timeRange = createTimeRange(timeRangeValue);

  return useQuery<TimeSeriesDataPoint[], Error>({
    queryKey: DatiQueryKeys.timeSeries(userId || '', sensorType, timeRangeValue),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return await datiService.getTimeSeriesData(userId, sensorType, timeRange);
    },
    enabled: !!userId,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Admin version: Fetch comparison chart data for a specific user
 *
 * @param userId - Target user ID
 * @param primaryType - First sensor type
 * @param secondaryType - Second sensor type
 * @param timeRangeValue - Time range selector
 * @returns Query result with aligned comparison data
 */
export function useAdminComparisonChartData(
  userId: string | null,
  primaryType: SensorType,
  secondaryType: SensorType,
  timeRangeValue: TimeRangeValue
): UseQueryResult<ComparisonChartData[], Error> {
  const timeRange = createTimeRange(timeRangeValue);

  return useQuery<ComparisonChartData[], Error>({
    queryKey: DatiQueryKeys.comparisonChart(
      userId || '',
      primaryType,
      secondaryType,
      timeRangeValue
    ),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return await datiService.getComparisonChartData(
        userId,
        primaryType,
        secondaryType,
        timeRange
      );
    },
    enabled: !!userId,
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
