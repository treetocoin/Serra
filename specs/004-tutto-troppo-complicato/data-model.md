# Data Model: Simplified Device Onboarding with Project-Scoped Device IDs

**Feature**: 004-tutto-troppo-complicato
**Date**: 2025-11-12
**Status**: Design Complete

## Overview

This document defines the complete data model for the project-scoped device ID system, including all entities, relationships, constraints, and state transitions.

---

## Entity Definitions

### 1. Project

**Purpose**: Represents a greenhouse or location grouping that contains up to 20 devices.

**Attributes**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal unique identifier |
| `project_id` | TEXT | NOT NULL, UNIQUE | Auto-generated human-readable ID (PROJ1, PROJ2, ..., P9999) |
| `name` | TEXT | NOT NULL, UNIQUE | User-provided project name (globally unique) |
| `description` | TEXT | NULLABLE | Optional project description |
| `user_id` | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the project |
| `status` | TEXT | NOT NULL, DEFAULT 'active', CHECK IN ('active', 'archived') | Project status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Project creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
```sql
CREATE UNIQUE INDEX idx_projects_project_id ON projects(project_id);
CREATE UNIQUE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

**RLS Policies**:
```sql
-- Users can view their own projects
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create projects for themselves
CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);
```

**Validation Rules**:
- `project_id` format: Must match `^PROJ\d{1,3}$|^P\d{4}$` (PROJ1-PROJ999 or P1000-P9999)
- `name`: Must be 1-100 characters, globally unique across all users
- `project_id`: Auto-generated via `generate_project_id()` RPC function, globally unique
- `status`: Only 'active' or 'archived' allowed

**Relationships**:
- **One-to-Many** with `devices` (a project can have 0-20 devices)
- **Many-to-One** with `auth.users` (a user can have multiple projects)

---

### 2. Device (Modified)

**Purpose**: Represents an ESP8266 device registered in the system, now scoped to a project.

**Attributes**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal unique identifier (legacy) |
| `composite_device_id` | TEXT | NOT NULL, UNIQUE | Combined project + device ID (e.g., "PROJ1-ESP5") |
| `project_id` | TEXT | NOT NULL, REFERENCES projects(project_id) ON DELETE CASCADE | Parent project ID |
| `device_number` | INTEGER | NOT NULL, CHECK (device_number >= 1 AND device_number <= 20) | Device number within project (1-20) |
| `name` | TEXT | NOT NULL | User-friendly device name |
| `device_key` | TEXT | NOT NULL | Authentication key (unchanged from v2) |
| `device_key_hash` | TEXT | NOT NULL | SHA-256 hash of device_key for verification |
| `user_id` | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the device |
| `status` | TEXT | NOT NULL, DEFAULT 'waiting', CHECK IN ('waiting', 'online', 'offline') | Device connection status |
| `last_seen_at` | TIMESTAMPTZ | NULLABLE | Timestamp of last heartbeat received |
| `rssi` | INTEGER | NULLABLE | WiFi signal strength (RSSI) from last heartbeat |
| `ip_address` | TEXT | NULLABLE | Device IP address from last heartbeat |
| `fw_version` | TEXT | NULLABLE | Firmware version from last heartbeat |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Device registration timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
```sql
CREATE UNIQUE INDEX idx_devices_composite_id ON devices(composite_device_id);
CREATE UNIQUE INDEX idx_devices_project_device_number ON devices(project_id, device_number);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_status_last_seen ON devices(status, last_seen_at DESC) WHERE status = 'online';
CREATE INDEX idx_devices_project_id ON devices(project_id);
```

**RLS Policies**:
```sql
-- Users can view their own devices
CREATE POLICY "Users can view their own devices"
  ON devices FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create devices for themselves
CREATE POLICY "Users can create devices"
  ON devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own devices
CREATE POLICY "Users can update their own devices"
  ON devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own devices
CREATE POLICY "Users can delete their own devices"
  ON devices FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can update device status (for Edge Functions)
CREATE POLICY "Service role can update device status"
  ON devices FOR UPDATE
  USING (auth.role() = 'service_role');
