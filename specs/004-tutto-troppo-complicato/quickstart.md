# Quickstart Guide: Project-Scoped Device IDs

**Feature**: 004-tutto-troppo-complicato
**Date**: 2025-11-12
**Audience**: Developers implementing this feature

## Overview

This guide walks through the complete implementation flow for the simplified device onboarding system with project-scoped device IDs. Follow these steps in order for a successful implementation.

---

## Prerequisites

- Supabase project set up and running
- PostgreSQL access via Supabase SQL Editor
- Frontend: React 19+ with TypeScript, Vite, React Query
- ESP8266 with Arduino IDE and WiFiManager library
- Node.js 18+ and npm/yarn

---

## Phase 0: Setup & Verification (30 minutes)

### Step 1: Verify Current System

```bash
# Check current git branch
git status

# You should be on: 004-tutto-troppo-complicato
# If not, create and switch to feature branch:
git checkout -b 004-tutto-troppo-complicato
```

### Step 2: Verify Dependencies

```bash
# Frontend dependencies
cd frontend
npm install  # Ensure all packages are installed

# Check key dependencies
npm list @supabase/supabase-js @tanstack/react-query react-router-dom

# Expected versions:
# @supabase/supabase-js@2.74.0
# @tanstack/react-query@5.90.2
# react-router-dom@7.9.3
```

### Step 3: Backup Current Database

```sql
-- In Supabase SQL Editor, run:
-- This creates a snapshot of current schema

BEGIN;

CREATE TABLE IF NOT EXISTS backup_devices_20251112 AS
SELECT * FROM devices;

CREATE TABLE IF NOT EXISTS backup_device_heartbeats_20251112 AS
SELECT * FROM device_heartbeats LIMIT 10000;

COMMIT;

-- Verify backups
SELECT COUNT(*) FROM backup_devices_20251112;
SELECT COUNT(*) FROM backup_device_heartbeats_20251112;
```

---

## Phase 1: Database Schema Changes (Week 1, 2 hours)

### Step 1: Create Projects Table

```sql
-- In Supabase SQL Editor, run:

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_projects_project_id ON projects(project_id);
CREATE UNIQUE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);
```

### Step 2: Create Project ID Sequence

```sql
-- Create sequence for project ID generation
CREATE SEQUENCE projects_seq
  START 1
  INCREMENT 1
  CACHE 50
  NO CYCLE;

-- Grant usage to authenticated users
GRANT USAGE ON SEQUENCE projects_seq TO authenticated;
```

### Step 3: Add Columns to Devices Table

```sql
-- Add new columns (nullable during Phase 1-2)
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS composite_device_id TEXT,
ADD COLUMN IF NOT EXISTS project_id TEXT,
ADD COLUMN IF NOT EXISTS device_number INTEGER;

-- Add indexes (will be unique after Phase 3)
CREATE INDEX idx_devices_composite_id ON devices(composite_device_id);
CREATE INDEX idx_devices_project_device_number ON devices(project_id, device_number);
```

### Step 4: Add Columns to Device Heartbeats

```sql
-- Add composite_device_id for denormalized lookup
ALTER TABLE device_heartbeats
ADD COLUMN IF NOT EXISTS composite_device_id TEXT;

-- Add index
CREATE INDEX idx_device_heartbeats_composite_id ON device_heartbeats(composite_device_id, ts DESC);
```

### Step 5: Verify Schema Changes

```sql
-- Check projects table
\d projects

-- Check new columns in devices
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'devices'
  AND column_name IN ('composite_device_id', 'project_id', 'device_number');

-- Should see 3 rows with is_nullable = 'YES'
```

---

## Phase 1: RPC Functions (Week 1, 1 hour)

Copy the RPC functions from `contracts/rpc-functions.md` and execute in Supabase SQL Editor:

### Step 1: Create generate_project_id()

```sql
CREATE OR REPLACE FUNCTION generate_project_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  seq_value BIGINT;
  formatted_id TEXT;
BEGIN
  seq_value := nextval('public.projects_seq');

  IF seq_value > 9999 THEN
    RAISE EXCEPTION 'Project ID sequence overflow at %', seq_value;
  END IF;

  formatted_id := CASE
    WHEN seq_value <= 999 THEN 'PROJ' || seq_value
    ELSE 'P' || seq_value
  END;

  RETURN formatted_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_project_id() TO authenticated;
```

