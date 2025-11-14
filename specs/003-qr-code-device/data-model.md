# Data Model: QR Code Device Onboarding

**Date**: 2025-10-09
**Feature**: QR Code Device Onboarding
**Branch**: `003-qr-code-device`

## Overview

This document defines the data entities, relationships, and validation rules for QR code-based device onboarding. The feature builds on the existing `devices` table structure with minimal schema changes.

---

## Entity Diagram

```
┌─────────────────────┐
│      auth.users     │
│                     │
│  - id (UUID) PK     │
│  - email            │
└──────────┬──────────┘
           │ 1
           │
           │ *
     ┌─────▼──────────────────────┐
     │       devices              │
     │                            │
     │  - id (UUID) PK            │ ──┐
     │  - user_id (UUID) FK       │   │ Generates
     │  - name (TEXT)             │   │
     │  - device_hostname (TEXT)  │   │
     │  - connection_status (ENUM)│   │
     │  - last_seen_at (TIMESTAMP)│   │
     │  - registered_at (TIMESTAMP)│  │
     │  - api_key_hash (TEXT)     │   │
     │  - firmware_version (TEXT) │   │
     └────────────────────────────┘   │
                                      │
                                      │
                         ┌────────────▼─────────────┐
                         │   QR Code (Computed)     │
                         │                          │
                         │  - SSID (from hostname)  │
                         │  - WiFi QR String        │
                         │  - Data URL (base64)     │
                         └──────────────────────────┘
```

---

## Entities

### 1. Device (Existing, Modified)

Represents an ESP8266 device registered to a user's account.

**Table**: `devices`
**Primary Key**: `id` (UUID, auto-generated)
**Relationships**:
- `user_id` → `auth.users.id` (many-to-one)

#### Fields

| Field Name | Type | Constraints | Description | Changes |
|------------|------|-------------|-------------|---------|
| `id` | UUID | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | Immutable system identifier | Existing |
| `user_id` | UUID | FOREIGN KEY (auth.users.id), NOT NULL | Owner of the device | Existing |
| `name` | TEXT | NOT NULL | User-customizable device label (can be duplicate) | Existing |
| `device_hostname` | TEXT | NULLABLE | mDNS hostname (e.g., "http://serrasetup-a1b2.local") | Existing |
| `connection_status` | ENUM | NOT NULL, DEFAULT 'offline' | Current connection state | **MODIFIED** - Add 'connection_failed' value |
| `last_seen_at` | TIMESTAMP | NULLABLE | Last successful heartbeat timestamp | Existing |
| `registered_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | Initial device registration time | Existing |
| `api_key_hash` | TEXT | NOT NULL | Hashed API key for device authentication | Existing |
| `firmware_version` | TEXT | NULLABLE | ESP8266 firmware version (self-reported) | Existing |
| `configuration_requested` | BOOLEAN | NOT NULL, DEFAULT false | Flag for pending sensor/actuator config | Existing |

#### Connection Status Enum

**Type**: `connection_status`

**Values** (Modified):
- `offline` - Device never connected or last seen >5 minutes ago
- `online` - Device actively sending heartbeats (last_seen_at <30s ago)
- **`connection_failed`** (NEW) - Device attempted WiFi connection but timed out (30s)

**State Transitions**:
```sql
-- Registration → offline
INSERT INTO devices (...) VALUES (...);  -- connection_status = 'offline'

-- First heartbeat → online
UPDATE devices SET connection_status = 'online' WHERE id = ? AND connection_status = 'offline';

-- Heartbeat timeout → offline (after 5 minutes)
UPDATE devices SET connection_status = 'offline' WHERE last_seen_at < NOW() - INTERVAL '5 minutes';

-- WiFi connection timeout → connection_failed (after 30 seconds post-registration)
UPDATE devices SET connection_status = 'connection_failed'
WHERE connection_status = 'offline'
  AND registered_at > NOW() - INTERVAL '1 minute'
  AND last_seen_at IS NULL;

