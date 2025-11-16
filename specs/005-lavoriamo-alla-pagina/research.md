# Research: Pagina Dati Implementation

**Feature**: 005-lavoriamo-alla-pagina
**Date**: 2025-11-14
**Status**: Complete

## Overview

This document consolidates research findings for implementing the "Dati" (Data) page redesign, resolving all "NEEDS CLARIFICATION" items from the Technical Context and providing best practices for the technologies involved.

---

## 1. Testing Infrastructure

### Decision
Defer comprehensive testing infrastructure setup to future iteration. Focus on manual QA and visual regression testing for this feature.

### Rationale
- **Current State**: No test infrastructure exists in codebase (no Jest, Vitest, React Testing Library, or E2E framework detected)
- **Cost/Benefit**: Setting up testing infrastructure is a significant undertaking (test runner, assertion library, mock setup, CI integration) that would delay feature delivery
- **Risk Assessment**: This is a UI-focused refactor with existing functionality. Manual QA can adequately cover acceptance scenarios in the short term
- **Future Path**: Recommend Vitest + React Testing Library for unit/integration tests, Playwright for E2E

### Alternatives Considered
1. **Full testing setup before implementation**: Rejected due to timeline impact and missing test-first culture in existing codebase
2. **Minimal Jest setup**: Rejected because Vite-based projects benefit more from Vitest's native ESM support
3. **Component visual testing only (Storybook)**: Rejected as insufficient for verifying data fetching logic

### Action Items
- Document manual QA checklist based on acceptance scenarios in spec.md
- Add testing infrastructure as a separate technical debt item for Q1 2026

---

## 2. Data Downsampling Strategy

### Decision
Implement **client-side downsampling** with PostgreSQL aggregation queries. Defer automated backend job to Phase 2.

### Rationale
- **Phase 1 (This Feature)**: Query full granularity data for 0-15 days, use SQL aggregation for older data
- **Phase 2 (Future)**: Add pg_cron or TimescaleDB continuous aggregate for automatic materialization
- **Why Client-Side First**: Simpler to implement, no new database extensions, works with existing Supabase setup

### Implementation Approach

#### Query Pattern for Recent Data (0-15 days)
```sql
SELECT timestamp, value, sensor_type
FROM sensor_readings
WHERE timestamp >= NOW() - INTERVAL '15 days'
  AND sensor_id IN (...)
ORDER BY timestamp ASC;
```

#### Query Pattern for Historical Data (>15 days)
```sql
SELECT
  date_trunc('hour', timestamp) as bucket,
  sensor_type,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as sample_count
FROM sensor_readings
WHERE timestamp < NOW() - INTERVAL '15 days'
  AND sensor_id IN (...)
GROUP BY bucket, sensor_type
ORDER BY bucket ASC;
```

#### Service Layer Logic
```typescript
// In history.service.ts
async function getSensorData(sensorId: string, startDate: Date, endDate: Date) {
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  if (startDate >= fifteenDaysAgo) {
    // All data is recent - fetch full granularity
    return fetchFullGranularityData(sensorId, startDate, endDate);
  } else if (endDate <= fifteenDaysAgo) {
    // All data is historical - fetch aggregated
    return fetchAggregatedData(sensorId, startDate, endDate, '30 minutes');
  } else {
    // Spans boundary - fetch both and merge
    const recentData = await fetchFullGranularityData(sensorId, fifteenDaysAgo, endDate);
    const historicalData = await fetchAggregatedData(sensorId, startDate, fifteenDaysAgo, '30 minutes');
    return mergeTimeSeries(historicalData, recentData);
  }
}
```

### Alternatives Considered
1. **TimescaleDB Continuous Aggregates**: Best long-term solution but requires Supabase Pro plan and migration complexity
2. **Materialized Views**: Good middle ground but requires manual refresh strategy
3. **Write-time Downsampling**: Creates data duplication and complicates insert logic

### Future Optimization
- Add `sensor_readings_hourly` materialized view for 15-30 day range
- Add `sensor_readings_daily` materialized view for >30 day range
- Use pg_cron to refresh views nightly

---

## 3. Recharts Best Practices for Time-Series Data

### Decision
Continue using Recharts 3.2.1 with optimizations for large datasets and overlaid multi-line charts.

### Rationale
- **Already Installed**: Recharts 3.2.1 is in package.json and working in existing History.page
- **React 19 Compatible**: Latest Recharts version supports React 19
- **Good for Indoor Greenhouse Use Case**: Handles 6 sensor types with <10k points per chart efficiently

### Best Practices Identified

#### 1. Performance Optimization for Large Datasets
```typescript
<LineChart data={chartData}>
  <Line
    type="monotone"
    dataKey="temperature"
    stroke="#ef4444"
    strokeWidth={2}
    dot={false}              // Critical: Disable dots for >100 points
    isAnimationActive={false} // Disable animation for >1000 points
  />
</LineChart>
```

