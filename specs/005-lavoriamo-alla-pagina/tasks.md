# Implementation Tasks: Pagina Dati

**Feature**: 005-lavoriamo-alla-pagina
**Branch**: `005-lavoriamo-alla-pagina`
**Date**: 2025-11-14

## Overview

This document breaks down the "Pagina Dati" (Sensor Data Page) implementation into actionable, dependency-ordered tasks organized by user story priority. Each user story is independently testable and can be delivered incrementally.

**Total Tasks**: 38
**Estimated Duration**: 8-9 days
**MVP Scope**: User Story 1 only (9 tasks, ~2 days)

---

## Task Organization Strategy

Tasks are organized into phases based on user story priorities from `spec.md`:

1. **Phase 1: Setup & Foundation** - Project initialization and shared infrastructure (blocking prerequisites)
2. **Phase 2: User Story 1 (P1)** - View Current Environmental Conditions
3. **Phase 3: User Story 2 (P2)** - View Historical Trends
4. **Phase 4: User Story 3 (P3)** - Compare Environmental Zones
5. **Phase 5: User Story 4 (P3)** - Identify Data Gaps
6. **Phase 6: Polish & Integration** - Cross-cutting concerns

**Legend**:
- `[P]` = Parallelizable (can run concurrently with other [P] tasks in same phase)
- `[US1]` = User Story 1, `[US2]` = User Story 2, etc.
- `→ depends on` = Must complete prerequisite task first

---

## Phase 1: Setup & Foundation (Blocking Prerequisites)

These tasks must complete before ANY user story can be implemented.

### T001: Create TypeScript Type Definitions [P]
**File**: `frontend/src/types/dati.types.ts`
**Story**: Foundation
**Duration**: 30 min

**Description**:
Create TypeScript interfaces for all domain models based on `data-model.md` and `contracts/service-layer.contract.ts`.

**Acceptance Criteria**:
- [X] `SensorType` union type defined with all sensor variants
- [X] `CurrentReading` interface matches data-model.md spec
- [X] `TimeSeriesDataPoint` interface includes aggregation metadata
- [X] `ComparisonChartData` interface for overlaid charts
- [X] `TimeRange` and `TimeRangeValue` types defined
- [X] `SensorStatus` interface with severity levels
- [X] All interfaces exported

**Implementation**:
```typescript
export type SensorType =
  | 'dht_sopra_temp'
  | 'dht_sopra_humidity'
  | 'dht_sotto_temp'
  | 'dht_sotto_humidity'
  | 'soil_moisture'
  | 'water_level'
  | 'unconfigured';

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

// ... (continue with other interfaces from data-model.md)
```

---

### T002: Create Formatting Utilities [P]
**File**: `frontend/src/lib/utils/formatting.ts`
**Story**: Foundation
**Duration**: 45 min
**Dependencies**: T001

**Description**:
Implement sensor value formatting with type-specific decimal precision based on `research.md` Section 7.

**Acceptance Criteria**:
- [X] `formatSensorValue()` uses correct precision per sensor type (temp: 1 decimal, humidity: 0 decimals, etc.)
- [X] `formatTimestamp()` supports 'short', 'long', 'relative' formats
- [X] Italian locale used for date formatting
- [X] Functions handle null/undefined gracefully

**Implementation**:
```typescript
import type { SensorType } from '../../types/dati.types';

export function formatSensorValue(
  value: number,
  sensorType: SensorType,
  unit?: string
): string {
  switch (sensorType) {
    case 'dht_sopra_temp':
    case 'dht_sotto_temp':
      return value.toFixed(1);
    case 'dht_sopra_humidity':
    case 'dht_sotto_humidity':
    case 'soil_moisture':
      return Math.round(value).toString();
    case 'water_level':
      return unit === '%' ? Math.round(value).toString() : value.toFixed(1);
    default:
      return value.toString();
  }
}

export function formatTimestamp(
  timestamp: Date,
  format: 'short' | 'long' | 'relative'
): string {
  // Use date-fns with Italian locale
  // 'short': "14:30"
  // 'long': "14 novembre 2025, 14:30"
  // 'relative': "2 minuti fa"
}
```

---

### T003: Create Time-Series Utilities [P]
**File**: `frontend/src/lib/utils/time-series.ts`
**Story**: Foundation
**Duration**: 1 hour
**Dependencies**: T001

**Description**:
Implement time-series transformation utilities for time range creation, series alignment, and gap detection.

**Acceptance Criteria**:
- [X] `createTimeRange()` correctly calculates dates and intervals for '24h', '7d', '30d'
- [X] `alignTimeSeries()` merges two series by timestamp
- [X] `insertGapMarkers()` adds null points for gaps >15 minutes
- [X] All functions handle empty arrays gracefully

**Reference**: `data-model.md` - Data Transformations sections

---

### T004: Extend SensorsService with Display Name Function
**File**: `frontend/src/services/sensors.service.ts`
**Story**: Foundation
**Duration**: 20 min
**Dependencies**: T001

**Description**:
Add `getDisplayName()` method to existing sensors service for human-readable Italian sensor names.

**Acceptance Criteria**:
- [X] `getDisplayName('dht_sopra_temp')` returns "Temperatura Sopra"
- [X] `getDisplayName('dht_sotto_temp')` returns "Temperatura Sotto"
- [X] All 6 sensor types have Italian display names
- [X] Method integrates with existing `getSensorConfig()`

**Implementation**:
```typescript
export function getDisplayName(sensorType: SensorType): string {
  const displayNames: Record<SensorType, string> = {
    dht_sopra_temp: 'Temperatura Sopra',
    dht_sopra_humidity: 'Umidità Sopra',
    dht_sotto_temp: 'Temperatura Sotto',
    dht_sotto_humidity: 'Umidità Sotto',
    soil_moisture: 'Umidità Terreno',
    water_level: 'Livello Serbatoio',
    unconfigured: 'Non Configurato',
  };
  return displayNames[sensorType] || sensorType;
}
```

