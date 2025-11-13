# Zero-Downtime Migration Strategy: API Key to Project-Scoped Device IDs

**Feature**: 004-tutto-troppo-complicato - Simplified Device Onboarding with Project-Scoped Device IDs
**Version**: 1.0
**Status**: Reference Implementation
**Date**: 2025-11-12

## Executive Summary

This document provides a comprehensive migration strategy for transitioning from UUID-based device IDs with per-device API keys to project-scoped composite IDs (PROJ1-ESP5 format) while maintaining zero-downtime for production systems and supporting existing devices.

**Key Characteristics of This Migration**:
- **Breaking Change**: Device ID format changes from UUID to "PROJX-ESPY"
- **Data Integrity**: Existing devices must remain operational during transition
- **Backward Compatibility**: Old API keys become obsolete; new system uses project ID + device ID
- **Phase-Based**: 4-phase migration allows parallel operation of old and new systems

---

## Current System Analysis

### Existing Architecture (v2.1)

**Device Identification**:
```
- devices.id: UUID (e.g., "550e8400-e29b-41d4-a716-446655440000")
- devices.api_key_hash: SHA-256 hash of per-device API key
- devices.device_key_hash: SHA-256 hash of device-specific key (replaces api_key)
- devices.device_hostname: mDNS hostname (e.g., "http://serrasetup-abcd.local")
```

**Authentication Flow**:
1. ESP devices authenticate via `device-heartbeat` Edge Function
2. Uses `x-device-key` header + `x-device-uuid` header
3. Edge Function hashes the key and compares with `device_key_hash`
4. Service role key updates device status and records heartbeat telemetry

**Current RLS Context**:
- All RLS policies based on `user_id` column
- Device ownership determined by `devices.user_id = auth.uid()`
- Sensors/actuators cascade access through device ownership

### Pain Points & Requirements

**Current Issues**:
1. **No project/location separation**: All devices belong to single user context
2. **Hard to scale**: Manual ESP configuration requires copying long UUIDs
3. **QR code complexity**: Must encode full UUID + API key (too verbose)
4. **Device ID collision risk**: No namespace separation per user

**New Requirements**:
1. **Project-scoped IDs**: Users can have multiple projects (greenhouses)
2. **Human-readable IDs**: "PROJ1-ESP5" format for manual ESP configuration
3. **Hardcoded configuration**: Firmware can hardcode project+device IDs
4. **Unique constraints**: Project names globally unique, device IDs scoped per project

---

## Phase 1: Schema Expansion (Zero-Downtime)

### Timeline: Week 1 | Zero Downtime Required

### Step 1.1: Create Projects Table

```sql
-- Migration: 20251112000000_add_projects_table.sql

-- Create projects table with globally unique names and IDs
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE, -- Globally unique project name
  project_id TEXT NOT NULL UNIQUE, -- Generated ID like "PROJ1", "PROJ2"
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_id ON public.projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects(name);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own projects
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.projects IS
  'Container for devices organized by location/greenhouse.
   Project ID is globally unique (e.g., PROJ1, PROJ2).
   Project name is globally unique.';

COMMENT ON COLUMN public.projects.project_id IS
  'Globally unique project identifier in format PROJN (e.g., PROJ1, PROJ2).
   Generated sequentially on creation.';
```

**Why This Approach**:
- Creates separate `projects` table instead of modifying `devices`
- Allows devices table to remain unchanged during Phase 1-2
- Prevents foreign key conflicts during transition
- Enables gradual migration of existing devices

---

### Step 1.2: Add Project Reference to Devices (Optional Column)

```sql
-- Add optional project_id column to devices
-- This allows gradual migration - devices can be NULL during transition
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add composite device ID column (PROJ1-ESP5 format)
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS composite_device_id TEXT UNIQUE;
-- This will be populated during Phase 2, remains NULL during Phase 1

-- Add device number within project (1-20)
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS device_number INTEGER CHECK (device_number >= 1 AND device_number <= 20);

-- Index for quick lookup by composite ID (new system)
CREATE INDEX IF NOT EXISTS idx_devices_composite_id
ON public.devices(composite_device_id)
WHERE composite_device_id IS NOT NULL;

-- Index for device_number queries
CREATE INDEX IF NOT EXISTS idx_devices_project_number
ON public.devices(project_id, device_number)
WHERE project_id IS NOT NULL;
```

**Migration Notes**:
- All new columns are NULLABLE or have defaults
- No existing data is modified
- Existing devices continue working with UUID-based queries
- Zero downtime: application can deploy with this schema immediately

---

### Step 1.3: Create Migration Audit Table

```sql
-- Create audit trail for migration tracking
CREATE TABLE IF NOT EXISTS public.device_migration_log (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  old_device_id TEXT NOT NULL, -- Original UUID
  new_device_id TEXT, -- New composite ID (PROJ1-ESP5)
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  migration_status TEXT CHECK (migration_status IN
    ('pending', 'in_progress', 'completed', 'failed', 'rollback')) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT valid_device_migration_status CHECK (
    -- Must have completed_at if status is 'completed'
    (migration_status != 'completed' OR completed_at IS NOT NULL)
    AND
    -- Cannot have completed_at if status is 'pending' or 'in_progress'
    (migration_status IN ('pending', 'in_progress') OR completed_at IS NOT NULL)
  )
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_migration_log_device_id ON public.device_migration_log(device_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_status ON public.device_migration_log(migration_status);
CREATE INDEX IF NOT EXISTS idx_migration_log_created_at ON public.device_migration_log(created_at DESC);

COMMENT ON TABLE public.device_migration_log IS
  'Audit trail for device ID migration from UUID to composite format.
   Tracks status, timing, and any errors encountered during migration.
   Used for rollback and troubleshooting.';
```

