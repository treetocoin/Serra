# Edge Function: device-heartbeat (v2.0)

**Feature**: 004-tutto-troppo-complicato
**Date**: 2025-11-12
**Version**: 2.0.0 (supports composite device IDs)

## Overview

The `device-heartbeat` Edge Function receives periodic heartbeat messages from ESP8266 devices, validates authentication, updates device status, and stores telemetry data.

**Version 2.0 Changes**:
- Accepts both legacy UUID (`x-device-uuid` header) and new composite ID (`x-composite-device-id` header)
- Validates composite device ID format
- Maintains backward compatibility during migration (Phases 1-2)

---

## Endpoint

**URL**: `https://[PROJECT_ID].supabase.co/functions/v1/device-heartbeat`

**Method**: `POST`

**Content-Type**: `application/json`

---

## Authentication

**Required Headers**:

| Header | Type | Required | Description | Version |
|--------|------|----------|-------------|---------|
| `x-device-key` | string | Yes | Device authentication key (64 hex chars) | All |
| `x-device-uuid` | string | Conditional | Legacy device UUID | v1.x (Phase 0-2) |
| `x-composite-device-id` | string | Conditional | Composite device ID (e.g., "PROJ1-ESP5") | v2.0+ (Phase 1+) |

**Authentication Logic**:
```
IF x-composite-device-id header present:
  Use composite ID to lookup device
ELSE IF x-device-uuid header present:
  Use UUID to lookup device (legacy)
ELSE:
  Return 400 Bad Request
```

**Validation**:
- `x-device-key`: Must be exactly 64 hexadecimal characters
- `x-device-uuid`: Must be valid UUID format (if provided)
- `x-composite-device-id`: Must match `^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$` (if provided)
- Device key must match stored `device_key_hash` (SHA-256 comparison)

---

## Request Body

**Schema**:
```typescript
interface HeartbeatRequest {
  rssi?: number;          // WiFi signal strength (dBm)
  ip_address?: string;    // Device IP address
  fw_version?: string;    // Firmware version (e.g., "v3.0.0")
  ts?: string;            // Optional device timestamp (ISO 8601)
}
```

**Example**:
```json
{
  "rssi": -65,
  "ip_address": "192.168.1.100",
  "fw_version": "v3.0.0",
  "ts": "2025-11-12T10:30:00Z"
}
```

**Field Validation**:
- `rssi`: Integer, typically -100 to 0 (optional)
- `ip_address`: Valid IP address string (optional)
- `fw_version`: String, max 20 chars (optional)
- `ts`: ISO 8601 timestamp (optional, server time is authoritative)

---

## Response

### Success Response (200 OK)

**Schema**:
```typescript
interface HeartbeatResponse {
  success: true;
  device_id: string;      // Composite ID (e.g., "PROJ1-ESP5") or UUID (legacy)
  status: string;         // "online"
  timestamp: string;      // Server timestamp (ISO 8601)
}
```

**Example**:
```json
{
  "success": true,
  "device_id": "PROJ1-ESP5",
  "status": "online",
  "timestamp": "2025-11-12T10:30:05.123Z"
}
```

---

### Error Responses

#### 400 Bad Request - Missing Identifier

**Condition**: Neither `x-device-uuid` nor `x-composite-device-id` header provided

**Response**:
```json
{
  "success": false,
  "error": "Missing device identifier",
  "details": "Provide either x-device-uuid or x-composite-device-id header"
}
```

---

#### 400 Bad Request - Invalid Format

**Condition**: Composite device ID doesn't match required format

**Response**:
```json
{
  "success": false,
  "error": "Invalid composite device ID format",
  "details": "Expected format: PROJ1-ESP5 (project ID + device number 1-20)"
}
```

---

#### 401 Unauthorized - Missing Device Key

**Condition**: `x-device-key` header not provided

**Response**:
```json
{
  "success": false,
  "error": "Missing device key",
  "details": "x-device-key header is required"
}
```

---

#### 401 Unauthorized - Invalid Device Key

**Condition**: Device key doesn't match stored hash