### Step 2: Test generate_project_id()

```sql
-- Test the function
SELECT generate_project_id();  -- Should return 'PROJ1'
SELECT generate_project_id();  -- Should return 'PROJ2'
SELECT generate_project_id();  -- Should return 'PROJ3'

-- Verify sequence state
SELECT last_value, is_called FROM projects_seq;
-- Should show last_value = 3, is_called = true
```

### Step 3: Create Remaining RPC Functions

Execute all remaining RPC functions from `contracts/rpc-functions.md`:
- `create_project()`
- `get_available_device_ids()`
- `register_device_with_project()`
- `delete_project()`
- `delete_device()`
- `get_project_devices()`

### Step 4: Test RPC Functions

```sql
-- Test create_project
SELECT * FROM create_project('Test Project', 'Test description');
-- Should return: { project_id: 'PROJ4', id: '...uuid...', created_at: '...' }

-- Test get_available_device_ids
SELECT * FROM get_available_device_ids('PROJ4');
-- Should return 20 rows (ESP1-ESP20)

-- Test register_device_with_project
SELECT * FROM register_device_with_project('My Device', 'PROJ4', 5);
-- Should return: { composite_device_id: 'PROJ4-ESP5', device_key: '...', ... }

-- Verify device was created
SELECT composite_device_id, project_id, device_number, name, status
FROM devices
WHERE composite_device_id = 'PROJ4-ESP5';

-- Test get_available_device_ids again
SELECT * FROM get_available_device_ids('PROJ4');
-- Should return 19 rows (ESP1-ESP4, ESP6-ESP20, no ESP5)

-- Cleanup test data
DELETE FROM projects WHERE project_id = 'PROJ4';
```

---

## Phase 2: Edge Function Update (Week 2, 2 hours)

### Step 1: Update device-heartbeat Edge Function

```bash
cd supabase/functions/device-heartbeat
```

Update `index.ts` to support both UUID and composite device IDs. See `contracts/edge-function-device-heartbeat.md` for the full implementation.

**Key changes**:
```typescript
// Extract headers
const deviceKey = req.headers.get('x-device-key');
const deviceUUID = req.headers.get('x-device-uuid'); // Legacy
const compositeDeviceId = req.headers.get('x-composite-device-id'); // New

// Determine lookup strategy
let device;
if (compositeDeviceId) {
  // Validate format
  const compositeIdRegex = /^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$/;
  if (!compositeIdRegex.test(compositeDeviceId)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid composite device ID format'
    }), { status: 400 });
  }

  // Lookup by composite ID
  const { data, error } = await supabase
    .from('devices')
    .select('id, device_key_hash, composite_device_id')
    .eq('composite_device_id', compositeDeviceId)
    .single();

  device = data;
} else if (deviceUUID) {
  // Lookup by UUID (legacy)
  const { data, error } = await supabase
    .from('devices')
    .select('id, device_key_hash, composite_device_id')
    .eq('id', deviceUUID)
    .single();

  device = data;
} else {
  return new Response(JSON.stringify({
    success: false,
    error: 'Missing device identifier'
  }), { status: 400 });
}

// ... rest of authentication and heartbeat processing
```

### Step 2: Deploy Edge Function

```bash
# Deploy the updated function
supabase functions deploy device-heartbeat

# Test with curl (using test device from Phase 1)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/device-heartbeat \
  -H "x-device-key: YOUR_DEVICE_KEY" \
  -H "x-composite-device-id: PROJ4-ESP5" \
  -H "Content-Type: application/json" \
  -d '{
    "rssi": -65,
    "ip_address": "192.168.1.100",
    "fw_version": "v3.0.0"
  }'

# Should return:
# { "success": true, "device_id": "PROJ4-ESP5", "status": "online", "timestamp": "..." }
```

---

## Phase 2: Frontend Implementation (Week 2-3, 8 hours)

### Step 1: Create Type Definitions

```bash
cd frontend/src/types
```

Create `project.types.ts`:
```typescript
export interface Project {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  user_id: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}
```

Update `device.types.ts`:
```typescript
export interface Device {
  id: string;
  composite_device_id: string;  // New
  project_id: string;            // New
  device_number: number;         // New
  name: string;
  // ... rest of existing fields
}

export interface AvailableDeviceId {
  device_id: string;
  device_number: number;
}
```

