# RPC Functions Contract

**Feature**: 004-tutto-troppo-complicato
**Date**: 2025-11-12
**Version**: 1.0.0

## Overview

This document defines the Supabase RPC (Remote Procedure Call) functions that implement server-side business logic for project and device management.

---

## 1. generate_project_id()

**Purpose**: Generates the next sequential project ID in the global sequence.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION generate_project_id()
RETURNS TEXT
```

**Parameters**: None

**Returns**:
- Type: `TEXT`
- Format: `PROJ1` to `PROJ999`, then `P1000` to `P9999`

**Behavior**:
1. Calls `nextval('projects_seq')` to get next sequence number
2. Formats number according to rules:
   - 1-999: `'PROJ' || number` → "PROJ1", "PROJ2", ..., "PROJ999"
   - 1000-9999: `'P' || number` → "P1000", "P1001", ..., "P9999"
3. Raises exception if sequence exceeds 9999

**Error Conditions**:
- Sequence overflow (>9999): Raises exception `'Project ID sequence overflow at %'`

**Example Usage**:
```sql
SELECT generate_project_id();
-- Returns: 'PROJ1' (if sequence is at 1)

SELECT generate_project_id();
-- Returns: 'PROJ2' (if sequence is at 2)
```

**Security**: `SECURITY DEFINER` - executes with owner permissions

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION generate_project_id() TO authenticated;
```

---

## 2. create_project()

