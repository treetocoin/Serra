# Migration SQL Scripts - Ready-to-Deploy

This document contains all SQL migration scripts organized by phase, ready to execute in Supabase SQL Editor.

**IMPORTANT**:
- Read MIGRATION_STRATEGY.md first for context
- Execute scripts in order within each phase
- Each script has rollback instructions
- Test against branch database first

---

## Phase 1: Schema Expansion

All scripts in this phase are **zero-downtime** and **fully reversible**.

### Phase 1.0: Enable Required Extensions

```sql
-- Migration: 20251112000000_enable_extensions.sql
-- Description: Enable required PostgreSQL extensions

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions (for hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- No migration log yet - just enable extensions
```

**Test**:
```sql
SELECT uuid_generate_v4(); -- Should return a UUID
SELECT encode(digest('test', 'sha256'), 'hex'); -- Should return SHA256 hash
```

**Rollback**: Extensions cannot be dropped if in use. Skip if issues occur.

---

### Phase 1.1: Create Projects Table

```sql
-- Migration: 20251112000001_add_projects_table.sql
-- Description: Create projects table for multi-greenhouse support
-- Reversibility: FULL - can be dropped without affecting devices table

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  project_id TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT project_id_format CHECK (project_id ~ '^PROJ[0-9]+$')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_id ON public.projects(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects(name);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Grant permissions
GRANT ALL ON public.projects TO authenticated;

-- Comments
COMMENT ON TABLE public.projects IS
  'Containers for devices organized by location/greenhouse.
   Project ID globally unique (PROJ1, PROJ2, etc.).
   Project name globally unique.';

COMMENT ON COLUMN public.projects.project_id IS
  'Globally unique project identifier format PROJN (e.g., PROJ1, PROJ2).
   Generated sequentially on creation.';

-- Test
DO $$
BEGIN
  RAISE NOTICE 'Projects table created successfully';
  RAISE NOTICE 'RLS policies enabled';
  RAISE NOTICE 'Indexes created';
END $$;
```

**Verification**:
```sql
SELECT * FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'projects';
-- Should return 1 row

SELECT * FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'projects';
-- Should show CHECK constraint for project_id format
```

**Rollback**:
```sql
-- Phase 1.1 ROLLBACK
DROP TABLE IF EXISTS public.projects CASCADE;
-- Verify dropped
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'projects';
-- Should return 0
```

---

### Phase 1.2: Add Columns to Devices Table

```sql
-- Migration: 20251112000002_add_project_columns_to_devices.sql
-- Description: Add project relationship columns (nullable during transition)
-- Reversibility: FULL - columns can be dropped

-- Add project reference (nullable)
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add composite device ID (nullable, unique)
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS composite_device_id TEXT UNIQUE;

-- Add device number within project (1-20, nullable)
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS device_number INTEGER CHECK (device_number >= 1 AND device_number <= 20);

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_devices_project_id ON public.devices(project_id);

CREATE INDEX IF NOT EXISTS idx_devices_composite_id
ON public.devices(composite_device_id)
WHERE composite_device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_devices_project_number
ON public.devices(project_id, device_number)
WHERE project_id IS NOT NULL;

-- Verify columns added
DO $$
BEGIN
  RAISE NOTICE 'Columns added to devices table:';
  RAISE NOTICE '  - project_id (nullable UUID)';
  RAISE NOTICE '  - composite_device_id (nullable TEXT UNIQUE)';
  RAISE NOTICE '  - device_number (nullable INTEGER 1-20)';
  RAISE NOTICE 'Indexes created for performance';
END $$;
```

**Verification**:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'devices'
AND column_name IN ('project_id', 'composite_device_id', 'device_number');
-- Should show 3 rows, all nullable=true
```

**Rollback**:
```sql
-- Phase 1.2 ROLLBACK
ALTER TABLE public.devices
DROP COLUMN IF EXISTS project_id CASCADE;

ALTER TABLE public.devices
DROP COLUMN IF EXISTS composite_device_id CASCADE;

ALTER TABLE public.devices
DROP COLUMN IF EXISTS device_number CASCADE;