**Response**:
```json
{
  "success": false,
  "error": "Invalid device key",
  "details": "Device key does not match stored hash"
}
```

---

#### 404 Not Found - Device Not Registered

**Condition**: Device ID not found in database

**Response**:
```json
{
  "success": false,
  "error": "Device not found",
  "details": "Device PROJ1-ESP5 is not registered"
}
```

---

#### 500 Internal Server Error

**Condition**: Database error or unexpected failure

**Response**:
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Failed to update device status"
}
```

---

## Processing Flow

```
1. Extract headers:
   - x-device-key (required)
   - x-composite-device-id OR x-device-uuid (one required)

2. Determine device identifier:
   IF x-composite-device-id provided:
     - Validate format (regex)
     - Use composite ID for lookup
   ELSE IF x-device-uuid provided:
     - Use UUID for lookup
   ELSE:
     - Return 400 Bad Request

3. Lookup device in database:
   - Query devices table by identifier
   - Retrieve device_key_hash

4. Verify authentication:
   - Hash provided device_key with SHA-256
   - Compare with stored device_key_hash
   - If mismatch: Return 401 Unauthorized

5. Extract telemetry from request body:
   - rssi (optional)
   - ip_address (optional)
   - fw_version (optional)

6. Insert heartbeat record:
   INSERT INTO device_heartbeats (
     device_id,
     composite_device_id,
     rssi,
     ip_address,
     fw_version,
     ts
   ) VALUES (...)

7. Update device status:
   UPDATE devices SET
     status = 'online',
     last_seen_at = NOW(),
     rssi = <rssi>,
     ip_address = <ip_address>,
     fw_version = <fw_version>
   WHERE id = <device_id>

8. Return success response
```

---

## Database Triggers

**Trigger**: `on_device_heartbeat_received()`

**Fires**: AFTER INSERT ON `device_heartbeats`

**Purpose**: Logs status changes and enables recovery notifications

**Behavior**:
```sql
1. Check if device was previously offline:
   - Query devices.status WHERE device_id = NEW.device_id

2. If device was offline (status = 'offline'):
   - Log recovery event in device_status_events table:
     INSERT INTO device_status_events (
       device_id,
       previous_status,
       new_status,
       reason,
       detected_at
     ) VALUES (
       NEW.device_id,
       'offline',
       'online',
       'heartbeat_received',
       NOW()
     )

3. If device was in 'waiting' state (first heartbeat):
   - Log initial connection event
```

---

## Example ESP8266 Request

**Arduino C++ Code**:
```cpp
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

void sendHeartbeat() {
  WiFiClientSecure client;
  client.setInsecure(); // For testing, use certificate validation in production

  HTTPClient http;

  String url = "https://fmyomzywzjtxmabvvjcd.supabase.co/functions/v1/device-heartbeat";
  http.begin(client, url);

  // Headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", deviceConfig.device_key); // 64 hex chars
  http.addHeader("x-composite-device-id", deviceConfig.composite_device_id); // "PROJ1-ESP5"

  // Body
  String payload = "{";
  payload += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  payload += "\"ip_address\":\"" + WiFi.localIP().toString() + "\",";
  payload += "\"fw_version\":\"v3.0.0\"";
  payload += "}";

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Heartbeat sent successfully: " + response);
  } else {
    Serial.println("Heartbeat failed: " + String(httpCode));
  }

  http.end();
}
```

**Example Request**:
```http
POST /functions/v1/device-heartbeat HTTP/1.1
Host: fmyomzywzjtxmabvvjcd.supabase.co
Content-Type: application/json
x-device-key: a1b2c3d4e5f6...0123456789abcdef (64 hex chars)
x-composite-device-id: PROJ1-ESP5

{
  "rssi": -65,
  "ip_address": "192.168.1.100",
  "fw_version": "v3.0.0"
}
```

**Example Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "device_id": "PROJ1-ESP5",
  "status": "online",
  "timestamp": "2025-11-12T10:30:05.123Z"
}
```

---

## Migration Compatibility Matrix

