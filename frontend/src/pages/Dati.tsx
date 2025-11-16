/**
 * Dati Page - Environmental Sensor Data Dashboard
 *
 * Phase 2 (T010): Current readings section with auto-refresh.
 * Phase 3 (T021): Historical trends with time range selector and charts.
 *
 * @feature 005-lavoriamo-alla-pagina T010, T021
 * @see ../../../specs/005-lavoriamo-alla-pagina/spec.md User Stories 1 & 2
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  useCurrentReadings,
  useTimeSeriesData,
  useComparisonChartData,
  useHasStaleData,
} from '../lib/hooks/useDatiData';
import {
  CurrentReadingCard,
  CurrentReadingCardSkeleton,
  CurrentReadingCardError,
} from '../components/dati/CurrentReadingCard';
import { EmptyStateOnboarding } from '../components/dati/EmptyStateOnboarding';
import { StaleDataAlert } from '../components/dati/StaleDataAlert';
import { ChartErrorBoundary } from '../components/dati/ChartErrorBoundary';
import { TimeRangeSelector } from '../components/dati/TimeRangeSelector';
import {
  TemperatureChart,
  TemperatureChartSkeleton,
} from '../components/dati/TemperatureChart';
import {
  HumidityChart,
  HumidityChartSkeleton,
} from '../components/dati/HumidityChart';
import {
  SoilMoistureChart,
  SoilMoistureChartSkeleton,
} from '../components/dati/SoilMoistureChart';
import {
  TankLevelChart,
  TankLevelChartSkeleton,
} from '../components/dati/TankLevelChart';
import type { TimeRangeValue } from '../types/dati.types';

// ============================================================================
// Component
// ============================================================================

export function Dati() {
  // Phase 2: Current readings
  const { data: readings, isLoading, error, isFetching } = useCurrentReadings();

  // Phase 5: Stale data detection
  const { data: hasStaleData } = useHasStaleData();

  // Phase 3: Time range state and historical data
  const [timeRangeValue, setTimeRangeValue] = useState<TimeRangeValue>('24h');

  // Phase 4: Comparison charts for temperature and humidity (sopra vs sotto)
  const {
    data: temperatureData,
    isLoading: isLoadingTemp,
  } = useComparisonChartData('dht_sopra_temp', 'dht_sotto_temp', timeRangeValue);

  const {
    data: humidityData,
    isLoading: isLoadingHumidity,
  } = useComparisonChartData('dht_sopra_humidity', 'dht_sotto_humidity', timeRangeValue);

  const {
    data: soilMoistureData,
    isLoading: isLoadingSoil,
  } = useTimeSeriesData('soil_moisture', timeRangeValue);

  const {
    data: tankLevelData,
    isLoading: isLoadingTank,
  } = useTimeSeriesData('water_level', timeRangeValue);

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Dati</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Condizioni Attuali
              </h2>
              <p className="text-sm text-gray-600">
                Letture in tempo reale dai sensori
              </p>
            </div>

            {/* Loading Skeleton Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <CurrentReadingCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Dati</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Errore caricamento dati
            </h2>
            <p className="text-sm text-red-700">
              {error.message || 'Si è verificato un errore imprevisto.'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (!readings || readings.length === 0) {
    return <EmptyStateOnboarding />;
  }

  // ============================================================================
  // Main Content - Current Readings
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dati</h1>

            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? 'animate-spin text-green-600' : ''}`}
              />
              <span>
                {isFetching ? 'Aggiornamento...' : 'Aggiornamento automatico'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Phase 5: Stale Data Alert */}
        {hasStaleData && <StaleDataAlert />}

        {/* Current Readings Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Condizioni Attuali
            </h2>
            <p className="text-sm text-gray-600">
              Letture in tempo reale dai sensori della tua serra
            </p>
          </div>

          {/* Sensor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {readings.map((reading) => (
              <CurrentReadingCard
                key={reading.sensorType}
                reading={reading}
              />
            ))}
          </div>
        </section>

        {/* Phase 3: Historical Trends Section */}
        <section className="mt-12">
          {/* Time Range Selector */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <TimeRangeSelector
              selected={timeRangeValue}
              onChange={setTimeRangeValue}
            />
          </div>

          {/* Section Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Storico</h2>
            <p className="text-sm text-gray-600">
              Andamento temporale dei sensori
            </p>
          </div>

          {/* Charts Grid */}
          <div className="space-y-6">
            {/* Temperature Chart (Comparison: Sopra vs Sotto) */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Temperatura (Sopra vs Sotto)
              </h3>
              {isLoadingTemp ? (
                <TemperatureChartSkeleton />
              ) : (
                <ChartErrorBoundary>
                  <TemperatureChart
                    data={temperatureData || []}
                    timeRangeValue={timeRangeValue}
                  />
                </ChartErrorBoundary>
              )}
            </div>

            {/* Humidity Chart (Comparison: Sopra vs Sotto) */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Umidità (Sopra vs Sotto)
              </h3>
              {isLoadingHumidity ? (
                <HumidityChartSkeleton />
              ) : (
                <ChartErrorBoundary>
                  <HumidityChart
                    data={humidityData || []}
                    timeRangeValue={timeRangeValue}
                  />
                </ChartErrorBoundary>
              )}
            </div>

            {/* Soil Moisture Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Umidità Terreno
              </h3>
              {isLoadingSoil ? (
                <SoilMoistureChartSkeleton />
              ) : (
                <ChartErrorBoundary>
                  <SoilMoistureChart
                    data={soilMoistureData || []}
                    timeRangeValue={timeRangeValue}
                  />
                </ChartErrorBoundary>
              )}
            </div>

            {/* Tank Level Chart */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Livello Serbatoio
              </h3>
              {isLoadingTank ? (
                <TankLevelChartSkeleton />
              ) : (
                <ChartErrorBoundary>
                  <TankLevelChart
                    data={tankLevelData || []}
                    timeRangeValue={timeRangeValue}
                  />
                </ChartErrorBoundary>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