DROP INDEX IF EXISTS idx_devices_project_id;
DROP INDEX IF EXISTS idx_devices_composite_id;
DROP INDEX IF EXISTS idx_devices_project_number;
```

---

### Phase 1.3: Create Migration Audit Table

```sql
-- Migration: 20251112000003_add_device_migration_log.sql
-- Description: Audit trail for migration tracking
-- Reversibility: FULL - standalone table

CREATE TABLE IF NOT EXISTS public.device_migration_log (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  old_device_id TEXT NOT NULL,
  new_device_id TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  migration_status TEXT DEFAULT 'pending' CHECK (migration_status IN
    ('pending', 'in_progress', 'completed', 'failed', 'rollback')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT migration_status_transitions CHECK (
    (migration_status NOT IN ('completed', 'failed') OR completed_at IS NOT NULL)
    AND
    (migration_status IN ('pending', 'in_progress') OR started_at IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_migration_log_device_id
ON public.device_migration_log(device_id);

CREATE INDEX IF NOT EXISTS idx_migration_log_status
ON public.device_migration_log(migration_status);

CREATE INDEX IF NOT EXISTS idx_migration_log_created_at
ON public.device_migration_log(created_at DESC);

-- Comments
COMMENT ON TABLE public.device_migration_log IS
  'Audit trail for device ID migration from UUID to composite format.
   Tracks every device migration: start time, status, errors, completion.
   Used for troubleshooting and rollback decisions.';

-- Test
DO $$
BEGIN
  RAISE NOTICE 'Device migration log table created';
  RAISE NOTICE 'Audit trail ready for Phase 3 backfill';
END $$;
```

**Rollback**:
```sql
-- Phase 1.3 ROLLBACK
DROP TABLE IF EXISTS public.device_migration_log CASCADE;
```

---

## Phase 2: Dual-Write System

These scripts can be deployed after Phase 1 is fully deployed and tested (24+ hours).

### Phase 2.0: Create Project Management Functions

```sql
-- Migration: 20251112000010_create_project_functions.sql
-- Description: Functions for project creation and management
-- Reversibility: FULL - functions can be dropped

-- Function 1: Generate next project ID
CREATE OR REPLACE FUNCTION public.get_next_project_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  next_num INT;
  next_id TEXT;
BEGIN
  -- Lock projects table to prevent race conditions
  LOCK TABLE public.projects IN EXCLUSIVE MODE;

  -- Find maximum number from existing project IDs
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_id FROM 5) AS INTEGER)), 0)
  INTO next_num
  FROM public.projects;

  -- Increment and format
  next_id := 'PROJ' || (next_num + 1)::TEXT;

  RETURN next_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_project_id()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_next_project_id() IS
  'Generates next sequential project ID (PROJ1, PROJ2, etc.).
   Acquires exclusive lock to prevent duplicate IDs.
   Globally unique across entire system.';