**Purpose**: Creates a new project with auto-generated project ID.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION create_project(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(project_id TEXT, id UUID, created_at TIMESTAMPTZ)
```

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_name` | TEXT | Yes | - | Project name (globally unique) |
| `p_description` | TEXT | No | NULL | Optional project description |
| `p_user_id` | UUID | No | auth.uid() | Owner user ID |

**Returns**:
- Type: `TABLE`
- Columns:
  - `project_id` (TEXT): Generated project ID (e.g., "PROJ1")
  - `id` (UUID): Internal project UUID
  - `created_at` (TIMESTAMPTZ): Creation timestamp

**Behavior**:
1. Validates `p_user_id` is not NULL
2. Calls `generate_project_id()` to get next project ID
3. Generates new UUID for internal `id`
4. INSERTs into `projects` table
5. Returns project details

**Error Conditions**:
- `p_user_id` is NULL: Raises exception `'User ID required'`
- `p_name` already exists: Raises exception `'Project name "%" already exists'` (unique_violation)
- Project ID sequence overflow: Propagates exception from `generate_project_id()`

**Example Usage**:
```typescript
const { data, error } = await supabase.rpc('create_project', {
  p_name: 'My Greenhouse',
  p_description: 'Main production greenhouse'
});

// Success:
// data = [{ project_id: 'PROJ1', id: '...uuid...', created_at: '2025-...' }]

// Error (duplicate name):
// error = { message: 'Project name "My Greenhouse" already exists', code: '...' }
```

**Security**: `SECURITY DEFINER` - executes with owner permissions to access sequence

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION create_project(TEXT, TEXT, UUID) TO authenticated;
```

---

## 3. get_available_device_ids()

**Purpose**: Returns list of device IDs (ESP1-ESP20) that are not yet registered in a specific project.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION get_available_device_ids(p_project_id TEXT)
RETURNS TABLE(device_id TEXT, device_number INTEGER)
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_project_id` | TEXT | Yes | Project ID to check (e.g., "PROJ1") |

**Returns**:
- Type: `TABLE`
- Columns:
  - `device_id` (TEXT): Available device ID (e.g., "ESP5")
  - `device_number` (INTEGER): Corresponding device number (5)

**Behavior**:
1. Generates full list of device numbers 1-20
2. LEFT JOINs with `devices` table on `project_id` and `device_number`
3. Filters to only rows where `devices.id IS NULL` (not registered)
4. Returns remaining available IDs

**Error Conditions**:
- None (returns empty set if all 20 devices registered)

**Example Usage**:
```typescript
const { data, error } = await supabase.rpc('get_available_device_ids', {
  p_project_id: 'PROJ1'
});

// Success (3 devices already registered):
// data = [
//   { device_id: 'ESP1', device_number: 1 },
//   { device_id: 'ESP2', device_number: 2 },
//   { device_id: 'ESP4', device_number: 4 },
//   // ... (total 17 rows, excluding ESP3, ESP5, ESP6 which are registered)
//   { device_id: 'ESP20', device_number: 20 }
// ]

// All devices registered:
// data = [] (empty array)
```

**Security**: `SECURITY DEFINER` - executes with owner permissions

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION get_available_device_ids(TEXT) TO authenticated;
```

---

## 4. register_device_with_project()

**Purpose**: Registers a new device in a specific project with an available device ID.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION register_device_with_project(
  p_name TEXT,
  p_project_id TEXT,
  p_device_number INTEGER,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  composite_device_id TEXT,
  device_key TEXT,
  id UUID,
  created_at TIMESTAMPTZ
)
```

**Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `p_name` | TEXT | Yes | - | Friendly device name |
| `p_project_id` | TEXT | Yes | - | Project ID (e.g., "PROJ1") |
| `p_device_number` | INTEGER | Yes | - | Device number (1-20) |
| `p_user_id` | UUID | No | auth.uid() | Owner user ID |

**Returns**:
- Type: `TABLE`
- Columns:
  - `composite_device_id` (TEXT): Generated composite ID (e.g., "PROJ1-ESP5")
  - `device_key` (TEXT): Generated device authentication key (64 hex chars)
  - `id` (UUID): Internal device UUID
  - `created_at` (TIMESTAMPTZ): Creation timestamp

**Behavior**:
1. Validates `p_device_number` is between 1 and 20
2. Validates `p_project_id` exists and belongs to `p_user_id`
3. Constructs `composite_device_id` = `p_project_id || '-ESP' || p_device_number`
4. Generates random 64-character hex `device_key` using `encode(gen_random_bytes(32), 'hex')`
5. Hashes `device_key` with SHA-256 to get `device_key_hash`
6. INSERTs device with status='waiting'
7. Returns device details

**Error Conditions**:
- `p_device_number` out of range (1-20): Raises exception `'Device number must be between 1 and 20'`
- `p_project_id` does not exist: Raises foreign key violation
- `p_project_id` does not belong to `p_user_id`: Raises exception `'Project not found or access denied'`
- Device number already registered in project: Raises unique_violation exception `'Device ESP% already registered in this project'`

**Example Usage**:
```typescript
const { data, error } = await supabase.rpc('register_device_with_project', {
  p_name: 'Temperature Sensor',
  p_project_id: 'PROJ1',
  p_device_number: 5
});

// Success:
// data = [{
//   composite_device_id: 'PROJ1-ESP5',
//   device_key: 'a1b2c3d4...', // 64 hex chars
//   id: '...uuid...',
//   created_at: '2025-...'
// }]

// Error (device number already used):
// error = { message: 'Device ESP5 already registered in this project', code: '23505' }
```

**Security**: `SECURITY DEFINER` - executes with owner permissions

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION register_device_with_project(TEXT, TEXT, INTEGER, UUID) TO authenticated;
```

---

## 5. delete_project()

**Purpose**: Deletes a project and all its associated devices (cascade).

**Signature**:
```sql
CREATE OR REPLACE FUNCTION delete_project(p_project_id TEXT)
RETURNS BOOLEAN
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_project_id` | TEXT | Yes | Project ID to delete (e.g., "PROJ1") |

**Returns**:
- Type: `BOOLEAN`
- Value: `TRUE` if project was deleted, `FALSE` if not found

**Behavior**:
1. Verifies project exists and belongs to authenticated user
2. DELETEs project (CASCADE deletes all devices)
3. Returns TRUE if deleted, FALSE if not found

**Error Conditions**:
- Project does not belong to authenticated user: Returns FALSE
- Project does not exist: Returns FALSE

**Example Usage**:
```typescript
const { data, error } = await supabase.rpc('delete_project', {
  p_project_id: 'PROJ1'
});

// Success:
// data = true

// Not found or access denied:
// data = false
```

**Security**: `SECURITY DEFINER` - executes with owner permissions, enforces ownership check

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION delete_project(TEXT) TO authenticated;
```

---

## 6. delete_device()

**Purpose**: Deletes a device from a project, making the device ID available for re-registration.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION delete_device(p_composite_device_id TEXT)
RETURNS BOOLEAN
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_composite_device_id` | TEXT | Yes | Composite device ID (e.g., "PROJ1-ESP5") |

**Returns**:
- Type: `BOOLEAN`
- Value: `TRUE` if device was deleted, `FALSE` if not found

**Behavior**:
1. Verifies device exists and belongs to authenticated user
2. DELETEs device (CASCADE deletes sensors, actuators, heartbeats, etc.)
3. Returns TRUE if deleted, FALSE if not found

**Error Conditions**:
- Device does not belong to authenticated user: Returns FALSE
- Device does not exist: Returns FALSE

**Example Usage**:
```typescript
const { data, error } = await supabase.rpc('delete_device', {
  p_composite_device_id: 'PROJ1-ESP5'
});

// Success:
// data = true

// Not found or access denied:
// data = false
```

**Security**: `SECURITY DEFINER` - executes with owner permissions, enforces ownership check

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION delete_device(TEXT) TO authenticated;
```

---

## 7. get_project_devices()

**Purpose**: Retrieves all devices for a specific project.

**Signature**:
```sql
CREATE OR REPLACE FUNCTION get_project_devices(p_project_id TEXT)
RETURNS TABLE(
  composite_device_id TEXT,
  device_number INTEGER,
  name TEXT,
  status TEXT,
  last_seen_at TIMESTAMPTZ,
  rssi INTEGER,
  created_at TIMESTAMPTZ
)
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `p_project_id` | TEXT | Yes | Project ID (e.g., "PROJ1") |

**Returns**:
- Type: `TABLE`
- Columns: Device details ordered by device_number ASC

**Behavior**:
1. Verifies project belongs to authenticated user
2. SELECTs all devices for the project
3. Orders by device_number ASC

**Error Conditions**:
- Project does not belong to authenticated user: Returns empty set
- Project does not exist: Returns empty set

**Example Usage**:
```typescript
const { data, error } = await supabase.rpc('get_project_devices', {
  p_project_id: 'PROJ1'
});

// Success:
// data = [
//   {
//     composite_device_id: 'PROJ1-ESP1',
//     device_number: 1,
//     name: 'Temperature Sensor',
//     status: 'online',
//     last_seen_at: '2025-11-12T10:30:00Z',
//     rssi: -65,
//     created_at: '2025-11-10T08:00:00Z'
//   },
//   // ... more devices
// ]
```

**Security**: `SECURITY DEFINER` - executes with owner permissions, enforces ownership check

**Grants**:
```sql
GRANT EXECUTE ON FUNCTION get_project_devices(TEXT) TO authenticated;
```

---

## Summary Table

| Function | Purpose | Auth Required | Returns | Side Effects |
|----------|---------|---------------|---------|--------------|
| `generate_project_id()` | Generate next project ID | Yes | TEXT | Increments sequence |
| `create_project()` | Create new project | Yes | TABLE (project details) | Inserts project row |
| `get_available_device_ids()` | List available device IDs | Yes | TABLE (device IDs) | None (read-only) |
| `register_device_with_project()` | Register device in project | Yes | TABLE (device details) | Inserts device row |
| `delete_project()` | Delete project | Yes | BOOLEAN | Deletes project + devices |
| `delete_device()` | Delete device | Yes | BOOLEAN | Deletes device |
| `get_project_devices()` | List project devices | Yes | TABLE (devices) | None (read-only) |

All functions require `authenticated` role and enforce user ownership via RLS or explicit checks.
