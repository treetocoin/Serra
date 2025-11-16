-- Migration: Update RLS Policies for Admin Bypass
-- Feature: 006-fammi-un-tipo (Admin User Role with Multi-Project View)
-- Created: 2025-11-16
-- Description: Updates RLS policies on devices, sensors, actuators, and sensor_readings
--              to allow admin users to view and update all data while maintaining user isolation

-- ============================================================================
-- DEVICES TABLE - Admin Bypass Policies
-- ============================================================================

-- DROP existing policies (if they exist from previous schema)
DROP POLICY IF EXISTS "Users can view own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can update own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON public.devices;

-- SELECT: Users see own devices, admins see all
CREATE POLICY "Users can view own or admin sees all devices" ON public.devices
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    auth.user_role() = 'admin'
  );

-- UPDATE: Users update own devices, admins update all
CREATE POLICY "Users can update own or admin updates all devices" ON public.devices
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    auth.user_role() = 'admin'
  );

-- INSERT: Users can insert own devices (admin can also insert)
CREATE POLICY "Users or admin can insert devices" ON public.devices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    auth.user_role() = 'admin'
  );

-- DELETE: Keep restrictive - only owners can delete (FR-012: admin cannot delete)
-- Note: If a DELETE policy already exists, it should remain unchanged
-- Only device owners can delete their own devices

-- ============================================================================
-- SENSORS TABLE - Admin Bypass Policies
-- ============================================================================

-- DROP existing policies
DROP POLICY IF EXISTS "Users can view sensors for their devices" ON public.sensors;
DROP POLICY IF EXISTS "Users can update sensors for their devices" ON public.sensors;
DROP POLICY IF EXISTS "Users can insert sensors" ON public.sensors;

-- SELECT: Users see own sensors, admins see all
CREATE POLICY "Users or admin can view sensors" ON public.sensors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = sensors.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- UPDATE: Users update own sensors, admins update all
CREATE POLICY "Users or admin can update sensors" ON public.sensors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = sensors.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- INSERT: Users can insert sensors on own devices, admins on all devices
CREATE POLICY "Users or admin can insert sensors" ON public.sensors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = sensors.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- DELETE: Maintain restrictive policy (admin cannot delete)

-- ============================================================================
-- ACTUATORS TABLE - Admin Bypass Policies
-- ============================================================================

-- DROP existing policies
DROP POLICY IF EXISTS "Users can view actuators for their devices" ON public.actuators;
DROP POLICY IF EXISTS "Users can update actuators for their devices" ON public.actuators;
DROP POLICY IF EXISTS "Users can insert actuators" ON public.actuators;

-- SELECT: Users see own actuators, admins see all
CREATE POLICY "Users or admin can view actuators" ON public.actuators
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = actuators.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- UPDATE: Users update own actuators, admins update all
CREATE POLICY "Users or admin can update actuators" ON public.actuators
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = actuators.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- INSERT: Users can insert actuators on own devices, admins on all devices
CREATE POLICY "Users or admin can insert actuators" ON public.actuators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = actuators.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- DELETE: Maintain restrictive policy (admin cannot delete)

-- ============================================================================
-- SENSOR_READINGS TABLE - Admin Bypass for Viewing
-- ============================================================================

-- DROP existing policies
DROP POLICY IF EXISTS "Users can view readings for their devices" ON public.sensor_readings;
DROP POLICY IF EXISTS "Devices can insert readings" ON public.sensor_readings;

-- SELECT: Admin can view all readings (for dashboard and troubleshooting)
CREATE POLICY "Users or admin can view sensor readings" ON public.sensor_readings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sensors s
      JOIN public.devices d ON d.id = s.device_id
      WHERE s.id = sensor_readings.sensor_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- INSERT: Allow inserting readings (typically done by devices via service role)
-- This policy allows authenticated users/devices to insert readings for sensors they own
CREATE POLICY "Users or admin can insert sensor readings" ON public.sensor_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sensors s
      JOIN public.devices d ON d.id = s.device_id
      WHERE s.id = sensor_readings.sensor_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- Note: sensor_readings are immutable - no UPDATE or DELETE policies

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, you must restore the original RLS policies.
-- Save the original policies before running this migration!
--
-- Rollback steps:
-- 1. Drop all new policies created above
-- 2. Restore original policies from backup
--
-- Example rollback (adjust policy names to match your original schema):
--
-- -- Devices
-- DROP POLICY IF EXISTS "Users can view own or admin sees all devices" ON public.devices;
-- DROP POLICY IF EXISTS "Users can update own or admin updates all devices" ON public.devices;
-- -- Restore original policies here...
--
-- -- Sensors
-- DROP POLICY IF EXISTS "Users or admin can view sensors" ON public.sensors;
-- DROP POLICY IF EXISTS "Users or admin can update sensors" ON public.sensors;
-- -- Restore original policies here...
--
-- -- Actuators
-- DROP POLICY IF EXISTS "Users or admin can view actuators" ON public.actuators;
-- DROP POLICY IF EXISTS "Users or admin can update actuators" ON public.actuators;
-- -- Restore original policies here...
--
-- -- Sensor Readings
-- DROP POLICY IF EXISTS "Users or admin can view sensor readings" ON public.sensor_readings;
-- -- Restore original policies here...

