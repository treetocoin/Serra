-- Migration: Auto-register sensors from ESP8266
-- Feature: Simplified sensor setup with auto-discovery
-- Date: 2025-10-13
-- Description: Allows ESP8266 to automatically register sensors in database

-- =====================================================
-- RPC Function: Auto-register sensors
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_register_sensors(
  device_id_param UUID,
  sensors_param JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sensor_item JSONB;
  sensor_id TEXT;
  sensor_name TEXT;
  sensor_type TEXT;
  sensor_unit TEXT;
  existing_sensor_id UUID;
  result JSONB := '{"registered": [], "updated": []}'::JSONB;
BEGIN
  -- Validate device exists
  IF NOT EXISTS (SELECT 1 FROM public.devices WHERE id = device_id_param) THEN
    RAISE EXCEPTION 'Device not found: %', device_id_param;
  END IF;

  -- Loop through each sensor in the array
  FOR sensor_item IN SELECT * FROM jsonb_array_elements(sensors_param)
  LOOP
    -- Extract sensor info
    sensor_id := sensor_item->>'sensor_id';
    sensor_name := sensor_item->>'name';
    sensor_type := sensor_item->>'type';
    sensor_unit := sensor_item->>'unit';

    -- Check if sensor already exists for this device
    SELECT id INTO existing_sensor_id
    FROM public.sensors
    WHERE device_id = device_id_param
    AND sensor_id = sensor_id;

    IF existing_sensor_id IS NOT NULL THEN
      -- Update existing sensor
      UPDATE public.sensors
      SET
        name = sensor_name,
        sensor_type = sensor_type,
        unit = sensor_unit,
        is_active = true,
        last_seen_at = NOW()
      WHERE id = existing_sensor_id;

      result := jsonb_set(
        result,
        '{updated}',
        (result->'updated') || jsonb_build_array(sensor_id)
      );
    ELSE
      -- Insert new sensor
      INSERT INTO public.sensors (
        device_id,
        sensor_id,
        name,
        sensor_type,
        unit,
        is_active,
        discovered_at,
        last_seen_at
      ) VALUES (
        device_id_param,
        sensor_id,
        sensor_name,
        sensor_type,
        sensor_unit,
        true,
        NOW(),
        NOW()
      );

      result := jsonb_set(
        result,
        '{registered}',
        (result->'registered') || jsonb_build_array(sensor_id)
      );
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_register_sensors(UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.auto_register_sensors(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.auto_register_sensors(UUID, JSONB) IS
'Auto-registers sensors from ESP8266 device.
Upserts sensors (creates new or updates existing).
Returns list of registered and updated sensor IDs.';

-- =====================================================
-- USAGE EXAMPLE
-- =====================================================
--
-- SELECT public.auto_register_sensors(
--   'device-uuid-here',
--   '[
--     {
--       "sensor_id": "temp_1_abc123",
--       "name": "DHT22 Temperature",
--       "type": "temperature",
--       "unit": "°C"
--     },
--     {
--       "sensor_id": "hum_1_abc123",
--       "name": "DHT22 Humidity",
--       "type": "humidity",
--       "unit": "%"
--     }
--   ]'::JSONB
-- );
--
-- Returns: {"registered": ["temp_1_abc123", "hum_1_abc123"], "updated": []}
