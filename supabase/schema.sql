-- Greenhouse Management System - Supabase Database Schema
-- This schema includes Row Level Security (RLS) policies for multi-tenant data isolation
-- Run this in Supabase SQL Editor after creating your project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable TimescaleDB extension (if available)
-- Note: TimescaleDB may not be available on Supabase free tier
-- Schema will work without it, but time-series queries will be slower
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================
-- Table: profiles (extends auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read/update their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Table: devices
-- =====================================================
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connection_status TEXT CHECK (connection_status IN ('online', 'offline', 'error')) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  api_key_hash TEXT NOT NULL,
  firmware_version TEXT,
  CONSTRAINT devices_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Indexes for devices
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_connection_status ON public.devices(connection_status);

-- Enable RLS on devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own devices
CREATE POLICY "Users can view their own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
  ON public.devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
  ON public.devices FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Table: sensors
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sensors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  sensor_id TEXT NOT NULL,
  sensor_type TEXT NOT NULL,
  unit TEXT NOT NULL,
  name TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  discovered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT sensors_unique_per_device UNIQUE (device_id, sensor_id)
);

-- Indexes for sensors
CREATE INDEX IF NOT EXISTS idx_sensors_device_id ON public.sensors(device_id);
CREATE INDEX IF NOT EXISTS idx_sensors_type ON public.sensors(sensor_type);

-- Enable RLS on sensors
ALTER TABLE public.sensors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access sensors from their devices
CREATE POLICY "Users can view sensors from their devices"
  ON public.sensors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sensors for their devices"
  ON public.sensors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sensors from their devices"
  ON public.sensors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sensors from their devices"
  ON public.sensors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- =====================================================
-- Table: actuators
-- =====================================================
CREATE TABLE IF NOT EXISTS public.actuators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  actuator_id TEXT NOT NULL,
  actuator_type TEXT NOT NULL,
  name TEXT,
  current_state TEXT DEFAULT 'off' NOT NULL,
  supports_pwm BOOLEAN DEFAULT FALSE NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT actuators_unique_per_device UNIQUE (device_id, actuator_id)
);

-- Indexes for actuators
CREATE INDEX IF NOT EXISTS idx_actuators_device_id ON public.actuators(device_id);
CREATE INDEX IF NOT EXISTS idx_actuators_type ON public.actuators(actuator_type);

-- Enable RLS on actuators
ALTER TABLE public.actuators ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access actuators from their devices
CREATE POLICY "Users can view actuators from their devices"
  ON public.actuators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = actuators.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert actuators for their devices"
  ON public.actuators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = actuators.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update actuators from their devices"
  ON public.actuators FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = actuators.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete actuators from their devices"
  ON public.actuators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices
      WHERE devices.id = actuators.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- =====================================================
-- Table: sensor_readings (Time-series data)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  sensor_id UUID NOT NULL REFERENCES public.sensors(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  value NUMERIC NOT NULL
);

-- Indexes for sensor_readings
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON public.sensor_readings(sensor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp ON public.sensor_readings(timestamp DESC);

-- Enable RLS on sensor_readings
ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access readings from their sensors
CREATE POLICY "Users can view readings from their sensors"
  ON public.sensor_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sensors
      JOIN public.devices ON devices.id = sensors.device_id
      WHERE sensors.id = sensor_readings.sensor_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert readings for their sensors"
  ON public.sensor_readings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sensors
      JOIN public.devices ON devices.id = sensors.device_id
      WHERE sensors.id = sensor_readings.sensor_id
      AND devices.user_id = auth.uid()
    )
  );

-- Convert to TimescaleDB hypertable (OPTIONAL - only if TimescaleDB is available)
-- SELECT create_hypertable('sensor_readings', 'timestamp', if_not_exists => TRUE);

-- Add compression policy (OPTIONAL - only if TimescaleDB is available)
-- ALTER TABLE sensor_readings SET (
--   timescaledb.compress,
--   timescaledb.compress_segmentby = 'sensor_id'
-- );
-- SELECT add_compression_policy('sensor_readings', INTERVAL '7 days');

-- =====================================================
-- Table: commands
-- =====================================================
CREATE TABLE IF NOT EXISTS public.commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actuator_id UUID NOT NULL REFERENCES public.actuators(id) ON DELETE CASCADE,
  command_type TEXT CHECK (command_type IN ('on', 'off', 'set_value')) NOT NULL,
  value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  delivered_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'delivered', 'executed', 'failed')) DEFAULT 'pending' NOT NULL
);

-- Indexes for commands
CREATE INDEX IF NOT EXISTS idx_commands_actuator_id ON public.commands(actuator_id);
CREATE INDEX IF NOT EXISTS idx_commands_status_created ON public.commands(status, created_at DESC);