```

**Validation Rules**:
- `composite_device_id` format: Must match `^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$` (e.g., "PROJ1-ESP5", "P9999-ESP20")
- `device_number`: Must be 1-20 inclusive
- `project_id` + `device_number`: Must be unique together (enforced by composite unique index)
- `project_id`: Must exist in `projects` table (foreign key constraint)
- `status`: Only 'waiting', 'online', or 'offline' allowed
- `name`: Must be 1-100 characters

**Relationships**:
- **Many-to-One** with `projects` (each device belongs to exactly one project)
- **Many-to-One** with `auth.users` (each device belongs to exactly one user)
- **One-to-Many** with `device_heartbeats` (a device can have multiple heartbeat records)
- **One-to-Many** with `sensors` (a device can have multiple sensors)
- **One-to-Many** with `actuators` (a device can have multiple actuators)

---

### 3. Device Heartbeat (Existing, Modified)

**Purpose**: Stores telemetry from periodic heartbeat messages sent by ESP devices.

**Attributes**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | Auto-incrementing heartbeat ID |
| `device_id` | UUID | NOT NULL, REFERENCES devices(id) ON DELETE CASCADE | Device that sent the heartbeat (legacy UUID) |
| `composite_device_id` | TEXT | NOT NULL | Composite ID for denormalized lookup |
| `rssi` | INTEGER | NULLABLE | WiFi signal strength |
| `ip_address` | TEXT | NULLABLE | Device IP address |
| `fw_version` | TEXT | NULLABLE | Firmware version |
| `ts` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Heartbeat timestamp |

**Indexes**:
```sql
CREATE INDEX idx_device_heartbeats_device_id ON device_heartbeats(device_id, ts DESC);
CREATE INDEX idx_device_heartbeats_composite_id ON device_heartbeats(composite_device_id, ts DESC);
CREATE INDEX idx_device_heartbeats_ts ON device_heartbeats(ts DESC);
```

**RLS Policies**:
```sql
-- Users can view heartbeats for their own devices
CREATE POLICY "Users can view their device heartbeats"
  ON device_heartbeats FOR SELECT
  USING (
    device_id IN (
      SELECT id FROM devices WHERE user_id = auth.uid()
    )
  );

-- Service role can insert heartbeats (for Edge Functions)
CREATE POLICY "Service role can insert heartbeats"
  ON device_heartbeats FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

**Validation Rules**:
- `device_id`: Must exist in `devices` table
- `composite_device_id`: Must match device's composite_device_id
- `ts`: Cannot be in the future (server time is authoritative)

**Relationships**:
- **Many-to-One** with `devices` (each heartbeat belongs to exactly one device)

---

### 4. Device Configuration (ESP EEPROM)

**Purpose**: Configuration stored on ESP8266 device in persistent EEPROM storage.

**Structure** (C struct):
```cpp
struct DeviceConfig {
  char composite_device_id[15];  // "PROJ1-ESP5" + null terminator (max 14 chars)
  char wifi_ssid[33];            // WiFi SSID (32 chars + null)
  char wifi_password[64];        // WiFi password (63 chars + null)
  char device_key[65];           // Device authentication key (64 chars + null)
  uint32_t crc32;                // CRC32 checksum for validation
};
// Total: 15 + 33 + 64 + 65 + 4 = 181 bytes
```

**Attributes**:

| Field | Type | Max Length | Description |
|-------|------|------------|-------------|
| `composite_device_id` | char[] | 14 chars | Combined project + device ID (e.g., "PROJ1-ESP5") |
| `wifi_ssid` | char[] | 32 chars | WiFi network SSID |
| `wifi_password` | char[] | 63 chars | WiFi network password |
| `device_key` | char[] | 64 chars | Device authentication key |
| `crc32` | uint32_t | 4 bytes | CRC32 checksum for data integrity |

**Validation Rules**:
- `composite_device_id`: Must match format `^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$`
- `wifi_ssid`: Must be 1-32 characters
- `wifi_password`: Must be 0-63 characters (empty allowed for open networks)
- `device_key`: Must be exactly 64 hexadecimal characters
- `crc32`: Must match calculated CRC32 of all fields (protects against power loss corruption)

**Storage**:
- EEPROM address: 0x000-0x0B5 (181 bytes)
- Written only when configuration changes (wear leveling)
- Read on boot to retrieve stored configuration