-- Function 2: Create new project
CREATE OR REPLACE FUNCTION public.create_project(
  name_param TEXT,
  description_param TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
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
  -- Validate user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to create projects';
  END IF;

  -- Check name length
  IF name_param IS NULL OR TRIM(name_param) = '' THEN
    RAISE EXCEPTION 'Project name cannot be empty';
  END IF;

  IF LENGTH(name_param) > 100 THEN
    RAISE EXCEPTION 'Project name cannot exceed 100 characters';
  END IF;

  -- Check for duplicate name
  IF EXISTS (SELECT 1 FROM public.projects WHERE LOWER(name) = LOWER(name_param)) THEN
    RAISE EXCEPTION 'Project name already exists. Choose a different name.'
      USING HINT = 'Project names must be globally unique.';
  END IF;

  -- Get next project ID
  next_id := public.get_next_project_id();

  -- Insert project
  INSERT INTO public.projects (user_id, name, project_id, description)
  VALUES (auth.uid(), TRIM(name_param), next_id, TRIM(description_param))
  RETURNING projects.id INTO new_project_id;

  -- Return created project
  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.project_id,
    p.name,
    p.description,
    p.created_at
  FROM public.projects p
  WHERE p.id = new_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.create_project(TEXT, TEXT) IS
  'Creates new project with auto-generated globally unique ID.
   Enforces unique project names across entire system.
   Returns complete project info including generated project_id.';

-- Test
DO $$
DECLARE
  test_project RECORD;
BEGIN
  -- Test get_next_project_id
  RAISE NOTICE 'Test: get_next_project_id() = %', public.get_next_project_id();

  -- Cannot fully test create_project without auth context
  RAISE NOTICE 'Functions created successfully';
  RAISE NOTICE 'Test create_project in application context';
END $$;
```

**Verification**:
```sql
-- Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_next_project_id', 'create_project');
-- Should return 2 rows
```

**Rollback**:
```sql
-- Phase 2.0 ROLLBACK
DROP FUNCTION IF EXISTS public.create_project(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_project_id() CASCADE;
```

---

### Phase 2.1: Create Device Management Functions

```sql
-- Migration: 20251112000011_create_device_functions.sql
-- Description: Functions for device registration in projects
-- Reversibility: FULL - functions can be dropped

-- Function 1: Get available device IDs for a project
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
STABLE
AS $$
DECLARE
  project_project_id TEXT;
BEGIN
  -- Get the project_id (PROJ1, PROJ2, etc.)
  SELECT p.project_id
  INTO project_project_id
  FROM public.projects p
  WHERE p.id = project_id_param AND p.user_id = auth.uid();

  IF project_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or not owned by current user'
      USING HINT = 'Ensure project ID is correct and you are the project owner.';
  END IF;

  -- Return all device numbers (1-20) with availability
  RETURN QUERY
  SELECT
    nums.num::INTEGER AS device_number,
    (project_project_id || '-ESP' || nums.num::TEXT)::TEXT AS device_id,
    NOT EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.project_id = project_id_param
      AND d.device_number = nums.num
    )::BOOLEAN AS is_available
  FROM (SELECT GENERATE_SERIES(1, 20) AS num) nums
  ORDER BY nums.num;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_device_ids(UUID)
  TO authenticated;

COMMENT ON FUNCTION public.get_available_device_ids(UUID) IS
  'Returns all device numbers (1-20) for a project with availability.
   Shows which device IDs (ESP1-ESP20) can be registered in this project.';

-- Function 2: Register device in project
CREATE OR REPLACE FUNCTION public.register_device_with_project(
  name_param TEXT,
  project_id_param UUID,
  device_number_param INTEGER
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  composite_device_id TEXT,
  project_id UUID,
  device_number INTEGER,
  connection_status TEXT,
  registered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_project_id TEXT;
  composite_id TEXT;
BEGIN
  -- Validate user owns the project
  SELECT p.project_id
  INTO project_project_id
  FROM public.projects p
  WHERE p.id = project_id_param AND p.user_id = auth.uid();

  IF project_project_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or not owned by current user';
  END IF;

  -- Validate device name
  IF name_param IS NULL OR TRIM(name_param) = '' THEN
    RAISE EXCEPTION 'Device name cannot be empty';
  END IF;

  IF LENGTH(name_param) > 100 THEN
    RAISE EXCEPTION 'Device name cannot exceed 100 characters';
  END IF;

  -- Validate device number range
  IF device_number_param < 1 OR device_number_param > 20 THEN
    RAISE EXCEPTION 'Device number must be between 1 and 20'
      USING HINT = 'Valid range: ESP1 through ESP20.';
  END IF;

  -- Check device number not already registered in this project
  IF EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.project_id = project_id_param
    AND d.device_number = device_number_param
  ) THEN
    RAISE EXCEPTION 'Device ESP% already registered in project %',
      device_number_param, project_project_id
      USING HINT = 'This device ID is already in use. Choose a different number.';
  END IF;

  -- Build composite device ID
  composite_id := project_project_id || '-ESP' || device_number_param::TEXT;

  -- Insert device
  INSERT INTO public.devices (
    user_id,
    name,
    project_id,
    device_number,
    composite_device_id,
    connection_status
  )
  VALUES (
    auth.uid(),
    TRIM(name_param),
    project_id_param,
    device_number_param,
    composite_id,
    'offline'
  )
  RETURNING
    devices.id,
    devices.user_id,
    devices.name,
    devices.composite_device_id,
    devices.project_id,
    devices.device_number,
    devices.connection_status,
    devices.registered_at
  INTO id, user_id, name, composite_device_id, project_id, device_number,
       connection_status, registered_at;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_with_project(TEXT, UUID, INTEGER)
  TO authenticated;

COMMENT ON FUNCTION public.register_device_with_project(TEXT, UUID, INTEGER) IS
  'Registers new device in project using composite ID format (PROJ1-ESP5).
   Enforces uniqueness of device_number within project.
   Device starts in "offline" state pending physical ESP connection.';
```

**Rollback**:
```sql
-- Phase 2.1 ROLLBACK
DROP FUNCTION IF EXISTS public.register_device_with_project(TEXT, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_available_device_ids(UUID) CASCADE;
```

---

### Phase 2.2: Create Heartbeat Handler for Composite IDs

```sql
-- Migration: 20251112000012_create_heartbeat_function.sql
-- Description: Heartbeat handler for composite device IDs
-- Reversibility: FULL - function can be dropped

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
  result JSON;
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

  -- Validate device key if provided and hash exists
  IF device_key_param IS NOT NULL AND stored_key_hash IS NOT NULL AND stored_key_hash != '' THEN
    -- Compute hash of provided key
    computed_hash := encode(digest(device_key_param, 'sha256'), 'hex');

    IF computed_hash != stored_key_hash THEN
      RAISE EXCEPTION 'Invalid device key for device: %', composite_device_id_param
        USING HINT = 'Device key does not match stored hash.';
    END IF;
  END IF;

  -- Update device status
  UPDATE public.devices
  SET
    connection_status = 'online',
    last_seen_at = NOW()
  WHERE id = device_id_val;

  -- Build response
  result := json_build_object(
    'success', true,
    'device_id', device_id_val,
    'composite_id', composite_device_id_param,
    'status', 'online',
    'previous_status', old_status,
    'timestamp', NOW()::TEXT
  );

  -- Log status change if transitioned
  IF old_status IS DISTINCT FROM 'online' THEN
    INSERT INTO public.device_migration_log (
      device_id,
      old_device_id,
      new_device_id,
      migration_status
    )
    VALUES (
      device_id_val,
      device_id_val::TEXT,
      composite_device_id_param,
      'completed'
    );
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.device_heartbeat_composite(TEXT, TEXT)
  TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.device_heartbeat_composite(TEXT, TEXT) IS
  'Process heartbeat using composite device ID (PROJ1-ESP5 format).
   Validates device key if provided (optional for backward compatibility).
   Updates device status to online and logs transition.';
```

**Verification**:
```sql
-- Check function exists and grants
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'device_heartbeat_composite';
-- Should return 1 row
```

**Rollback**:
```sql
-- Phase 2.2 ROLLBACK
DROP FUNCTION IF EXISTS public.device_heartbeat_composite(TEXT, TEXT) CASCADE;
```

---

## Phase 3: Data Migration

Execute during scheduled maintenance window only.

### Phase 3.0: Pre-Migration Checks

```sql
-- Migration: 20251112000020_pre_migration_verification.sql
-- Description: Verify system state before migration
-- DOES NOT MODIFY DATA - Safe to run anytime

-- Check 1: Verify schema is complete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    RAISE EXCEPTION 'STOP: projects table missing. Run Phase 1.1 first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices'
    AND column_name = 'composite_device_id'
  ) THEN
    RAISE EXCEPTION 'STOP: composite_device_id column missing. Run Phase 1.2 first.';
  END IF;

  RAISE NOTICE 'PASS: Schema verification complete';
END $$;

-- Check 2: Verify functions exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'device_heartbeat_composite'
  ) THEN
    RAISE EXCEPTION 'STOP: device_heartbeat_composite function missing. Run Phase 2.2 first.';
  END IF;

  RAISE NOTICE 'PASS: Functions verification complete';
