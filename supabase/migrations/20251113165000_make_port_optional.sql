-- Make sensor configuration optional for backward compatibility
-- Allow both configured (with port_id) and auto-discovery (without port_id) modes

CREATE OR REPLACE FUNCTION insert_sensor_readings(readings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  reading_item JSONB;
  v_device_id UUID;
  v_composite_device_id TEXT;
  v_sensor_type TEXT;
  v_sensor_name TEXT;
  v_port_id TEXT;
  v_value NUMERIC;
  v_unit TEXT;
  v_sensor_id UUID;
  v_generated_sensor_id TEXT;
  v_configured_sensor_type TEXT;
  inserted_count INTEGER := 0;
BEGIN
  -- Loop through each reading
  FOR reading_item IN SELECT * FROM jsonb_array_elements(readings)
  LOOP
    -- Extract reading info
    v_composite_device_id := reading_item->>'composite_device_id';
    v_sensor_type := reading_item->>'sensor_type';
    v_sensor_name := reading_item->>'sensor_name';
    v_port_id := reading_item->>'port_id';  -- May be NULL
    v_value := (reading_item->>'value')::NUMERIC;
    v_unit := reading_item->>'unit';

    -- Get device UUID from composite_device_id
    SELECT id INTO v_device_id
    FROM devices
    WHERE composite_device_id = v_composite_device_id;

    IF v_device_id IS NULL THEN
      RAISE EXCEPTION 'Device not found: %', v_composite_device_id;
    END IF;

    -- OPTIONAL: If port_id is provided, try to use sensor configuration
    IF v_port_id IS NOT NULL THEN
      -- Try to get configured sensor type from device_sensor_configs
      SELECT sensor_type INTO v_configured_sensor_type
      FROM device_sensor_configs
      WHERE device_id = v_device_id
        AND port_id = v_port_id
        AND is_active = true;

      -- If configuration exists, use it
      IF v_configured_sensor_type IS NOT NULL THEN
        v_sensor_type := v_configured_sensor_type;
      END IF;
      -- If no configuration, just use the provided sensor_type (auto-discovery)
    END IF;

    -- Check if sensor exists, if not create it (auto-discovery)
    SELECT id INTO v_sensor_id
    FROM sensors
    WHERE device_id = v_device_id
      AND name = v_sensor_name
      AND sensor_type = v_sensor_type;

    IF v_sensor_id IS NULL THEN
      -- Generate unique sensor_id
      v_generated_sensor_id := lower(v_sensor_type) || '_' ||
        substring(md5(random()::text || clock_timestamp()::text) from 1 for 8);

      -- Auto-register sensor
      INSERT INTO sensors (
        device_id,
        sensor_id,
        name,
        sensor_type,
        unit,
        is_active,
        discovered_at
      ) VALUES (
        v_device_id,
        v_generated_sensor_id,
        v_sensor_name,
        v_sensor_type,
        v_unit,
        true,
        NOW()
      )
      RETURNING id INTO v_sensor_id;
    ELSE
      -- Update is_active
      UPDATE sensors
      SET is_active = true
      WHERE id = v_sensor_id;
    END IF;

    -- Insert reading with port_id and reading_sensor_type
    INSERT INTO sensor_readings (
      sensor_id,
      timestamp,
      value,
      sensor_name,
      port_id,
      reading_sensor_type
    ) VALUES (
      v_sensor_id,
      NOW(),
      v_value,
      v_sensor_name,
      v_port_id,  -- May be NULL
      v_sensor_type
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', inserted_count);
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION insert_sensor_readings(JSONB) TO authenticated, anon;
