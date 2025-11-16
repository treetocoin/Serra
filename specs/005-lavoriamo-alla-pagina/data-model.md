# Data Model: Pagina Dati

**Feature**: 005-lavoriamo-alla-pagina
**Date**: 2025-11-14

## Overview

This document defines the entities, relationships, and data transformations required for the "Dati" page. The data model focuses on **frontend presentation concerns** rather than database schema changes, as the feature leverages existing Supabase tables without migrations.

---

## Entities

### 1. CurrentReading

Represents the latest measurement for a specific sensor type, displayed in the "Letture Correnti" section.

**Fields**:
- `sensorType`: `'dht_sopra_temp' | 'dht_sopra_humidity' | 'dht_sotto_temp' | 'dht_sotto_humidity' | 'soil_moisture' | 'water_level'`
- `value`: `number` - The measured value
- `unit`: `string` - Unit of measurement (°C, %, cm, L, etc.)
- `timestamp`: `Date` - When the reading was taken
- `deviceId`: `string` (UUID) - Source device identifier
- `isStale`: `boolean` - True if reading is >15 minutes old

**Validation Rules**:
- `timestamp` must not be in the future
- `value` must be numeric and within sensor's configured min/max bounds (if set)
- `isStale` computed as: `(now - timestamp) > 15 minutes`

**State Transitions**:
None - read-only entity for display purposes

**TypeScript Definition**:
```typescript
interface CurrentReading {
  sensorType: SensorType;
  value: number;
  unit: string;
  timestamp: Date;
  deviceId: string;
  isStale: boolean;
  displayName: string;  // Human-readable name (e.g., "Temperatura Sopra")
  icon: string;         // Emoji icon for sensor type
  color: string;        // Tailwind color class for UI
}
```

---

### 2. TimeSeriesDataPoint

Represents a single point in a historical chart, supporting both full-granularity and downsampled data.

**Fields**:
- `timestamp`: `Date` - X-axis value
- `value`: `number | null` - Y-axis value (null indicates gap in data)
- `sensorType`: `SensorType` - Which sensor this reading is from
- `isAggregated`: `boolean` - True if this is a downsampled point (avg/min/max)
- `aggregationMetadata?`: `{ min: number, max: number, sampleCount: number }` - Optional metadata for aggregated points

**Validation Rules**:
- `timestamp` must be in chronological order within a time series
- If `isAggregated` is true, `aggregationMetadata` must be present
- Gaps (null values) should only appear when there's a >15 minute interval between readings

**TypeScript Definition**:
```typescript
interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number | null;
  sensorType: SensorType;
  isAggregated: boolean;
  aggregationMetadata?: {
    min: number;
    max: number;
    sampleCount: number;
  };
}
```

---

### 3. ComparisonChartData

Represents data structure for overlaid comparison charts (temperature sopra vs sotto, humidity sopra vs sotto).

**Fields**:
- `timestamp`: `Date` - Common X-axis value
- `primaryValue`: `number | null` - First series (e.g., temp sopra)
- `secondaryValue`: `number | null` - Second series (e.g., temp sotto)
- `primaryLabel`: `string` - Display name for primary series
- `secondaryLabel`: `string` - Display name for secondary series

**Relationships**:
- Derived from two separate `TimeSeriesDataPoint[]` arrays by timestamp alignment

**Validation Rules**:
- Both series must share the same time range
- Timestamps must align exactly (use time bucketing to achieve this)

**TypeScript Definition**:
```typescript
interface ComparisonChartData {
  timestamp: Date;
  primaryValue: number | null;    // e.g., temp_sopra
  secondaryValue: number | null;  // e.g., temp_sotto
  primaryLabel: string;
  secondaryLabel: string;
}
```

---

### 4. TimeRange

Represents the user-selected period for viewing historical data.

**Fields**:
- `value`: `'24h' | '7d' | '30d'` - Predefined range options
- `startDate`: `Date` - Calculated start timestamp
- `endDate`: `Date` - Calculated end timestamp (usually now)
- `interval`: `'raw' | 'hourly' | 'daily'` - Aggregation granularity (auto-selected based on range)

**State Transitions**:
```
User selects "24h" → startDate = now - 24h, endDate = now, interval = 'raw'
User selects "7d"  → startDate = now - 7d,  endDate = now, interval = 'hourly'
User selects "30d" → startDate = now - 30d, endDate = now, interval = 'daily'
```

**Validation Rules**:
- `startDate` must be before `endDate`
- `interval` auto-selection logic:
  - Range <= 2 days: 'raw'
  - Range <= 7 days: 'hourly'
  - Range > 7 days: 'daily'