**State Machine**:
```
[No Config] → Factory Reset
    ↓
[Create AP: "Serra-Setup"]
    ↓
[User Configures Portal] → Submit
    ↓
[Save to EEPROM]
    ↓
[Restart]
    ↓
[Read EEPROM]
    ↓
[Connect to WiFi]
    ↓
[Send Heartbeat with composite_device_id]
```

---

## Supporting Entities

### 5. Projects Sequence

**Purpose**: Generates sequential project IDs globally across all users.

```sql
CREATE SEQUENCE projects_seq
  START 1
  INCREMENT 1
  CACHE 50
  NO CYCLE;
```

**Attributes**:
- `START`: 1 (first project will be PROJ1)
- `INCREMENT`: 1 (sequential numbering)
- `CACHE`: 50 (pre-allocate 50 values for performance)
- `OWNED BY`: None (independent lifecycle from projects table)

**Usage**:
- Called by `generate_project_id()` RPC function
- Automatically manages concurrent access
- Never resets (even when projects are deleted)

---

### 6. Device Migration Log (Audit Table)

**Purpose**: Tracks migration of devices from UUID-only system to composite ID system (Phase 3).

**Attributes**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | Migration log entry ID |
| `device_uuid` | UUID | NOT NULL | Original device UUID |
| `old_api_key` | TEXT | NULLABLE | Original API key (if exists) |
| `new_composite_id` | TEXT | NOT NULL | Generated composite device ID |
| `new_project_id` | TEXT | NOT NULL | Assigned project ID |
| `new_device_number` | INTEGER | NOT NULL | Assigned device number |
| `migration_phase` | TEXT | NOT NULL | Phase name ('phase_3_batch') |
| `migrated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Migration timestamp |
| `migrated_by` | TEXT | NOT NULL | Migration script identifier |

**Indexes**:
```sql
CREATE INDEX idx_device_migration_log_device_uuid ON device_migration_log(device_uuid);
CREATE INDEX idx_device_migration_log_composite_id ON device_migration_log(new_composite_id);
CREATE INDEX idx_device_migration_log_migrated_at ON device_migration_log(migrated_at DESC);
```

**Usage**:
- Populated during Phase 3 migration
- Provides audit trail for troubleshooting
- Enables rollback analysis
- Can be archived or deleted after successful migration stabilizes

---

## Entity Relationships Diagram

```
┌─────────────┐
│ auth.users  │
│ (Supabase)  │
└──────┬──────┘
       │
       │ 1:N
       │
       ▼
┌─────────────────────────────────────────┐
│ projects                                 │
│ ──────────────────────────────────────  │
│ • id (PK, UUID)                          │
│ • project_id (UNIQUE, TEXT) ← PROJ1     │
│ • name (UNIQUE, TEXT)                    │
│ • user_id (FK → auth.users)             │
│ • status ('active' | 'archived')        │
└──────┬──────────────────────────────────┘
       │
       │ 1:N (max 20)
       │
       ▼
┌──────────────────────────────────────────────┐
│ devices                                       │
│ ───────────────────────────────────────────  │
│ • id (PK, UUID, legacy)                       │
│ • composite_device_id (UNIQUE, TEXT)          │
│   ↳ Format: "PROJ1-ESP5"                      │
│ • project_id (FK → projects.project_id)       │
│ • device_number (1-20)                        │
│ • user_id (FK → auth.users)                   │
│ • status ('waiting'|'online'|'offline')       │
│ • last_seen_at (TIMESTAMPTZ)                  │
│ • device_key, device_key_hash                 │
└──────┬───────────────────────────────────────┘
       │
       │ 1:N
       │
       ▼
┌──────────────────────────────────────────────┐
│ device_heartbeats                             │
│ ───────────────────────────────────────────  │
│ • id (PK, BIGSERIAL)                          │
│ • device_id (FK → devices.id)                 │
│ • composite_device_id (denormalized)          │
│ • rssi, ip_address, fw_version                │
│ • ts (TIMESTAMPTZ)                            │
└───────────────────────────────────────────────┘

Additional Relationships (Existing System):

devices 1:N sensors
devices 1:N actuators
devices 1:N sensor_readings (via sensors)
devices 1:N commands (via actuators)
```

---

## State Transitions

### Project Lifecycle

```
[User Creates Project]
    ↓
