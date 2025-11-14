# Data Model: Standard Sensor Configuration

**Feature**: 004-deve-funzionare-così
**Date**: 2025-11-13
**Status**: Design Complete

## Overview

This data model extends the existing Supabase schema to support standard sensor type configuration with port mapping. The design implements a snapshot approach where sensor readings are permanently associated with the sensor type active at collection time, ensuring historical data integrity across configuration changes.

## Entity Relationship Diagram

```
┌─────────────────────┐
│     devices         │
│ ─────────────────── │
│ id (PK, UUID)       │
│ user_id (FK)        │
│ name                │
│ connection_status   │
│ ...                 │
└──────────┬──────────┘
           │
           │ 1:N
           │
┌──────────▼──────────────────────┐
│  device_sensor_configs          │
│ ─────────────────────────────── │
│ id (PK, UUID)                   │
│ device_id (FK) ────────────┐    │
│ sensor_type                 │    │
│ port_id                     │    │
│ configured_at               │    │
│ is_active                   │    │
│ UNIQUE(device_id, port_id,  │    │
│        is_active)           │    │
└─────────────────────────────┘    │
                                   │
                                   │ Used at write time
                                   │ to resolve sensor_type
                                   │
┌──────────────────────────────────▼─┐
│      sensor_readings               │
│ ────────────────────────────────── │
│ id (PK, UUID)                      │
│ device_id (FK)                     │
│ sensor_id (legacy, kept for compat)│
│ sensor_type (NEW, denormalized)    │◄─── Snapshot approach:
│ port_id (NEW)                      │     sensor_type stored
│ value                              │     with each reading
│ timestamp                          │
│ unit                               │
└────────────────────────────────────┘
```

## Entities

### device_sensor_configs (NEW)

**Purpose**: Stores the current and historical configuration of which sensor types are connected to which ports on each device.

**Attributes**:
- `id` (UUID, PK): Unique identifier for this configuration record
- `device_id` (UUID, FK → devices.id, NOT NULL): The device this configuration belongs to
- `sensor_type` (TEXT, NOT NULL): Standard sensor type identifier (see enumeration below)
- `port_id` (TEXT, NOT NULL): Physical port identifier (e.g., "GPIO4", "A0")
- `configured_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): When this configuration was created
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Whether this configuration is currently active

**Constraints**:
- `CHECK (sensor_type IN ('dht_sopra_temp', 'dht_sopra_humidity', 'dht_sotto_temp', 'dht_sotto_humidity', 'soil_moisture_1', 'soil_moisture_2', 'soil_moisture_3', 'soil_moisture_4', 'soil_moisture_5', 'water_level', 'unconfigured'))`
- `CHECK (port_id ~ '^[A-Za-z0-9_-]+$')` - Alphanumeric with dash/underscore only (FR-014)
- `UNIQUE (device_id, port_id, is_active)` WHERE `is_active = TRUE` - Prevents duplicate active port assignments (FR-008)

**Indexes**:
- `idx_device_sensor_configs_device` on `device_id`
- `idx_device_sensor_configs_active` on `(device_id, is_active)` WHERE `is_active = TRUE`

**RLS Policies**:
- SELECT: User can view configs for their devices (via device ownership)
- INSERT: User can create configs for their devices
- UPDATE: User can modify configs for their devices
- DELETE: User can delete configs for their devices (soft delete preferred via `is_active = FALSE`)

**Business Rules**:
1. When user changes a port configuration, set existing config `is_active = FALSE` and insert new config with `is_active = TRUE`
2. Only one active configuration per (device_id, port_id) pair
3. Multiple soil moisture sensors numbered 1-5 can coexist on different ports
4. DHT sensors produce two reading types each (temperature + humidity) but are configured once

**Lifecycle**:
- **Creation**: User configures sensor via SensorConfigForm component
- **Update**: User modifies sensor type or port → old config deactivated, new config created
- **Deletion**: User removes sensor → config set to `is_active = FALSE`
- **Query**: Active configs fetched for configuration UI display

---

### sensor_readings (MODIFIED)

**Purpose**: Stores time-series sensor data with permanent sensor type association.

**New Attributes**:
- `sensor_type` (TEXT, nullable for backward compatibility): Standard sensor type at time of reading (denormalized from active config)
- `port_id` (TEXT, nullable for backward compatibility): Port identifier at time of reading

**Existing Attributes** (unchanged):
- `id` (UUID, PK)
- `device_id` (UUID, FK → devices.id)
- `sensor_id` (TEXT): Legacy identifier, kept for backward compatibility
- `value` (NUMERIC)
- `timestamp` (TIMESTAMPTZ)
- `unit` (TEXT)

**New Indexes**:
- `idx_sensor_readings_type` on `sensor_type`
- `idx_sensor_readings_device_type` on `(device_id, sensor_type)`

**RLS Policies** (existing, no changes):
- SELECT: User can view readings from their devices
- INSERT: Service role only (readings inserted via API/Edge Function)

**Business Rules**:
1. `sensor_type` resolved at write time from active `device_sensor_configs` entry
2. If no active config for port, `sensor_type = 'unconfigured'` (see R3 in research.md)
3. Once written, `sensor_type` is immutable (implements snapshot approach from spec User Story 3)
4. Historical readings retain their original `sensor_type` even after configuration changes

**Data Flow**:
```
Device sends reading
  ↓
