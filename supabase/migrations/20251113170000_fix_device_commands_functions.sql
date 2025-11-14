-- Fix check_device_configuration and get_pending_commands to accept composite_device_id
-- Both functions now accept composite_device_id (text) instead of device_id (uuid)
-- This matches how the ESP8266 firmware calls these endpoints

-- Drop old function and create new version with composite_device_id parameter
DROP FUNCTION IF EXISTS check_device_configuration(uuid);

CREATE OR REPLACE FUNCTION check_device_configuration(composite_device_id_param text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  result JSON;
  config_requested BOOLEAN;
  v_device_id UUID;
BEGIN
  -- Get device UUID from composite_device_id
  SELECT id INTO v_device_id
  FROM public.devices
  WHERE composite_device_id = composite_device_id_param;

  IF v_device_id IS NULL THEN
    RAISE EXCEPTION 'Device not found: %', composite_device_id_param;
  END IF;

  -- Get configuration_requested flag
  SELECT configuration_requested INTO config_requested
  FROM public.devices
  WHERE id = v_device_id;

  -- Return result
  SELECT json_build_object(
    'device_id', v_device_id,
    'composite_device_id', composite_device_id_param,
    'configuration_requested', COALESCE(config_requested, false)
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_device_configuration(text) TO authenticated, anon;


-- Drop old function and create new version with composite_device_id parameter
DROP FUNCTION IF EXISTS get_pending_commands(uuid);

CREATE OR REPLACE FUNCTION get_pending_commands(composite_device_id_param text)
RETURNS TABLE(id uuid, actuator_id uuid, command_type text, value integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_device_id UUID;
BEGIN
  -- Get device UUID from composite_device_id
  SELECT d.id INTO v_device_id
  FROM public.devices d
  WHERE d.composite_device_id = composite_device_id_param;

  IF v_device_id IS NULL THEN
    RAISE EXCEPTION 'Device not found: %', composite_device_id_param;
  END IF;

  -- Return pending commands for this device
  RETURN QUERY
  SELECT
    c.id,
    c.actuator_id,
    c.command_type,
    c.value
  FROM public.commands c
  JOIN public.actuators a ON a.id = c.actuator_id
  WHERE a.device_id = v_device_id
    AND c.status = 'pending'
    AND c.created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY c.created_at ASC
  LIMIT 10;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_commands(text) TO authenticated, anon;