-- Enable RLS on commands
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access commands for their actuators
CREATE POLICY "Users can view commands for their actuators"
  ON public.commands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.actuators
      JOIN public.devices ON devices.id = actuators.device_id
      WHERE actuators.id = commands.actuator_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert commands for their actuators"
  ON public.commands FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.actuators
      JOIN public.devices ON devices.id = actuators.device_id
      WHERE actuators.id = commands.actuator_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update commands for their actuators"
  ON public.commands FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.actuators
      JOIN public.devices ON devices.id = actuators.device_id
      WHERE actuators.id = commands.actuator_id
      AND devices.user_id = auth.uid()
    )
  );

-- =====================================================
-- Database Functions
-- =====================================================

-- Function: Update device last_seen_at when sensor data is received
CREATE OR REPLACE FUNCTION public.update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.devices
  SET last_seen_at = NOW(),
      connection_status = 'online'
  WHERE id = (
    SELECT device_id FROM public.sensors WHERE id = NEW.sensor_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_sensor_reading_insert
  AFTER INSERT ON public.sensor_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_device_last_seen();

-- Function: Get latest sensor readings for a user
CREATE OR REPLACE FUNCTION public.get_latest_sensor_readings(user_id_param UUID)
RETURNS TABLE (
  device_id UUID,
  device_name TEXT,
  sensor_id UUID,
  sensor_name TEXT,
  sensor_type TEXT,
  value NUMERIC,
  unit TEXT,
  timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id AS device_id,
    d.name AS device_name,
    s.id AS sensor_id,
    s.name AS sensor_name,
    s.sensor_type,
    sr.value,
    s.unit,
    sr.timestamp
  FROM public.devices d
  JOIN public.sensors s ON s.device_id = d.id
  JOIN LATERAL (
    SELECT value, timestamp
    FROM public.sensor_readings
    WHERE sensor_id = s.id
    ORDER BY timestamp DESC
    LIMIT 1
  ) sr ON TRUE
  WHERE d.user_id = user_id_param
    AND d.connection_status = 'online'
    AND s.is_active = TRUE
  ORDER BY d.name, s.sensor_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get pending commands for ESP32 device
CREATE OR REPLACE FUNCTION public.get_pending_commands(device_id_param UUID)
RETURNS TABLE (
  id UUID,
  actuator_id UUID,
  command_type TEXT,
  value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.actuator_id,
    c.command_type,
    c.value
  FROM public.commands c
  JOIN public.actuators a ON a.id = c.actuator_id
  WHERE a.device_id = device_id_param
    AND c.status = 'pending'
    AND c.created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY c.created_at ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Verification Queries (for testing)
-- =====================================================

-- List all tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS policies
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- =====================================================
-- ESP32 API Key Authentication (T037)
-- =====================================================
-- ESP32 devices need to INSERT sensor_readings using API keys
--
-- OPTION 1: Use Service Role Key (Simple but less secure)
-- - ESP32 sends: Authorization: Bearer {SERVICE_ROLE_KEY}
-- - Bypasses RLS (has full access)
-- - Get key from Supabase Dashboard > Settings > API > service_role key
-- - ⚠️ Keep service role key secret - only for backend/devices
--
-- OPTION 2: Custom API Key Function (More secure - RECOMMENDED)
-- Create a function to verify device API keys and bypass RLS:
--
-- CREATE OR REPLACE FUNCTION public.verify_device_api_key(api_key_param TEXT)
-- RETURNS UUID AS $$
-- DECLARE
--   device_uuid UUID;
-- BEGIN
--   -- Hash the provided API key
--   -- Compare with stored api_key_hash
--   -- Return device_id if valid, NULL otherwise
--   SELECT id INTO device_uuid
--   FROM public.devices
--   WHERE api_key_hash = encode(digest(api_key_param, 'sha256'), 'hex');
--
--   RETURN device_uuid;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- Then create RLS policy:
-- CREATE POLICY "ESP32 can insert sensor readings with API key"
--   ON public.sensor_readings FOR INSERT
--   WITH CHECK (
--     EXISTS (
--       SELECT 1 FROM public.sensors
--       WHERE id = sensor_readings.sensor_id
--       AND device_id = verify_device_api_key(current_setting('request.headers')::json->>'x-api-key')
--     )
--   );
--
-- For now, use Service Role Key for simplicity.
-- See ESP32_INTEGRATION.md for complete implementation guide.
-- =====================================================

-- =====================================================
-- NOTES
-- =====================================================
-- 1. After running this schema, configure Supabase Auth:
--    - Go to Authentication > Providers > Enable Email
--    - Go to Authentication > URL Configuration > Set Site URL
-- 2. Update frontend .env.local with:
--    - VITE_SUPABASE_URL
--    - VITE_SUPABASE_ANON_KEY
-- 3. Test RLS policies by trying to access data from different users
-- 4. ESP32 devices: Use Service Role Key for API authentication (see above)
-- 5. See ESP32_INTEGRATION.md for complete ESP32 firmware integration guide
-- =====================================================