API/Edge Function receives (device_id, port_id, value)
  ↓
Lookup: SELECT sensor_type FROM device_sensor_configs
        WHERE device_id = ? AND port_id = ? AND is_active = TRUE
  ↓
INSERT INTO sensor_readings (device_id, port_id, sensor_type, value, ...)
  ↓
Reading permanently tagged with sensor_type
```

---

## Standard Sensor Types Enumeration

| sensor_type         | Description                       | Charts Displayed     | Notes                          |
|---------------------|-----------------------------------|----------------------|--------------------------------|
| dht_sopra_temp      | Temperature at ceiling level      | Temperature (line 1) | From DHT22/DHT11 sensor        |
| dht_sopra_humidity  | Humidity at ceiling level         | Humidity (line 1)    | From same DHT sensor           |
| dht_sotto_temp      | Temperature at ground level       | Temperature (line 2) | From DHT22/DHT11 sensor        |
| dht_sotto_humidity  | Humidity at ground level          | Humidity (line 2)    | From same DHT sensor           |
| soil_moisture_1     | Soil moisture sensor #1           | Soil Moisture 1      | Capacitive/resistive sensor    |
| soil_moisture_2     | Soil moisture sensor #2           | Soil Moisture 2      | Up to 5 supported per device   |
| soil_moisture_3     | Soil moisture sensor #3           | Soil Moisture 3      |                                |
| soil_moisture_4     | Soil moisture sensor #4           | Soil Moisture 4      |                                |
| soil_moisture_5     | Soil moisture sensor #5           | Soil Moisture 5      |                                |
| water_level         | Water reservoir level             | Water Level          | Ultrasonic/float sensor        |
| unconfigured        | Port not yet configured in webapp | (Hidden or alert)    | Temporary state, user notified |

**Chart Mapping Rules**:
- Temperature chart: Shows `dht_sopra_temp` (ceiling line) and `dht_sotto_temp` (ground line) if data exists
- Humidity chart: Shows `dht_sopra_humidity` (ceiling line) and `dht_sotto_humidity` (ground line) if data exists
- Soil Moisture charts: Each instance (1-5) gets separate chart if data exists
- Water Level chart: Single chart if data exists
- Charts appear only when at least one reading exists for relevant sensor type (FR-006, FR-007)

---

## Data Access Patterns

### P1: Fetch Active Sensor Configurations for Device

**Use Case**: Display current sensor configuration in device detail page

**Query**:
```sql
SELECT
  id,
  sensor_type,
  port_id,
  configured_at
FROM device_sensor_configs
WHERE device_id = :device_id
  AND is_active = TRUE
ORDER BY sensor_type;
```

**Performance**: O(log n) via `idx_device_sensor_configs_active`

---

### P2: Fetch Sensor Readings for Chart Rendering

**Use Case**: Render temperature chart with ceiling and ground lines

**Query**:
```sql
SELECT
  timestamp,
  sensor_type,
  value
FROM sensor_readings
WHERE device_id = :device_id
  AND sensor_type IN ('dht_sopra_temp', 'dht_sotto_temp')
  AND timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp ASC;
```

**Performance**: O(log n) via `idx_sensor_readings_device_type` + time range filter

**Chart Transformation** (frontend):
```typescript
// Group readings by timestamp, pivot sensor_type to columns
const chartData = readings.reduce((acc, reading) => {
  const key = reading.timestamp.toISOString();
  if (!acc[key]) acc[key] = { timestamp: key };
  acc[key][reading.sensor_type] = reading.value;
  return acc;
}, {} as Record<string, any>);

// Result: [{ timestamp: "...", dht_sopra_temp: 25.5, dht_sotto_temp: 22.1 }, ...]
```

---

### P3: Resolve Sensor Type at Write Time

**Use Case**: Device sends reading, API resolves sensor type before storage

**Query**:
```sql
SELECT sensor_type
FROM device_sensor_configs
WHERE device_id = :device_id
  AND port_id = :port_id
  AND is_active = TRUE
LIMIT 1;
```

**Performance**: O(1) via unique index on `(device_id, port_id, is_active)`

**Fallback**: If no result, use `sensor_type = 'unconfigured'`

---

### P4: Check for Duplicate Port Assignment

**Use Case**: Validate user input before creating new configuration

**Query**:
```sql
SELECT COUNT(*)
FROM device_sensor_configs
WHERE device_id = :device_id
  AND port_id = :port_id
  AND is_active = TRUE;