**Deployment Steps for Phase 1**:
1. Run three migration scripts above in order
2. Deploy backend/frontend without logic changes
3. Verify schema with: `SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('projects', 'devices')`
4. Monitor database for 24 hours (verify no issues)

---

## Phase 2: Dual-Write System (Graceful Deprecation)

### Timeline: Week 2-3 | No New Devices on Old System

### Overview

During this phase:
- **New devices**: Registered in projects table with composite IDs
- **Existing devices**: Continue working with UUID (no changes to firmware)
- **No API keys**: All authentication transitions to device keys
- **Deprecation period**: Old API key system still operational but not used for new registrations

---

### Step 2.1: Create Project Management Functions

```sql
-- Function: Generate next project ID
CREATE OR REPLACE FUNCTION public.get_next_project_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INT;
  next_id TEXT;
BEGIN
  -- Find the maximum project number from existing project IDs
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_id FROM 5) AS INTEGER)), 0)
  INTO next_num
  FROM public.projects;

  -- Increment and format as PROJN
  next_id := 'PROJ' || (next_num + 1)::TEXT;

  RETURN next_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_project_id() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_next_project_id() IS
  'Generates next sequential project ID (e.g., PROJ1, PROJ2).
   Ensures globally unique IDs across entire system.';
```

```sql
-- Function: Create new project with auto-generated ID
CREATE OR REPLACE FUNCTION public.create_project(
  name_param TEXT,
  description_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  project_id TEXT,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_id TEXT;
  new_project_id UUID;
BEGIN
  -- Check if project name already exists
  IF EXISTS (SELECT 1 FROM public.projects WHERE name = name_param) THEN
    RAISE EXCEPTION 'Project name already exists: %', name_param
      USING HINT = 'Choose a different project name. Project names must be globally unique.';
  END IF;

  -- Get next project ID
  next_id := public.get_next_project_id();

  -- Create project
  INSERT INTO public.projects (user_id, name, project_id, description)
  VALUES (auth.uid(), name_param, next_id, description_param)
  RETURNING projects.id INTO new_project_id;

  -- Return created project
  RETURN QUERY
  SELECT p.id, p.project_id, p.name, p.description, p.created_at
  FROM public.projects p
  WHERE p.id = new_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_project(TEXT, TEXT) IS
  'Creates new project with auto-generated globally unique ID.
   Enforces globally unique project names.
   Returns complete project info including generated project_id.';
```

```sql
-- Function: Get available device IDs for a project
CREATE OR REPLACE FUNCTION public.get_available_device_ids(
  project_id_param UUID
)
RETURNS TABLE (
  device_number INTEGER,
  device_id TEXT,
  is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_project_id TEXT;
BEGIN
  -- Get the project_id (string like "PROJ1")
  SELECT p.project_id INTO project_project_id
  FROM public.projects p
  WHERE p.id = project_id_param AND p.user_id = auth.uid();

  IF project_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or not owned by user';
  END IF;

  -- Return all device numbers (1-20) with availability
  RETURN QUERY
  SELECT
    nums.num::INTEGER,
    project_project_id || '-ESP' || nums.num::TEXT,
    NOT EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.project_id = project_id_param
      AND d.device_number = nums.num
    ) AS available
  FROM (SELECT GENERATE_SERIES(1, 20) AS num) nums
  ORDER BY nums.num;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_device_ids(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_available_device_ids(UUID) IS
  'Returns all device numbers (1-20) for a project with availability status.
   Shows which device IDs (ESP1-ESP20) are available for registration.';
```

---

### Step 2.2: Update Device Registration Function

```sql
-- Function: Register device in new system (with project)
CREATE OR REPLACE FUNCTION public.register_device_with_project(
  name_param TEXT,
  project_id_param UUID,
  device_number_param INTEGER
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  composite_device_id TEXT,
  device_key_hash TEXT,
  project_id UUID,
  registered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_project_id TEXT;
  composite_id TEXT;
  device_key_hash_val TEXT;
BEGIN
  -- Verify user owns the project
  SELECT p.project_id INTO project_project_id
  FROM public.projects p
  WHERE p.id = project_id_param AND p.user_id = auth.uid();

  IF project_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or not owned by user';
  END IF;

  -- Check device number is in valid range
  IF device_number_param < 1 OR device_number_param > 20 THEN
    RAISE EXCEPTION 'Device number must be between 1 and 20';
  END IF;

  -- Check device number not already registered in this project
  IF EXISTS (
    SELECT 1 FROM public.devices
    WHERE project_id = project_id_param
    AND device_number = device_number_param
  ) THEN
    RAISE EXCEPTION 'Device % already registered in project %',
      'ESP' || device_number_param, project_project_id
      USING HINT = 'This device ID is already in use. Choose a different number.';
  END IF;

  -- Build composite device ID (e.g., "PROJ1-ESP5")
  composite_id := project_project_id || '-ESP' || device_number_param::TEXT;

  -- For now, set empty device_key_hash (will be set by frontend/SDK)
  -- Frontend will generate actual device key and send it for hashing
  device_key_hash_val := '';

  -- Insert device
  INSERT INTO public.devices (
    user_id,
    name,
    project_id,
    device_number,
    composite_device_id,
    device_key_hash,
    connection_status
  )
  VALUES (
    auth.uid(),
    name_param,
    project_id_param,
    device_number_param,
    composite_id,
    device_key_hash_val,
    'offline'
  )
  RETURNING
    devices.id,
    devices.name,
    devices.composite_device_id,
    devices.device_key_hash,
    devices.project_id,
    devices.registered_at
  INTO id, name, composite_device_id, device_key_hash, project_id, registered_at;

  -- Return created device
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_with_project(TEXT, UUID, INTEGER)
  TO authenticated;

COMMENT ON FUNCTION public.register_device_with_project(TEXT, UUID, INTEGER) IS
  'Registers new device in project using composite ID format (PROJ1-ESP5).
   Enforces uniqueness of device_number within project.
   Device is in "offline" state pending physical ESP connection.';
```

