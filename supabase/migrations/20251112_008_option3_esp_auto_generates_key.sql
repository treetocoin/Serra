-- Migration: Update register_device_with_project for Option 3 (ESP auto-generates key)
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Device registered with NULL device_key_hash, ESP generates key, Edge Function stores hash on first heartbeat

DROP FUNCTION IF EXISTS public.register_device_with_project(TEXT, TEXT, INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.register_device_with_project(
  p_name TEXT,
  p_project_id TEXT,
  p_device_number INTEGER,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  composite_device_id TEXT,
  id UUID,
  registered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_composite_id TEXT;
  v_new_id UUID;
  v_registered_at TIMESTAMPTZ;
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

  v_new_id := extensions.gen_random_uuid();
  v_registered_at := now();

  -- Insert device with NULL device_key_hash (ESP will generate key, Edge Function will store hash)
  INSERT INTO public.devices (
    id, composite_device_id, project_id, device_number, name,
    device_key_hash, user_id, status, registered_at
  ) VALUES (
    v_new_id, v_composite_id, p_project_id, p_device_number, trim(p_name),
    NULL, p_user_id, 'offline', v_registered_at
  );

  -- Return device details WITHOUT device_key (ESP generates it automatically)
  RETURN QUERY SELECT v_composite_id, v_new_id, v_registered_at;
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
COMMENT ON FUNCTION public.register_device_with_project IS 'Registers a new device with NULL device_key_hash. ESP auto-generates key, Edge Function stores hash on first heartbeat.';