END $$;

-- Check 3: Baseline metrics
DO $$
DECLARE
  total_devices INT;
  devices_with_uuid_only INT;
  devices_with_project INT;
BEGIN
  SELECT COUNT(*) INTO total_devices FROM public.devices;
  SELECT COUNT(*) INTO devices_with_uuid_only
  FROM public.devices WHERE composite_device_id IS NULL;
  SELECT COUNT(*) INTO devices_with_project
  FROM public.devices WHERE project_id IS NOT NULL;

  RAISE NOTICE 'PRE-MIGRATION BASELINE:';
  RAISE NOTICE '  Total devices: %', total_devices;
  RAISE NOTICE '  Devices with UUID only: %', devices_with_uuid_only;
  RAISE NOTICE '  Devices with project: %', devices_with_project;
  RAISE NOTICE '';
  RAISE NOTICE 'Expected after migration:';
  RAISE NOTICE '  Devices with UUID only: 0';
  RAISE NOTICE '  Devices with project: %', total_devices;
END $$;

-- Check 4: Verify database state
DO $$
DECLARE
  duplicate_composite_count INT;
  duplicate_project_names INT;
  duplicate_project_ids INT;
BEGIN
  -- Check for duplicate composite IDs (should be 0)
  SELECT COUNT(*) INTO duplicate_composite_count
  FROM (
    SELECT composite_device_id FROM public.devices
    WHERE composite_device_id IS NOT NULL
    GROUP BY composite_device_id HAVING COUNT(*) > 1
  ) t;

  -- Check for duplicate project names (should be 0 - UNIQUE constraint)
  SELECT COUNT(*) INTO duplicate_project_names
  FROM (
    SELECT name FROM public.projects
    GROUP BY name HAVING COUNT(*) > 1
  ) t;

  -- Check for duplicate project IDs (should be 0 - UNIQUE constraint)
  SELECT COUNT(*) INTO duplicate_project_ids
  FROM (
    SELECT project_id FROM public.projects
    GROUP BY project_id HAVING COUNT(*) > 1
  ) t;

  IF duplicate_composite_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % duplicate composite IDs detected', duplicate_composite_count;
  END IF;

  IF duplicate_project_names > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % duplicate project names detected', duplicate_project_names;
  END IF;

  IF duplicate_project_ids > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % duplicate project IDs detected', duplicate_project_ids;
  END IF;

  RAISE NOTICE 'PASS: Data integrity check complete - no duplicates found';
