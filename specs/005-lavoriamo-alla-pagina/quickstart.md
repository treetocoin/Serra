# Quickstart Guide: Implementing Pagina Dati

**Feature**: 005-lavoriamo-alla-pagina
**Date**: 2025-11-14
**For**: Developers implementing the "Dati" page redesign

## Overview

This quickstart provides a step-by-step implementation path for the "Dati" (Data) page redesign. Follow these steps sequentially to ensure all dependencies are met.

---

## Prerequisites

Before starting, ensure you have:

1. ✅ Existing Serra project checked out on branch `005-lavoriamo-alla-pagina`
2. ✅ Node.js 18+ and npm/pnpm installed
3. ✅ Supabase project credentials configured in `.env`
4. ✅ Familiarity with React 19, TypeScript, TailwindCSS, and React Query
5. ✅ Read the following docs:
   - [`spec.md`](./spec.md) - Feature requirements
   - [`research.md`](./research.md) - Technical decisions
   - [`data-model.md`](./data-model.md) - Entity definitions
   - [`contracts/`](./contracts/) - API contracts

---

## Implementation Roadmap

### Phase 1: Foundation (Day 1)

#### 1.1 Create New Service Layer

**File**: `frontend/src/services/dati.service.ts`

```typescript
import { supabase } from '../lib/supabase';
import type { CurrentReading, TimeRange, TimeSeriesDataPoint } from '../types/dati.types';

export const datiService = {
  async getCurrentReadings(userId: string): Promise<CurrentReading[]> {
    // TODO: Implement (see contracts/service-layer.contract.ts)
    throw new Error('Not implemented');
  },

  async getTimeSeriesData(
    userId: string,
    sensorType: string,
    timeRange: TimeRange
  ): Promise<TimeSeriesDataPoint[]> {
    // TODO: Implement
    throw new Error('Not implemented');
  },

  // ... other methods from service-layer.contract.ts
};
```

**Reference**: `contracts/service-layer.contract.ts` - Lines 50-78

**Test**: Create a simple test query in Supabase dashboard to verify data access

---

#### 1.2 Create TypeScript Type Definitions

**File**: `frontend/src/types/dati.types.ts`

Copy interface definitions from `data-model.md` and `contracts/service-layer.contract.ts`:

```typescript
export type SensorType = 'dht_sopra_temp' | 'dht_sopra_humidity' | ...;
export interface CurrentReading { ... }
export interface TimeSeriesDataPoint { ... }
export interface ComparisonChartData { ... }
export interface TimeRange { ... }
export interface SensorStatus { ... }
```

**Reference**: `data-model.md` - Sections 1-5

---

#### 1.3 Create Utility Functions

**File**: `frontend/src/lib/utils/formatting.ts`

```typescript
import type { SensorType } from '../../types/dati.types';

export function formatSensorValue(
  value: number,
  sensorType: SensorType,
  unit?: string
): string {
  // See research.md Section 7 for precision standards
  switch (sensorType) {
    case 'dht_sopra_temp':
    case 'dht_sotto_temp':
      return value.toFixed(1);
    // ... other cases
  }
}

export function formatTimestamp(
  timestamp: Date,
  format: 'short' | 'long' | 'relative'
): string {
  // Implement using date-fns or similar
}
```

**File**: `frontend/src/lib/utils/time-series.ts`

```typescript
import type { TimeRange, TimeRangeValue } from '../../types/dati.types';

export function createTimeRange(value: TimeRangeValue): TimeRange {
  // See data-model.md Section 4 for implementation
}

export function alignTimeSeries(...) { ... }
export function insertGapMarkers(...) { ... }
```

**Reference**: `research.md` - Sections 4, 7 and `data-model.md` - Data Transformations

---

### Phase 2: Data Layer Implementation (Day 2-3)

#### 2.1 Implement `datiService.getCurrentReadings()`

**Steps**:
1. Query `sensor_readings` with JOIN to `sensors` and `devices`
2. Filter by `user_id` and order by `timestamp DESC`
3. Group by `sensor_type` to get latest per type
4. Transform to `CurrentReading[]` with UI metadata

**Reference**:
- `contracts/supabase-queries.contract.ts` - Query 1
- `data-model.md` - Data Transformation 1

**Test**:
```typescript
// In browser console or test file
import { datiService } from './services/dati.service';

const readings = await datiService.getCurrentReadings('user-uuid-here');
console.log(readings);
// Expected: Array of 6 objects (one per sensor type) with value, timestamp, isStale, etc.
```

