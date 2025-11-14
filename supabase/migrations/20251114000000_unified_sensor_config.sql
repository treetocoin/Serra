-- =====================================================
-- Feature: Unified Sensor Configuration (Cloud as Single Source of Truth)
-- Migration: Add config_version tracking + get_device_sensor_config function
-- Date: 2025-11-14
-- =====================================================

-- =====================================================
-- Add config_version to devices table
-- Purpose: Track configuration changes so ESP8266 knows when to re-fetch config
-- =====================================================

ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS config_version INTEGER DEFAULT 1 NOT NULL;

COMMENT ON COLUMN public.devices.config_version IS
  'Incremented each time sensor configuration changes. ESP8266 polls this to detect config updates';

-- Index for efficient version checks during heartbeat
CREATE INDEX IF NOT EXISTS idx_devices_config_version
  ON public.devices(composite_device_id, config_version);

-- =====================================================
-- Function: get_device_sensor_config
-- Purpose: Return active sensor configs for a device (called by ESP8266 on heartbeat)
-- Returns: JSON array of {sensor_type, port_id} objects
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_device_sensor_config(composite_device_id_param text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_device_id UUID;
  result JSON;
BEGIN
  -- Get device UUID from composite_device_id
  SELECT id INTO v_device_id
  FROM public.devices
  WHERE composite_device_id = composite_device_id_param;

  IF v_device_id IS NULL THEN
    RAISE EXCEPTION 'Device not found: %', composite_device_id_param;
  END IF;

  -- Return active sensor configs as JSON array
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'sensor_type', sensor_type,
        'port_id', port_id,
        'configured_at', configured_at
      )
      ORDER BY sensor_type
    ),
    '[]'::json
  ) INTO result
  FROM public.device_sensor_configs
  WHERE device_id = v_device_id
    AND is_active = TRUE;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_sensor_config(text) TO authenticated, anon;

COMMENT ON FUNCTION public.get_device_sensor_config IS
  'Returns active sensor configurations for a device as JSON array. Called by ESP8266 during heartbeat to sync config from cloud to EEPROM';

-- =====================================================
-- Trigger: Auto-increment config_version on sensor config changes
-- Purpose: Notify ESP8266 that configuration has changed
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_device_config_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment config_version for the affected device
  UPDATE public.devices
  SET config_version = config_version + 1
  WHERE id = COALESCE(NEW.device_id, OLD.device_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for INSERT/UPDATE/DELETE on device_sensor_configs
DROP TRIGGER IF EXISTS trigger_increment_config_version ON public.device_sensor_configs;

CREATE TRIGGER trigger_increment_config_version
  AFTER INSERT OR UPDATE OR DELETE ON public.device_sensor_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_device_config_version();

COMMENT ON FUNCTION public.increment_device_config_version IS
  'Trigger function that increments devices.config_version when sensor configs change. Allows ESP8266 to detect configuration updates during heartbeat';

-- =====================================================
-- Enhanced heartbeat function to include config_version
-- Purpose: ESP8266 can compare versions to detect config changes
-- =====================================================

CREATE OR REPLACE FUNCTION public.device_heartbeat_with_config(
  composite_device_id_param text,
  firmware_version_param text DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_device_id UUID;
  v_config_version INTEGER;
  result JSON;
BEGIN
  -- Get device UUID from composite_device_id
  SELECT id, config_version INTO v_device_id, v_config_version
  FROM public.devices
  WHERE composite_device_id = composite_device_id_param;

  IF v_device_id IS NULL THEN
    RAISE EXCEPTION 'Device not found: %', composite_device_id_param;
  END IF;

  -- Update last_seen_at (and optionally firmware_version)
  IF firmware_version_param IS NOT NULL THEN
    UPDATE public.devices
    SET last_seen_at = NOW(),
        firmware_version = firmware_version_param
    WHERE id = v_device_id;
  ELSE
    UPDATE public.devices
    SET last_seen_at = NOW()
    WHERE id = v_device_id;
  END IF;

  -- Return config_version so ESP8266 can compare
  SELECT json_build_object(
    'device_id', v_device_id,
    'composite_device_id', composite_device_id_param,
    'config_version', v_config_version,
    'timestamp', NOW()
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.device_heartbeat_with_config(text, text) TO authenticated, anon;

COMMENT ON FUNCTION public.device_heartbeat_with_config IS
  'Enhanced heartbeat that returns current config_version. ESP8266 compares this with its cached version to detect config changes';
