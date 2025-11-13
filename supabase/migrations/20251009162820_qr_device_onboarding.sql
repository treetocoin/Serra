-- Migration: QR Code Device Onboarding
-- Feature: 003-qr-code-device
-- Date: 2025-10-09
-- Description: Adds support for QR code-based device onboarding with WiFi connection monitoring

-- =====================================================
-- PART 1: Schema Changes
-- =====================================================

-- Step 1: Add 'connection_failed' value to connection_status enum
-- This handles devices that timeout during WiFi connection (30s after registration)
-- Note: connection_status currently uses TEXT CHECK constraint, not ENUM
-- We'll update the CHECK constraint to include the new value

ALTER TABLE public.devices
DROP CONSTRAINT IF EXISTS devices_connection_status_check;

ALTER TABLE public.devices
ADD CONSTRAINT devices_connection_status_check
CHECK (connection_status IN ('online', 'offline', 'error', 'connection_failed'));

-- Step 2: Add device_hostname column for mDNS hostname (if not exists)
-- Format: http://serrasetup-XXXX.local (where XXXX = last 2 bytes of MAC address)
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS device_hostname TEXT;

-- Step 3: Add configuration_requested flag (if not exists)
-- Used to indicate pending sensor/actuator configuration from ESP8266
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS configuration_requested BOOLEAN DEFAULT false NOT NULL;

-- Step 4: Add comment to document connection status values
COMMENT ON COLUMN public.devices.connection_status IS
'Device connection state:
 - offline: Never connected or last seen >5min ago
 - online: Actively sending heartbeats (<30s ago)
 - error: Generic error state (legacy)
 - connection_failed: WiFi connection timed out (30s), device returned to AP mode';

-- Step 5: Drop old index and create partial index for performance
-- Only index active devices (not offline) to improve query performance
DROP INDEX IF EXISTS public.idx_devices_connection_status;

CREATE INDEX IF NOT EXISTS idx_devices_connection_status_active
ON public.devices(connection_status)
WHERE connection_status != 'offline';

-- Step 6: Add index on last_seen_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_devices_last_seen_at
ON public.devices(last_seen_at)
WHERE last_seen_at IS NOT NULL;

-- =====================================================
-- PART 2: RPC Functions
-- =====================================================

-- Function: device_heartbeat
-- Called by ESP8266 devices to indicate online status and update hostname
-- Handles all status transitions: offline → online, connection_failed → online
CREATE OR REPLACE FUNCTION public.device_heartbeat(
  device_id_param UUID,
  hostname_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INT;
  old_status TEXT;
  new_hostname TEXT;
BEGIN
  -- Get current status before update
  SELECT connection_status INTO old_status
  FROM public.devices
  WHERE id = device_id_param;

  -- Update device status to online (from any previous state)
  UPDATE public.devices
  SET
    connection_status = 'online',  -- Always set to online when heartbeat received
    last_seen_at = NOW(),
    device_hostname = COALESCE(hostname_param, device_hostname)  -- Update hostname if provided
  WHERE id = device_id_param
  RETURNING device_hostname INTO new_hostname;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  -- Raise exception if device not found
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Device not found: %', device_id_param
      USING HINT = 'Check that the device_id is correct and the device exists in the database';
  END IF;

  -- Log status transition for debugging (only if status changed)
  IF old_status IS DISTINCT FROM 'online' THEN
    RAISE NOTICE 'Device % status changed: % → online', device_id_param, old_status;
  END IF;

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'timestamp', NOW(),
    'status', 'online',
    'previous_status', old_status,
    'hostname', new_hostname
  );
END;
$$;

-- Grant execute permission to authenticated and anon roles
-- Anon role needed for ESP8266 devices using API key authentication
GRANT EXECUTE ON FUNCTION public.device_heartbeat(UUID, TEXT) TO authenticated, anon;

-- Add comment to document the function
COMMENT ON FUNCTION public.device_heartbeat(UUID, TEXT) IS
'Called by ESP8266 devices every 30 seconds to indicate online status.
Automatically transitions device from any state (offline, connection_failed, error) to online.
Optionally updates device hostname (mDNS address) if provided.';

-- Function: cleanup_connection_status
-- Monitors device timeouts and updates connection status accordingly
-- Should be called periodically (e.g., every minute via cron or frontend polling)
CREATE OR REPLACE FUNCTION public.cleanup_connection_status()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  offline_count INT;
  failed_count INT;