---

### Step 2.3: Update Device Heartbeat for Composite IDs

```sql
-- Function: Process heartbeat with composite device ID
CREATE OR REPLACE FUNCTION public.device_heartbeat_composite(
  composite_device_id_param TEXT,
  device_key_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  device_id_val UUID;
  stored_key_hash TEXT;
  computed_hash TEXT;
  old_status TEXT;
BEGIN
  -- Look up device by composite ID
  SELECT id, device_key_hash, connection_status
  INTO device_id_val, stored_key_hash, old_status
  FROM public.devices
  WHERE composite_device_id = composite_device_id_param;

  IF device_id_val IS NULL THEN
    RAISE EXCEPTION 'Device not found: %', composite_device_id_param
      USING HINT = 'Ensure device is registered in webapp before sending heartbeat.';
  END IF;

  -- If device_key provided, validate it
  IF device_key_param IS NOT NULL AND stored_key_hash IS NOT NULL THEN
    -- Hash the provided key (matching frontend implementation)
    computed_hash := encode(digest(device_key_param, 'sha256'), 'hex');

    IF computed_hash != stored_key_hash THEN
      RAISE EXCEPTION 'Invalid device key for device: %', composite_device_id_param;
    END IF;
  END IF;

  -- Update device status
  UPDATE public.devices
  SET
    connection_status = 'online',
    last_seen_at = NOW()
  WHERE id = device_id_val;

  -- Log status transition
  RAISE NOTICE 'Device % heartbeat received, status: % → online',
    composite_device_id_param, old_status;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'device_id', device_id_val,
    'composite_id', composite_device_id_param,
    'status', 'online',
    'previous_status', old_status,
    'timestamp', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.device_heartbeat_composite(TEXT, TEXT)
  TO authenticated, anon;

COMMENT ON FUNCTION public.device_heartbeat_composite(TEXT, TEXT) IS
  'Process heartbeat using composite device ID (PROJ1-ESP5 format).
   Validates device key if provided (optional for backward compatibility).
   Updates device status to online.';
```

---

### Step 2.4: Update Edge Function for Composite IDs

Replace `/supabase/functions/device-heartbeat/index.ts`:

```typescript
/**
 * Edge Function: device-heartbeat (v2.2 - Composite ID Support)
 *
 * Handles heartbeats from both:
 * 1. Old devices: Using UUID + device_key (phase out during Phase 3)
 * 2. New devices: Using composite_device_id + device_key
 *
 * Graceful degradation: accepts both formats during transition period
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function hashDeviceKey(deviceKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-key, x-device-uuid, x-composite-device-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Extract headers - support both old (UUID) and new (composite ID) formats
    const deviceKey = req.headers.get("x-device-key") ?? "";
    const deviceUUID = req.headers.get("x-device-uuid") ?? "";
    const compositeDeviceId = req.headers.get("x-composite-device-id") ?? "";

    // Must provide either UUID or composite ID
    if (!deviceKey || (!deviceUUID && !compositeDeviceId)) {
      return new Response(
        JSON.stringify({ error: "Missing authentication headers" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which lookup to perform
    let device: any;
    let lookupType: "uuid" | "composite" = "uuid";

    if (compositeDeviceId && !deviceUUID) {
      // New format: lookup by composite ID
      lookupType = "composite";
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_key_hash, connection_status")
        .eq("composite_device_id", compositeDeviceId)
        .single();

      if (error || !data) {
        console.error("Composite device lookup failed:", error);
        return new Response(
          JSON.stringify({ error: "Device not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      device = data;
    } else {
      // Old format: lookup by UUID
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_key_hash, connection_status")
        .eq("id", deviceUUID)
        .single();

      if (error || !data) {
        console.error("UUID device lookup failed:", error);
        return new Response(
          JSON.stringify({ error: "Device not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      device = data;
    }

    // Verify device key
    const deviceKeyHash = await hashDeviceKey(deviceKey);

    if (device.device_key_hash !== deviceKeyHash) {
      console.error(`Device key mismatch (${lookupType}):`, compositeDeviceId || deviceUUID);
      return new Response(
        JSON.stringify({ error: "Forbidden: invalid device key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const rssi = typeof body.rssi === "number" ? body.rssi : null;
    const fwVersion = typeof body.fw_version === "string" ? body.fw_version : null;
    const ip = typeof body.ip === "string" ? body.ip : null;

    // Insert heartbeat
    const { error: insertErr } = await supabase
      .from("device_heartbeats")
      .insert({
        device_id: device.id,
        rssi,
        fw_version: fwVersion,
        ip,
      });

    if (insertErr) {
      console.error("Heartbeat insert failed:", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to record heartbeat" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update device status
    const { error: updateErr } = await supabase
      .from("devices")
      .update({
        last_seen_at: new Date().toISOString(),
        connection_status: "online",
      })
      .eq("id", device.id);

    if (updateErr) {
      console.error("Device status update failed:", updateErr);
    }

    // Return success
    return new Response(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        status: "online",
        lookup_type: lookupType,
        device_id: device.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

### Phase 2 Deployment Steps

1. Deploy Step 2.1-2.3 migrations in order
2. Deploy updated Edge Function
3. Update frontend `devicesService.registerDevice()`:
   - Create project if not exists
   - Call new `register_device_with_project()` function
   - Generate device key with Web Crypto API
   - Hash and store in `device_key_hash`

4. **Test both systems in parallel**:
   - Register a new device with project (new system)
   - Verify old device still sends heartbeats (old system)
   - Both should update `last_seen_at` and `connection_status`

5. Monitor for 48 hours:
   - Check for duplicate heartbeats
   - Verify RLS policies still work
   - Ensure no data corruption

---

## Phase 3: Device Migration (Scheduled Downtime - 30 min)

### Timeline: Week 4 | Single 30-minute maintenance window

### Step 3.1: Backfill Composite IDs for Existing Devices

**Pre-Migration Actions**:
1. Notify all users: "Device system maintenance on [DATE] 2-2:30 AM UTC"
2. Create rollback backup: `pg_dump` of devices table
3. Disable CI/CD deployments

**Migration Script**:

```sql
-- Migration: 20251112000100_migrate_devices_to_composite_ids.sql

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Create default project for each user with existing devices
-- This groups all their legacy devices under one project
INSERT INTO public.projects (user_id, name, project_id, description)
SELECT DISTINCT
  d.user_id,
  'Legacy Devices' as name,
  'PROJ0' as project_id,
  'Auto-created project for devices registered before project system' as description