#### 2. Overlaid Comparison Charts (Temperature: Sopra vs Sotto)
```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={mergedData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
    <XAxis
      dataKey="timestamp"
      tickFormatter={(value) => format(new Date(value), 'HH:mm')}
      stroke="#6b7280"
    />
    <YAxis
      label={{ value: '°C', angle: -90, position: 'insideLeft' }}
      domain={['auto', 'auto']}
      stroke="#6b7280"
    />
    <Tooltip
      labelFormatter={(value) => format(new Date(value), 'PPpp', { locale: it })}
      formatter={(value: number) => [value.toFixed(1), '']}
    />
    <Legend
      verticalAlign="top"
      height={36}
      iconType="line"
    />
    <Line
      type="monotone"
      dataKey="temp_sopra"
      stroke="#ef4444"
      strokeWidth={2}
      name="Temperatura Sopra (Lampada)"
      dot={false}
      connectNulls={false}  // For gap visualization
      strokeDasharray="5 5" // When data is stale
    />
    <Line
      type="monotone"
      dataKey="temp_sotto"
      stroke="#3b82f6"
      strokeWidth={2}
      name="Temperatura Sotto (Terreno)"
      dot={false}
      connectNulls={false}
    />
  </LineChart>
</ResponsiveContainer>
```

#### 3. Gap Visualization with Dotted Lines
```typescript
// Data transformation to show gaps
function prepareDataWithGaps(readings: SensorReading[]) {
  const sortedReadings = readings.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const result = [];
  for (let i = 0; i < sortedReadings.length; i++) {
    result.push(sortedReadings[i]);

    // If gap > 15 minutes, insert null point to break line
    if (i < sortedReadings.length - 1) {
      const current = new Date(sortedReadings[i].timestamp);
      const next = new Date(sortedReadings[i + 1].timestamp);
      const gapMinutes = (next.getTime() - current.getTime()) / (1000 * 60);

      if (gapMinutes > 15) {
        result.push({
          timestamp: new Date(current.getTime() + 1000).toISOString(),
          value: null, // This creates the gap
        });
      }
    }
  }
  return result;
}

// Then use connectNulls={false} in Line component
```

#### 4. Mobile Responsiveness
```typescript
// Adjust chart height and font sizes based on viewport
const isMobile = window.innerWidth < 768;

<ResponsiveContainer width="100%" height={isMobile ? 250 : 400}>
  <LineChart data={data}>
    <XAxis
      tick={{ fontSize: isMobile ? 10 : 12 }}
      interval={isMobile ? 'preserveStartEnd' : 'preserveEnd'}
    />
    <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
    <Legend
      wrapperStyle={{ fontSize: isMobile ? '11px' : '14px' }}
      iconSize={isMobile ? 10 : 14}
    />
  </LineChart>
</ResponsiveContainer>
```

### Alternatives Considered
1. **ApexCharts**: Rejected - Already have apexcharts in package.json but not using it; Recharts is more React-native
2. **Chart.js**: Rejected - Imperative API doesn't fit React paradigm as well
3. **Plotly.js**: Rejected - Overkill for this use case, large bundle size
4. **D3.js**: Rejected - Too low-level, requires custom implementation

---

## 4. Auto-Refresh Strategy (1-Minute Interval)

### Decision
Use React Query's `refetchInterval` with smart invalidation to refresh current readings every 60 seconds.

### Rationale
- **React Query Already Integrated**: @tanstack/react-query 5.90.2 in use throughout app
- **Efficient**: Only refetches stale queries, leverages caching
- **User-Friendly**: Doesn't disrupt user interaction (scrolling, hovering on charts)

### Implementation Pattern

```typescript
// In Dati.page.tsx
const { data: currentReadings } = useQuery({
  queryKey: ['current-readings', deviceIds],
  queryFn: async () => {
    // Fetch latest reading per sensor type
    const { data } = await supabase
      .from('sensor_readings')
      .select('sensor_type, value, timestamp')
      .in('device_id', deviceIds)
      .order('timestamp', { ascending: false })
      .limit(6); // One per sensor type (temp sopra/sotto, humidity sopra/sotto, soil, tank)

    return data;
  },
  refetchInterval: 60000, // 60 seconds
  staleTime: 55000,       // Consider stale after 55 seconds
  enabled: !!deviceIds && deviceIds.length > 0,
});

// Indicator for last update time
const lastUpdateTime = currentReadings?.[0]?.timestamp;
const minutesSinceUpdate = lastUpdateTime
  ? Math.floor((Date.now() - new Date(lastUpdateTime).getTime()) / 60000)
  : null;

const isDataStale = minutesSinceUpdate !== null && minutesSinceUpdate > 15;
```