---

#### 2.2 Implement `datiService.getTimeSeriesData()`

**Steps**:
1. Determine if data is recent (<15 days) or historical
2. For recent: Query raw readings with `timestamp >= 15 days ago`
3. For historical: Use aggregation logic (client-side for now)
4. Insert gap markers using `insertGapMarkers()` utility
5. Return `TimeSeriesDataPoint[]`

**Reference**:
- `research.md` - Section 2 (Downsampling Strategy)
- `data-model.md` - Data Transformation 2

**Test**:
```typescript
const timeRange = createTimeRange('24h');
const data = await datiService.getTimeSeriesData(
  'user-uuid',
  'dht_sopra_temp',
  timeRange
);
console.log(data);
// Expected: Array of time-series points with timestamps in ascending order
```

---

#### 2.3 Implement `datiService.getComparisonChartData()`

**Steps**:
1. Fetch time-series for both sensor types (e.g., sopra + sotto)
2. Use `alignTimeSeries()` to merge by timestamp
3. Return `ComparisonChartData[]`

**Reference**: `data-model.md` - Data Transformation 3

---

### Phase 3: React Hooks & State Management (Day 4)

#### 3.1 Create React Query Hook

**File**: `frontend/src/lib/hooks/useDatiData.ts`

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from './useAuth';
import { datiService } from '../../services/dati.service';
import { DatiQueryKeys, CacheConfigurations } from '../../types/query-keys';
import type { TimeRangeValue, TimeRange } from '../../types/dati.types';
import { createTimeRange } from '../utils/time-series';

export function useDatiData() {
  const { user } = useAuth();
  const [timeRangeValue, setTimeRangeValue] = useState<TimeRangeValue>('24h');
  const timeRange = createTimeRange(timeRangeValue);

  // Current readings query
  const {
    data: currentReadings,
    isLoading: isLoadingCurrent,
    error: errorCurrent,
  } = useQuery({
    queryKey: DatiQueryKeys.currentReadings(user!.id),
    queryFn: () => datiService.getCurrentReadings(user!.id),
    enabled: !!user,
    ...CacheConfigurations.currentReadings,
  });

  // Temperature comparison query
  const { data: temperatureData } = useQuery({
    queryKey: DatiQueryKeys.temperatureComparison(user!.id, timeRangeValue),
    queryFn: () =>
      datiService.getComparisonChartData(
        user!.id,
        'dht_sopra_temp',
        'dht_sotto_temp',
        timeRange
      ),
    enabled: !!user,
    ...CacheConfigurations.comparisonCharts,
  });

  // ... other chart queries

  return {
    currentReadings,
    isLoadingCurrent,
    errorCurrent,
    timeRange,
    setTimeRangeValue,
    temperatureData,
    // ... other data
  };
}
```

**Reference**:
- `contracts/service-layer.contract.ts` - Lines 228-253
- `contracts/react-query-keys.contract.ts` - All sections

**Test**: Use React DevTools to inspect query cache and verify correct keys

---

### Phase 4: UI Components (Day 5-7)

#### 4.1 Create CurrentReadingCard Component

**File**: `frontend/src/components/dati/CurrentReadingCard.tsx`

```tsx
import { formatSensorValue, formatTimestamp } from '../../lib/utils/formatting';
import type { CurrentReading } from '../../types/dati.types';

interface Props {
  reading: CurrentReading;
}

export function CurrentReadingCard({ reading }: Props) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
      reading.isStale ? 'border-yellow-500' : 'border-green-500'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-3xl">{reading.icon}</span>
        {reading.isStale && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            Vecchio
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">
        {reading.displayName}
      </h3>
      <div className="flex items-baseline space-x-1">
        <span className="text-3xl font-bold text-gray-900">
          {formatSensorValue(reading.value, reading.sensorType, reading.unit)}
        </span>
        <span className="text-lg text-gray-500">{reading.unit}</span>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {formatTimestamp(reading.timestamp, 'relative')}
      </p>
    </div>
  );
}
```

**Reference**: `research.md` - Section 5 (Layout), Section 7 (Formatting), Section 8 (Colors)

---

#### 4.2 Create TemperatureComparisonChart Component

**File**: `frontend/src/components/dati/TemperatureComparisonChart.tsx`

```tsx
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { ComparisonChartData } from '../../types/dati.types';

