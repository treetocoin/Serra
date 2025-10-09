# Data Model: Home Greenhouse Management System

**Date**: 2025-10-08
**Database**: PostgreSQL 15+ with TimescaleDB extension
**ORM**: SQLAlchemy 2.0+

## Overview

The system uses PostgreSQL for relational data (users, devices, authentication) and TimescaleDB hypertables for time-series data (sensor readings). This provides optimal query performance for both transactional and historical data.

---

## Entity Relationship Diagram

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────┴──────────┐
│   Device        │
└──────┬──────────┘
       │ 1
       ├─────────────────┬──────────────┐
       │ N               │ N            │ N
┌──────┴──────┐   ┌──────┴──────┐  ┌──┴──────────┐
│   Sensor    │   │  Actuator   │  │   DeviceLog │
└──────┬──────┘   └──────┬──────┘  └─────────────┘
       │ 1               │ 1
       │ N               │ N
┌──────┴──────────┐  ┌──┴──────────┐
│ SensorReading  │  │   Command    │
│ (TimescaleDB)  │  └──────────────┘
└─────────────────┘
```

---

## Entities

### 1. User

Represents a greenhouse owner with authentication credentials.

**Table**: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(255) | NULL | User's full name |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Account active status |
| email_verified | BOOLEAN | NOT NULL, DEFAULT FALSE | Email verification status |

**Indexes**:
- PRIMARY KEY on `id`
- UNIQUE INDEX on `email`
- INDEX on `created_at` for analytics

**Validation Rules**:
- Email must be valid format (RFC 5322)
- Password minimum 8 characters, must contain letters and numbers (enforced at application layer)
- Email case-insensitive (stored lowercase)

**Relationships**:
- One User has many Devices (one-to-many)
- One User has many Sessions (one-to-many, not detailed here)

---

### 2. Device (ESP32)

Represents a physical ESP32 microcontroller registered to a user.

**Table**: `devices`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique device identifier (system-generated) |
| user_id | UUID | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE | Owner of this device |
| name | VARCHAR(100) | NOT NULL | User-assigned device name |
| api_key_hash | VARCHAR(255) | UNIQUE, NOT NULL | Hashed API key for device authentication |
| api_key_prefix | VARCHAR(10) | NOT NULL | First 8 chars of API key (for display) |
| connection_status | VARCHAR(20) | NOT NULL, DEFAULT 'offline' | Current connection status |
| last_seen_at | TIMESTAMPTZ | NULL | Last communication timestamp |
| registered_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Device registration timestamp |
| firmware_version | VARCHAR(50) | NULL | ESP32 firmware version |
| metadata | JSONB | NULL | Flexible metadata (MAC address, IP, etc.) |

**Indexes**:
- PRIMARY KEY on `id`
- FOREIGN KEY INDEX on `user_id`
- UNIQUE INDEX on `api_key_hash`
- INDEX on `connection_status` for filtering online devices
- INDEX on `last_seen_at` for stale device detection

**Validation Rules**:
- API key generated as 32-byte random hex string (64 characters)
- API key stored as bcrypt hash, prefix stored for user display
- `connection_status` enum: 'online', 'offline', 'error'
- `name` length: 1-100 characters
- Device considered offline if `last_seen_at` > 5 minutes ago

**Relationships**:
- Many Devices belong to one User (many-to-one)
- One Device has many Sensors (one-to-many)
- One Device has many Actuators (one-to-many)
- One Device has many DeviceLogs (one-to-many)

**State Transitions**:
```
[registered] → discovery broadcast → [pending_approval] → user approval → [active]
[active] ←→ [online/offline] (based on last_seen_at)
[active] → user delete → [deleted] (CASCADE deletes sensors, actuators, readings)
```

---

### 3. Sensor

Represents a data collection point auto-discovered from ESP32 firmware.

**Table**: `sensors`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique sensor identifier |
| device_id | UUID | NOT NULL, FOREIGN KEY → devices(id) ON DELETE CASCADE | Associated device |
| sensor_id | VARCHAR(50) | NOT NULL | ESP32-reported sensor identifier (e.g., "temp_1") |
| sensor_type | VARCHAR(50) | NOT NULL | Sensor type (temperature, humidity, soil_moisture, light) |
| unit | VARCHAR(20) | NOT NULL | Measurement unit (C, F, %, lux, etc.) |
| name | VARCHAR(100) | NULL | User-assigned friendly name |
| min_value | DECIMAL(10,2) | NULL | Minimum valid value for validation |
| max_value | DECIMAL(10,2) | NULL | Maximum valid value for validation |
| discovered_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-discovery timestamp |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Sensor active status |
| metadata | JSONB | NULL | Flexible metadata (calibration, location, etc.) |

**Indexes**:
- PRIMARY KEY on `id`
- FOREIGN KEY INDEX on `device_id`
- UNIQUE INDEX on `(device_id, sensor_id)` to prevent duplicate sensors per device
- INDEX on `sensor_type` for filtering by type

**Validation Rules**:
- `sensor_id` format: alphanumeric + underscore, 1-50 characters
- `sensor_type` enum: 'temperature', 'humidity', 'soil_moisture', 'light_level', 'ph', 'ec', 'co2', 'custom'
- `unit` common values: 'C', 'F', '%', 'lux', 'ppm', 'pH', 'mS/cm'
- Value range validation: incoming readings must be between `min_value` and `max_value` if set

**Relationships**:
- Many Sensors belong to one Device (many-to-one)
- One Sensor has many SensorReadings (one-to-many)

---

### 4. Actuator

Represents a controllable device auto-discovered from ESP32 firmware.

**Table**: `actuators`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique actuator identifier |
| device_id | UUID | NOT NULL, FOREIGN KEY → devices(id) ON DELETE CASCADE | Associated device |
| actuator_id | VARCHAR(50) | NOT NULL | ESP32-reported actuator identifier (e.g., "pump_1") |
| actuator_type | VARCHAR(50) | NOT NULL | Actuator type (pump, fan, light, valve, heater) |
| name | VARCHAR(100) | NULL | User-assigned friendly name |
| current_state | VARCHAR(20) | NOT NULL, DEFAULT 'off' | Current actuator state |
| supports_pwm | BOOLEAN | NOT NULL, DEFAULT FALSE | Supports PWM control (0-100%) |
| discovered_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Auto-discovery timestamp |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Actuator active status |
| metadata | JSONB | NULL | Flexible metadata (GPIO pin, power rating, etc.) |

**Indexes**:
- PRIMARY KEY on `id`
- FOREIGN KEY INDEX on `device_id`
- UNIQUE INDEX on `(device_id, actuator_id)` to prevent duplicate actuators per device
- INDEX on `actuator_type` for filtering by type

**Validation Rules**:
- `actuator_id` format: alphanumeric + underscore, 1-50 characters
- `actuator_type` enum: 'pump', 'fan', 'light', 'valve', 'heater', 'cooler', 'custom'
- `current_state` for binary: 'on', 'off', 'error'
- `current_state` for PWM: 'on:{value}' where value is 0-100 (e.g., 'on:75' for 75% power)

**Relationships**:
- Many Actuators belong to one Device (many-to-one)
- One Actuator has many Commands (one-to-many)

**State Transitions**:
```
[discovered] → [off] → user command → [pending] → ESP32 confirmation → [on]
[on] → user command → [pending] → ESP32 confirmation → [off]
[any] → error → [error] → user retry → [off]
```

---

### 5. SensorReading (TimescaleDB Hypertable)

Represents a time-series data point from a sensor.

**Table**: `sensor_readings` (TimescaleDB hypertable)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| time | TIMESTAMPTZ | NOT NULL | Reading timestamp (partitioning key) |
| sensor_id | UUID | NOT NULL, FOREIGN KEY → sensors(id) ON DELETE CASCADE | Sensor that produced reading |
| device_id | UUID | NOT NULL, FOREIGN KEY → devices(id) ON DELETE CASCADE | Device (for efficient queries) |
| value | DOUBLE PRECISION | NOT NULL | Measured value |
| is_valid | BOOLEAN | NOT NULL, DEFAULT TRUE | Validation status |
| validation_error | VARCHAR(255) | NULL | Validation error message if invalid |

**Indexes**:
- PRIMARY KEY on `(sensor_id, time)` - TimescaleDB automatically creates this
- INDEX on `device_id, time DESC` for device-level queries
- INDEX on `time DESC` for global recent readings

**TimescaleDB Configuration**:
```sql
SELECT create_hypertable('sensor_readings', 'time',
  chunk_time_interval => INTERVAL '1 day'
);