END $$;

-- Summary
RAISE NOTICE '========================================';
RAISE NOTICE 'PRE-MIGRATION VERIFICATION COMPLETE';
RAISE NOTICE 'Safe to proceed with migration';
RAISE NOTICE '========================================';
```

**Run this script**:
```bash
# In Supabase SQL Editor, copy-paste the entire script and execute
# Should see:
#   PASS: Schema verification complete
#   PASS: Functions verification complete
#   PRE-MIGRATION BASELINE: ...
#   PASS: Data integrity check complete - no duplicates found
#   PRE-MIGRATION VERIFICATION COMPLETE
```

---

### Phase 3.1: Device Migration

```sql
-- Migration: 20251112000021_migrate_devices_to_composite.sql
-- Description: Create projects for existing devices and generate composite IDs
-- REVERSIBILITY: FULL - see Phase 3.2 rollback script
-- EXECUTION TIME: ~5-30 seconds depending on device count
-- DOWNTIME: 30-60 seconds (devices offline during migration)

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- =====================================================
-- STEP 1: Create Default Project for Legacy Devices
-- =====================================================

-- This groups all existing devices without a project under "PROJ0"
INSERT INTO public.projects (user_id, name, project_id, description)
SELECT DISTINCT
  d.user_id,
  'Legacy Devices' AS name,
  'PROJ0' AS project_id,
  'Auto-created for devices registered before project system' AS description
FROM public.devices d
WHERE d.project_id IS NULL
ON CONFLICT (project_id) DO NOTHING;

-- Verify creation
DO $$
DECLARE
  created_count INT;
BEGIN
  SELECT COUNT(*) INTO created_count
  FROM public.projects WHERE project_id = 'PROJ0';

  RAISE NOTICE 'Created % PROJ0 projects for legacy device owners', created_count;
