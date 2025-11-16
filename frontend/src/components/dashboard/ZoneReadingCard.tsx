/**
 * ZoneReadingCard Component
 *
 * Displays temperature and humidity readings for a specific zone (Sopra/Sotto)
 * in a compact card format for the dashboard.
 */

import { Thermometer, Droplets } from 'lucide-react';
import type { CurrentReading } from '../../types/dati.types';

export interface ZoneReadingCardProps {
  zoneName: string;
  temperature: CurrentReading | null;
  humidity: CurrentReading | null;
}

export function ZoneReadingCard({ zoneName, temperature, humidity }: ZoneReadingCardProps) {
  const hasData = temperature || humidity;

  if (!hasData) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{zoneName}</h4>

      <div className="space-y-2">
        {/* Temperature */}
        {temperature && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-red-500" />
              <span className="text-xs text-gray-600">Temp</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {temperature.value.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">{temperature.unit}</span>
            </div>
          </div>
        )}

        {/* Humidity */}
        {humidity && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-600">Umid</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gray-900">
                {humidity.value.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">{humidity.unit}</span>
            </div>
          </div>
        )}
      </div>

      {/* Stale indicator */}
      {(temperature?.isStale || humidity?.isStale) && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-amber-600">⚠️ Dati non recenti</span>
        </div>
      )}
    </div>
  );
}

export function ZoneReadingCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-16 mb-3"></div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
}
