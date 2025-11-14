-- =====================================================
-- Feature: Standard Sensor Configuration and Dynamic Charting
-- Migration: device_sensor_configs table and sensor_readings extensions
-- Date: 2025-11-13
-- =====================================================

-- =====================================================
-- Table: device_sensor_configs
-- Purpose: Store current and historical sensor type → port mappings per device
-- =====================================================

CREATE TABLE IF NOT EXISTS public.device_sensor_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN (
    'dht_sopra_temp',
    'dht_sopra_humidity',
    'dht_sotto_temp',
    'dht_sotto_humidity',
    'soil_moisture_1',
    'soil_moisture_2',
    'soil_moisture_3',
    'soil_moisture_4',
    'soil_moisture_5',
    'water_level',
    'unconfigured'
  )),
  port_id TEXT NOT NULL CHECK (port_id ~ '^[A-Za-z0-9_-]+$' AND char_length(port_id) <= 50),
  configured_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

-- Prevent duplicate active port assignments per device (FR-008)
CREATE UNIQUE INDEX idx_device_sensor_configs_unique_active_port
  ON public.device_sensor_configs(device_id, port_id)
  WHERE is_active = TRUE;

-- Index for querying active configs by device
CREATE INDEX idx_device_sensor_configs_device
  ON public.device_sensor_configs(device_id);

-- Index for active config lookups (write-time resolution)
CREATE INDEX idx_device_sensor_configs_active
  ON public.device_sensor_configs(device_id, port_id, is_active)
  WHERE is_active = TRUE;

-- =====================================================
-- RLS Policies for device_sensor_configs
-- =====================================================

ALTER TABLE public.device_sensor_configs ENABLE ROW LEVEL SECURITY;

-- Users can view sensor configs for their devices
CREATE POLICY "Users can view sensor configs for their devices"
  ON public.device_sensor_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = device_sensor_configs.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Users can insert sensor configs for their devices
CREATE POLICY "Users can insert sensor configs for their devices"
  ON public.device_sensor_configs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = device_sensor_configs.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Users can update sensor configs for their devices
CREATE POLICY "Users can update sensor configs for their devices"
  ON public.device_sensor_configs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = device_sensor_configs.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Users can delete sensor configs for their devices
CREATE POLICY "Users can delete sensor configs for their devices"
  ON public.device_sensor_configs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = device_sensor_configs.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- =====================================================
-- Extend sensor_readings table
-- Purpose: Add snapshot approach fields (sensor_type, port_id)
-- =====================================================

-- Add columns (nullable for backward compatibility)
ALTER TABLE public.sensor_readings
ADD COLUMN IF NOT EXISTS sensor_type TEXT,
ADD COLUMN IF NOT EXISTS port_id TEXT;

-- Add check constraint for sensor_type (matches device_sensor_configs)
ALTER TABLE public.sensor_readings
ADD CONSTRAINT sensor_readings_sensor_type_check
CHECK (sensor_type IS NULL OR sensor_type IN (
  'dht_sopra_temp',
  'dht_sopra_humidity',
  'dht_sotto_temp',
  'dht_sotto_humidity',
  'soil_moisture_1',
  'soil_moisture_2',
  'soil_moisture_3',
  'soil_moisture_4',
  'soil_moisture_5',
  'water_level',
  'unconfigured'
));

-- Index for filtering readings by sensor type (chart queries)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_type
  ON public.sensor_readings(sensor_type)
  WHERE sensor_type IS NOT NULL;

-- Composite index for device + sensor type queries (primary chart access pattern)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_type
  ON public.sensor_readings(device_id, sensor_type)
  WHERE sensor_type IS NOT NULL;

-- =====================================================
-- Helper Function: Resolve Sensor Type from Active Config
-- Purpose: Used by API/Edge Function to resolve sensor_type at write time
-- =====================================================

CREATE OR REPLACE FUNCTION public.resolve_sensor_type(
  p_device_id UUID,
  p_port_id TEXT
) RETURNS TEXT AS $$
DECLARE
  v_sensor_type TEXT;
BEGIN
  SELECT sensor_type INTO v_sensor_type
  FROM public.device_sensor_configs
  WHERE device_id = p_device_id
    AND port_id = p_port_id
    AND is_active = TRUE
  LIMIT 1;

  -- Return 'unconfigured' if no active config found (R3 from research.md)
  RETURN COALESCE(v_sensor_type, 'unconfigured');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE public.device_sensor_configs IS
  'Stores current and historical sensor type configurations per device port. ' ||
  'Uses is_active flag for temporal tracking (snapshot approach). ' ||
  'Feature: 004-deve-funzionare-così';

COMMENT ON COLUMN public.device_sensor_configs.sensor_type IS
  'Standard sensor type identifier (e.g., dht_sopra_temp, soil_moisture_1). ' ||
  'Determines which chart receives the data.';

COMMENT ON COLUMN public.device_sensor_configs.port_id IS
  'Physical port identifier on the device (e.g., GPIO4, A0). ' ||
  'User-assigned, must be alphanumeric with optional dash/underscore.';

COMMENT ON COLUMN public.device_sensor_configs.is_active IS
  'TRUE for current configuration, FALSE for historical. ' ||
  'Only one active config per (device_id, port_id) pair.';

COMMENT ON COLUMN public.sensor_readings.sensor_type IS
  'Denormalized sensor type at time of reading (snapshot approach). ' ||
  'Permanently associates reading with sensor type, immune to config changes. ' ||
  'Feature: 004-deve-funzionare-così';

COMMENT ON COLUMN public.sensor_readings.port_id IS
  'Port identifier at time of reading (for audit/debugging). ' ||
  'Feature: 004-deve-funzionare-così';

COMMENT ON FUNCTION public.resolve_sensor_type IS
  'Resolves sensor_type from active device_sensor_config for a given device and port. ' ||
  'Returns ''unconfigured'' if no active config exists. ' ||
  'Feature: 004-deve-funzionare-così';
