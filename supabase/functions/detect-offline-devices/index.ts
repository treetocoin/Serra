/**
 * Edge Function: detect-offline-devices
 *
 * Scheduled function to mark devices as offline if they haven't sent a heartbeat
 * within the threshold period (2 minutes).
 *
 * This function should be called periodically (e.g., every minute) via Supabase Cron
 * or external scheduler.
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OFFLINE_THRESHOLD_SECONDS = 120; // 2 minutes

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find devices that should be offline
  const thresholdTime = new Date(Date.now() - OFFLINE_THRESHOLD_SECONDS * 1000).toISOString();

  const { data: offlineDevices, error } = await supabase
    .from("devices")
    .select("id, composite_device_id, last_seen_at, status")
    .eq("status", "online")
    .lt("last_seen_at", thresholdTime);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Update their status
  if (offlineDevices && offlineDevices.length > 0) {
    const deviceIds = offlineDevices.map(d => d.id);

    const { error: updateError } = await supabase
      .from("devices")
      .update({ status: "offline" })
      .in("id", deviceIds);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Marked ${offlineDevices.length} devices as offline`);
  }

  return new Response(
    JSON.stringify({
      processed: offlineDevices?.length || 0,
      threshold_seconds: OFFLINE_THRESHOLD_SECONDS,
      timestamp: new Date().toISOString()
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