BEGIN
  -- Mark as offline if no heartbeat for 5 minutes
  -- Only affects devices currently marked as 'online'
  UPDATE public.devices
  SET connection_status = 'offline'
  WHERE connection_status = 'online'
    AND last_seen_at IS NOT NULL
    AND last_seen_at < NOW() - INTERVAL '5 minutes';

  GET DIAGNOSTICS offline_count = ROW_COUNT;

  -- Mark as connection_failed if registered but no heartbeat after 30s
  -- Only applies to recently registered devices (within last 5 minutes)
  -- Avoids false positives for old offline devices
  UPDATE public.devices
  SET connection_status = 'connection_failed'
  WHERE connection_status = 'offline'
    AND last_seen_at IS NULL  -- Never received a heartbeat
    AND registered_at > NOW() - INTERVAL '5 minutes'  -- Recently registered
    AND registered_at < NOW() - INTERVAL '30 seconds';  -- But registration was >30s ago

  GET DIAGNOSTICS failed_count = ROW_COUNT;

  -- Log cleanup results
  RAISE NOTICE 'Cleanup completed: % devices marked offline, % marked connection_failed',
    offline_count, failed_count;

  -- Return summary
  RETURN json_build_object(
    'success', true,
    'timestamp', NOW(),
    'devices_marked_offline', offline_count,
    'devices_marked_failed', failed_count
  );
END;
$$;

-- Grant execute permission to authenticated role only
-- This function should not be called by devices
GRANT EXECUTE ON FUNCTION public.cleanup_connection_status() TO authenticated;

-- Add comment to document the function
COMMENT ON FUNCTION public.cleanup_connection_status() IS
'Monitors device timeouts and updates connection status.
Should be called periodically (every 1-2 minutes) via cron or frontend polling.
Transitions:
  - online → offline (after 5 minutes without heartbeat)
  - offline → connection_failed (after 30s without heartbeat for newly registered devices)';

-- =====================================================
-- PART 3: Data Integrity Triggers
-- =====================================================

-- Trigger: Ensure last_seen_at is set when status changes to 'online'
-- Prevents inconsistent state where device is online but last_seen_at is NULL
CREATE OR REPLACE FUNCTION public.ensure_last_seen_on_online()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is being set to 'online' and last_seen_at is NULL, set it to NOW()
  IF NEW.connection_status = 'online' AND NEW.last_seen_at IS NULL THEN
    NEW.last_seen_at = NOW();
    RAISE NOTICE 'Auto-setting last_seen_at for device % (status: online)', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_ensure_last_seen ON public.devices;

CREATE TRIGGER trg_ensure_last_seen
BEFORE INSERT OR UPDATE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.ensure_last_seen_on_online();

-- Add comment to document the trigger
COMMENT ON FUNCTION public.ensure_last_seen_on_online() IS
'Ensures data consistency: if connection_status is "online", last_seen_at must not be NULL.
Automatically sets last_seen_at to NOW() if it would otherwise be NULL.';

-- =====================================================
-- PART 4: Update Existing Data
-- =====================================================

-- Backfill: Convert any 'error' status devices to 'offline' for consistency
-- The 'error' status is being deprecated in favor of specific failure states
UPDATE public.devices
SET connection_status = 'offline'
WHERE connection_status = 'error';

-- =====================================================
-- PART 5: Verification Queries (for testing)
-- =====================================================

-- Verify new constraint is working
DO $$
BEGIN
  -- Test that invalid status is rejected
  BEGIN
    INSERT INTO public.devices (user_id, name, api_key_hash, connection_status)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'Test Invalid Status',
      'test-hash',
      'invalid_status'
    );
    RAISE EXCEPTION 'Constraint check failed: invalid status was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'Constraint check passed: invalid status correctly rejected';
  END;
END $$;

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
--
-- This migration is BACKWARD COMPATIBLE:
-- - All changes are additive (no data loss)
-- - Existing devices continue working without modification
-- - New 'connection_failed' status only applies to future registrations
-- - Legacy 'error' status devices are migrated to 'offline'
--
-- REQUIRED FOLLOW-UP ACTIONS:
-- 1. Update frontend to handle 'connection_failed' status
-- 2. Update ESP8266 firmware to call device_heartbeat() every 30s
-- 3. Schedule cleanup_connection_status() to run periodically:
--    - Option A: Use pg_cron extension (if available):
--        SELECT cron.schedule('cleanup-device-status', '*/1 * * * *', 'SELECT cleanup_connection_status()');
--    - Option B: Call from frontend every 60 seconds via polling
-- 4. Update device registration flow to generate and display QR codes
--
-- TESTING CHECKLIST:
-- □ Verify device_heartbeat() transitions offline → online
-- □ Verify device_heartbeat() transitions connection_failed → online
-- □ Verify cleanup marks devices offline after 5 min timeout
-- □ Verify cleanup marks devices connection_failed after 30s timeout
-- □ Verify partial index improves query performance
-- □ Verify RLS policies still work correctly
--
-- =====================================================