**TypeScript Definition**:
```typescript
type TimeRangeValue = '24h' | '7d' | '30d';
type AggregationInterval = 'raw' | 'hourly' | 'daily';

interface TimeRange {
  value: TimeRangeValue;
  startDate: Date;
  endDate: Date;
  interval: AggregationInterval;
}

// Helper function
function createTimeRange(value: TimeRangeValue): TimeRange {
  const now = new Date();
  const startDate = new Date(now);

  switch (value) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      return { value, startDate, endDate: now, interval: 'raw' };
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      return { value, startDate, endDate: now, interval: 'hourly' };
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      return { value, startDate, endDate: now, interval: 'daily' };
  }
}
```

---

### 5. SensorStatus

Represents the operational state of a sensor, used for alerting and UX feedback.

**Fields**:
- `sensorType`: `SensorType` - Which sensor this status applies to
- `status`: `'active' | 'stale' | 'no_data' | 'error'`
- `lastSeenAt`: `Date | null` - Most recent reading timestamp
- `message`: `string` - Human-readable status message
- `severity`: `'info' | 'warning' | 'error'`

**State Transitions**:
```
Initial State: 'no_data' (no readings exist)
  ↓ (first reading received)
State: 'active' (readings are current)
  ↓ (>15 minutes since last reading)
State: 'stale' (sensor may be offline)
  ↓ (error during data fetch or invalid readings)
State: 'error' (technical issue)
```

**Validation Rules**:
- `status` determines `severity`:
  - 'active' → 'info'
  - 'stale' → 'warning'
  - 'no_data' → 'warning'
  - 'error' → 'error'