END $$;

-- =====================================================
-- STEP 2: Assign Devices to Legacy Project
-- =====================================================

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

-- Verify assignment
DO $$
DECLARE
  assigned_count INT;
  still_null INT;
BEGIN
  SELECT COUNT(*) INTO assigned_count
  FROM public.devices WHERE project_id IS NOT NULL;

  SELECT COUNT(*) INTO still_null
  FROM public.devices WHERE project_id IS NULL;

  RAISE NOTICE 'Assigned % devices to projects', assigned_count;

  IF still_null > 0 THEN
    RAISE EXCEPTION 'ERROR: % devices still unassigned', still_null;
  END IF;
END $$;

-- =====================================================
-- STEP 3: Generate Composite Device IDs
-- =====================================================

-- Assign sequential numbers to devices within each project
-- based on registration order
WITH device_numbering AS (
  SELECT
    d.id,
    d.project_id,
    p.project_id AS proj_code,
    ROW_NUMBER() OVER (PARTITION BY d.project_id ORDER BY d.registered_at ASC) AS seq_num
  FROM public.devices d
  JOIN public.projects p ON p.id = d.project_id
  WHERE d.composite_device_id IS NULL
)
UPDATE public.devices d
SET
  device_number = dn.seq_num,
  composite_device_id = dn.proj_code || '-ESP' || dn.seq_num::TEXT
FROM device_numbering dn
WHERE d.id = dn.id;

-- Verify generation
DO $$
DECLARE
  generated_count INT;
  still_null INT;
BEGIN
  SELECT COUNT(*) INTO generated_count
  FROM public.devices WHERE composite_device_id IS NOT NULL;

  SELECT COUNT(*) INTO still_null
  FROM public.devices WHERE composite_device_id IS NULL;

  RAISE NOTICE 'Generated composite IDs for % devices', generated_count;

  IF still_null > 0 THEN
    RAISE EXCEPTION 'ERROR: % devices still lack composite IDs', still_null;
  END IF;
END $$;

-- =====================================================
-- STEP 4: Add NOT NULL Constraints
-- =====================================================

-- Now that all devices have values, make columns required
ALTER TABLE public.devices
ALTER COLUMN composite_device_id SET NOT NULL;

ALTER TABLE public.devices
ALTER COLUMN project_id SET NOT NULL;

RAISE NOTICE 'Columns now required: composite_device_id, project_id';

-- =====================================================
-- STEP 5: Data Integrity Verification
-- =====================================================

DO $$
DECLARE
  duplicate_count INT;
  devices_count INT;
  migrated_count INT;
  expected_count INT;
BEGIN
  -- Check for duplicates
  SELECT COUNT(DISTINCT composite_device_id)
  INTO migrated_count
  FROM public.devices;

  SELECT COUNT(*)
  INTO devices_count
  FROM public.devices;

  IF migrated_count != devices_count THEN
    RAISE EXCEPTION 'DUPLICATE composite IDs detected: % unique vs % total',
      migrated_count, devices_count;
  END IF;

  -- Verify all have project_id
  SELECT COUNT(*)
  INTO duplicate_count
  FROM public.devices
  WHERE project_id IS NULL;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'ERROR: % devices still lack project_id', duplicate_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE - DATA INTEGRITY OK';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migrated %devices', devices_count;
  RAISE NOTICE 'All devices have:';
  RAISE NOTICE '  - composite_device_id (PROJ0-ESPX, PROJ1-ESPX, etc.)';
  RAISE NOTICE '  - project_id (UUID reference)';
  RAISE NOTICE '  - device_number (1-20 within project)';
  RAISE NOTICE '';
  RAISE NOTICE 'Devices are now offline during transaction.';
  RAISE NOTICE 'Heartbeats will resume after COMMIT.';
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION: Verify Data
-- =====================================================