-- Compression (compress chunks older than 7 days)
ALTER TABLE sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'sensor_id'
);

SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- Retention policy (optional - user-controlled deletion instead)
-- SELECT add_retention_policy('sensor_readings', INTERVAL '2 years');
```

**Validation Rules**:
- `time` must not be in the future
- `time` must not be more than 24 hours in the past (to catch clock drift)
- `value` must be between sensor's `min_value` and `max_value` if configured
- Invalid readings stored with `is_valid = FALSE` for debugging

**Relationships**:
- Many SensorReadings belong to one Sensor (many-to-one)
- Many SensorReadings belong to one Device (many-to-one, denormalized for performance)

**Query Optimization**:
- Continuous aggregations for common queries:
  - Hourly averages: `sensor_readings_hourly`
  - Daily averages: `sensor_readings_daily`
- Example hourly aggregation:
```sql
CREATE MATERIALIZED VIEW sensor_readings_hourly
WITH (timescaledb.continuous) AS
SELECT sensor_id, device_id,
  time_bucket('1 hour', time) AS bucket,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS reading_count
FROM sensor_readings
WHERE is_valid = TRUE
GROUP BY sensor_id, device_id, bucket;

SELECT add_continuous_aggregate_policy('sensor_readings_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

---

### 6. Command

Represents an actuator control command queued for ESP32 retrieval.

**Table**: `commands`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique command identifier |
| actuator_id | UUID | NOT NULL, FOREIGN KEY → actuators(id) ON DELETE CASCADE | Target actuator |
| device_id | UUID | NOT NULL, FOREIGN KEY → devices(id) ON DELETE CASCADE | Target device (denormalized) |
| user_id | UUID | NOT NULL, FOREIGN KEY → users(id) ON DELETE CASCADE | User who issued command |
| command_type | VARCHAR(20) | NOT NULL | Command type (on, off, set_value) |
| value | INTEGER | NULL | Value for PWM control (0-100) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | Command execution status |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Command creation timestamp |
| retrieved_at | TIMESTAMPTZ | NULL | When ESP32 retrieved command |
| confirmed_at | TIMESTAMPTZ | NULL | When ESP32 confirmed execution |
| error_message | VARCHAR(255) | NULL | Error message if execution failed |
| expires_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() + INTERVAL '5 minutes' | Command expiration |

**Indexes**:
- PRIMARY KEY on `id`
- FOREIGN KEY INDEX on `actuator_id`
- FOREIGN KEY INDEX on `device_id`
- INDEX on `(device_id, status, created_at)` for ESP32 polling queries
- INDEX on `expires_at` for cleanup jobs

**Validation Rules**:
- `command_type` enum: 'on', 'off', 'set_value'
- `value` required if `command_type = 'set_value'`, must be 0-100
- `status` enum: 'pending', 'retrieved', 'confirmed', 'failed', 'expired'
- Commands expire after 5 minutes if not retrieved

**Relationships**:
- Many Commands belong to one Actuator (many-to-one)
- Many Commands belong to one Device (many-to-one, denormalized for efficient polling)
- Many Commands issued by one User (many-to-one)

**State Transitions**:
```
[pending] → ESP32 polls → [retrieved] → ESP32 confirms → [confirmed]
[pending] → timeout → [expired]
[retrieved] → ESP32 reports error → [failed]
```

**Query Optimization**:
- Cleanup job: Delete commands with `status IN ('confirmed', 'expired', 'failed') AND confirmed_at < NOW() - INTERVAL '7 days'`
- ESP32 polling query:
```sql
SELECT * FROM commands
WHERE device_id = $1
  AND status = 'pending'
  AND expires_at > NOW()
ORDER BY created_at ASC
LIMIT 10;
```

---

### 7. DeviceLog (Optional - for debugging)

Represents connection and error logs for devices.

**Table**: `device_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique log identifier |
| device_id | UUID | NOT NULL, FOREIGN KEY → devices(id) ON DELETE CASCADE | Associated device |
| log_level | VARCHAR(20) | NOT NULL | Log level (info, warning, error) |
| message | TEXT | NOT NULL | Log message |
| timestamp | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Log timestamp |
| metadata | JSONB | NULL | Additional context (error codes, stack traces) |

**Indexes**:
- PRIMARY KEY on `id`
- INDEX on `(device_id, timestamp DESC)` for device log history
- INDEX on `timestamp` for retention policy

**Validation Rules**:
- `log_level` enum: 'info', 'warning', 'error'
- Retention: Keep logs for 30 days, then delete

**Relationships**:
- Many DeviceLogs belong to one Device (many-to-one)

---

## Data Retention & Archival

### Sensor Readings
- **Retention**: Indefinite (user-controlled)
- **Compression**: Automatic compression after 7 days (90%+ storage reduction)
- **User Deletion**: Users can delete readings by date range or device via API
- **Continuous Aggregations**: Hourly and daily aggregations pre-computed for fast queries

### Commands
- **Retention**: 7 days after confirmation/expiration/failure
- **Cleanup**: Nightly job deletes old commands

### Device Logs
- **Retention**: 30 days
- **Cleanup**: Nightly job deletes logs older than 30 days

---

## Security Considerations

### Password Security
- Passwords hashed with bcrypt (cost factor 12)
- Never store plain text passwords
- Password reset tokens stored separately with expiration

### API Key Security
- API keys generated with cryptographically secure random (32 bytes hex = 64 chars)
- API keys hashed with bcrypt before storage
- API key prefix (first 8 chars) stored for user display ("abcd1234...")
- API keys transmitted only once during device registration

### Data Access Control
- Users can only access their own devices, sensors, actuators, and readings
- API endpoints enforce user_id filtering on all queries
- Foreign key constraints ensure referential integrity
- CASCADE deletes prevent orphaned records

---

## Database Initialization

### Extensions
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### Migrations
Use Alembic (SQLAlchemy migrations) for schema versioning:
```bash
alembic init migrations
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

---

## Example Queries

### Get Current Sensor Readings for User's Dashboard
```sql
SELECT
  d.id AS device_id,
  d.name AS device_name,
  s.id AS sensor_id,
  s.name AS sensor_name,
  s.sensor_type,
  sr.value,
  s.unit,
  sr.time AS reading_time
FROM devices d
JOIN sensors s ON s.device_id = d.id
JOIN LATERAL (
  SELECT value, time
  FROM sensor_readings
  WHERE sensor_id = s.id
  ORDER BY time DESC
  LIMIT 1
) sr ON TRUE
WHERE d.user_id = $1
  AND d.connection_status = 'online'
  AND s.is_active = TRUE
ORDER BY d.name, s.sensor_type;
```

### Get Historical Data for Chart (1 week, hourly averages)
```sql
SELECT
  bucket AS time,
  avg_value AS value
FROM sensor_readings_hourly
WHERE sensor_id = $1
  AND bucket >= NOW() - INTERVAL '7 days'
ORDER BY bucket ASC;
```

### ESP32 Poll for Pending Commands
```sql
SELECT id, actuator_id, command_type, value
FROM commands
WHERE device_id = $1
  AND status = 'pending'
  AND expires_at > NOW()
ORDER BY created_at ASC
LIMIT 10;
```

---

## SQLAlchemy Models Reference

Models will be defined in `backend/src/models/` using SQLAlchemy 2.0 declarative style with type hints:

```python
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, ForeignKey, func
from uuid import UUID
import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=func.uuid_generate_v4())
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime.datetime] = mapped_column(server_default=func.now())
    # ... relationships defined with relationship()
```

Full models implementation in Phase 2 (`/speckit.tasks`).

---

## Summary

This data model provides:
- ✅ Efficient time-series storage with TimescaleDB
- ✅ Referential integrity via foreign keys
- ✅ Flexible metadata with JSONB columns
- ✅ Query optimization with strategic indexes
- ✅ Security with hashed credentials
- ✅ Scalability to 100K+ sensor streams
- ✅ Indefinite data retention with compression

Next steps: Generate API contracts in `/contracts/`.