-- Recovery: connection_failed → online (when heartbeat finally received)
UPDATE devices SET connection_status = 'online' WHERE id = ? AND connection_status = 'connection_failed';
```

#### Validation Rules

- **name**:
  - MIN length: 1 character
  - MAX length: 255 characters
  - Can contain duplicates (no unique constraint)
- **device_hostname**:
  - Format: `http://serrasetup-XXXX.local` where XXXX = last 2 bytes of MAC address (hex)
  - Example: `http://serrasetup-a1b2.local`
  - Updated by ESP8266 via heartbeat
- **api_key_hash**:
  - SHA-256 hash of randomly generated API key
  - Generated server-side at registration
  - Never exposed to client (plain API key shown once at registration)
- **connection_status**:
  - Cannot be NULL
  - Must be one of: 'offline', 'online', 'connection_failed'

#### Indexes

```sql
-- Existing indexes
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_last_seen_at ON devices(last_seen_at);

-- NEW: Optimize status-based queries
CREATE INDEX idx_devices_connection_status ON devices(connection_status)
WHERE connection_status != 'offline';  -- Partial index for active monitoring
```

---

### 2. QR Code (Computed Entity - Not Stored)

Generated on-demand from device hostname. No database table.

#### Computed Fields

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `ssid` | STRING | Extracted from `device_hostname` | WiFi AP SSID (e.g., "serrasetup-a1b2") |
| `wifi_qr_string` | STRING | Generated | Standard WiFi QR format: `WIFI:S:{ssid};;` |
| `qr_data_url` | STRING (Base64) | Generated | Canvas-rendered QR code as data URL |

#### Generation Logic

```typescript
// TypeScript pseudocode
interface QRCodeData {
  ssid: string;
  wifiQRString: string;
  qrDataURL: string;
}

function generateQRCode(deviceHostname: string): QRCodeData {
  // Extract SSID from hostname
  const url = new URL(deviceHostname); // "http://serrasetup-a1b2.local"
  const ssid = url.hostname.split('.')[0]; // "serrasetup-a1b2"

  // Build WiFi QR string (open network, no password)
  const wifiQRString = `WIFI:S:${ssid};;`;

  // Generate QR code image
  const qrDataURL = await QRCode.toDataURL(wifiQRString, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: 'M',
  });

  return { ssid, wifiQRString, qrDataURL };
}
```

---

## Database Schema Changes

### Migration: Add `connection_failed` Status

```sql
-- Migration: 003_qr_device_onboarding.sql
-- Add new connection status value

-- Step 1: Add enum value (PostgreSQL 12+)
ALTER TYPE connection_status ADD VALUE IF NOT EXISTS 'connection_failed';

-- Step 2: Add index for status-based filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_connection_status
ON devices(connection_status)
WHERE connection_status != 'offline';

-- Step 3: Add comment for documentation
COMMENT ON COLUMN devices.connection_status IS
  'Device connection state:
   - offline: Never connected or last seen >5min ago
   - online: Actively sending heartbeats (<30s ago)
   - connection_failed: WiFi connection timed out (30s), device returned to AP mode';

-- Step 4: Update RPC function to handle new status
CREATE OR REPLACE FUNCTION device_heartbeat(
  device_id_param UUID,
  hostname_param TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update device status to online (from any previous state)
  UPDATE devices
  SET
    connection_status = 'online',  -- Always set to online when heartbeat received
    last_seen_at = NOW(),
    device_hostname = COALESCE(hostname_param, device_hostname)
  WHERE id = device_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Device not found: %', device_id_param;
  END IF;

  RETURN json_build_object(
    'success', true,
    'timestamp', NOW()
  );
END;
$$;

-- Step 5: Add cleanup function for failed connections
CREATE OR REPLACE FUNCTION cleanup_connection_status()
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
  -- (Only for recently registered devices to avoid false positives)
  UPDATE devices
  SET connection_status = 'connection_failed'
  WHERE connection_status = 'offline'
    AND last_seen_at IS NULL
    AND registered_at > NOW() - INTERVAL '5 minutes'
    AND registered_at < NOW() - INTERVAL '30 seconds';
END;
$$;

-- Optional: Schedule cleanup function (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-device-status', '*/1 * * * *', 'SELECT cleanup_connection_status()');
```