```

**Expected Result**: 0 (no active config) or 1 (existing config, should prevent or replace)

**Performance**: O(1) via unique index

---

### P5: Deactivate Configuration on Update

**Use Case**: User changes sensor type or port, old config must be deactivated

**Query**:
```sql
UPDATE device_sensor_configs
SET is_active = FALSE
WHERE id = :config_id;
```

**Note**: Typically followed by INSERT of new active configuration

---

### P6: Check Chart Visibility (Has Data?)

**Use Case**: Determine which charts to render on dashboard

**Query**:
```sql
SELECT DISTINCT sensor_type
FROM sensor_readings
WHERE device_id = :device_id
  AND timestamp >= NOW() - INTERVAL '24 hours';
```

**Frontend Logic**:
```typescript
const hasTemperatureData = sensorTypes.some(t =>
  t === 'dht_sopra_temp' || t === 'dht_sotto_temp'
);

if (hasTemperatureData) {
  return <TemperatureChart deviceId={deviceId} />;
}
```

**Performance**: O(log n) via `idx_sensor_readings_device_type`, typically <10 distinct types

---

## State Transitions

### Configuration Lifecycle

```
[No Config]
    │
    │ User: Configure Sensor
    ▼
[Active Config]
    │       sensor_type = "dht_sopra_temp"
    │       port_id = "GPIO4"
    │       is_active = TRUE
    │
    ├─► User: Change Port (GPIO4 → GPIO5)
    │   │
    │   ├─► UPDATE old: is_active = FALSE
    │   └─► INSERT new: port_id = "GPIO5", is_active = TRUE
    │
    ├─► User: Change Sensor Type (dht_sopra → dht_sotto)
    │   │
    │   ├─► UPDATE old: is_active = FALSE
    │   └─► INSERT new: sensor_type = "dht_sotto_temp", is_active = TRUE
    │
    └─► User: Remove Sensor
        │
        └─► UPDATE: is_active = FALSE
            (Soft delete, historical data preserved)
```

### Reading Association (Snapshot Approach)

```
Device sends reading from GPIO4
    ↓
Lookup active config: sensor_type = "dht_sopra_temp"
    ↓
INSERT reading with sensor_type = "dht_sopra_temp"
    ↓
[Reading stored with permanent sensor_type]
    │
    │ User changes GPIO4 to "dht_sotto_temp"
    │
    ▼
New readings get sensor_type = "dht_sotto_temp"
    │
    │ OLD readings still tagged "dht_sopra_temp"
    ▼
[Historical data integrity maintained]
```

---

## Migration Strategy

**Phase 1: Add New Schema**
```sql
-- Create device_sensor_configs table
-- Add sensor_type, port_id columns to sensor_readings (nullable)
-- Create indexes
-- Add RLS policies
```

**Phase 2: Backfill (Optional)**
```sql
-- For existing sensor_readings without sensor_type:
-- Attempt to infer from sensor_id or set to 'unconfigured'
-- This is optional as new readings will have sensor_type
```

**Phase 3: Application Changes**
- Update frontend to use new configuration UI
- Modify API/Edge Function to resolve sensor_type before writing readings
- Update chart components to filter by sensor_type instead of sensor_id

**Rollback Plan**:
- New columns are nullable, so schema changes are backward compatible
- Old code can continue using sensor_id
- New code can coexist by checking sensor_type first, falling back to sensor_id

---

## Validation Rules Summary

| Field             | Validation                                | Error Message                                                |
|-------------------|-------------------------------------------|--------------------------------------------------------------|
| sensor_type       | Must be in enumeration                    | "Invalid sensor type. Must be one of: dht_sopra_temp, ..."  |
| port_id           | Regex: `^[A-Za-z0-9_-]+$`, max 50 chars   | "Port ID must be alphanumeric with - or _ only (max 50)"    |
| device_id         | Must exist in devices table               | "Device not found"                                           |
| device_id + port  | Unique active config per device-port pair | "Port already configured for this device"                    |
| soil_moisture_N   | Max 5 per device                          | "Maximum 5 soil moisture sensors allowed per device"        |

---

## Performance Considerations

1. **Indexes**: All critical access patterns covered by indexes
2. **Denormalization**: `sensor_type` stored with readings trades storage for query performance (acceptable for time-series data)
3. **Time Range Queries**: Always filter readings by timestamp to limit scan size
4. **Chart Rendering**: Frontend transformation (pivot) done in memory, acceptable for 24-hour window (~1440 datapoints at 1-minute interval)
5. **RLS Overhead**: Device-based RLS already exists, extending to configs has minimal additional cost

---

**Data Model Complete**: Ready for contracts generation (Phase 1 continuation)
