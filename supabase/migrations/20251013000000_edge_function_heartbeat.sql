-- Migration: Edge Function Heartbeat with Device Keys
-- Feature: Secure device authentication without anon key
-- Date: 2025-10-13
-- Description: Migrates from api_key_hash to device_key_hash and creates device_heartbeats table

-- =====================================================
-- PART 1: Schema Changes
-- =====================================================

-- Step 1: Add device_key_hash column (replaces api_key_hash)
-- This is the SHA-256 hash of the device-specific key sent in QR code
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS device_key_hash TEXT;

-- Step 2: Create index on device_key_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_devices_device_key_hash
ON public.devices(device_key_hash)
WHERE device_key_hash IS NOT NULL;

-- Step 3: Create device_heartbeats table for detailed telemetry
CREATE TABLE IF NOT EXISTS public.device_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  ip TEXT,
  rssi INTEGER,
  fw_version TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_heartbeats_device_id
ON public.device_heartbeats(device_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_heartbeats_ts
ON public.device_heartbeats(ts DESC);

-- Step 5: Add status column to devices if not exists
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline'));

-- =====================================================
-- PART 2: Remove Old RPC Function
-- =====================================================

-- Drop old device_heartbeat function that used anon key
-- The new implementation is in Edge Function (server-side)
DROP FUNCTION IF EXISTS public.device_heartbeat(UUID, TEXT);

-- =====================================================
-- PART 3: RLS Policies
-- =====================================================

-- Enable RLS on device_heartbeats table
ALTER TABLE public.device_heartbeats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read heartbeats for their own devices
CREATE POLICY "Users can read own device heartbeats"
ON public.device_heartbeats
FOR SELECT
TO authenticated
USING (
  device_id IN (
    SELECT id FROM public.devices WHERE user_id = auth.uid()
  )
);

-- Policy: Service role can insert heartbeats (used by Edge Function)
-- Note: This policy allows service_role to bypass RLS
CREATE POLICY "Service role can insert heartbeats"
ON public.device_heartbeats
FOR INSERT
TO service_role
WITH CHECK (true);

-- =====================================================
-- PART 4: Helper Functions
-- =====================================================

-- Function: Get recent heartbeats for a device
CREATE OR REPLACE FUNCTION public.get_device_heartbeats(
  device_id_param UUID,
  limit_param INT DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  ip TEXT,
  rssi INTEGER,
  fw_version TEXT,
  ts TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user owns the device
  IF NOT EXISTS (
    SELECT 1 FROM public.devices
    WHERE id = device_id_param
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: device not found or not owned by user';
  END IF;

  RETURN QUERY
  SELECT
    dh.id,
    dh.ip,
    dh.rssi,
    dh.fw_version,
    dh.ts
  FROM public.device_heartbeats dh
  WHERE dh.device_id = device_id_param
  ORDER BY dh.ts DESC
  LIMIT limit_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_device_heartbeats(UUID, INT) TO authenticated;

COMMENT ON FUNCTION public.get_device_heartbeats(UUID, INT) IS
'Retrieves recent heartbeat telemetry for a specific device.
Only accessible by the device owner.';

-- =====================================================
-- PART 5: Data Migration
-- =====================================================

-- Migrate existing api_key_hash to device_key_hash (if api_key_hash exists)
-- This ensures backward compatibility with v2.0 devices
DO $$
BEGIN
  -- Check if api_key_hash column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'devices'
    AND column_name = 'api_key_hash'
  ) THEN
    -- Copy existing api_key_hash values to device_key_hash
    UPDATE public.devices
    SET device_key_hash = api_key_hash
    WHERE device_key_hash IS NULL
    AND api_key_hash IS NOT NULL;

    RAISE NOTICE 'Migrated % devices from api_key_hash to device_key_hash',
      (SELECT COUNT(*) FROM public.devices WHERE device_key_hash IS NOT NULL);
  END IF;
END $$;

-- =====================================================
-- PART 6: Comments and Documentation
-- =====================================================

COMMENT ON COLUMN public.devices.device_key_hash IS
'SHA-256 hash of the device-specific authentication key.
Used by Edge Function to authenticate device heartbeats.
Never exposed to client - only plain key is shown once during registration.';

COMMENT ON TABLE public.device_heartbeats IS
'Stores detailed telemetry from device heartbeats.
Populated by Edge Function (device-heartbeat) using service_role key.
Includes IP address, RSSI (WiFi signal strength), and firmware version.';

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
--
-- SECURITY IMPROVEMENTS:
-- - Devices no longer use anon key (removed from firmware)
-- - Each device has unique device_key (stored as hash in DB)
-- - Edge Function uses service_role key (never exposed)
-- - RLS policies ensure users only see their own data
--
-- DEPLOYMENT STEPS:
-- 1. Run this migration
-- 2. Deploy Edge Function (supabase/functions/device-heartbeat)
-- 3. Set env vars: SUPABASE_URL, SERVICE_ROLE_KEY
-- 4. Update firmware to v2.1 (HTTPS + device_key auth)
-- 5. Update frontend to generate device_key in registerDevice()
--
-- TESTING CHECKLIST:
-- □ Verify device_heartbeats table created
-- □ Verify device_key_hash index exists
-- □ Verify old device_heartbeat() RPC dropped
-- □ Verify RLS policies allow user to read own heartbeats
-- □ Verify Edge Function can insert heartbeats
-- □ Verify firmware can POST to Edge Function with device_key
--
-- =====================================================
