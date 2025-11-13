-- Migration: RPC Function - register_device_with_project()
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Registers a new device within a project with auto-generated device key

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_composite_id TEXT;
  v_device_key TEXT;
  v_device_key_hash TEXT;
  v_new_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required. Authentication may have failed.';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Device name cannot be empty';
  END IF;

  IF p_project_id IS NULL OR trim(p_project_id) = '' THEN
    RAISE EXCEPTION 'Project ID required';
  END IF;

  -- Validate device number range
  IF p_device_number < 1 OR p_device_number > 20 THEN
    RAISE EXCEPTION 'Device number must be between 1 and 20';
  END IF;

  -- Verify project exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE project_id = p_project_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Project "%" not found or access denied', p_project_id;
  END IF;

  -- Construct composite ID (e.g., "PROJ1-ESP5")
  v_composite_id := p_project_id || '-ESP' || p_device_number;

  -- Generate device key (64-character hex string = 32 random bytes)
  v_device_key := encode(gen_random_bytes(32), 'hex');

  -- Hash the device key for storage (SHA-256)
  v_device_key_hash := encode(digest(v_device_key, 'sha256'), 'hex');

  v_new_id := gen_random_uuid();
  v_created_at := now();

  -- Insert device
  INSERT INTO public.devices (
    id, composite_device_id, project_id, device_number, name,
    device_key_hash, user_id, status, created_at, updated_at
  ) VALUES (
    v_new_id, v_composite_id, p_project_id, p_device_number, trim(p_name),
    v_device_key_hash, p_user_id, 'waiting', v_created_at, v_created_at
  );

  -- Return device details including the unhashed device_key (ONLY returned once at creation)
  RETURN QUERY SELECT v_composite_id, v_device_key, v_new_id, v_created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Device ESP% is already registered in project "%"', p_device_number, p_project_id;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to register device: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_device_with_project(TEXT, TEXT, INTEGER, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION register_device_with_project IS 'Registers a new device with auto-generated device key. Returns composite_device_id (e.g., PROJ1-ESP5) and device_key (returned only once).';