---

## Data Integrity Rules

### Referential Integrity

1. **User Ownership**:
   ```sql
   ALTER TABLE devices
   ADD CONSTRAINT fk_devices_user_id
   FOREIGN KEY (user_id) REFERENCES auth.users(id)
   ON DELETE CASCADE;  -- Delete devices when user is deleted
   ```

2. **No Orphaned Devices**:
   - Every device MUST have a valid `user_id`
   - If user is deleted, all their devices are cascade-deleted

### Business Logic Constraints

1. **API Key Uniqueness**:
   ```sql
   -- api_key_hash must be unique across all devices
   ALTER TABLE devices ADD CONSTRAINT unique_api_key_hash UNIQUE (api_key_hash);
   ```

2. **Hostname Format** (Application-level validation):
   ```typescript
   function validateHostname(hostname: string): boolean {
     const pattern = /^http:\/\/serrasetup-[0-9a-f]{4}\.local$/;
     return pattern.test(hostname);
   }
   ```

3. **Status Consistency** (Trigger):
   ```sql
   -- Ensure last_seen_at is updated when status changes to 'online'
   CREATE OR REPLACE FUNCTION ensure_last_seen_on_online()
   RETURNS TRIGGER AS $$
   BEGIN
     IF NEW.connection_status = 'online' AND NEW.last_seen_at IS NULL THEN
       NEW.last_seen_at = NOW();
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trg_ensure_last_seen
   BEFORE UPDATE ON devices
   FOR EACH ROW
   EXECUTE FUNCTION ensure_last_seen_on_online();
   ```

---

## Query Patterns

### 1. Register New Device

```sql
INSERT INTO devices (user_id, name, api_key_hash)
VALUES (
  'user-uuid',
  'My Greenhouse',
  'sha256-hash-of-api-key'
)
RETURNING id, name, registered_at;
-- Returns UUID for device, displayed with QR code
```

### 2. Get Device with QR Code Data

```typescript
// Frontend service
async getDeviceWithQR(deviceId: string): Promise<DeviceWithQR> {
  const device = await supabase
    .from('devices')
    .select('id, name, device_hostname, connection_status, last_seen_at')
    .eq('id', deviceId)
    .single();

  if (!device.data?.device_hostname) {
    throw new Error('Device hostname not set - device has not sent first heartbeat');
  }

  const qrCode = await generateQRCode(device.data.device_hostname);

  return {
    ...device.data,
    qrCode,
  };
}
```

### 3. Monitor Connection Status

```sql
-- Get all devices with failed connections (for user notification)
SELECT id, name, registered_at, device_hostname
FROM devices
WHERE user_id = 'user-uuid'
  AND connection_status = 'connection_failed'
ORDER BY registered_at DESC;
```

### 4. Cleanup Stale Status

```sql
-- Run periodically (e.g., via cron or frontend polling)
SELECT cleanup_connection_status();
```

---

## Summary of Changes

| Change Type | Description | Impact |
|-------------|-------------|--------|
| **Enum Extension** | Add 'connection_failed' to connection_status | Migration required, backward compatible |
| **Index Addition** | Partial index on connection_status | Improves query performance |
| **RPC Update** | device_heartbeat handles all status transitions | Existing devices unaffected |
| **New Function** | cleanup_connection_status() for timeout monitoring | Optional background job |
| **Computed Entity** | QR Code generated from device_hostname | No schema change, frontend-only |

**Backward Compatibility**: ✅ All changes are additive. Existing devices continue working without modification.

---

**Next Phase**: Create contracts/ directory with API endpoint specifications.