### Visual Feedback
```tsx
{isDataStale && (
  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
    <p className="text-sm text-yellow-800">
      ⚠️ Dati non aggiornati da {minutesSinceUpdate} minuti
    </p>
  </div>
)}
```

### Alternatives Considered
1. **WebSocket Real-Time Subscriptions**: Rejected - Overkill for 1-minute refresh, adds complexity
2. **Server-Sent Events (SSE)**: Rejected - Supabase Realtime is available but unnecessary for low-frequency updates
3. **Manual setInterval**: Rejected - React Query handles this more elegantly with automatic cleanup

---

## 5. Responsive Layout Strategy

### Decision
Use **CSS Grid** for main layout with TailwindCSS responsive utilities.

### Rationale
- **Two-Column Desktop, Single-Column Mobile**: Perfect use case for CSS Grid
- **Tailwind Already Integrated**: Version 4.1.14 in package.json
- **Simpler Than Flexbox**: Grid handles 2D layout more intuitively

### Layout Structure

```tsx
<div className="min-h-screen bg-gray-50">
  <header className="bg-white shadow-sm sticky top-0 z-10">
    {/* Navigation bar with page title "Dati" */}
  </header>

  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    {/* Stale data warning */}
    {isDataStale && <StaleDataAlert />}

    {/* Current Readings Section */}
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Letture Correnti</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 6 sensor cards: temp sopra/sotto, humidity sopra/sotto, soil, tank */}
        <CurrentReadingCard sensor="temp_sopra" value={22.5} unit="°C" timestamp={...} />
        <CurrentReadingCard sensor="temp_sotto" value={21.8} unit="°C" timestamp={...} />
        {/* ... 4 more cards */}
      </div>
    </section>

    {/* Time Range Selector */}
    <section className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
    </section>

    {/* Historical Charts Section */}
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Storico</h2>

      {/* Temperature Chart (Overlaid: Sopra vs Sotto) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Temperatura</h3>
        <TemperatureComparisonChart data={tempData} />
      </div>

      {/* Humidity Chart (Overlaid: Sopra vs Sotto) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Umidità</h3>
        <HumidityComparisonChart data={humidityData} />
      </div>

      {/* Soil Moisture Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Umidità Terreno</h3>
        <SoilMoistureChart data={soilData} />
      </div>

      {/* Tank Level Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Livello Serbatoio</h3>
        <TankLevelChart data={tankData} />
      </div>
    </section>
  </main>
</div>
```

### Responsive Breakpoints (Tailwind Defaults)
- **sm**: 640px (mobile landscape)
- **md**: 768px (tablets)
- **lg**: 1024px (desktop)
- **xl**: 1280px (large desktop)

### Mobile Optimizations
```typescript
// 1. Card Grid: 1 column on mobile, 2 on tablet, 3 on desktop
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// 2. Reduced padding on mobile
className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6"

// 3. Smaller font sizes on mobile
className="text-sm sm:text-base"

// 4. Hide less critical info on mobile
className="hidden sm:block"

// 5. Stacked time range buttons on mobile
className="flex flex-col sm:flex-row gap-2"
```

---

## 6. Onboarding Wizard for Empty State

### Decision
Simple **inline onboarding flow** with call-to-action to device management.

### Rationale
- **Scope Constraint**: Spec explicitly marks sensor configuration as "out of scope" for this page
- **Existing Functionality**: Device and sensor setup already exists in `/devices` route
- **User Flow**: Guide users to existing functionality rather than duplicate configuration UI

### Implementation

```tsx
// In Dati.page.tsx - Empty state component
function EmptyStateOnboarding() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-6">
        <div className="text-6xl">🌱</div>
        <h2 className="text-2xl font-bold text-gray-900">
          Benvenuto su Dati
        </h2>
        <p className="text-gray-600">
          Per iniziare a visualizzare i dati dei tuoi sensori, devi prima configurare
          almeno un dispositivo con sensori attivi.
        </p>
        <div className="space-y-3">
          <Link
            to="/devices"
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
          >
            <Settings className="h-5 w-5 mr-2" />
            Configura Dispositivi
          </Link>
          <p className="text-sm text-gray-500">
            Oppure consulta la{' '}
            <a href="#" className="text-green-600 hover:underline">
              guida rapida
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Usage in main component
if (!devices || devices.length === 0 || !sensors || sensors.length === 0) {
  return (
    <PageLayout>
      <EmptyStateOnboarding />
    </PageLayout>
  );
}
```

### Alternatives Considered
1. **Multi-step Modal Wizard**: Rejected - Too complex for MVP, goes beyond page scope
2. **Inline Configuration**: Rejected - Violates separation of concerns, duplicates `/devices` functionality
3. **Video Tutorial**: Rejected - Asset management overhead, localization complexity