[status = 'active', project_id = generated]
    ↓
    ├─→ [User Archives Project]
    │       ↓
    │   [status = 'archived']
    │       ↓
    │       └─→ [User Unarchives] → [status = 'active']
    │
    └─→ [User Deletes Project]
            ↓
        [CASCADE DELETE all devices]
            ↓
        [Project Removed]
```

**State Rules**:
- `active`: Default state, project is in use
- `archived`: Project is hidden from active lists but data retained
- Deleted: Cascades to all associated devices, sensors, actuators

---

### Device Lifecycle

```
[User Registers Device in Webapp]
    ↓
[status = 'waiting', composite_device_id = assigned]
    ↓
    ├─→ [User Configures ESP via WiFi Portal]
    │       ↓
    │   [ESP Saves composite_device_id to EEPROM]
    │       ↓
    │   [ESP Connects to WiFi]
    │       ↓
    │   [ESP Sends First Heartbeat]
    │       ↓
    │   [status = 'online', last_seen_at = NOW()]
    │       ↓
    │       ├─→ [Heartbeats Continue (every 60s)]
    │       │       ↓
    │       │   [status = 'online' maintained]
    │       │
    │       └─→ [Heartbeats Stop >2 minutes]
    │               ↓
    │           [status = 'offline']
    │               ↓
    │               └─→ [Heartbeat Resumes]
    │                       ↓
    │                   [status = 'online' (automatic recovery)]
    │
    └─→ [User Deletes Device]
            ↓
        [Device Removed, ESP sends heartbeats that are rejected]
```

**State Rules**:
- `waiting`: Device registered in webapp but ESP not configured yet
- `online`: Device has sent heartbeat within last 2 minutes
- `offline`: Device has not sent heartbeat for >2 minutes
- Automatic transitions:
  - `waiting` → `online`: First heartbeat received
  - `online` → `offline`: 2 minutes without heartbeat (enforced by scheduled job)
  - `offline` → `online`: Heartbeat received (automatic recovery)

---

### Heartbeat Processing Flow

```
[ESP Sends Heartbeat]
    ↓
[Edge Function: device-heartbeat receives request]
    ↓
[Validate composite_device_id format]
    ↓
[Verify device_key matches device_key_hash]
    ↓
[INSERT into device_heartbeats]
    ↓
[UPDATE devices SET status='online', last_seen_at=NOW()]
    ↓
[Return 200 OK]

Parallel Process (Every 1 minute):
[External Cron triggers detect-offline-devices Edge Function]
    ↓
[Find devices WHERE status='online' AND last_seen_at < NOW() - 2 minutes]
    ↓
[UPDATE devices SET status='offline' WHERE id IN (...)]
    ↓
[Log status changes]
```

---

## Data Integrity Constraints

### Database-Level Constraints

**Primary Keys**:
- All tables have UUID or BIGSERIAL primary keys for internal referencing

**Unique Constraints**:
```sql
-- Global uniqueness (across all users)
UNIQUE (projects.project_id)
UNIQUE (projects.name)
UNIQUE (devices.composite_device_id)

-- Project-scoped uniqueness (per project)
UNIQUE (devices.project_id, devices.device_number)
```

**Foreign Keys**:
```sql
projects.user_id → auth.users(id) ON DELETE CASCADE
devices.project_id → projects(project_id) ON DELETE CASCADE
devices.user_id → auth.users(id) ON DELETE CASCADE
device_heartbeats.device_id → devices(id) ON DELETE CASCADE
```

**Check Constraints**:
```sql
CHECK (projects.status IN ('active', 'archived'))
CHECK (devices.status IN ('waiting', 'online', 'offline'))
CHECK (devices.device_number >= 1 AND devices.device_number <= 20)
```

### Application-Level Validation

**Project Creation**:
1. Validate `name` is 1-100 characters
2. Call `generate_project_id()` to get unique project_id
3. Verify `user_id` matches authenticated user
4. INSERT with global UNIQUE constraint check

**Device Registration**:
1. Verify project exists and belongs to user
2. Validate device_number is 1-20
3. Check device_number not already used in project (unique constraint)
4. Generate composite_device_id: `project_id + "-ESP" + device_number`
5. Generate device_key (64 hex chars) and device_key_hash (SHA-256)
6. INSERT with unique constraint check

**Heartbeat Processing**:
1. Validate composite_device_id format matches `^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$`
2. Look up device by composite_device_id
3. Verify device_key matches stored device_key_hash
4. INSERT heartbeat record
5. UPDATE device status to 'online' and last_seen_at

---

## Performance Considerations

### Expected Data Volumes

**Assumptions** (per user):
- 1-5 projects per user
- 5-20 devices per project
- 1 heartbeat per device per 60 seconds
- Retention: 30 days of heartbeats

**Estimates** (1,000 active users):
- Projects: 1,000-5,000 rows (~500KB)
- Devices: 5,000-100,000 rows (~50MB)
- Heartbeats: 72M-432M rows per month (~10-60GB)

### Index Strategy

**Read-Heavy Queries** (optimize for SELECT):
```sql
-- Most common queries:
SELECT * FROM devices WHERE user_id = ? AND status = 'online'
SELECT * FROM devices WHERE project_id = ?
SELECT * FROM device_heartbeats WHERE device_id = ? ORDER BY ts DESC LIMIT 100