---

## ✓ CHECKPOINT: Foundation Complete

Verify before proceeding to User Story 1:
- [ ] All type definitions compile without errors
- [ ] Utility functions have basic unit tests (or manual verification)
- [ ] SensorsService extension doesn't break existing functionality

---

## Phase 2: User Story 1 (P1) - View Current Environmental Conditions

**Goal**: Display current sensor readings in cards with auto-refresh.

**Independent Test Criteria**:
- Navigate to /dati and see 6 sensor cards (temp/humidity sopra/sotto, soil, tank)
- Each card shows value, unit, timestamp, icon
- Stale indicator appears for readings >15 min old
- Page auto-refreshes every 60 seconds

---

### T005: [US1] Create DatiService - getCurrentReadings()
**File**: `frontend/src/services/dati.service.ts`
**Story**: US1
**Duration**: 1.5 hours
**Dependencies**: T001, T004

**Description**:
Implement service layer function to fetch latest sensor readings with UI metadata.

**Acceptance Criteria**:
- [X] Query Supabase `sensor_readings` with JOIN to `sensors` and `devices`
- [X] Filter by user_id and order by timestamp DESC
- [X] Group by sensor_type to get latest per type
- [X] Transform to `CurrentReading[]` with display name, icon, color from `getSensorConfig()`
- [X] Compute `isStale` flag (>15 minutes)
- [X] Return exactly 6 readings (or fewer if sensors missing)

**Reference**: `contracts/supabase-queries.contract.ts` - Query 1, `data-model.md` - Transformation 1

**Implementation Skeleton**:
```typescript
import { supabase } from '../lib/supabase';
import type { CurrentReading } from '../types/dati.types';
import { sensorsService } from './sensors.service';

export const datiService = {
  async getCurrentReadings(userId: string): Promise<CurrentReading[]> {
    // 1. Query sensor_readings + sensors + devices
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sensor_type, value, timestamp, device_id, sensors(unit)')
      .eq('devices.user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // 2. Group by sensor_type and take latest
    const latestByType = new Map();
    for (const reading of data) {
      if (!latestByType.has(reading.sensor_type)) {
        latestByType.set(reading.sensor_type, reading);
      }
    }

    // 3. Transform to CurrentReading with metadata
    return Array.from(latestByType.values()).map(reading => {
      const config = sensorsService.getSensorConfig(reading.sensor_type);
      const timestamp = new Date(reading.timestamp);
      const ageMinutes = (Date.now() - timestamp.getTime()) / (1000 * 60);

      return {
        sensorType: reading.sensor_type,
        value: reading.value,
        unit: reading.sensors.unit,
        timestamp,
        deviceId: reading.device_id,
        isStale: ageMinutes > 15,
        displayName: sensorsService.getDisplayName(reading.sensor_type),
        icon: config.icon,
        color: config.color,
      };
    });
  },
};
```

---

### T006: [US1] Create React Query Keys Contract [P]
**File**: `frontend/src/lib/query-keys.ts`
**Story**: US1
**Duration**: 30 min
**Dependencies**: T001

**Description**:
Implement React Query key factory pattern from `contracts/react-query-keys.contract.ts`.

**Acceptance Criteria**:
- [X] `DatiQueryKeys.currentReadings(userId)` returns correct key array
- [X] All key functions follow ['dati', type, ...params] pattern
- [X] Keys are typed as `readonly` for immutability
- [X] Export cache configuration constants

**Reference**: `contracts/react-query-keys.contract.ts`

---

### T007: [US1] Create useDatiData Hook - Current Readings Only
**File**: `frontend/src/lib/hooks/useDatiData.ts`
**Story**: US1
**Duration**: 1 hour
**Dependencies**: T005, T006

**Description**:
Create React Query hook for fetching current readings with 60-second auto-refresh.

**Acceptance Criteria**:
- [X] Uses `useQuery` with `DatiQueryKeys.currentReadings()`
- [X] Configured with 55s staleTime, 60s refetchInterval
- [X] Returns `{ currentReadings, isLoadingCurrent, errorCurrent }`
- [X] Enabled only when user is authenticated
- [X] Auto-refetch works without UI disruption

**Implementation**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { datiService } from '../../services/dati.service';
import { DatiQueryKeys } from '../query-keys';

