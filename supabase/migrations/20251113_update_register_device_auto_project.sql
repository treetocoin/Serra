-- Migration: Update register_device to auto-use default project
-- Date: 2025-11-13
-- Description: Simplified device registration - auto-uses user's default project

CREATE OR REPLACE FUNCTION public.register_device_simple(
  p_name TEXT,
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
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_project_id TEXT;
  v_composite_id TEXT;
  v_new_id UUID;
  v_registered_at TIMESTAMPTZ;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF p_device_number < 1 OR p_device_number > 20 THEN
    RAISE EXCEPTION 'Device number must be between 1 and 20';
  END IF;

  IF LENGTH(TRIM(p_name)) < 1 OR LENGTH(TRIM(p_name)) > 100 THEN
    RAISE EXCEPTION 'Device name must be between 1 and 100 characters';
  END IF;

  -- Get user's default project (should always exist due to trigger)
  SELECT project_id INTO v_project_id
  FROM projects
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'No default project found for user. Please contact support.';
  END IF;

  -- Build composite device ID
  v_composite_id := v_project_id || '-ESP' || p_device_number;

  -- Check if device already exists
  IF EXISTS (
    SELECT 1 FROM devices d
    WHERE d.composite_device_id = v_composite_id AND d.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Device ESP% is already registered in your project.', p_device_number;
  END IF;

  v_new_id := extensions.gen_random_uuid();
  v_registered_at := now();

  -- Insert device (ESP will generate key, Edge Function will store hash on first heartbeat)
  INSERT INTO devices (
    id, composite_device_id, project_id, device_number, name,
    device_key_hash, user_id, status, registered_at
  ) VALUES (
    v_new_id, v_composite_id, v_project_id, p_device_number, trim(p_name),
    NULL, p_user_id, 'offline', v_registered_at
  );

  -- Return device details WITHOUT device_key (ESP generates it automatically)
  RETURN QUERY SELECT
    v_composite_id AS composite_device_id,
    v_new_id AS id,
    v_registered_at AS registered_at;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.register_device_simple(TEXT, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION public.register_device_simple(TEXT, INTEGER, UUID) IS
'Simplified device registration - automatically uses user''s default project.
Parameters: device_name, device_number (1-20).
Returns: composite_device_id, id, registered_at.
ESP auto-generates device key; backend stores hash on first heartbeat.';