### Step 2: Create Services

Create `src/services/projects.service.ts` using the implementation from `contracts/frontend-api.md`.

### Step 3: Create React Query Hooks

Create `src/lib/hooks/useProjects.ts` and `src/lib/hooks/useProjectDevices.ts` using implementations from `contracts/frontend-api.md`.

### Step 4: Create UI Components

**Projects List Page** (`src/pages/Projects.page.tsx`):
```typescript
import { useProjects, useCreateProject } from '@/lib/hooks/useProjects';
import { Link } from 'react-router-dom';

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { mutate: createProject } = useCreateProject();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My Projects</h1>
      <button onClick={() => /* show create modal */}>Add Project</button>

      <div className="projects-grid">
        {projects?.map(project => (
          <Link key={project.id} to={`/projects/${project.project_id}`}>
            <div className="project-card">
              <h2>{project.project_id}</h2>
              <p>{project.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Device Registration Form** (`src/components/devices/DeviceRegister.tsx`):
```typescript
import { useAvailableDeviceIds, useRegisterDevice } from '@/lib/hooks/useProjectDevices';
import { useState } from 'react';

export function DeviceRegister({ projectId }: { projectId: string }) {
  const { data: availableIds } = useAvailableDeviceIds(projectId);
  const { mutate: registerDevice, isPending } = useRegisterDevice();
  const [deviceNumber, setDeviceNumber] = useState<number>(1);
  const [deviceName, setDeviceName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerDevice({
      name: deviceName,
      projectId,
      deviceNumber
    }, {
      onSuccess: (data) => {
        alert(`Device ${data.composite_device_id} registered!\nDevice Key: ${data.device_key}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={deviceName}
        onChange={(e) => setDeviceName(e.target.value)}
        placeholder="Device name"
        required
      />

      <select
        value={deviceNumber}
        onChange={(e) => setDeviceNumber(Number(e.target.value))}
        required
      >
        {availableIds?.map(id => (
          <option key={id.device_number} value={id.device_number}>
            {id.device_id}
          </option>
        ))}
      </select>

      <button type="submit" disabled={isPending || !availableIds?.length}>
        Register Device
      </button>
    </form>
  );
}
```

### Step 5: Update Routing

Update `src/App.tsx`:
```typescript
import { Routes, Route } from 'react-router-dom';
import { ProjectsPage } from './pages/Projects.page';
import { ProjectDetailPage } from './pages/ProjectDetail.page';

function App() {
  return (
    <Routes>
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      {/* ... other routes */}
    </Routes>
  );
}
```

---

## Phase 2: ESP8266 Firmware (Week 3, 4 hours)

### Step 1: Create Firmware v3.0

Create new directory:
```bash
mkdir firmware/ESP8266_Greenhouse_v3.0
cd firmware/ESP8266_Greenhouse_v3.0
```

### Step 2: Create config.h

```cpp
#ifndef CONFIG_H
#define CONFIG_H

#include <EEPROM.h>

// EEPROM layout
#define EEPROM_SIZE 512
#define EEPROM_OFFSET 0

// Device configuration stored in EEPROM
struct DeviceConfig {
  char composite_device_id[15];  // "PROJ1-ESP5" + null terminator
  char wifi_ssid[33];            // WiFi SSID (32 + null)
  char wifi_password[64];        // WiFi password (63 + null)
  char device_key[65];           // Device key (64 hex + null)
  uint32_t crc32;                // CRC32 checksum
};

extern DeviceConfig deviceConfig;

// Function prototypes
void loadConfig();
void saveConfig();
uint32_t calculateCRC32(const uint8_t* data, size_t length);
bool validateConfig();

#endif
```

### Step 3: Implement WiFiManager Portal

See `research.md` Section 1 for complete WiFiManager implementation with custom captive portal.

**Key pattern**:
```cpp
// Hidden field for device number + JavaScript dropdown
WiFiManagerParameter hidden_device_num("device_num", "Device Number", "1", 3);

const char dropdown_html[] PROGMEM = R"(
<br/><label for='device_select'>Device ID</label>
<select id='device_select' onchange="document.getElementById('device_num').value=this.value">
  <option value='1'>ESP-1</option>
  <option value='2'>ESP-2</option>
  <!-- ... ESP-3 through ESP-20 ... -->
</select>
<script>
  document.querySelector("[for='device_num']").hidden=1;
  document.getElementById('device_num').hidden=1;
</script>
)";

WiFiManagerParameter custom_dropdown(dropdown_html);

// Project ID with uppercase normalization
WiFiManagerParameter project_id("proj_id", "Project ID", "", 10,
  " onchange='this.value=this.value.toUpperCase()'");

wifiManager.addParameter(&project_id);
wifiManager.addParameter(&hidden_device_num);
wifiManager.addParameter(&custom_dropdown);
```

### Step 4: Test Firmware

1. Upload firmware to ESP8266
2. Connect to "Serra-Setup" AP
3. Enter project ID (e.g., "proj1" - will be normalized to "PROJ1")
4. Select device ID from dropdown (e.g., "ESP-5")
5. Enter WiFi credentials
6. Submit and verify ESP connects and sends heartbeat

---

## Testing Checklist

### Database Tests

- [ ] Projects table created with all columns and indexes
- [ ] RLS policies enforce user ownership
- [ ] Sequence generates sequential IDs (PROJ1, PROJ2, ..., P9999)
- [ ] Unique constraints prevent duplicate project names
- [ ] Unique constraints prevent duplicate device numbers in same project
- [ ] Foreign key CASCADE deletes work (delete project → deletes devices)

### API Tests

- [ ] `create_project()` generates unique project IDs
- [ ] `create_project()` rejects duplicate project names
- [ ] `get_available_device_ids()` returns correct available IDs
- [ ] `register_device_with_project()` creates device with composite ID
- [ ] `register_device_with_project()` rejects duplicate device numbers
- [ ] Edge Function accepts `x-composite-device-id` header
- [ ] Edge Function accepts `x-device-uuid` header (legacy)
- [ ] Edge Function validates composite ID format

### Frontend Tests

- [ ] Projects list displays all user projects
- [ ] Create project form validates name uniqueness
- [ ] Device registration form shows available device IDs
- [ ] Device registration form submits and shows device key
- [ ] Device list updates when device comes online
- [ ] Delete project shows warning if last project

### Firmware Tests

- [ ] ESP creates "Serra-Setup" AP on first boot
- [ ] Captive portal displays project ID input and device ID dropdown
- [ ] Project ID input normalizes to uppercase
- [ ] Device ID dropdown shows ESP1-ESP20
- [ ] Configuration saves to EEPROM
- [ ] ESP connects to WiFi after configuration
- [ ] ESP sends heartbeat with composite device ID
- [ ] Heartbeat includes RSSI, IP, firmware version

---

## Troubleshooting

### Common Issues

**Issue**: "Project name already exists" error
**Solution**: Check global uniqueness - another user may have the same project name. Choose a different name.

**Issue**: Device heartbeat returns 404
**Solution**: Verify device is registered in webapp before configuring ESP. Check composite device ID format matches "PROJ1-ESP5".

**Issue**: ESP doesn't connect to WiFi after configuration
**Solution**: Factory reset ESP (hold reset button), verify WiFi credentials are correct, check WiFi signal strength.

**Issue**: Available device IDs dropdown is empty
**Solution**: Project has 20 devices registered. Delete a device to free up an ID.

**Issue**: Sequence overflow error when creating project
**Solution**: Maximum of 9999 projects reached globally. Contact support or implement sequence reset.

---

## Next Steps

After completing this quickstart:

1. **Read migration documentation**: See `MIGRATION_STRATEGY.md` for Phase 3 data migration
2. **Review contracts**: See `contracts/` directory for complete API specifications
3. **Run `/speckit.tasks`**: Generate implementation tasks from this plan
4. **Deploy to production**: Follow Phase 3 migration checklist

---

## Support Resources

- **Data Model**: `data-model.md` - Complete entity definitions
- **Research**: `research.md` - Technical decisions and alternatives
- **RPC Functions**: `contracts/rpc-functions.md` - Database function specs
- **Edge Function**: `contracts/edge-function-device-heartbeat.md` - API specification
- **Frontend API**: `contracts/frontend-api.md` - TypeScript interfaces and services

For questions or issues, refer to these documents or create an issue in the project repository.