export function useDatiData() {
  const { user } = useAuth();

  const {
    data: currentReadings,
    isLoading: isLoadingCurrent,
    error: errorCurrent,
  } = useQuery({
    queryKey: DatiQueryKeys.currentReadings(user!.id),
    queryFn: () => datiService.getCurrentReadings(user!.id),
    enabled: !!user,
    staleTime: 55000, // 55 seconds
    refetchInterval: 60000, // 60 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return {
    currentReadings,
    isLoadingCurrent,
    errorCurrent,
  };
}
```

---

### T008: [US1] Create CurrentReadingCard Component
**File**: `frontend/src/components/dati/CurrentReadingCard.tsx`
**Story**: US1
**Duration**: 1 hour
**Dependencies**: T001, T002

**Description**:
Build sensor reading card component with stale indicator.

**Acceptance Criteria**:
- [X] Displays sensor icon, display name, formatted value with unit
- [X] Shows relative timestamp ("2 minuti fa")
- [X] Stale indicator (yellow badge) appears when `isStale === true`
- [X] Green left border for active, yellow for stale
- [X] Responsive: single column on mobile, adapts to parent grid
- [X] Uses Tailwind classes from `research.md` Section 8

**Reference**: `quickstart.md` - Section 4.1 for implementation example

---

### T009: [US1] Create Empty State Onboarding Component [P]
**File**: `frontend/src/components/dati/EmptyStateOnboarding.tsx`
**Story**: US1
**Duration**: 45 min
**Dependencies**: None (UI only)

**Description**:
Build empty state wizard that guides users to device management.

**Acceptance Criteria**:
- [X] Displays friendly message when no sensors are configured
- [X] Shows plant emoji (🌱) and welcoming headline
- [X] "Configura Dispositivi" button links to `/devices`
- [X] Centered layout, works on all screen sizes
- [X] Optional link to quickstart guide

**Reference**: `research.md` - Section 6 for implementation

---

### T010: [US1] Create Dati Page - Current Readings Section Only
**File**: `frontend/src/pages/Dati.page.tsx`
**Story**: US1
**Duration**: 1.5 hours
**Dependencies**: T007, T008, T009

**Description**:
Build main page component with header, current readings grid, and empty state.

**Acceptance Criteria**:
- [X] Page header shows "Dati" title (not "Storico Sensori")
- [X] Renders `<EmptyStateOnboarding />` when no readings
- [X] Renders grid of `<CurrentReadingCard />` (1 col mobile, 2 tablet, 3 desktop)
- [X] Loading skeleton during initial fetch
- [X] Header includes user email and logout button
- [X] Home icon links to `/dashboard`

**Implementation Notes**:
- Only implement "Letture Correnti" section for US1
- Time range selector and charts will be added in US2
- Use CSS Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`

---

### T011: [US1] Update App Routes
**File**: `frontend/src/App.tsx`
**Story**: US1
**Duration**: 15 min
**Dependencies**: T010

**Description**:
Add `/dati` route and redirect old `/history` route for backward compatibility.

**Acceptance Criteria**:
- [X] `/dati` route renders `<DatiPage />` with `<ProtectedRoute>`
- [X] `/history` redirects to `/dati` with `<Navigate replace />`
- [X] Update navigation menu to show "Dati" instead of "Storico Sensori"

**Implementation**:
```typescript
<Route
  path="/dati"
  element={
    <ProtectedRoute>
      <DatiPage />
    </ProtectedRoute>
  }
/>
<Route path="/history" element={<Navigate to="/dati" replace />} />
```

---

### T012: [US1] Manual QA - Current Readings
**Story**: US1
**Duration**: 30 min
**Dependencies**: T011

**Description**:
Verify User Story 1 acceptance scenarios through manual testing.

**Test Cases**:
0 Navigate to /dati with active sensors → See 6 cards with values
0 Each card shows icon, name, value, unit, timestamp
0 Stale indicator appears for readings >15 min old
0 Auto-refresh works (wait 60s, verify new timestamp)
0 Empty state appears for user with no sensors
0 "Configura Dispositivi" button navigates to /devices
0 Page layout responsive on 320px, 768px, 1920px viewports

**Success Criteria**: All 7 test cases pass

---

## ✓ CHECKPOINT: User Story 1 Complete (MVP Deliverable)

**Deliverable**: Users can view current sensor readings with auto-refresh and stale detection.

**Independent Test**: Navigate to /dati and verify all acceptance scenarios from spec.md User Story 1.

**Decision Point**: Can deploy MVP here if time-constrained.

---

## Phase 3: User Story 2 (P2) - View Historical Trends

**Goal**: Add time range selector and historical charts for all sensor types.

**Independent Test Criteria**:
- Select "Ultime 24 Ore" → See 4 charts with data
- Switch to "Ultimi 7 Giorni" → Charts update within 1 second
- Hover over chart → See tooltip with exact value and timestamp
- All sensor types have clearly labeled charts with units

---

### T013: [US2] Create DatiService - getTimeSeriesData()
**File**: `frontend/src/services/dati.service.ts`
**Story**: US2
**Duration**: 2 hours
**Dependencies**: T005, T003

**Description**:
Implement time-series data fetching with automatic granularity selection.

**Acceptance Criteria**:
- [X] Query `sensor_readings` filtered by sensor_type and time range
- [X] For range <15 days: Return full granularity (raw data)
- [X] For range >15 days: Use client-side aggregation (hourly/daily buckets)
- [X] Apply `insertGapMarkers()` for missing data visualization
- [X] Return `TimeSeriesDataPoint[]` with aggregation metadata
- [X] Handle boundary case (range spanning 15-day threshold)

**Reference**: `research.md` - Section 2, `data-model.md` - Transformation 2

**Implementation Skeleton**:
```typescript
async getTimeSeriesData(
  userId: string,
  sensorType: SensorType,
  timeRange: TimeRange
): Promise<TimeSeriesDataPoint[]> {
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  // Query Supabase for sensor readings
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('timestamp, value, sensor_type')
    .eq('sensor_type', sensorType)
    .in('device_id', deviceIds) // Get from user's devices
    .gte('timestamp', timeRange.startDate.toISOString())
    .lte('timestamp', timeRange.endDate.toISOString())
    .order('timestamp', { ascending: true })
    .limit(10000);

  if (error) throw error;

  // Transform to TimeSeriesDataPoint
  let timeSeries = data.map(r => ({
    timestamp: new Date(r.timestamp),
    value: r.value,
    sensorType: r.sensor_type,
    isAggregated: false,
  }));

  // Apply aggregation if interval !== 'raw'
  if (timeRange.interval === 'hourly' || timeRange.interval === 'daily') {
    timeSeries = this.aggregateClientSide(data, timeRange.interval);
  }

  // Insert gap markers
  return insertGapMarkers(timeSeries, 15);
}
```

---

### T014: [US2] Extend useDatiData Hook - Add Time Range State
**File**: `frontend/src/lib/hooks/useDatiData.ts`
**Story**: US2
**Duration**: 30 min
**Dependencies**: T007, T003

**Description**:
Add time range selection state management to hook.

**Acceptance Criteria**:
- [X] `timeRangeValue` state initialized to '24h'
- [X] `setTimeRangeValue()` function updates state
- [X] `timeRange` computed using `createTimeRange(timeRangeValue)`
- [X] State change triggers chart query refetch (via React Query key change)

**Implementation**:
```typescript
const [timeRangeValue, setTimeRangeValue] = useState<TimeRangeValue>('24h');
const timeRange = createTimeRange(timeRangeValue);

return {
  // ... existing current readings
  timeRange,
  setTimeRangeValue,
};
```

---

### T015: [US2] Create TimeRangeSelector Component [P]
**File**: `frontend/src/components/dati/TimeRangeSelector.tsx`
**Story**: US2
**Duration**: 45 min
**Dependencies**: T001

**Description**:
Build time range button group component.

**Acceptance Criteria**:
- [X] Three buttons: "Ultime 24 Ore", "Ultimi 7 Giorni", "Ultimi 30 Giorni"
- [X] Selected button has green background, others gray
- [X] Clicking button calls `onChange(timeRangeValue)`
- [X] Buttons stack vertically on mobile, horizontal on tablet+
- [X] Responsive spacing and font sizes

**Reference**: `quickstart.md` - Section 4.3 for layout

---

### T016: [US2] Create TemperatureChart Component [P]
**File**: `frontend/src/components/dati/TemperatureChart.tsx`
**Story**: US2 (single line only - comparison overlay in US3)
**Duration**: 1 hour
**Dependencies**: T001

**Description**:
Create basic temperature line chart with Recharts (single sensor type for now).

**Acceptance Criteria**:
- [ ] Uses `<LineChart>` from recharts with responsive container
- [ ] X-axis shows time (formatted as "HH:mm" for 24h, "dd/MM" for longer)
- [X] Y-axis labeled with "°C"
- [X] Tooltip shows exact value (1 decimal) and timestamp
- [X] Line: red color (#ef4444), strokeWidth 2, no dots for >100 points
- [X] connectNulls={false} to show gaps
- [X] Chart height: 300px

**Note**: This task creates basic single-line chart. T022 will extend it for comparison overlay.

**Reference**: `research.md` - Section 3 for Recharts best practices

---

### T017: [US2] Create HumidityChart Component [P]
**File**: `frontend/src/components/dati/HumidityChart.tsx`
**Story**: US2
**Duration**: 45 min
**Dependencies**: T016 (copy/modify)

**Description**:
Clone temperature chart and adapt for humidity data.

**Acceptance Criteria**:
- [ ] Y-axis labeled with "%"
- [X] Line color: cyan (#06b6d4)
- [X] Tooltip formats value as integer (0 decimals)
- [X] Same responsive behavior as TemperatureChart

---

### T018: [US2] Create SoilMoistureChart Component [P]
**File**: `frontend/src/components/dati/SoilMoistureChart.tsx`
**Story**: US2
**Duration**: 45 min
**Dependencies**: T016 (copy/modify)

**Description**:
Clone temperature chart and adapt for soil moisture data.

**Acceptance Criteria**:
- [X] Y-axis labeled with "%"
- [X] Line color: green (#10b981)
- [X] Tooltip formats value as integer (0 decimals)

---

### T019: [US2] Create TankLevelChart Component [P]
**File**: `frontend/src/components/dati/TankLevelChart.tsx`
**Story**: US2
**Duration**: 45 min
**Dependencies**: T016 (copy/modify)

**Description**:
Clone temperature chart and adapt for tank level data.

**Acceptance Criteria**:
- [X] Y-axis label adapts to unit (cm, L, or %)
- [X] Line color: indigo (#6366f1)
- [X] Tooltip formats value with 1 decimal or integer based on unit

---

### T020: [US2] Extend useDatiData Hook - Add Chart Queries
**File**: `frontend/src/lib/hooks/useDatiData.ts`
**Story**: US2
**Duration**: 1 hour
**Dependencies**: T013, T014, T006

**Description**:
Add React Query hooks for fetching time-series data for all sensor types.

**Acceptance Criteria**:
- [X] Query for temperature data (sopra only for now, sotto in US3)
- [X] Query for humidity data (sopra only for now, sotto in US3)
- [X] Query for soil moisture data
- [X] Query for tank level data
- [X] All queries use `DatiQueryKeys.timeSeries()` with timeRangeValue
- [X] Configured with 5-minute staleTime, no auto-refresh
- [X] Return `{ temperatureData, humidityData, soilMoistureData, tankLevelData, isLoadingCharts, errorCharts }`

**Implementation**:
```typescript
const { data: temperatureData } = useQuery({
  queryKey: DatiQueryKeys.timeSeries(user!.id, 'dht_sopra_temp', timeRangeValue),
  queryFn: () =>
    datiService.getTimeSeriesData(user!.id, 'dht_sopra_temp', timeRange),
  enabled: !!user,
  staleTime: 300000, // 5 minutes
  refetchOnWindowFocus: false,
});

// ... repeat for other sensor types
```

---

### T021: [US2] Update Dati Page - Add Charts Section
**File**: `frontend/src/pages/Dati.page.tsx`
**Story**: US2
**Duration**: 1.5 hours
**Dependencies**: T010, T015, T016-T019, T020

**Description**:
Integrate time range selector and charts into main page.

**Acceptance Criteria**:
- [X] Time range selector section renders below current readings
- [X] "Storico" section header with 4 chart cards
- [X] Each chart in white rounded card with title and chart component
- [X] Loading state shows skeleton for charts
- [X] Error state shows friendly message
- [X] Charts stack vertically with consistent spacing

**Layout**:
```tsx
<section className="bg-white rounded-lg shadow-sm p-4 mb-6">
  <TimeRangeSelector selected={timeRange.value} onChange={setTimeRangeValue} />
</section>

<section className="space-y-6">
  <h2 className="text-xl font-semibold">Storico</h2>

  <div className="bg-white rounded-lg shadow-sm p-6">
    <h3 className="text-lg font-medium mb-4">Temperatura</h3>
    {temperatureData ? (
      <TemperatureChart data={temperatureData} />
    ) : (
      <LoadingSkeleton height={300} />
    )}
  </div>

  {/* ... repeat for other charts */}
</section>
```

---

### T022: [US2] Manual QA - Historical Trends
**Story**: US2
**Duration**: 45 min
**Dependencies**: T021

**Description**:
Verify User Story 2 acceptance scenarios through manual testing.

**Test Cases**:
1. [ ] Select "Ultime 24 Ore" → All 4 charts display data
2. [ ] Switch to "Ultimi 7 Giorni" → Charts update <1 second
3. [ ] Switch to "Ultimi 30 Giorni" → Charts update <1 second
4. [ ] Hover over data point → Tooltip shows value and timestamp
5. [ ] Charts have clear labels (sensor type + unit)
6. [ ] X-axis time formatting appropriate for range
7. [ ] No console errors during time range switching

**Success Criteria**: All 7 test cases pass

---

## ✓ CHECKPOINT: User Story 2 Complete

**Deliverable**: Users can view historical trends with time range selection.

**Independent Test**: Verify all acceptance scenarios from spec.md User Story 2.

---

## Phase 4: User Story 3 (P3) - Compare Environmental Zones

**Goal**: Overlay temperature and humidity charts to compare sopra vs sotto.

**Independent Test Criteria**:
- Temperature chart shows two lines: red (sopra) and blue (sotto)
- Humidity chart shows two lines: cyan (sopra) and dark cyan (sotto)
- Legend clearly identifies each line
- Visual difference between height levels is apparent

---

### T023: [US3] Create DatiService - getComparisonChartData()
**File**: `frontend/src/services/dati.service.ts`
**Story**: US3
**Duration**: 1 hour
**Dependencies**: T013, T003

**Description**:
Implement function to fetch and align two sensor types for comparison charts.

**Acceptance Criteria**:
- [X] Fetch time-series for both primaryType and secondaryType
- [X] Use `alignTimeSeries()` utility to merge by timestamp
- [X] Return `ComparisonChartData[]` with aligned values
- [X] Handle case where one sensor has no data

**Reference**: `data-model.md` - Transformation 3

**Implementation**:
```typescript
async getComparisonChartData(
  userId: string,
  primaryType: SensorType,
  secondaryType: SensorType,
  timeRange: TimeRange
): Promise<ComparisonChartData[]> {
  // Fetch both series
  const [primaryData, secondaryData] = await Promise.all([
    this.getTimeSeriesData(userId, primaryType, timeRange),
    this.getTimeSeriesData(userId, secondaryType, timeRange),
  ]);

  // Align timestamps
  const primaryLabel = sensorsService.getDisplayName(primaryType);
  const secondaryLabel = sensorsService.getDisplayName(secondaryType);

  return alignTimeSeries(primaryData, secondaryData, primaryLabel, secondaryLabel);
}
```

---

### T024: [US3] Update useDatiData Hook - Replace Single Queries with Comparison Queries
**File**: `frontend/src/lib/hooks/useDatiData.ts`
**Story**: US3
**Duration**: 45 min
**Dependencies**: T020, T023, T006

**Description**:
Replace single temperature/humidity queries with comparison queries.

**Acceptance Criteria**:
- [X] Query `temperatureData` now fetches sopra + sotto comparison
- [X] Query `humidityData` now fetches sopra + sotto comparison
- [X] Use `DatiQueryKeys.temperatureComparison()` and `humidityComparison()`
- [X] Return `ComparisonChartData[]` instead of `TimeSeriesDataPoint[]`
- [X] Backward compatible with existing chart components (refactor charts separately)

**Implementation**:
```typescript
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
  staleTime: 300000,
});

const { data: humidityData } = useQuery({
  queryKey: DatiQueryKeys.humidityComparison(user!.id, timeRangeValue),
  queryFn: () =>
    datiService.getComparisonChartData(
      user!.id,
      'dht_sopra_humidity',
      'dht_sotto_humidity',
      timeRange
    ),
  enabled: !!user,
  staleTime: 300000,
});
```

---

### T025: [US3] Refactor TemperatureChart to Support Comparison
**File**: `frontend/src/components/dati/TemperatureChart.tsx`
**Story**: US3
**Duration**: 45 min
**Dependencies**: T016, T024

**Description**:
Update temperature chart to display two overlaid lines for sopra vs sotto.

**Acceptance Criteria**:
- [X] Accepts `ComparisonChartData[]` prop instead of `TimeSeriesDataPoint[]`
- [X] Renders two `<Line>` components: primaryValue (red) and secondaryValue (blue)
- [X] Legend shows "Temperatura Sopra (Lampada)" and "Temperatura Sotto (Terreno)"
- [X] Both lines use same axis scales
- [X] Tooltip displays both values when hovering

**Reference**: `quickstart.md` - Section 4.2 for implementation example

**Implementation**:
```tsx
<LineChart data={data}>
  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
  <XAxis dataKey="timestamp" tickFormatter={...} />
  <YAxis label={{ value: '°C', angle: -90 }} />
  <Tooltip labelFormatter={...} />
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
```

---

### T026: [US3] Refactor HumidityChart to Support Comparison
**File**: `frontend/src/components/dati/HumidityChart.tsx`
**Story**: US3
**Duration**: 45 min
**Dependencies**: T017, T024

**Description**:
Update humidity chart to display two overlaid lines for sopra vs sotto.

**Acceptance Criteria**:
- [X] Accepts `ComparisonChartData[]` prop
- [X] Primary line: cyan (#06b6d4), Secondary line: sky-600 (#0284c7)
- [X] Legend shows "Umidità Sopra (Lampada)" and "Umidità Sotto (Terreno)"
- [X] Same comparison behavior as TemperatureChart

---

### T027: [US3] Manual QA - Environmental Comparison
**Story**: US3
**Duration**: 30 min
**Dependencies**: T025, T026

**Description**:
Verify User Story 3 acceptance scenarios through manual testing.

**Test Cases**:
1. [ ] Temperature chart displays two distinct lines (red and blue)
2. [ ] Humidity chart displays two distinct lines (cyan and darker cyan)
3. [ ] Legend clearly identifies sopra vs sotto for each chart
4. [ ] Visual difference between height levels is apparent
5. [ ] Hovering shows values for both lines at same timestamp
6. [ ] No regression in chart performance or responsiveness

**Success Criteria**: All 6 test cases pass

---

## ✓ CHECKPOINT: User Story 3 Complete

**Deliverable**: Users can compare environmental zones via overlaid charts.

**Independent Test**: Verify all acceptance scenarios from spec.md User Story 3.

---

## Phase 5: User Story 4 (P3) - Identify Data Gaps

**Goal**: Add visual indicators for stale/missing sensor data.

**Independent Test Criteria**:
- Sensor card shows yellow badge when data is >15 min old
- Banner warning appears at top of page if any sensor is stale
- Empty state appears in chart if sensor has never reported
- Stale indicator updates in real-time during page view

---

### T028: [US4] Create DatiService - getSensorStatuses()
**File**: `frontend/src/services/dati.service.ts`
**Story**: US4
**Duration**: 45 min
**Dependencies**: T005

**Description**:
Implement function to compute sensor status for all tracked types.

**Acceptance Criteria**:
- [X] Returns `Map<SensorType, SensorStatus>` for all 6 sensor types
- [X] Status: 'active' if reading <15 min old, 'stale' if 15-60 min, 'no_data' if never reported
- [X] Severity: 'info' for active, 'warning' for stale/no_data
- [X] Human-readable Italian message for each status

**Reference**: `data-model.md` - Section 5 (SensorStatus entity)

**Implementation**:
```typescript
async getSensorStatuses(userId: string): Promise<Map<SensorType, SensorStatus>> {
  const readings = await this.getCurrentReadings(userId);
  const statusMap = new Map<SensorType, SensorStatus>();

  const allTypes: SensorType[] = [
    'dht_sopra_temp',
    'dht_sopra_humidity',
    'dht_sotto_temp',
    'dht_sotto_humidity',
    'soil_moisture',
    'water_level',
  ];

  for (const sensorType of allTypes) {
    const reading = readings.find(r => r.sensorType === sensorType);
    statusMap.set(sensorType, computeSensorStatus(sensorType, reading));
  }

  return statusMap;
}

function computeSensorStatus(
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
}
```

---

### T029: [US4] Extend useDatiData Hook - Add Sensor Statuses
**File**: `frontend/src/lib/hooks/useDatiData.ts`
**Story**: US4
**Duration**: 30 min
**Dependencies**: T028, T006

**Description**:
Add sensor status query to hook, derived from current readings.

**Acceptance Criteria**:
- [X] Query uses `DatiQueryKeys.sensorStatuses()` with same cache config as current readings
- [X] Returns `{ sensorStatuses, hasStaleData }`
- [X] `hasStaleData` computed as boolean: true if any sensor has 'stale' or 'no_data' status
- [X] Updates every 60 seconds with current readings refresh

**Implementation**:
```typescript
const { data: sensorStatuses } = useQuery({
  queryKey: DatiQueryKeys.sensorStatuses(user!.id),
  queryFn: () => datiService.getSensorStatuses(user!.id),
  enabled: !!user,
  staleTime: 55000,
  refetchInterval: 60000,
});

const hasStaleData = useMemo(() => {
  if (!sensorStatuses) return false;
  return Array.from(sensorStatuses.values()).some(
    status => status.status === 'stale' || status.status === 'no_data'
  );
}, [sensorStatuses]);

return {
  // ... existing
  sensorStatuses,
  hasStaleData,
};
```

---

### T030: [US4] Create StaleDataAlert Component [P]
**File**: `frontend/src/components/dati/StaleDataAlert.tsx`
**Story**: US4
**Duration**: 30 min
**Dependencies**: T001

**Description**:
Build banner warning component for stale sensor data.

**Acceptance Criteria**:
- [X] Yellow background (#fef3c7) with warning icon (⚠️)
- [X] Message: "Alcuni sensori non inviano dati da più di 15 minuti"
- [X] Dismissible with X button (stores dismissed state in localStorage)
- [X] Only renders when `hasStaleData === true`
- [X] Responsive spacing

**Implementation**:
```tsx
export function StaleDataAlert({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4 flex items-center justify-between">
      <p className="text-sm text-yellow-800">
        ⚠️ Alcuni sensori non inviano dati da più di 15 minuti
      </p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-yellow-600 hover:text-yellow-800">
          ✕
        </button>
      )}
    </div>
  );
}
```

---

### T031: [US4] Update CurrentReadingCard - Enhance Stale Indicator
**File**: `frontend/src/components/dati/CurrentReadingCard.tsx`
**Story**: US4
**Duration**: 20 min
**Dependencies**: T008

**Description**:
Improve stale indicator visibility on sensor cards.

**Acceptance Criteria**:
- [X] Stale badge more prominent (larger, yellow-500 background)
- [X] Yellow left border when stale (previously was green for all)
- [X] Card opacity slightly reduced when stale (opacity-90)
- [X] Timestamp shows relative time in yellow when stale

**Enhancement**:
```tsx
<div className={`bg-white rounded-lg shadow-sm p-4 border-l-4 ${
  reading.isStale
    ? 'border-yellow-500 opacity-90'
    : 'border-green-500'
}`}>
  <div className="flex items-start justify-between mb-2">
    <span className="text-3xl">{reading.icon}</span>
    {reading.isStale && (
      <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded font-semibold">
        Vecchio
      </span>
    )}
  </div>
  {/* ... rest of card */}
  <p className={`text-xs mt-2 ${
    reading.isStale ? 'text-yellow-700 font-medium' : 'text-gray-500'
  }`}>
    {formatTimestamp(reading.timestamp, 'relative')}
  </p>
</div>
```

---

### T032: [US4] Update Dati Page - Add Stale Data Alert
**File**: `frontend/src/pages/Dati.page.tsx`
**Story**: US4
**Duration**: 15 min
**Dependencies**: T029, T030

**Description**:
Integrate stale data alert banner at top of page content.

**Acceptance Criteria**:
- [X] Alert renders below header, above current readings section
- [X] Only visible when `hasStaleData === true`
- [X] Dismissal persists for current session (or until next stale detection)

**Implementation**:
```tsx
<main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {hasStaleData && <StaleDataAlert />}

  {/* ... rest of page */}
</main>
```

---

### T033: [US4] Manual QA - Data Gap Detection
**Story**: US4
**Duration**: 30 min
**Dependencies**: T032

**Description**:
Verify User Story 4 acceptance scenarios through manual testing.

**Test Cases**:
1. [ ] Simulate stale sensor (pause device for 20 min) → Stale indicator appears
2. [ ] Banner warning appears at top of page when sensor is stale
3. [ ] Sensor card shows yellow badge and border for stale data
4. [ ] Timestamp displays in yellow for stale readings
5. [ ] Banner dismissible and doesn't reappear until next stale event
6. [ ] Empty state ("Nessun dato") appears for sensor that never reported
7. [ ] Auto-refresh updates stale status in real-time

**Success Criteria**: All 7 test cases pass

---

## ✓ CHECKPOINT: User Story 4 Complete

**Deliverable**: Users can identify stale/missing data with clear visual indicators.

**Independent Test**: Verify all acceptance scenarios from spec.md User Story 4.

---

## Phase 6: Polish & Integration (Cross-Cutting Concerns)

These tasks address quality, performance, and professional appearance.

---

### T034: [Polish] Add Loading Skeletons for Charts [P]
**File**: `frontend/src/components/common/LoadingSkeleton.tsx` (extend existing)
**Story**: Polish
**Duration**: 30 min
**Dependencies**: None

**Description**:
Create skeleton loader for chart components to improve perceived performance.

**Acceptance Criteria**:
- [X] Skeleton matches chart card dimensions (300px height)
- [X] Animated pulse effect
- [X] Reusable component accepts height and className props
- [X] Used in all chart rendering locations

---

### T035: [Polish] Add Mobile-Specific Chart Optimizations
**Files**: All chart components
**Story**: Polish
**Duration**: 1 hour
**Dependencies**: T016-T019, T025-T026

**Description**:
Optimize chart display for mobile devices <768px.

**Acceptance Criteria**:
- [X] Chart height reduces to 250px on mobile (300px desktop)
- [X] Font sizes scale down (tick: 10px, legend: 11px)
- [X] X-axis shows fewer ticks on mobile (interval: 'preserveStartEnd')
- [X] Tooltip follows touch gestures correctly
- [X] No horizontal overflow

**Reference**: `research.md` - Section 3.4 for mobile responsiveness

---

### T036: [Polish] Add Error Boundaries for Chart Sections
**File**: `frontend/src/components/dati/ChartErrorBoundary.tsx`
**Story**: Polish
**Duration**: 45 min
**Dependencies**: None

**Description**:
Wrap chart components in error boundaries to prevent full page crash.

**Acceptance Criteria**:
- [X] Catches rendering errors in chart components
- [X] Displays friendly error message: "Impossibile caricare il grafico"
- [X] Includes retry button that clears error state
- [X] Logs error to console for debugging
- [X] Doesn't affect other charts if one fails

**Implementation**:
```tsx
export class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ChartErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[300px] flex flex-col items-center justify-center text-gray-500">
          <p className="mb-4">⚠️ Impossibile caricare il grafico</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Riprova
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

### T037: [Polish] Performance Audit and Optimization
**Story**: Polish
**Duration**: 1 hour
**Dependencies**: All previous tasks

**Description**:
Run performance profiling and apply optimizations.

**Acceptance Criteria**:
- [X] Page load time <2 seconds (measure with React DevTools Profiler)
- [X] Time range switch <1 second (measure with Network tab)
- [X] No unnecessary re-renders (check with React DevTools Profiler)
- [X] Query cache working correctly (verify in React Query DevTools)
- [X] Chart animations disabled for >1000 data points
- [X] Memoize expensive computations (isStale, hasStaleData)

**Optimizations to Apply**:
1. Memoize chart data transformations with `useMemo`
2. Add `React.memo()` to pure components (cards, charts)
3. Disable Recharts animations when `data.length > 1000`
4. Ensure query keys are stable (not recreated on every render)

---

### T038: [Polish] Final Manual QA - Full Feature Test
**Story**: Polish
**Duration**: 1 hour
**Dependencies**: All previous tasks

**Description**:
Comprehensive end-to-end testing of complete feature.

**Test Matrix**:

| Test Case | Viewport | Expected Result |
|-----------|----------|-----------------|
| Empty state | All | Onboarding wizard renders |
| Current readings | Mobile (320px) | Cards stack vertically |
| Current readings | Tablet (768px) | 2-column grid |
| Current readings | Desktop (1920px) | 3-column grid |
| Auto-refresh | All | New timestamps after 60s |
| Time range switch | All | Charts update <1s |
| Chart hover | Desktop | Tooltip shows value + timestamp |
| Chart touch | Mobile | Tooltip follows finger |
| Stale data | All | Yellow indicators visible |
| Comparison charts | All | Two lines clearly distinguishable |
| No data gaps | All | Continuous lines |
| Data gaps >15min | All | Dotted/dashed lines |
| Error recovery | All | Error boundary catches issues |

**Success Criteria**: All 13 test cases pass across 3 viewports (39 total combinations)

---

## ✓ FINAL CHECKPOINT: Feature Complete

All user stories implemented and tested. Ready for code review and deployment.

---

## Dependencies Graph

```
Phase 1 (Setup/Foundation)
├─ T001: Type Definitions [P]
├─ T002: Formatting Utils [P] → depends on T001
├─ T003: Time-Series Utils [P] → depends on T001
└─ T004: Extend SensorsService → depends on T001

Phase 2 (US1: Current Readings)
├─ T005: getCurrentReadings() → depends on T001, T004
├─ T006: React Query Keys [P] → depends on T001
├─ T007: useDatiData (current) → depends on T005, T006
├─ T008: CurrentReadingCard → depends on T001, T002
├─ T009: EmptyStateOnboarding [P]
├─ T010: Dati Page (US1) → depends on T007, T008, T009
├─ T011: Update Routes → depends on T010
└─ T012: Manual QA US1 → depends on T011

Phase 3 (US2: Historical Trends)
├─ T013: getTimeSeriesData() → depends on T005, T003
├─ T014: Extend useDatiData (time range) → depends on T007, T003
├─ T015: TimeRangeSelector [P] → depends on T001
├─ T016: TemperatureChart [P] → depends on T001
├─ T017: HumidityChart [P] → depends on T016
├─ T018: SoilMoistureChart [P] → depends on T016
├─ T019: TankLevelChart [P] → depends on T016
├─ T020: Extend useDatiData (charts) → depends on T013, T014, T006
├─ T021: Update Dati Page (US2) → depends on T010, T015, T016-T019, T020
└─ T022: Manual QA US2 → depends on T021

Phase 4 (US3: Comparison)
├─ T023: getComparisonChartData() → depends on T013, T003
├─ T024: Update useDatiData (comparison) → depends on T020, T023, T006
├─ T025: Refactor TemperatureChart → depends on T016, T024
├─ T026: Refactor HumidityChart → depends on T017, T024
└─ T027: Manual QA US3 → depends on T025, T026

Phase 5 (US4: Data Gaps)
├─ T028: getSensorStatuses() → depends on T005
├─ T029: Extend useDatiData (statuses) → depends on T028, T006
├─ T030: StaleDataAlert [P] → depends on T001
├─ T031: Enhance CurrentReadingCard → depends on T008
├─ T032: Update Dati Page (alert) → depends on T029, T030
└─ T033: Manual QA US4 → depends on T032

Phase 6 (Polish)
├─ T034: Loading Skeletons [P]
├─ T035: Mobile Optimizations → depends on T016-T019, T025-T026
├─ T036: Error Boundaries [P]
├─ T037: Performance Audit → depends on all previous
└─ T038: Final QA → depends on all previous
```

---

## Parallel Execution Opportunities

### Phase 1 (Foundation) - 3 tasks can run in parallel:
- T001 + T002 + T003 (after T001 completes)
- Estimated parallel time: **1.5 hours** (vs 2.5 hours sequential)

### Phase 2 (US1) - 2 parallelizable:
- T006 + T009 while waiting for T005
- Estimated savings: **45 minutes**

### Phase 3 (US2) - 5 charts parallelizable:
- T015 + T016 + T017 + T018 + T019 after T013 completes
- Estimated parallel time: **1 hour** (vs 4.25 hours sequential)
- **Savings: 3.25 hours**

### Phase 6 (Polish) - 2 parallelizable:
- T034 + T036 independently
- Estimated savings: **30 minutes**

**Total Potential Time Savings with Parallel Execution: ~5 hours**

---

## Implementation Strategy

### MVP Delivery (2 days)
**Scope**: User Story 1 only (T001-T012)
- Current readings display with auto-refresh
- Empty state onboarding
- Stale data detection on cards

### Incremental Delivery (8-9 days)
**Week 1**:
- Days 1-2: Foundation + US1 (MVP delivery)
- Days 3-4: US2 (Historical trends)

**Week 2**:
- Day 5: US3 (Comparison charts)
- Day 6: US4 (Data gap detection)
- Days 7-8: Polish & QA

### Critical Path
```
T001 → T002 → T005 → T007 → T010 → T011 → T013 → T020 → T021 → T023 → T024 → T025 → T028 → T029 → T032 → T037 → T038
```

**Critical Path Duration**: ~12 hours of focused work (excluding QA and polish)

---

## Testing Strategy

**Note**: No automated tests required per spec.md (testing infrastructure deferred). All verification via manual QA.

### Manual QA Checkpoints:
1. After T012: Verify US1 acceptance scenarios
2. After T022: Verify US2 acceptance scenarios
3. After T027: Verify US3 acceptance scenarios
4. After T033: Verify US4 acceptance scenarios
5. After T038: Full feature regression test

### Browser Compatibility Testing:
- Chrome/Edge (primary)
- Firefox
- Safari (iOS)
- Mobile browsers (320px, 375px, 768px viewports)

---

## Success Metrics

**Development Velocity**:
- 38 tasks in 8-9 days = ~4-5 tasks/day
- MVP delivery: 12 tasks in 2 days = 6 tasks/day

**Quality Metrics** (from spec.md Success Criteria):
- [ ] SC-001: Page load <2 seconds
- [ ] SC-002: Time range switch <1 second
- [ ] SC-003: Identify stale data <5 seconds
- [ ] SC-004: Responsive 320px-1920px
- [ ] SC-005: Intuitive sopra/sotto comparison
- [ ] SC-006: Locate historical value <30 seconds
- [ ] SC-007: Multi-year data performance maintained
- [ ] SC-008: User feedback: "professional and easy to understand"

---

## Glossary

- **US1/US2/US3/US4**: User Story 1/2/3/4 from spec.md
- **P1/P2/P3**: Priority levels (P1 = highest)
- **[P]**: Parallelizable task (can run concurrently)
- **Sopra**: Italian for "above" (lamp height)
- **Sotto**: Italian for "below" (ground level)
- **Stale Data**: Sensor readings >15 minutes old
- **Comparison Chart**: Overlaid chart showing sopra vs sotto
- **Time Range**: User-selected period (24h, 7d, 30d)

---

**End of Task Breakdown**

For implementation, start with Phase 1 (T001-T004), then proceed to Phase 2 for MVP delivery. Each task is self-contained and references the appropriate design documents for detailed specifications.