-- Corresponding indexes:
CREATE INDEX idx_devices_user_status ON devices(user_id, status)
CREATE INDEX idx_devices_project_id ON devices(project_id)
CREATE INDEX idx_device_heartbeats_device_ts ON device_heartbeats(device_id, ts DESC)
```

**Write-Heavy Operations** (minimize index overhead):
- Heartbeat INSERTs: Only 2 indexes (device_id, composite_device_id, ts)
- Device UPDATEs: Indexed on primary key (fast)

### Partitioning Strategy (Optional, Future)

For very large heartbeat tables:
```sql
-- Partition by month for easy archival
CREATE TABLE device_heartbeats (
  id BIGSERIAL,
  device_id UUID NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  ...
) PARTITION BY RANGE (ts);

CREATE TABLE device_heartbeats_2025_01 PARTITION OF device_heartbeats
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Auto-drop old partitions after 30 days
DROP TABLE device_heartbeats_2024_12;
```

---

## Migration Data Model

### Phase 1-2: Dual Schema

**During Phases 1-2**, both old and new schemas coexist:

```sql
-- Devices table supports both systems
devices {
  -- Legacy (Phase 0-2)
  id UUID PRIMARY KEY
  api_key TEXT
  api_key_hash TEXT

  -- New (Phase 1+, nullable until Phase 3)
  composite_device_id TEXT NULLABLE
  project_id TEXT NULLABLE
  device_number INTEGER NULLABLE

  -- Shared
  user_id UUID NOT NULL
  status TEXT NOT NULL
  last_seen_at TIMESTAMPTZ
}
```

### Phase 3: Migration Transform

**Transformation Rules**:
```sql
-- For each existing device without project_id:
1. Assign to default project 'PROJ0' (created once per user)
2. Generate device_number sequentially (ROW_NUMBER() within user's devices)
3. Construct composite_device_id = 'PROJ0-ESP' || device_number
4. Preserve device_key and device_key_hash (unchanged)
5. Keep status and last_seen_at (unchanged)
```

**Example**:
```
Before (Legacy):
id: 550e8400-e29b-41d4-a716-446655440000
api_key: abc123...
status: online

After (Phase 3):
id: 550e8400-e29b-41d4-a716-446655440000
composite_device_id: PROJ0-ESP1
project_id: PROJ0
device_number: 1
status: online
```

### Phase 4: Cleanup

**Remove deprecated columns**:
```sql
ALTER TABLE devices
DROP COLUMN api_key,
DROP COLUMN api_key_hash,
DROP COLUMN id;  -- (optional, can keep for legacy references)
```

---

## Summary

This data model provides:

1. **Clear entity boundaries**: Projects own devices, devices send heartbeats
2. **Strong consistency**: Database constraints enforce uniqueness and referential integrity
3. **Scalability**: Indexed for common queries, partition-ready for heartbeat growth
4. **Migration-friendly**: Nullable columns in Phase 1-2, required in Phase 3+
5. **Audit trail**: Migration log tracks all transformations
6. **State machines**: Well-defined transitions for project and device lifecycles
7. **Performance**: Optimized indexes for read-heavy operations, minimal write overhead

Next step: Generate API contracts defining how frontend and firmware interact with this data model.