**TypeScript Definition**:
```typescript
type SensorStatusValue = 'active' | 'stale' | 'no_data' | 'error';
type SensorStatusSeverity = 'info' | 'warning' | 'error';

interface SensorStatus {
  sensorType: SensorType;
  status: SensorStatusValue;
  lastSeenAt: Date | null;
  message: string;
  severity: SensorStatusSeverity;
}

// Helper function
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

## Data Transformations

### 1. Raw Sensor Readings → Current Readings

**Input**: Array of `sensor_readings` from Supabase (latest per sensor type)
**Output**: Array of `CurrentReading`

```typescript
async function fetchCurrentReadings(deviceIds: string[]): Promise<CurrentReading[]> {
  // Query: Get latest reading per sensor type
  const { data } = await supabase
    .from('sensor_readings')
    .select('sensor_type, value, timestamp, device_id')
    .in('device_id', deviceIds)
    .order('timestamp', { ascending: false });

  // Group by sensor_type and take most recent
  const latestByType = new Map<SensorType, any>();
  for (const reading of data) {
    if (!latestByType.has(reading.sensor_type)) {
      latestByType.set(reading.sensor_type, reading);
    }
  }

  // Transform to CurrentReading with metadata
  return Array.from(latestByType.values()).map(reading => {
    const config = SENSOR_CONFIGS[reading.sensor_type];
    const timestamp = new Date(reading.timestamp);
    const ageMinutes = (Date.now() - timestamp.getTime()) / (1000 * 60);

    return {
      sensorType: reading.sensor_type,
      value: reading.value,
      unit: config.unit,
      timestamp,
      deviceId: reading.device_id,
      isStale: ageMinutes > 15,
      displayName: config.displayName,
      icon: config.icon,
      color: config.color,
    };
  });
}
```

---

### 2. Time-Series Aggregation (Downsampling)

**Input**: Array of `sensor_readings` for a date range
**Output**: Array of `TimeSeriesDataPoint` (aggregated by time bucket)

```typescript
function aggregateTimeSeries(
  readings: any[],
  interval: 'hourly' | 'daily'
): TimeSeriesDataPoint[] {
  const bucketSize = interval === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

  // Group by time bucket
  const buckets = new Map<number, any[]>();
  for (const reading of readings) {
    const timestamp = new Date(reading.timestamp).getTime();
    const bucket = Math.floor(timestamp / bucketSize) * bucketSize;

    if (!buckets.has(bucket)) {
      buckets.set(bucket, []);
    }
    buckets.get(bucket)!.push(reading);
  }

  // Aggregate each bucket
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketTimestamp, bucketReadings]) => {
      const values = bucketReadings.map(r => r.value);
      const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);

      return {
        timestamp: new Date(bucketTimestamp),
        value: avgValue,
        sensorType: bucketReadings[0].sensor_type,
        isAggregated: true,
        aggregationMetadata: {
          min: minValue,
          max: maxValue,
          sampleCount: values.length,
        },
      };
    });
}
```

---

### 3. Time-Series Alignment for Comparison Charts

**Input**: Two separate `TimeSeriesDataPoint[]` arrays (e.g., temp sopra and temp sotto)
**Output**: Single `ComparisonChartData[]` array with aligned timestamps

```typescript
function alignTimeSeries(
  primarySeries: TimeSeriesDataPoint[],
  secondarySeries: TimeSeriesDataPoint[],
  primaryLabel: string,
  secondaryLabel: string
): ComparisonChartData[] {
  // Create a map of all unique timestamps
  const timestampMap = new Map<number, { primary: number | null; secondary: number | null }>();

  for (const point of primarySeries) {
    const ts = point.timestamp.getTime();
    timestampMap.set(ts, { primary: point.value, secondary: null });
  }

  for (const point of secondarySeries) {
    const ts = point.timestamp.getTime();
    const existing = timestampMap.get(ts) || { primary: null, secondary: null };
    existing.secondary = point.value;
    timestampMap.set(ts, existing);
  }

  // Convert to sorted ComparisonChartData array
  return Array.from(timestampMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([timestamp, values]) => ({
      timestamp: new Date(timestamp),
      primaryValue: values.primary,
      secondaryValue: values.secondary,
      primaryLabel,
      secondaryLabel,
    }));
}
```

---

### 4. Gap Detection and Visualization Preparation

**Input**: Array of `TimeSeriesDataPoint`
**Output**: Array of `TimeSeriesDataPoint` with explicit null points for gaps

```typescript
function insertGapMarkers(
  timeSeries: TimeSeriesDataPoint[],
  gapThresholdMinutes: number = 15
): TimeSeriesDataPoint[] {
  const result: TimeSeriesDataPoint[] = [];
  const sortedSeries = [...timeSeries].sort((a, b) =>
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (let i = 0; i < sortedSeries.length; i++) {
    result.push(sortedSeries[i]);

    // Check if there's a gap to the next point
    if (i < sortedSeries.length - 1) {
      const current = sortedSeries[i].timestamp.getTime();
      const next = sortedSeries[i + 1].timestamp.getTime();
      const gapMinutes = (next - current) / (1000 * 60);

      if (gapMinutes > gapThresholdMinutes) {
        // Insert a null point to create a visual break
        result.push({
          timestamp: new Date(current + 1000), // 1 second after current
          value: null,
          sensorType: sortedSeries[i].sensorType,
          isAggregated: false,
        });
      }
    }
  }

  return result;
}
```

---

## Entity Relationships

```
User
  └── has many → Device
        └── has many → Sensor
              └── generates many → SensorReading
                    ↓
                    transforms to
                    ↓
              ┌─────┴─────┐
              ↓           ↓
        CurrentReading  TimeSeriesDataPoint
              ↓           ↓
              └───→ displayed in UI ←───┘
                    (Dati Page)
```

**Key Relationships**:
1. **Device → Sensor**: One-to-many (a device has multiple sensors)
2. **Sensor → SensorReading**: One-to-many (a sensor produces many readings over time)
3. **SensorReading → CurrentReading**: Many-to-one (latest reading per sensor type)
4. **SensorReading → TimeSeriesDataPoint**: Many-to-many (historical readings aggregated for charts)

---

## Database Query Patterns

### Pattern 1: Fetch Current Readings
```sql
-- Get latest reading per sensor type for user's devices
WITH latest_readings AS (
  SELECT DISTINCT ON (sr.sensor_type)
    sr.sensor_type,
    sr.value,
    sr.timestamp,
    sr.device_id,
    s.unit
  FROM sensor_readings sr
  JOIN sensors s ON sr.sensor_id = s.id
  JOIN devices d ON s.device_id = d.id
  WHERE d.user_id = $1
  ORDER BY sr.sensor_type, sr.timestamp DESC
)
SELECT * FROM latest_readings;
```

### Pattern 2: Fetch Time-Series Data (Full Granularity)
```sql
-- For recent data (< 15 days)
SELECT timestamp, value, sensor_type
FROM sensor_readings
WHERE sensor_id IN ($1, $2, ...)
  AND timestamp >= $startDate
  AND timestamp <= $endDate
ORDER BY timestamp ASC
LIMIT 10000;
```

### Pattern 3: Fetch Time-Series Data (Aggregated)
```sql
-- For historical data (> 15 days), hourly buckets
SELECT
  date_trunc('hour', timestamp) as bucket,
  sensor_type,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as sample_count
FROM sensor_readings
WHERE sensor_id IN ($1, $2, ...)
  AND timestamp >= $startDate
  AND timestamp < $endDate
GROUP BY bucket, sensor_type
ORDER BY bucket ASC;
```

---

## Summary

This data model defines **five core entities** for the Dati page:

1. **CurrentReading**: Latest sensor values for "Letture Correnti" cards
2. **TimeSeriesDataPoint**: Individual points for historical charts
3. **ComparisonChartData**: Aligned data for overlaid temp/humidity comparisons
4. **TimeRange**: User-selected date range with auto-interval selection
5. **SensorStatus**: Operational status with stale/missing data detection

All entities are **frontend presentation models** derived from existing `sensor_readings`, `sensors`, and `devices` tables. No database schema changes are required.

Key transformations handle:
- Latest-value extraction for current readings
- Time-series aggregation for downsampling
- Timestamp alignment for comparison charts
- Gap detection for dotted-line visualization