-- Sample of migrated devices
RAISE NOTICE 'Sample of migrated devices:';
SELECT composite_device_id, name, connection_status, device_number
FROM public.devices
LIMIT 5;
```

**Execution Notes**:
- Takes 30-60 seconds depending on device count
- All devices offline during transaction (they can't send heartbeats)
- After COMMIT, devices can resume sending heartbeats
- Must execute during scheduled maintenance window

**Post-Migration Verification**:
```sql
-- Run immediately after COMMIT to verify
SELECT
  COUNT(*) as total_devices,
  COUNT(CASE WHEN composite_device_id IS NOT NULL THEN 1 END) as with_composite_id,
  COUNT(CASE WHEN project_id IS NOT NULL THEN 1 END) as with_project,
  COUNT(CASE WHEN composite_device_id IS NULL THEN 1 END) as unmigrated
FROM public.devices;

-- Should show: total_devices = with_composite_id = with_project, unmigrated = 0
```

---

### Phase 3.2: Rollback Script

```sql
-- ROLLBACK: 20251112000021_migrate_devices_to_composite.sql
-- Description: Restore devices to pre-migration state
-- EXECUTION TIME: 5-30 seconds
-- WARNING: Only use if migration failed or shows data corruption

BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Step 1: Drop NOT NULL constraints
ALTER TABLE public.devices
ALTER COLUMN composite_device_id DROP NOT NULL;

ALTER TABLE public.devices
ALTER COLUMN project_id DROP NOT NULL;

-- Step 2: Clear migration data
UPDATE public.devices
SET
  composite_device_id = NULL,
  device_number = NULL,
  project_id = NULL;

-- Step 3: Remove PROJ0 projects
DELETE FROM public.projects
WHERE project_id = 'PROJ0';

-- Step 4: Verify rollback
DO $$
DECLARE
  null_composite INT;
  null_project INT;
  proj0_count INT;
BEGIN
  SELECT COUNT(*) INTO null_composite
  FROM public.devices WHERE composite_device_id IS NULL;

  SELECT COUNT(*) INTO null_project
  FROM public.devices WHERE project_id IS NULL;

  SELECT COUNT(*) INTO proj0_count
  FROM public.projects WHERE project_id = 'PROJ0';

  RAISE NOTICE 'ROLLBACK COMPLETE:';
  RAISE NOTICE '  Devices with NULL composite_device_id: %', null_composite;
  RAISE NOTICE '  Devices with NULL project_id: %', null_project;
  RAISE NOTICE '  PROJ0 projects remaining: %', proj0_count;

  IF null_composite = 0 OR null_project = 0 OR proj0_count > 0 THEN
    RAISE EXCEPTION 'Rollback verification FAILED - data not restored';
  END IF;
END $$;

COMMIT;

RAISE NOTICE 'System restored to pre-migration state.';
```

---

## Phase 4: Cleanup (Optional - execute 1+ week after Phase 3)

### Phase 4.0: Remove API Key Columns

```sql
-- Migration: 20251112000030_remove_api_key_columns.sql
-- Description: Remove deprecated API key columns
-- Prerequisites: All devices migrated (Phase 3 complete)
-- Reversibility: REQUIRES BACKUP - columns cannot be recovered

-- WARNING: Only run after confirming:
-- 1. All devices use device_key_hash (API keys deprecated)
-- 2. No firmware uses api_key_hash anymore
-- 3. Full database backup exists

DO $$
BEGIN
  RAISE WARNING 'This migration PERMANENTLY DELETES api_key columns.';
  RAISE WARNING 'Ensure database backup exists before proceeding.';
  RAISE WARNING '';
  RAISE WARNING 'Verify readiness:';
  RAISE WARNING '1. Check migration_log: SELECT COUNT(*) FROM device_migration_log;';
  RAISE WARNING '2. Check no api_key references in code';
  RAISE WARNING '3. Confirm backup: pg_dump -f backup.sql';
END $$;

-- Drop columns (if they exist)
ALTER TABLE public.devices
DROP COLUMN IF EXISTS api_key CASCADE;

ALTER TABLE public.devices
DROP COLUMN IF EXISTS api_key_hash CASCADE;

-- Drop any indexes related to api_key
DROP INDEX IF EXISTS idx_devices_api_key;
DROP INDEX IF EXISTS idx_devices_api_key_hash;