FROM public.devices d
WHERE d.project_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.user_id = d.user_id
  AND p.project_id = 'PROJ0'
)
ON CONFLICT (project_id) DO NOTHING;

-- Verify legacy project was created
DO $$
DECLARE
  legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO legacy_count FROM public.projects WHERE project_id = 'PROJ0';
  RAISE NOTICE 'Created % legacy projects', legacy_count;
END $$;

-- Step 2: Assign existing devices to legacy project
WITH legacy_projects AS (
  SELECT p.id, p.user_id
  FROM public.projects p
  WHERE p.project_id = 'PROJ0'
)
UPDATE public.devices d
SET project_id = lp.id
FROM legacy_projects lp
WHERE d.user_id = lp.user_id
AND d.project_id IS NULL;

-- Verify devices were assigned
DO $$
DECLARE
  assigned_count INT;
BEGIN
  SELECT COUNT(*) INTO assigned_count
  FROM public.devices WHERE project_id IS NOT NULL;
  RAISE NOTICE 'Assigned % devices to projects', assigned_count;
END $$;

-- Step 3: Generate composite device IDs
-- Use device creation order to assign sequential numbers (ESP1, ESP2, etc.)
WITH device_numbering AS (
  SELECT
    d.id,
    d.project_id,
    p.project_id as proj_code,
    ROW_NUMBER() OVER (PARTITION BY d.project_id ORDER BY d.registered_at ASC) as seq_num
  FROM public.devices d
  JOIN public.projects p ON p.id = d.project_id
  WHERE d.composite_device_id IS NULL
  AND d.device_number IS NULL
)
UPDATE public.devices d
SET
  device_number = dn.seq_num,
  composite_device_id = dn.proj_code || '-ESP' || dn.seq_num::TEXT
FROM device_numbering dn
WHERE d.id = dn.id;

-- Verify composite IDs were generated
DO $$
DECLARE
  migrated_count INT;
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM public.devices WHERE composite_device_id IS NOT NULL;
  SELECT COUNT(*) INTO null_count
  FROM public.devices WHERE composite_device_id IS NULL;

  RAISE NOTICE 'Generated % composite IDs, % devices remaining',
    migrated_count, null_count;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % devices still have NULL composite_device_id', null_count;
  END IF;
END $$;

-- Step 4: Log migration in audit table
INSERT INTO public.device_migration_log (
  device_id,
  old_device_id,
  new_device_id,
  project_id,
  migration_status,
  started_at,
  completed_at
)
SELECT
  d.id,
  d.id::TEXT,
  d.composite_device_id,
  d.project_id,
  'completed',
  NOW() - INTERVAL '1 second',
  NOW()
FROM public.devices d
WHERE d.composite_device_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.device_migration_log dml
  WHERE dml.device_id = d.id
);

-- Step 5: Verify data integrity
DO $$
DECLARE
  duplicate_composite_ids INT;
  devices_without_composite INT;
  devices_without_project INT;