interface Props {
  data: ComparisonChartData[];
}

export function TemperatureComparisonChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value) => format(new Date(value), 'HH:mm')}
          stroke="#6b7280"
        />
        <YAxis
          label={{ value: '°C', angle: -90, position: 'insideLeft' }}
          stroke="#6b7280"
        />
        <Tooltip
          labelFormatter={(value) => format(new Date(value), 'PPpp', { locale: it })}
          formatter={(value: number) => [value.toFixed(1), '']}
        />
        <Legend verticalAlign="top" height={36} iconType="line" />
        <Line
          type="monotone"
          dataKey="primaryValue"
          stroke="#ef4444"
          strokeWidth={2}
          name="Temperatura Sopra (Lampada)"
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="secondaryValue"
          stroke="#3b82f6"
          strokeWidth={2}
          name="Temperatura Sotto (Terreno)"
          dot={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Reference**: `research.md` - Section 3 (Recharts Best Practices)

---

#### 4.3 Create Main Dati Page

**File**: `frontend/src/pages/Dati.page.tsx`

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, LogOut } from 'lucide-react';
import { useAuth } from '../lib/hooks/useAuth';
import { useDatiData } from '../lib/hooks/useDatiData';
import { CurrentReadingCard } from '../components/dati/CurrentReadingCard';
import { TemperatureComparisonChart } from '../components/dati/TemperatureComparisonChart';
import { HumidityComparisonChart } from '../components/dati/HumidityComparisonChart';
import { SoilMoistureChart } from '../components/dati/SoilMoistureChart';
import { TankLevelChart } from '../components/dati/TankLevelChart';
import { EmptyStateOnboarding } from '../components/dati/EmptyStateOnboarding';
import type { TimeRangeValue } from '../types/dati.types';

