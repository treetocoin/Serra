/**
 * Formatting utilities for sensor values and timestamps
 *
 * Provides type-specific decimal precision and Italian locale formatting
 * for the Dati page display.
 *
 * @feature 005-lavoriamo-alla-pagina
 * @see ../../../specs/005-lavoriamo-alla-pagina/research.md Section 7
 */

import { formatDistanceToNow, format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { SensorType } from '../../types/dati.types';

// ============================================================================
// Sensor Value Formatting
// ============================================================================

/**
 * Format sensor value with appropriate decimal precision based on sensor type
 *
 * Precision standards:
 * - Temperature: 1 decimal (DHT22 accuracy ±0.5°C)
 * - Humidity: 0 decimals (DHT22 accuracy ±2%)
 * - Soil moisture: 0 decimals (capacitive sensors ~5% variance)
 * - Tank level: varies by unit (cm/L: 1 decimal, %: 0 decimals)
 *
 * @param value - Numeric sensor reading
 * @param sensorType - Type of sensor (determines precision)
 * @param unit - Optional unit for edge cases (tank level percentage)
 * @returns Formatted string value
 */
export function formatSensorValue(
  value: number,
  sensorType: SensorType,
  unit?: string
): string {
  // Handle null/undefined
  if (value === null || value === undefined || isNaN(value)) {
    return '--';
  }

  switch (sensorType) {
    case 'dht_sopra_temp':
    case 'dht_sotto_temp':
      return value.toFixed(1);

    case 'dht_sopra_humidity':
    case 'dht_sotto_humidity':
    case 'soil_moisture':
      return Math.round(value).toString();

    case 'water_level':
      // Tank level: percentage uses 0 decimals, others use 1 decimal
      return unit === '%' ? Math.round(value).toString() : value.toFixed(1);

    case 'unconfigured':
      return '--';

    default:
      return value.toString();
  }
}

// ============================================================================
// Timestamp Formatting
// ============================================================================

/**
 * Format timestamp in various display formats with Italian locale
 *
 * Formats:
 * - 'short': "14:30" (time only, for compact display)
 * - 'long': "14 novembre 2025, 14:30" (full date and time)
 * - 'relative': "2 minuti fa" (relative time, for recency indicators)
 *
 * @param timestamp - Date to format
 * @param formatType - Display format type
 * @returns Formatted date/time string in Italian
 */
export function formatTimestamp(
  timestamp: Date,
  formatType: 'short' | 'long' | 'relative'
): string {
  // Handle null/undefined
  if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
    return '--';
  }

  try {
    switch (formatType) {
      case 'short':
        // Time only: "14:30"
        return format(timestamp, 'HH:mm', { locale: it });

      case 'long':
        // Full date and time: "14 novembre 2025, 14:30"
        return format(timestamp, 'dd MMMM yyyy, HH:mm', { locale: it });

      case 'relative':
        // Relative time: "2 minuti fa", "3 ore fa", "2 giorni fa"
        return formatDistanceToNow(timestamp, {
          addSuffix: true,
          locale: it,
        });

      default:
        return format(timestamp, 'PPpp', { locale: it });
    }
  } catch (error) {
    console.error('[formatTimestamp] Error formatting timestamp:', error);
    return '--';
  }
}

/**
 * Format timestamp for chart X-axis based on time range
 *
 * Adapts format based on data density:
 * - 24h range: "HH:mm" (time only)
 * - 7d range: "dd/MM HH:mm" (day and time)
 * - 30d range: "dd/MM" (day only)
 *
 * @param timestamp - Date to format
 * @param timeRange - Current time range selection
 * @returns Formatted string for axis label
 */
export function formatChartAxisTimestamp(
  timestamp: Date | number,
  timeRange: '24h' | '7d' | '30d'
): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (isNaN(date.getTime())) {
    return '';
  }

  try {
    switch (timeRange) {
      case '24h':
        return format(date, 'HH:mm', { locale: it });
      case '7d':
        return format(date, 'dd/MM HH:mm', { locale: it });
      case '30d':
        return format(date, 'dd/MM', { locale: it });
      default:
        return format(date, 'dd/MM', { locale: it });
    }
  } catch (error) {
    console.error('[formatChartAxisTimestamp] Error formatting timestamp:', error);
    return '';
  }
}

/**
 * Format timestamp for chart tooltip with full context
 *
 * @param timestamp - Date to format
 * @returns Full date/time string for tooltip display
 */
export function formatChartTooltipTimestamp(timestamp: Date | number): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (isNaN(date.getTime())) {
    return '';
  }

  try {
    // Format: "14 novembre 2025, 14:30"
    return format(date, 'dd MMMM yyyy, HH:mm', { locale: it });
  } catch (error) {
    console.error('[formatChartTooltipTimestamp] Error formatting timestamp:', error);
    return '';
  }
}