---

## 7. Decimal Precision Standards

### Decision
Implement **sensor-type-specific precision** with helper utility function.

### Rationale
- **User Experience**: Different sensor types require different precision levels for readability
- **Scientific Accuracy**: Align precision with sensor hardware capabilities
- **Consistency**: Centralize formatting logic to ensure uniform display

### Precision Standards

| Sensor Type | Precision | Rationale |
|-------------|-----------|-----------|
| Temperature (°C) | 1 decimal | DHT22 accuracy is ±0.5°C, 1 decimal sufficient |
| Humidity (%) | 0 decimals | DHT22 accuracy is ±2%, integers sufficient |
| Soil Moisture (%) | 0 decimals | Capacitive sensors have ~5% variance, integers sufficient |
| Tank Level | Varies by unit | cm: 1 decimal, liters: 1 decimal, %: 0 decimals |

### Implementation

```typescript
// In lib/utils/formatting.ts
export function formatSensorValue(
  value: number,
  sensorType: string,
  unit?: string
): string {
  switch (sensorType) {
    case 'dht_sopra_temp':
    case 'dht_sotto_temp':
      return value.toFixed(1);

    case 'dht_sopra_humidity':
    case 'dht_sotto_humidity':
    case 'soil_moisture_1':
    case 'soil_moisture_2':
    case 'soil_moisture_3':
    case 'soil_moisture_4':
    case 'soil_moisture_5':
      return Math.round(value).toString();

    case 'water_level':
      if (unit === '%') return Math.round(value).toString();
      return value.toFixed(1); // For cm or liters

    default:
      return value.toString();
  }
}

// Usage in components
<span className="text-3xl font-bold">
  {formatSensorValue(reading.value, reading.sensor_type, reading.unit)}
  <span className="text-lg font-normal ml-1">{reading.unit}</span>
</span>
```

---

## 8. Color Palette for Professional Appearance

### Decision
Use **semantic color system** with Tailwind's neutral grays and accent colors for sensor types.

### Rationale
- **Professional != Flashy**: Neutral base with strategic color accents
- **Accessibility**: Ensure WCAG 2.1 AA compliance (4.5:1 contrast for text)
- **Greenhouse Domain**: Green as primary accent reinforces domain context

### Color System

```typescript
// Sensor type colors
const SENSOR_COLORS = {
  temperature: {
    sopra: '#ef4444',   // red-500 (warm/hot - lamp level)
    sotto: '#3b82f6',   // blue-500 (cooler - ground level)
  },
  humidity: {
    sopra: '#06b6d4',   // cyan-500 (lighter blue - lamp level)
    sotto: '#0284c7',   // sky-600 (deeper blue - ground level)
  },
  soil_moisture: '#10b981',  // green-500 (plants)
  water_level: '#6366f1',    // indigo-500 (water tank)
};

// UI colors
const UI_COLORS = {
  primary: '#16a34a',      // green-600 (CTAs, primary actions)
  secondary: '#6b7280',    // gray-500 (secondary text)
  background: '#f9fafb',   // gray-50 (page background)
  card: '#ffffff',         // white (cards, panels)
  border: '#e5e7eb',       // gray-200 (subtle borders)
  error: '#dc2626',        // red-600 (errors, alerts)
  warning: '#f59e0b',      // amber-500 (warnings, stale data)
  success: '#10b981',      // green-500 (success states)
};
```

### Tailwind Classes for Consistency
```typescript
// Page background
className="bg-gray-50"

// Cards
className="bg-white rounded-lg shadow-sm"

// Headers
className="text-gray-900 font-semibold"

// Body text
className="text-gray-600"

// Borders
className="border border-gray-200"

// Primary CTA
className="bg-green-600 hover:bg-green-700 text-white"
```

---

## Summary of Research Decisions

| Topic | Decision | Status |
|-------|----------|--------|
| Testing Infrastructure | Defer to future iteration, use manual QA | ✅ Resolved |
| Data Downsampling | Client-side with SQL aggregation, backend job in Phase 2 | ✅ Resolved |
| Chart Library | Continue with Recharts 3.2.1 | ✅ Resolved |
| Auto-Refresh | React Query refetchInterval (60 seconds) | ✅ Resolved |
| Responsive Layout | CSS Grid with Tailwind utilities | ✅ Resolved |
| Empty State | Inline onboarding with CTA to /devices | ✅ Resolved |
| Decimal Precision | Sensor-type-specific helper function | ✅ Resolved |
| Color Palette | Semantic system with neutral base | ✅ Resolved |

All "NEEDS CLARIFICATION" items from Technical Context have been resolved. Ready to proceed to Phase 1 (Data Model & Contracts).