BEGIN
  -- Check for duplicate composite IDs
  SELECT COUNT(*) INTO duplicate_composite_ids
  FROM (
    SELECT composite_device_id FROM public.devices
    WHERE composite_device_id IS NOT NULL
    GROUP BY composite_device_id
    HAVING COUNT(*) > 1
  ) t;

  -- Check devices without composite IDs
  SELECT COUNT(*) INTO devices_without_composite
  FROM public.devices
  WHERE composite_device_id IS NULL;

  -- Check devices without project
  SELECT COUNT(*) INTO devices_without_project
  FROM public.devices
  WHERE project_id IS NULL;

  IF duplicate_composite_ids > 0 THEN
    RAISE EXCEPTION 'Data integrity error: % duplicate composite IDs found', duplicate_composite_ids;
  END IF;

  IF devices_without_composite > 0 THEN
    RAISE EXCEPTION 'Data integrity error: % devices without composite IDs', devices_without_composite;
  END IF;

  IF devices_without_project > 0 THEN
    RAISE EXCEPTION 'Data integrity error: % devices without project assignment', devices_without_project;
  END IF;

  RAISE NOTICE 'Data integrity check: PASSED';
END $$;

-- Step 6: Make composite_device_id NOT NULL going forward
ALTER TABLE public.devices
ALTER COLUMN composite_device_id SET NOT NULL;

ALTER TABLE public.devices
ALTER COLUMN project_id SET NOT NULL;

COMMIT;

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
--
-- WHAT WAS CHANGED:
-- - All existing devices assigned to "PROJ0" (Legacy Devices) project
-- - Composite device IDs generated: PROJ0-ESP1, PROJ0-ESP2, etc.
-- - Device numbers assigned sequentially by registration order
-- - Migration audit logged in device_migration_log
--
-- BACKWARD COMPATIBILITY:
-- - UUID column (id) unchanged - queries using old IDs still work
-- - api_key_hash columns unchanged (for rollback)
-- - device_key_hash preserved if previously set
--
-- IF ROLLBACK NEEDED:
-- - ALTER TABLE devices DROP COLUMN composite_device_id;
-- - ALTER TABLE devices DROP COLUMN device_number;
-- - DELETE FROM projects WHERE project_id = 'PROJ0';
-- - Application will revert to UUID-based system
--
-- TESTING CHECKLIST:
-- - Verify all devices have composite_device_id
-- - Verify all devices have project_id
-- - Verify no duplicate composite_device_ids
-- - Query old system by UUID still works: SELECT * FROM devices WHERE id = 'uuid';
-- - Existing heartbeat function still works
-- - RLS policies unchanged
--
```

**Rollback Plan** (if needed during maintenance window):

```sql
-- ROLLBACK: 20251112000100_migrate_devices_to_composite_ids.sql

BEGIN TRANSACTION;

-- Step 1: Restore constraints to nullable
ALTER TABLE public.devices
ALTER COLUMN composite_device_id DROP NOT NULL;

ALTER TABLE public.devices
ALTER COLUMN project_id DROP NOT NULL;

-- Step 2: Clear newly created data
UPDATE public.devices
SET composite_device_id = NULL,
    device_number = NULL,
    project_id = NULL;

DELETE FROM public.device_migration_log
WHERE migration_status = 'completed'
AND created_at > NOW() - INTERVAL '1 hour';

DELETE FROM public.projects
WHERE project_id = 'PROJ0';

COMMIT;

-- =====================================================
-- ROLLBACK COMPLETE
-- System reverted to UUID-based device IDs
-- All heartbeat functions continue working
-- =====================================================
```

---

### Step 3.2: Update Application Queries

**Before running migration script**, prepare application changes:

```typescript
// frontend/src/services/devices.service.ts

// OLD QUERY (Phase 1-2): UUID-based
async getDevice(deviceId: string) {
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId) // UUID
    .single();
}

// NEW QUERY (Phase 3+): Composite ID OR UUID fallback
async getDevice(deviceId: string) {
  // Check if it's composite format (PROJX-ESPY)
  if (deviceId.includes('-')) {
    // Try composite ID first
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('composite_device_id', deviceId)
      .single();

    if (!error && data) return data;
  }

  // Fallback to UUID (backward compatible)
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('id', deviceId)
    .single();

  return data;
}
```

---

### Phase 3 Deployment Checklist

- [ ] Create maintenance window notification (24 hours before)
- [ ] Backup database
- [ ] Deploy application with Phase 3 code
- [ ] Stop all non-critical background jobs
- [ ] Run migration script with SERIALIZABLE isolation
- [ ] Verify rollback backup was successful
- [ ] Monitor heartbeats during window:
  ```sql
  SELECT
    composite_device_id,
    connection_status,
    last_seen_at,
    COUNT(*) as heartbeat_count
  FROM devices d
  LEFT JOIN device_heartbeats dh ON d.id = dh.device_id
  WHERE dh.ts > NOW() - INTERVAL '5 minutes'
  GROUP BY 1,2,3
  ORDER BY 4 DESC
  LIMIT 20;
  ```
- [ ] Verify RLS policies work with new queries
- [ ] Verify composite ID queries fast (index check):
  ```sql
  EXPLAIN ANALYZE SELECT * FROM devices WHERE composite_device_id = 'PROJ0-ESP1';
  ```
- [ ] Enable CI/CD
- [ ] Post-migration notification to users

---

## Phase 4: Cleanup and Optimization (Week 5)

### Timeline: 1 week | Deprecation of old system

### Step 4.1: Remove API Key References

```sql
-- Migration: 20251112000200_remove_api_key_columns.sql

-- After confirming all devices use device_key_hash (Phase 3 complete + 1 week),
-- remove legacy api_key columns

-- Drop old column
ALTER TABLE public.devices
DROP COLUMN IF EXISTS api_key;

ALTER TABLE public.devices
DROP COLUMN IF EXISTS api_key_hash;