export function DatiPage() {
  const { user, signOut } = useAuth();
  const {
    currentReadings,
    isLoadingCurrent,
    timeRange,
    setTimeRangeValue,
    temperatureData,
    humidityData,
    soilMoistureData,
    tankLevelData,
    hasStaleData,
  } = useDatiData();

  // Empty state check
  if (!isLoadingCurrent && (!currentReadings || currentReadings.length === 0)) {
    return <EmptyStateOnboarding />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-green-600">
                <Home className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Dati</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stale data warning */}
        {hasStaleData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Alcuni sensori non inviano dati da più di 15 minuti
            </p>
          </div>
        )}

        {/* Current Readings Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Letture Correnti</h2>
          {isLoadingCurrent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg shadow-sm p-4 h-32 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentReadings?.map((reading) => (
                <CurrentReadingCard key={reading.sensorType} reading={reading} />
              ))}
            </div>
          )}
        </section>

        {/* Time Range Selector */}
        <section className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Intervallo</h2>
            <div className="flex space-x-2">
              {(['24h', '7d', '30d'] as TimeRangeValue[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRangeValue(range)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    timeRange.value === range
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === '24h' && 'Ultime 24 Ore'}
                  {range === '7d' && 'Ultimi 7 Giorni'}
                  {range === '30d' && 'Ultimi 30 Giorni'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Historical Charts */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Storico</h2>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Temperatura</h3>
            {temperatureData ? (
              <TemperatureComparisonChart data={temperatureData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Caricamento...
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Umidità</h3>
            {humidityData ? (
              <HumidityComparisonChart data={humidityData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Caricamento...
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Umidità Terreno</h3>
            {soilMoistureData ? (
              <SoilMoistureChart data={soilMoistureData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Caricamento...
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Livello Serbatoio</h3>
            {tankLevelData ? (
              <TankLevelChart data={tankLevelData} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Caricamento...
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
```

**Reference**: `research.md` - Section 5 (Responsive Layout)

---

#### 4.4 Update App Routes

**File**: `frontend/src/App.tsx`

```typescript
// Change existing History route to Dati
<Route
  path="/dati"
  element={
    <ProtectedRoute>
      <DatiPage />
    </ProtectedRoute>
  }
/>

// Redirect old /history route to /dati for backward compatibility
<Route path="/history" element={<Navigate to="/dati" replace />} />
```

---

### Phase 5: Testing & Refinement (Day 8-9)

#### 5.1 Manual QA Checklist

Based on `spec.md` acceptance scenarios:

- [ ] **User Story 1 - Current Readings**:
  - [ ] Navigate to /dati and verify all 6 sensor cards display
  - [ ] Check that each card shows value, unit, timestamp, icon
  - [ ] Verify stale indicator appears for readings >15 min old

- [ ] **User Story 2 - Historical Trends**:
  - [ ] Select "Ultime 24 Ore" and verify charts load
  - [ ] Switch to "Ultimi 7 Giorni" and verify data updates
  - [ ] Switch to "Ultimi 30 Giorni" and verify data updates
  - [ ] Hover over chart points and verify tooltip shows value + timestamp

- [ ] **User Story 3 - Environmental Comparison**:
  - [ ] Verify temperature chart shows two lines (sopra + sotto)
  - [ ] Verify humidity chart shows two lines (sopra + sotto)
  - [ ] Check that legend clearly identifies each line
  - [ ] Verify colors are distinguishable

- [ ] **User Story 4 - Data Gaps**:
  - [ ] Simulate missing data (pause device for 20 min)
  - [ ] Verify stale indicator appears on affected cards
  - [ ] Verify chart shows dotted line through gap (if visible)

- [ ] **Empty State**:
  - [ ] Test with user account that has no sensors
  - [ ] Verify onboarding wizard appears
  - [ ] Click "Configura Dispositivi" button → should navigate to /devices

- [ ] **Mobile Responsiveness**:
  - [ ] Test on 320px width (smallest phone)
  - [ ] Test on 768px width (tablet)
  - [ ] Test on 1920px width (desktop)
  - [ ] Verify layout adapts correctly at each breakpoint

#### 5.2 Performance Testing

- [ ] Measure page load time (target: <2 seconds)
- [ ] Measure time range switch latency (target: <1 second)
- [ ] Verify auto-refresh doesn't cause UI jank
- [ ] Check React DevTools Profiler for unnecessary re-renders
- [ ] Verify query cache is working (check Network tab for duplicate requests)

#### 5.3 Edge Case Testing

- [ ] Test with only 1 data point per sensor (insufficient for graphing)
- [ ] Test with sensor readings outside expected ranges (negative, impossibly high)
- [ ] Test with extremely old last reading (weeks/months)
- [ ] Test with rapid device online/offline transitions

---

## Common Issues & Solutions

### Issue 1: "No data available" despite sensors reporting

**Cause**: Query filtering by wrong user_id or device_id

**Solution**: Check Supabase RLS policies and verify user authentication

### Issue 2: Charts not updating when time range changes

**Cause**: React Query not detecting key change

**Solution**: Ensure `timeRangeValue` is in query key, not `timeRange` object

### Issue 3: Stale data indicator flashing on/off

**Cause**: Auto-refresh causing timestamp recalculation

**Solution**: Use `useMemo` to stabilize `isStale` computation

### Issue 4: Memory leak warning on unmount

**Cause**: React Query refetchInterval not cleaned up

**Solution**: Ensure queries are properly disabled when component unmounts

---

## Deployment Checklist

Before merging to main:

- [ ] All acceptance scenarios pass manual QA
- [ ] No console errors or warnings
- [ ] Page loads successfully on Netlify preview deploy
- [ ] Mobile layout tested on real device
- [ ] Update navigation menu to show "Dati" instead of "Storico Sensori"
- [ ] Update CLAUDE.md with any new technologies/patterns
- [ ] Create PR with clear description linking to this spec

---

## Next Steps (Out of Scope for This Feature)

Future enhancements to consider:

1. **Backend Downsampling Job**: Add pg_cron task to materialize hourly/daily aggregates
2. **Testing Infrastructure**: Set up Vitest + React Testing Library
3. **CSV Export**: Add download button for historical data
4. **Advanced Filtering**: Allow hiding specific sensor types from charts
5. **Anomaly Detection**: Highlight readings outside min/max thresholds
6. **Real-Time Updates**: Replace polling with Supabase Realtime subscriptions

---

## Support & Resources

- **Feature Spec**: [`spec.md`](./spec.md)
- **Research Decisions**: [`research.md`](./research.md)
- **Data Model**: [`data-model.md`](./data-model.md)
- **API Contracts**: [`contracts/`](./contracts/)
- **Recharts Docs**: https://recharts.org/en-US/
- **React Query Docs**: https://tanstack.com/query/latest
- **Supabase Docs**: https://supabase.com/docs

For questions or issues, reference the spec documents above or consult with the team.