| Phase | ESP Firmware | Headers Sent | Edge Function Behavior |
|-------|--------------|--------------|------------------------|
| 0 (Legacy) | v2.x | `x-device-uuid` + `x-device-key` | Lookup by UUID, update status |
| 1-2 (Dual) | v2.x (old ESP) | `x-device-uuid` + `x-device-key` | Lookup by UUID, update status |
| 1-2 (Dual) | v3.x (new ESP) | `x-composite-device-id` + `x-device-key` | Lookup by composite ID, update status |
| 3+ (New) | v3.x | `x-composite-device-id` + `x-device-key` | Lookup by composite ID, update status |
| 4+ (Cleanup) | v3.x | `x-composite-device-id` + `x-device-key` | Lookup by composite ID (UUID support removed) |

---

## Performance Requirements

**Latency**:
- Target: < 100ms p50
- Acceptable: < 200ms p95
- Maximum: < 500ms p99

**Throughput**:
- Target: 100 req/s (supports 6,000 devices at 60s heartbeat interval)
- Scale: 1,000 req/s (supports 60,000 devices)

**Availability**:
- Target: 99.9% uptime
- Graceful degradation: If database unavailable, return 503 but don't crash

---

## Security Considerations

**Authentication**:
- Device key never sent in URL or body (only headers)
- Device key hash stored in database (SHA-256), never plaintext
- HTTPS required for all requests (TLS 1.2+)

**Rate Limiting**:
- Per-device: Max 2 requests per minute (heartbeat every 60s + tolerance)
- Global: Max 1,000 requests per second (Supabase default)

**Input Validation**:
- All string inputs sanitized and length-limited
- Regex validation for composite device ID format
- UUID validation for legacy device ID

**Authorization**:
- Device key is device-specific (not shared across devices)
- No user-level authentication required (device key sufficient)
- RLS policies prevent cross-user data access

---

## Monitoring & Logging

**Metrics to Track**:
- Request count per device per hour
- Success rate (200 vs 4xx/5xx)
- Latency (p50, p95, p99)
- Authentication failures per device

**Log Events**:
- Device first connection (status: waiting → online)
- Device recovery (status: offline → online)
- Authentication failures (potential security issue)
- Malformed requests (potential firmware bug)

**Alerts**:
- Authentication failure rate > 5% (investigate device keys)
- Latency p95 > 500ms (database performance issue)
- 5xx error rate > 1% (Edge Function bug)

---

## Testing Checklist

**Unit Tests**:
- [ ] Valid composite device ID format accepted
- [ ] Invalid composite device ID format rejected (400)
- [ ] Valid UUID format accepted (legacy)
- [ ] Missing device identifier rejected (400)
- [ ] Valid device key authenticates successfully
- [ ] Invalid device key rejected (401)
- [ ] Device not found returns 404
- [ ] Telemetry correctly stored in heartbeats table
- [ ] Device status updated to 'online'
- [ ] Server timestamp used (not device timestamp)

**Integration Tests**:
- [ ] ESP8266 firmware can send heartbeat successfully
- [ ] Device status changes from 'waiting' to 'online' on first heartbeat
- [ ] Device status changes from 'offline' to 'online' on recovery
- [ ] Multiple devices can send heartbeats concurrently
- [ ] Heartbeats from deleted devices are rejected (404)

**Performance Tests**:
- [ ] 100 concurrent devices (100 req/s) complete in < 200ms p95
- [ ] 1000 heartbeats complete in < 10 seconds

---

## Summary

Edge Function v2.0 provides backward-compatible heartbeat processing with support for both legacy UUID and new composite device IDs. It enforces authentication, updates device status, and stores telemetry efficiently.

**Key Changes from v1.x**:
- Accepts `x-composite-device-id` header (in addition to `x-device-uuid`)
- Validates composite device ID format
- Stores composite device ID in heartbeats table
- Maintains full backward compatibility during migration

**Next Version (v3.0)**:
- Remove support for `x-device-uuid` header (after Phase 4 cleanup)
- Simplify lookup logic (composite ID only)