-- Drop old indexes
DROP INDEX IF EXISTS public.idx_devices_api_key_hash;

-- Drop legacy RPC functions (if any remain from v1.x)
DROP FUNCTION IF EXISTS public.verify_device_api_key(TEXT);

COMMENT ON TABLE public.devices IS
  'Device registry with composite IDs (PROJX-ESPY) scoped to projects.
   API authentication via device_key_hash (SHA-256 hashed).
   Old UUID and api_key columns removed in v3.0.';
```

### Step 4.2: Optimize Indexes

```sql
-- Migration: 20251112000300_optimize_indexes.sql

-- Drop partial indexes that are now redundant
DROP INDEX IF EXISTS public.idx_devices_connection_status;

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_devices_project_status
ON public.devices(project_id, connection_status)
WHERE connection_status != 'offline';

-- Create index for device lookup in heartbeat function
CREATE INDEX IF NOT EXISTS idx_devices_composite_project
ON public.devices(composite_device_id, project_id);

-- Analyze query performance
ANALYZE public.devices;
ANALYZE public.device_heartbeats;

-- Reindex for optimization
REINDEX INDEX CONCURRENTLY idx_devices_project_status;
REINDEX INDEX CONCURRENTLY idx_devices_composite_project;
```

### Step 4.3: Archive Migration Logs

```sql
-- Migration: 20251112000400_archive_migration_logs.sql

-- Create archive table
CREATE TABLE IF NOT EXISTS public.device_migration_log_archive (
  LIKE public.device_migration_log INCLUDING ALL
);

-- Archive completed migrations (after Phase 3 + 7 days)
INSERT INTO public.device_migration_log_archive
SELECT * FROM public.device_migration_log
WHERE migration_status = 'completed'
AND completed_at < NOW() - INTERVAL '7 days';

-- Purge archived records from active log
DELETE FROM public.device_migration_log
WHERE id IN (
  SELECT id FROM public.device_migration_log_archive
);

-- Create index for archive queries
CREATE INDEX IF NOT EXISTS idx_migration_archive_device_id
ON public.device_migration_log_archive(device_id);
```

---

## Data Migration Patterns & Best Practices

### Pattern 1: Phased Column Addition

**Why**: Allows zero-downtime deployment of new schema without changing business logic

```sql
-- Week 1: Add new columns (nullable, no defaults)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS project_id UUID;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS composite_device_id TEXT;

-- Week 2: Backfill old data (in batches to avoid table lock)
UPDATE devices SET composite_device_id = ... WHERE composite_device_id IS NULL LIMIT 1000;

-- Week 3: Make columns NOT NULL (after backfill complete)
ALTER TABLE devices ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE devices ALTER COLUMN composite_device_id SET NOT NULL;

-- Week 4: Drop old columns
ALTER TABLE devices DROP COLUMN IF EXISTS api_key;
```

**Why This Works**:
- Deployments don't wait for schema changes
- Backfill happens during normal traffic (no lock contention)
- Rollback easy at any phase (columns nullable = reversible)

---

### Pattern 2: Dual-Write During Transition

**Heartbeat Function (Phase 2-3)**:

```plpgsql
-- Accepts both old (UUID) and new (composite ID) formats
CREATE OR REPLACE FUNCTION device_heartbeat_dual_mode(
  device_identifier TEXT,  -- Can be UUID or "PROJ1-ESP5"
  device_key TEXT
)
RETURNS JSON AS $$
BEGIN
  -- Try composite ID first (new format)
  IF device_identifier LIKE 'PROJ%-%' THEN
    RETURN device_heartbeat_composite(device_identifier, device_key);
  ELSE
    -- Fall back to UUID (old format)
    RETURN device_heartbeat_uuid(device_identifier, device_key);
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Why This Works**:
- Old devices continue working without firmware update
- New devices use new format immediately
- No forced cutover date
- Graceful degradation in case of bugs

---

### Pattern 3: Audit Trail for Rollback

Every phase creates audit records:

```sql
INSERT INTO device_migration_log (device_id, old_device_id, new_device_id,
  migration_status, started_at, completed_at)
SELECT d.id, d.id::TEXT, d.composite_device_id, 'completed', NOW(), NOW()
FROM devices d
WHERE migrated_at IS NULL;
```

**Rollback Query**:

```sql
-- Show all migrations in last 24 hours
SELECT * FROM device_migration_log
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Rollback specific device (if needed)
UPDATE devices
SET composite_device_id = NULL, device_number = NULL
WHERE id = 'device-uuid-here'
AND EXISTS (
  SELECT 1 FROM device_migration_log
  WHERE device_id = devices.id
  AND created_at > NOW() - INTERVAL '1 hour'
);
```

---

## Backward Compatibility Strategies

### Strategy 1: UUID → Composite ID Mapper

```typescript
// Utility layer for transparent migration
export class DeviceIdentifier {
  // Detect format
  static isCompositeId(id: string): boolean {
    return /^PROJ\d+-ESP\d+$/.test(id);
  }

  static isUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}/.test(id);
  }

  // Query either format
  static async lookup(id: string) {
    if (this.isCompositeId(id)) {
      return await supabase
        .from('devices')
        .select('*')
        .eq('composite_device_id', id)
        .single();
    } else {
      return await supabase
        .from('devices')
        .select('*')
        .eq('id', id)
        .single();
    }
  }
}
```

### Strategy 2: View for Legacy Compatibility

