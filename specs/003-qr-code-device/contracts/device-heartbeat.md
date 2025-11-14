# API Contract: Device Heartbeat

**Endpoint**: ESP8266 Device Heartbeat
**Feature**: QR Code Device Onboarding
**Date**: 2025-10-09

---

## Supabase RPC Function

### `device_heartbeat()`

Called by ESP8266 devices to indicate online status and provide hostname.

#### SQL Signature

```sql
CREATE OR REPLACE FUNCTION device_heartbeat(
  device_id_param UUID,
  hostname_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER;
```

#### HTTP Request (from ESP8266)

**Method**: POST
**URL**: `https://[project].supabase.co/rest/v1/rpc/device_heartbeat`
**Headers**:
```
Content-Type: application/json
apikey: [SUPABASE_ANON_KEY]
Authorization: Bearer [SUPABASE_ANON_KEY]
```

**Body**:
```json
{
  "device_id_param": "550e8400-e29b-41d4-a716-446655440000",
  "hostname_param": "http://serrasetup-a1b2.local"
}
```

---

## Request Schema

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `device_id_param` | UUID | Yes | Device unique identifier (from registration) |
| `hostname_param` | TEXT | No | mDNS hostname (e.g., "http://serrasetup-a1b2.local") |

### Validation Rules

```sql
-- Enforced by function
- device_id_param MUST be a valid UUID
- device_id_param MUST exist in devices table
- hostname_param MUST match pattern: http://serrasetup-[a-f0-9]{4}.local
```

---

## Response Schema

### Success Response (200 OK)

```json
{
  "success": true,
  "timestamp": "2025-10-09T15:30:00.000Z"
}
```

### Error Responses

#### 404 Not Found

Device ID does not exist in database.

```sql
EXCEPTION: Device not found: 550e8400-e29b-41d4-a716-446655440000
```

Returns:
```json
{
  "error": {
    "code": "PGRST204",
    "message": "Device not found: 550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### 400 Bad Request

Invalid UUID format.

```json
{
  "error": {
    "code": "22P02",
    "message": "invalid input syntax for type uuid"
  }
}
```

---

## Function Implementation

```sql
CREATE OR REPLACE FUNCTION device_heartbeat(
  device_id_param UUID,
  hostname_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_affected INT;
BEGIN
  -- Update device status to online (from any previous state)
  UPDATE devices
  SET
    connection_status = 'online',  -- Always set to online when heartbeat received
    last_seen_at = NOW(),
    device_hostname = COALESCE(hostname_param, device_hostname),  -- Update hostname if provided
    firmware_version = COALESCE(
      (current_setting('request.headers')::json->>'x-firmware-version'),
      firmware_version
    )  -- Optional firmware version from header
  WHERE id = device_id_param;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Device not found: %', device_id_param;
  END IF;

  RETURN json_build_object(
    'success', true,
    'timestamp', NOW(),
    'status', 'online'
  );
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION device_heartbeat(UUID, TEXT) TO authenticated, anon;
```

---

## State Transitions

### Status Updates

```sql
-- First heartbeat after registration
connection_status: 'offline' → 'online'
last_seen_at: NULL → NOW()
device_hostname: NULL → "http://serrasetup-a1b2.local"

-- Subsequent heartbeats
connection_status: 'online' → 'online' (no change)
last_seen_at: [old timestamp] → NOW()
device_hostname: [unchanged] or [updated if new value provided]

-- Recovery from connection_failed
connection_status: 'connection_failed' → 'online'
last_seen_at: [old timestamp] → NOW()
```

---

## ESP8266 Implementation

### Arduino Code

```cpp
// ESP8266_Greenhouse_WebConfig.ino

#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// Supabase configuration
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

// Device configuration (from registration)
const char* DEVICE_ID = "550e8400-e29b-41d4-a716-446655440000";
const char* FIRMWARE_VERSION = "v1.3.0";

// mDNS hostname (generated from MAC address)
extern char MDNS_HOSTNAME[32];  // e.g., "serrasetup-a1b2"

void sendHeartbeat() {
  WiFiClientSecure client;
  HTTPClient http;

  client.setInsecure();  // Skip certificate validation (production should verify)

  String url = String(SUPABASE_URL) + "/rest/v1/rpc/device_heartbeat";
  http.begin(client, url);

  // Set headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("x-firmware-version", FIRMWARE_VERSION);  // Optional

  // Build payload with hostname
  String hostnameUrl = "http://" + String(MDNS_HOSTNAME) + ".local";
  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"hostname_param\":\"" + hostnameUrl + "\"}";

  // Send POST request
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Heartbeat successful");
    String response = http.getString();
    Serial.println("Response: " + response);
  } else {
    Serial.printf("✗ Heartbeat failed: HTTP %d\n", httpCode);
    Serial.println("Error: " + http.errorToString(httpCode));
  }

  http.end();
}

