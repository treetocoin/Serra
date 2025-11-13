/**
 * Edge Function: device-heartbeat v3.0
 *
 * Auto-registers device keys on first heartbeat for simplified setup.
 *
 * Features:
 * 1. First heartbeat: ESP sends auto-generated key, backend stores hash
 * 2. Subsequent heartbeats: Validates against stored hash
 * 3. Supports both legacy UUID and new composite device IDs
 * 4. Inserts heartbeat telemetry using service_role key
 * 5. Updates device status and last_seen_at
 *
 * Security:
 * - Service role key never exposed to client
 * - Each device has unique auto-generated device_key
 * - All database writes use service_role (bypass RLS)
 * - SHA-256 hash verification prevents key leakage
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables (automatically injected by Supabase)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Validate environment variables at startup
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    `Missing environment variables: SUPABASE_URL=${!!SUPABASE_URL}, SERVICE_ROLE_KEY=${!!SUPABASE_SERVICE_ROLE_KEY}`
  );
}

// Headers for device authentication
const DEVICE_KEY_HEADER = "x-device-key";
const DEVICE_UUID_HEADER = "x-device-uuid"; // Legacy
const COMPOSITE_DEVICE_ID_HEADER = "x-composite-device-id"; // New

// Composite ID validation regex: PROJ1-ESP5 or P1000-ESP20
const COMPOSITE_ID_REGEX = /^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$/;

// Create Supabase client with service role key (bypass RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Hash device key using SHA-256 (matches frontend implementation)
 */
async function hashDeviceKey(deviceKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * CORS headers for preflight requests
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-key, x-device-uuid, x-composite-device-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1) Extract device authentication headers
    const deviceKey = req.headers.get(DEVICE_KEY_HEADER);
    const deviceUUID = req.headers.get(DEVICE_UUID_HEADER); // Legacy
    const compositeDeviceId = req.headers.get(COMPOSITE_DEVICE_ID_HEADER); // New

    // 2) Validate device key is present
    if (!deviceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing device key",
          details: "x-device-key header is required"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 3) Determine lookup strategy
    let device;
    let lookupField;

    if (compositeDeviceId) {
      // New: Lookup by composite ID
      // Validate format
      if (!COMPOSITE_ID_REGEX.test(compositeDeviceId)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid composite device ID format",
            details: "Expected format: PROJ1-ESP5 (project ID + device number 1-20)"
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      // Lookup by composite ID
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_key_hash, composite_device_id")
        .eq("composite_device_id", compositeDeviceId)
        .single();

      if (error || !data) {
        console.error("Device lookup failed (composite ID):", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Device not found",
            details: `Device ${compositeDeviceId} is not registered`
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      device = data;
      lookupField = compositeDeviceId;
    } else if (deviceUUID) {
      // Legacy: Lookup by UUID
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_key_hash, composite_device_id")
        .eq("id", deviceUUID)
        .single();

      if (error || !data) {
        console.error("Device lookup failed (UUID):", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Device not found"
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      device = data;
      lookupField = deviceUUID;
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing device identifier",
          details: "Provide either x-device-uuid or x-composite-device-id header"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 4) Handle first heartbeat (device_key_hash is NULL) vs subsequent heartbeats
    const deviceKeyHash = await hashDeviceKey(deviceKey);

    if (device.device_key_hash === null) {
      // First heartbeat - register the device key
      console.log("First heartbeat from device, registering key:", lookupField);

      const { error: updateErr } = await supabase
        .from("devices")
        .update({ device_key_hash: deviceKeyHash })
        .eq("id", device.id);

      if (updateErr) {
        console.error("Failed to register device key:", updateErr);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to register device key"
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      console.log("Device key registered successfully");
    } else {
      // Subsequent heartbeats - verify device key
      if (device.device_key_hash !== deviceKeyHash) {
        console.error("Device key mismatch for:", lookupField);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid device key",
            details: "Device key does not match stored hash"
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // 5) Parse heartbeat payload (optional telemetry data)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional, use empty object if JSON parsing fails
      body = {};
    }

    const rssi = typeof body.rssi === "number" ? body.rssi : null;
    const fwVersion = typeof body.fw_version === "string" ? body.fw_version : null;
    const ipAddress = typeof body.ip_address === "string" ? body.ip_address : null;
    const deviceHostname = typeof body.device_hostname === "string" ? body.device_hostname : null;

    // 6) Insert heartbeat telemetry
    const { error: insertErr } = await supabase
      .from("device_heartbeats")
      .insert({
        device_id: device.id,
        composite_device_id: device.composite_device_id || lookupField,
        rssi,
        fw_version: fwVersion,
        ip: ipAddress,
        ts: new Date().toISOString()
      });

    if (insertErr) {
      console.error("Heartbeat insert failed:", insertErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to record heartbeat"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // 7) Update device status and last_seen_at
    const updateData: any = {
      last_seen_at: new Date().toISOString(),
      status: "online",
    };

    if (fwVersion) updateData.firmware_version = fwVersion;
    if (deviceHostname) updateData.device_hostname = deviceHostname;

    const { error: updateErr } = await supabase
      .from("devices")
      .update(updateData)
      .eq("id", device.id);

    if (updateErr) {
      console.error("Device status update failed:", updateErr);
      // Don't fail the request - heartbeat was recorded
    }

    // 8) Return success response
    return new Response(
      JSON.stringify({
        success: true,
        device_id: device.composite_device_id || lookupField,
        status: "online",
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(e)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