```sql
-- Create view that hides migration complexity
CREATE VIEW devices_v2 AS
SELECT
  id as legacy_device_id,
  composite_device_id,
  COALESCE(composite_device_id, id::TEXT) as current_device_id,
  project_id,
  user_id,
  name,
  connection_status,
  last_seen_at
FROM public.devices;

-- Old code queries: SELECT * FROM devices_v2 WHERE legacy_device_id = $1;
-- New code queries: SELECT * FROM devices_v2 WHERE composite_device_id = $1;
```

---

## Testing Strategies

### Test 1: Heartbeat Acceptance Testing

```sql
-- Create test project and devices
INSERT INTO projects (user_id, name, project_id)
VALUES (auth.uid(), 'Test', 'PROJTST')
RETURNING id INTO @test_project;

INSERT INTO devices (user_id, project_id, name, device_number, composite_device_id)
VALUES (auth.uid(), @test_project, 'Test Device', 1, 'PROJTST-ESP1')
RETURNING id INTO @test_device;

-- Send heartbeat with composite ID
SELECT device_heartbeat_composite('PROJTST-ESP1', 'test-key');

-- Verify status updated
SELECT connection_status, last_seen_at
FROM devices WHERE id = @test_device;
```

### Test 2: Migration Rollback Testing

**Pre-migration**:
```bash
# Create snapshot
pg_dump -h localhost -U postgres -d serra > pre_migration_backup.sql

# Start transaction monitor
SELECT * FROM device_migration_log WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Post-migration**:
```bash
# If issues detected:
psql -h localhost -U postgres -d serra < pre_migration_backup.sql

# Or selective rollback:
UPDATE devices SET composite_device_id = NULL
WHERE id IN (SELECT device_id FROM device_migration_log
  WHERE migration_status = 'completed' AND completed_at > NOW() - INTERVAL '1 hour');
```

### Test 3: RLS Policy Verification

```sql
-- Test user can only see their own devices
SET ROLE authenticated; -- Simulate user
SET auth.uid() = 'user-123-uuid';

SELECT * FROM devices; -- Should only show devices where user_id = 'user-123-uuid'

-- Test service_role bypass
SET ROLE service_role;
SELECT COUNT(*) FROM devices; -- Should see all devices
```

---

## User Communication Timeline

### T-7 Days: Announcement
**Subject**: Upcoming System Upgrade - Device Management Simplified

"We're upgrading the device system to make ESP configuration easier. Here's what's changing:

- **Old format**: Device IDs are long UUIDs (e.g., 550e8400-...)
- **New format**: Device IDs are simple codes (e.g., PROJ1-ESP5)
- **When**: [Date] 2:00 AM UTC (30 min maintenance window)
- **Impact**: Devices will be offline for ~30 minutes during migration
- **Benefits**:
  - Simpler device configuration (hardcode in firmware)
  - Project-based organization (multiple greenhouses)
  - QR codes now encode full device ID

No action needed from you - migration is automatic."

### T-1 Day: Reminder
"Reminder: Device system maintenance tomorrow 2:00 AM UTC. All devices will be temporarily offline."

### T+0: Real-Time Updates
"Maintenance started. Devices offline until 2:30 AM UTC."

### T+30min: Completion
"Maintenance complete. All devices back online with new simplified IDs."

### T+7 Days: Feature Highlight
"Migration successful! Try the new device registration with projects [LINK]"

---

## Monitoring During Migration

### Metrics to Track

**Pre-Migration Baseline** (establish 24 hours before):
```sql
SELECT
  COUNT(*) as total_devices,
  COUNT(CASE WHEN connection_status = 'online' THEN 1 END) as online_devices,
  COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '5 min' THEN 1 END) as active_devices,
  MAX(last_seen_at) as latest_heartbeat,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_seen_at))) as avg_offline_duration
FROM devices;
```

**During Migration** (every 5 minutes):
```sql
-- Query same metric to track changes
-- Alert if:
--   - online_devices drops below 80% of baseline
--   - heartbeat latency increases >1s
--   - composite_device_id is NULL and it shouldn't be
```

**Post-Migration**:
```sql
-- Verify migration completeness
SELECT
  COUNT(CASE WHEN composite_device_id IS NULL THEN 1 END) as unmigrated_devices,
  COUNT(CASE WHEN project_id IS NULL THEN 1 END) as unprojects_devices,
  COUNT(DISTINCT device_migration_log.device_id) as migrated_count
FROM devices
LEFT JOIN device_migration_log ON devices.id = device_migration_log.device_id;
-- Should show: 0, 0, [all_devices]
```

---

## Rollback Decision Tree

```
Is migration complete? (all devices have composite_device_id)
├─ NO → Still in Phase 1-2
│   └─ Do nothing (no data changed yet)
│
└─ YES → In Phase 3 or later
    ├─ Are old heartbeats still working? (UUID-based)
    │  ├─ NO → Rollback using Phase 3.1 rollback script
    │  │        Restore from backup
    │  │        Issue incident report
    │  │
    │  └─ YES → Continue
    │
    ├─ Are new heartbeats working? (composite ID-based)
    │  ├─ NO → Rollback using Phase 3.1 rollback script
    │  │        Frontend continues using UUID until hotfix
    │  │
    │  └─ YES → Continue
    │
    └─ Any data corruption detected?
       ├─ YES → Rollback using Phase 3.1 rollback script
       │        Restore pre-migration backup
       │        Investigate RLS policy issues
       │
       └─ NO → Migration successful!
               Proceed to Phase 4 after 7 days