-- Drop any functions using api_key
DROP FUNCTION IF EXISTS verify_device_api_key(TEXT) CASCADE;

RAISE NOTICE 'API key columns and functions removed.';
RAISE NOTICE 'System now uses device_key_hash exclusively.';
```

---

## Testing & Validation Scripts

### Test Script 1: Full Phase Verification

```sql
-- Script: Validate all migration phases are complete
-- Safe to run anytime - read-only queries only

DO $$
DECLARE
  phase1_ok BOOLEAN;
  phase2_ok BOOLEAN;
  phase3_ok BOOLEAN;
  phase4_ok BOOLEAN;
BEGIN
  -- Phase 1: Check schema exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) INTO phase1_ok;

  -- Phase 2: Check functions exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name = 'device_heartbeat_composite'
  ) INTO phase2_ok;

  -- Phase 3: Check devices migrated
  SELECT NOT EXISTS (
    SELECT 1 FROM public.devices
    WHERE composite_device_id IS NULL
  ) INTO phase3_ok;

  -- Phase 4: Check API key columns removed
  SELECT NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices'
    AND column_name IN ('api_key', 'api_key_hash')
  ) INTO phase4_ok;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION PHASE STATUS:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 1 (Schema): %', CASE WHEN phase1_ok THEN 'COMPLETE' ELSE 'PENDING' END;
  RAISE NOTICE 'Phase 2 (Functions): %', CASE WHEN phase2_ok THEN 'COMPLETE' ELSE 'PENDING' END;
  RAISE NOTICE 'Phase 3 (Migration): %', CASE WHEN phase3_ok THEN 'COMPLETE' ELSE 'PENDING' END;
  RAISE NOTICE 'Phase 4 (Cleanup): %', CASE WHEN phase4_ok THEN 'COMPLETE' ELSE 'PENDING' END;
  RAISE NOTICE '========================================';
END $$;
```

---

## Quick Reference: Expected Output

### After Phase 1 (Schema Ready)
```
Phase 1 (Schema): COMPLETE
Phase 2 (Functions): PENDING
Phase 3 (Migration): PENDING
Phase 4 (Cleanup): PENDING
```

### After Phase 2 (Functions Ready)
```
Phase 1 (Schema): COMPLETE
Phase 2 (Functions): COMPLETE
Phase 3 (Migration): PENDING
Phase 4 (Cleanup): PENDING
```

### After Phase 3 (Migration Done)
```
Phase 1 (Schema): COMPLETE
Phase 2 (Functions): COMPLETE
Phase 3 (Migration): COMPLETE
Phase 4 (Cleanup): PENDING
```

### After Phase 4 (Cleanup Done)
```
Phase 1 (Schema): COMPLETE
Phase 2 (Functions): COMPLETE
Phase 3 (Migration): COMPLETE
Phase 4 (Cleanup): COMPLETE
```

---

## Emergency Commands

### Check Migration Status
```sql
SELECT
  COUNT(*) as total_devices,
  COUNT(CASE WHEN composite_device_id IS NOT NULL THEN 1 END) as migrated,
  COUNT(CASE WHEN composite_device_id IS NULL THEN 1 END) as pending
FROM public.devices;
```

### Stop All Heartbeats (emergency)
```sql
-- Temporarily disable Edge Function (in Supabase dashboard)
-- Or block at table level:
ALTER TABLE public.device_heartbeats DISABLE ROW LEVEL SECURITY;
```

### Restart Heartbeats
```sql
ALTER TABLE public.device_heartbeats ENABLE ROW LEVEL SECURITY;
```

### View Recent Heartbeats
```sql
SELECT
  d.composite_device_id,
  d.connection_status,
  d.last_seen_at,
  COUNT(dh.id) as heartbeat_count
FROM devices d
LEFT JOIN device_heartbeats dh ON d.id = dh.device_id
WHERE dh.ts > NOW() - INTERVAL '5 minutes'
GROUP BY d.id, d.composite_device_id, d.connection_status, d.last_seen_at
ORDER BY dh.ts DESC
LIMIT 20;
```