// Call heartbeat every 30 seconds
void loop() {
  static unsigned long lastHeartbeat = 0;
  const unsigned long HEARTBEAT_INTERVAL = 30000;  // 30 seconds

  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    if (WiFi.status() == WL_CONNECTED) {
      sendHeartbeat();
      lastHeartbeat = millis();
    }
  }

  // ... other loop code
}
```

---

## Heartbeat Frequency

### Recommended Intervals

| Scenario | Interval | Rationale |
|----------|----------|-----------|
| **Normal operation** | 30 seconds | Balance between freshness and server load |
| **Initial connection** | 5 seconds | Quick feedback for user during setup |
| **Error recovery** | 60 seconds | Avoid spamming after failures |

### Implementation

```cpp
#define HEARTBEAT_NORMAL 30000   // 30 seconds
#define HEARTBEAT_INITIAL 5000   // 5 seconds (first 5 minutes after connection)
#define HEARTBEAT_ERROR 60000    // 60 seconds (after failure)

unsigned long getHeartbeatInterval() {
  if (WiFi.status() != WL_CONNECTED) return HEARTBEAT_ERROR;

  unsigned long connectedTime = millis() - wifiConnectedAt;
  if (connectedTime < 300000) {  // First 5 minutes
    return HEARTBEAT_INITIAL;
  }

  return HEARTBEAT_NORMAL;
}
```

---

## Monitoring & Cleanup

### Timeout Detection (Frontend)

```typescript
// Poll devices and update status based on last_seen_at
useEffect(() => {
  const interval = setInterval(async () => {
    const { data: devices } = await supabase
      .from('devices')
      .select('id, connection_status, last_seen_at')
      .eq('user_id', user.id)
      .eq('connection_status', 'online');

    devices?.forEach(device => {
      const lastSeen = new Date(device.last_seen_at);
      const now = new Date();
      const secondsSinceLastSeen = (now.getTime() - lastSeen.getTime()) / 1000;

      if (secondsSinceLastSeen > 300) {  // 5 minutes = timeout
        // Mark as offline (done by backend cleanup function)
        console.warn(`Device ${device.id} hasn't sent heartbeat in 5 minutes`);
      }
    });
  }, 60000);  // Check every minute

  return () => clearInterval(interval);
}, [user]);
```

### Backend Cleanup Function

```sql
-- Run via pg_cron or manual trigger
CREATE OR REPLACE FUNCTION cleanup_device_status()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set to offline if no heartbeat for 5 minutes
  UPDATE devices
  SET connection_status = 'offline'
  WHERE connection_status = 'online'
    AND last_seen_at < NOW() - INTERVAL '5 minutes';

  -- Mark as connection_failed if registered but no heartbeat after 30s
  UPDATE devices
  SET connection_status = 'connection_failed'
  WHERE connection_status = 'offline'
    AND last_seen_at IS NULL
    AND registered_at > NOW() - INTERVAL '5 minutes'
    AND registered_at < NOW() - INTERVAL '30 seconds';

  RAISE NOTICE 'Cleanup completed: % rows updated', (SELECT COUNT(*) FROM devices WHERE connection_status != 'online');
END;
$$;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-device-status', '*/1 * * * *', 'SELECT cleanup_device_status()');
```

---

## Security Considerations

### Authentication

- Uses Supabase anon key (public key, safe to embed in firmware)
- Row Level Security (RLS) policies prevent unauthorized updates:

```sql
-- RLS Policy: Devices can update their own status
CREATE POLICY "Devices can update their own heartbeat"
ON devices FOR UPDATE
USING (id = (current_setting('request.jwt.claims')::json->>'device_id')::uuid)
WITH CHECK (id = (current_setting('request.jwt.claims')::json->>'device_id')::uuid);
```

### Rate Limiting

**Backend**: Supabase has built-in rate limiting (1000 requests/minute per IP)

**Firmware**: Enforce minimum 5-second interval between heartbeats

```cpp
void sendHeartbeat() {
  static unsigned long lastCall = 0;
  if (millis() - lastCall < 5000) {
    Serial.println("⚠ Heartbeat rate limit - waiting...");
    return;
  }
  lastCall = millis();

  // ... send heartbeat
}
```

---

## Error Handling

### Retry Logic

```cpp
void sendHeartbeatWithRetry() {
  const int MAX_RETRIES = 3;
  int attempts = 0;

  while (attempts < MAX_RETRIES) {
    int httpCode = sendHeartbeat();

    if (httpCode == 200) {
      return;  // Success
    }

    attempts++;
    Serial.printf("Heartbeat attempt %d/%d failed\n", attempts, MAX_RETRIES);

    if (attempts < MAX_RETRIES) {
      delay(5000);  // Wait 5 seconds before retry
    }
  }

  Serial.println("✗ All heartbeat attempts failed - will retry in next interval");
}
```

---

**Related Contracts**:
- [device-registration.md](./device-registration.md) - Provides device_id for heartbeat
- [qr-code-generation.md](./qr-code-generation.md) - Uses hostname from heartbeat