```

---

## Risk Assessment

### High-Risk Areas

1. **RLS Policy Interactions**
   - Risk: Old policies query by `user_id`, new system by `project_id`
   - Mitigation: Test RLS with both UUID and composite ID lookups before Phase 3
   - Fallback: Revert to UUID-based queries in policies

2. **Heartbeat Race Conditions**
   - Risk: Device sends heartbeat during migration, gets NULL composite_device_id
   - Mitigation: Backfill composite IDs in short batches, handle NULL gracefully
   - Fallback: Keep `id` as fallback lookup key

3. **Application Query Chaos**
   - Risk: Frontend uses old UUID queries after deployment
   - Mitigation: Update services layer with composite-first, UUID-fallback logic
   - Fallback: Dual-write both `id` and `composite_device_id` columns

### Medium-Risk Areas

1. **Index Performance**
   - Risk: Old indexes no longer useful after migration
   - Mitigation: Create composite indexes before Phase 3
   - Monitoring: EXPLAIN ANALYZE every critical query

2. **Firmware Compatibility**
   - Risk: Old ESP firmware still sends UUID-based heartbeats
   - Mitigation: Edge Function accepts both formats until Phase 4
   - Deprecation: Add firmware version check, warn users

### Low-Risk Areas

1. **Project Table Unused**: Just sits there, no harm
2. **Device_number Collisions**: Unique constraint per project prevents issues
3. **Audit Log Bloat**: Archive table keeps system table lean

---

## Success Criteria

Migration is successful when:

- [x] All devices have `composite_device_id` populated
- [x] All devices have `project_id` assigned
- [x] Zero devices with NULL in either column
- [x] No duplicate composite device IDs
- [x] Heartbeats received for >95% of devices within 5 min post-migration
- [x] No new RLS policy violations detected
- [x] Queries using composite ID execute in <50ms (index verified)
- [x] Rollback tested and confirmed works (backup restored successfully)
- [x] Zero data corruption detected in integrity checks
- [x] All user tests pass (manual device addition, device status updates)

---

## Appendix A: SQL Helper Functions

### Batch Migration Helper

```sql
CREATE OR REPLACE FUNCTION migrate_devices_batch(batch_size INT DEFAULT 1000)
RETURNS TABLE (processed INT, failed INT, total_remaining INT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_processed INT := 0;
  v_failed INT := 0;
BEGIN
  -- Process batch of unmigrated devices
  BEGIN
    UPDATE devices
    SET composite_device_id = ...
    WHERE composite_device_id IS NULL
    LIMIT batch_size;

    GET DIAGNOSTICS v_processed = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_failed := batch_size;
  END;

  -- Count remaining
  SELECT COUNT(*) INTO total_remaining
  FROM devices WHERE composite_device_id IS NULL;

  -- Return metrics
  RETURN NEXT;
END;
$$;
```

### RLS Policy Audit

```sql
-- Check RLS effectiveness during migration
SELECT
  u.id as user_id,
  COUNT(d.id) as visible_devices,
  COUNT(CASE WHEN d.user_id = u.id THEN 1 END) as owned_devices
FROM auth.users u
CROSS JOIN LATERAL (
  SELECT id, user_id FROM devices
  -- Simulate query with current user context
) d
GROUP BY u.id
HAVING COUNT(d.id) != COUNT(CASE WHEN d.user_id = u.id THEN 1 END);
-- Should return zero rows (all visible devices = owned devices)
```

---

## Appendix B: Complete Rollback Script

```sql
-- FULL ROLLBACK: Restore system to Phase 1
-- Use if migrations fail catastrophically

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Delete phase 3 changes
DELETE FROM device_migration_log;
UPDATE devices SET composite_device_id = NULL, device_number = NULL, project_id = NULL;

-- Step 2: Delete phase 2 functions
DROP FUNCTION IF EXISTS create_project(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_next_project_id() CASCADE;
DROP FUNCTION IF EXISTS get_available_device_ids(UUID) CASCADE;
DROP FUNCTION IF EXISTS register_device_with_project(TEXT, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS device_heartbeat_composite(TEXT, TEXT) CASCADE;

-- Step 3: Delete phase 1 tables
DROP TABLE IF EXISTS device_migration_log;
DROP TABLE IF EXISTS projects;

-- Step 4: Restore Edge Function to v2.1
-- (manually redeploy device-heartbeat function to use UUID-based lookups)

-- Step 5: Verify rollback
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
    RAISE EXCEPTION 'Rollback failed: projects table still exists';
  END IF;

  IF EXISTS (SELECT composite_device_id FROM devices WHERE composite_device_id IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Rollback failed: composite_device_ids still populated';
  END IF;

  RAISE NOTICE 'Rollback successful - system restored to v2.1 (UUID-based)';
END $$;

COMMIT;
```

---

## Conclusion

This migration strategy provides:

1. **Zero-downtime in Phases 1-2**: New schema coexists with old system
2. **Planned downtime in Phase 3**: Single 30-minute maintenance window with full rollback capability
3. **Graceful cleanup in Phase 4**: Old columns removed 1+ week after successful migration
4. **Comprehensive testing**: Each phase includes verification and audit trails
5. **Risk mitigation**: Rollback procedures at every step, monitoring dashboards, user communication

The phased approach reduces risk by limiting the scope of changes in any single deployment, while the dual-write system ensures devices continue functioning regardless of migration status.

