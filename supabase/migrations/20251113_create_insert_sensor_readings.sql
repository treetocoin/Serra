-- Migration: Create insert_sensor_readings function
-- Date: 2025-11-13
-- Description: ESP8266 calls this to insert sensor readings with auto-discovery

CREATE OR REPLACE FUNCTION public.insert_sensor_readings(readings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  reading_item JSONB;
  v_device_id UUID;
  v_composite_device_id TEXT;
  v_sensor_type TEXT;
  v_sensor_name TEXT;
  v_value NUMERIC;
  v_unit TEXT;
  v_sensor_id UUID;
  inserted_count INTEGER := 0;
BEGIN
  -- Loop through each reading
  FOR reading_item IN SELECT * FROM jsonb_array_elements(readings)
  LOOP
    -- Extract reading info
    v_composite_device_id := reading_item->>'composite_device_id';
    v_sensor_type := reading_item->>'sensor_type';
    v_sensor_name := reading_item->>'sensor_name';
    v_value := (reading_item->>'value')::NUMERIC;
    v_unit := reading_item->>'unit';

    -- Get device UUID from composite_device_id
    SELECT id INTO v_device_id
    FROM public.devices
    WHERE composite_device_id = v_composite_device_id;

    IF v_device_id IS NULL THEN
      RAISE EXCEPTION 'Device not found: %', v_composite_device_id;
    END IF;

    -- Check if sensor exists, if not create it
    SELECT id INTO v_sensor_id
    FROM public.sensors
    WHERE device_id = v_device_id
      AND name = v_sensor_name
      AND sensor_type = v_sensor_type;

    IF v_sensor_id IS NULL THEN
      -- Auto-register sensor
      INSERT INTO public.sensors (
        device_id,
        name,
        sensor_type,
        unit,
        is_active,
        discovered_at,
        last_seen_at
      ) VALUES (
        v_device_id,
        v_sensor_name,
        v_sensor_type,
        v_unit,
        true,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_sensor_id;
    ELSE
      -- Update last_seen_at
      UPDATE public.sensors
      SET last_seen_at = NOW(),
          is_active = true
      WHERE id = v_sensor_id;
    END IF;

    -- Insert reading
    INSERT INTO public.sensor_readings (
      sensor_id,
      device_id,
      value,
      unit,
      sensor_name,
      recorded_at
    ) VALUES (
      v_sensor_id,
      v_device_id,
      v_value,
      v_unit,
      v_sensor_name,
      NOW()
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', inserted_count);
END;
$$;

-- Grant execute to anon (ESP8266 uses anon key)
GRANT EXECUTE ON FUNCTION public.insert_sensor_readings(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_sensor_readings(JSONB) TO authenticated;

COMMENT ON FUNCTION public.insert_sensor_readings(JSONB) IS
'Inserts sensor readings from ESP8266.
Auto-registers sensors if they do not exist.
Accepts array of readings with composite_device_id, sensor_type, sensor_name, value, unit.';
