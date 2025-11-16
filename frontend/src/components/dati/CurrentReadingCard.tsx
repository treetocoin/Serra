/**
 * CurrentReadingCard Component
 *
 * Displays a single sensor's current reading in a card format with:
 * - Sensor icon and display name
 * - Current value with type-specific formatting
 * - Unit display
 * - Timestamp (relative format)
 * - Stale data indicator (if >15 minutes old)
 *
 * @feature 005-lavoriamo-alla-pagina T008
 * @see ../../../specs/005-lavoriamo-alla-pagina/research.md Section 6
 */

import { AlertCircle } from 'lucide-react';
import type { CurrentReading } from '../../types/dati.types';
import { formatSensorValue, formatTimestamp } from '../../lib/utils/formatting';

// ============================================================================
// Component Props
// ============================================================================

export interface CurrentReadingCardProps {
  reading: CurrentReading;
}

// ============================================================================
// Component
// ============================================================================

export function CurrentReadingCard({ reading }: CurrentReadingCardProps) {
  const {
    displayName,
    icon,
    color,
    value,
    unit,
    timestamp,
    isStale,
    sensorType,
  } = reading;

  // Format value with sensor-specific precision
  const formattedValue = formatSensorValue(value, sensorType, unit);

  // Format timestamp as relative time (Italian locale)
  const relativeTime = formatTimestamp(timestamp, 'relative');

  return (
    <div
      className={`
        relative bg-white rounded-lg shadow-sm border-l-4 p-6 transition-all hover:shadow-md
        ${
          isStale
            ? 'border-l-yellow-500 border-t border-r border-b border-yellow-200 bg-yellow-50/40 opacity-95'
            : 'border-l-green-500 border-t border-r border-b border-gray-200'
        }
      `}
    >
      {/* Stale Data Indicator */}
      {isStale && (
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center gap-1 bg-yellow-500 text-white px-2 py-1 rounded text-xs font-semibold">
            <AlertCircle className="h-3 w-3" />
            Vecchio
          </span>
        </div>
      )}

      {/* Sensor Icon and Name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl" aria-hidden="true">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">{displayName}</h3>
        </div>
      </div>

      {/* Value and Unit */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-4xl font-bold ${color}`}>{formattedValue}</span>
        <span className="text-xl text-gray-500">{unit}</span>
      </div>

      {/* Timestamp */}
      <div
        className={`flex items-center gap-1 text-sm ${
          isStale ? 'text-yellow-700 font-medium' : 'text-gray-500'
        }`}
      >
        <span>Aggiornato</span>
        <span className="font-medium">{relativeTime}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

/**
 * Skeleton loader for CurrentReadingCard during data fetch
 *
 * Matches the card's structure with animated placeholders.
 */
export function CurrentReadingCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
      {/* Icon and Name Skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </div>

      {/* Value Skeleton */}
      <div className="flex items-baseline gap-2 mb-2">
        <div className="h-10 w-24 bg-gray-300 rounded" />
        <div className="h-6 w-12 bg-gray-200 rounded" />
      </div>

      {/* Timestamp Skeleton */}
      <div className="h-4 w-40 bg-gray-200 rounded" />
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

/**
 * Error state for CurrentReadingCard when data fetch fails
 *
 * Displays a user-friendly error message within the card structure.
 */
export function CurrentReadingCardError() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <h3 className="text-sm font-medium text-gray-900">Errore caricamento</h3>
      </div>
      <p className="text-sm text-gray-600">
        Impossibile caricare i dati del sensore.
      </p>
    </div>
  );
}
