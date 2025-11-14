# Research: QR Code Device Onboarding

**Date**: 2025-10-09
**Feature**: QR Code Device Onboarding
**Branch**: `003-qr-code-device`

## Overview

This document captures all technical research and decisions made for implementing QR code-based ESP8266 device onboarding with captive portal WiFi configuration.

---

## 1. QR Code Generation

### Decision
Use **`qrcode`** npm package (https://www.npmjs.com/package/qrcode) for browser-based QR code generation.

### Rationale
- Lightweight (~40KB gzipped)
- Supports standard WiFi QR format (`WIFI:S:<SSID>;T:<WPA/WEP>;P:<password>;;`)
- Canvas and SVG output options
- Works in browser without build dependencies
- Widely used (10M+ weekly downloads)

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| `qrcode.react` | React wrapper adds unnecessary abstraction, same underlying library |
| `react-qr-code` | SVG-only, no canvas support for downloads |
| Manual implementation | Reinventing wheel, error-prone for WiFi format |
| Server-side generation | Adds latency, unnecessary backend complexity |

### Implementation Pattern
```typescript
import QRCode from 'qrcode';

// Generate WiFi QR code
const wifiQRString = `WIFI:S:${ssid};;`; // Open network format
const qrCodeDataURL = await QRCode.toDataURL(wifiQRString, {
  width: 256,
  margin: 2,
  errorCorrectionLevel: 'M',
});
```

---

## 2. Device Status Synchronization

### Decision
Use **TanStack Query with 30-second polling** for device status updates.

### Rationale
- Consistent with existing codebase patterns (already using TanStack Query)
- Simple implementation (`refetchInterval: 30000`)
- Status changes are infrequent (device comes online once per setup)
- No need for real-time sub-second updates
- Lower server load than WebSockets for this use case

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Supabase Realtime | Adds complexity, overkill for low-frequency updates |
| WebSockets | Requires persistent connection, harder to scale |
| Manual setInterval | TanStack Query handles caching, deduplication automatically |
| Server-Sent Events | Browser compatibility issues, more complex than polling |

### Implementation Pattern
```typescript
const { data: device } = useQuery({
  queryKey: ['device', deviceId],
  queryFn: () => devicesService.getDevice(deviceId),
  refetchInterval: 30000, // Poll every 30 seconds
  enabled: !!deviceId,
});
```

---

## 3. QR Code Persistence Strategy

### Decision
**Generate QR codes on-demand** from device hostname (not stored in database).

### Rationale
- QR code is deterministic: `device_hostname` → `WIFI:S:${hostname};;` → QR image
- Saves database storage (no blob/base64 columns)
- Always up-to-date if hostname changes
- Generation is fast (<50ms in browser)
- No migration needed for existing devices

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Store as base64 in database | Wastes ~2KB per device, hard to update if hostname changes |
| Pre-generate at registration | Same storage issue, can't regenerate if lost |
| Store as separate file | Requires file storage service, adds complexity |

### Implementation Pattern
```typescript
// Service method
async generateQRCode(deviceId: string): Promise<string> {
  const device = await this.getDevice(deviceId);
  if (!device.device_hostname) throw new Error('Device hostname not set');

  const ssid = new URL(device.device_hostname).hostname; // Extract SSID from hostname
  const wifiQR = `WIFI:S:${ssid};;`;
  return QRCode.toDataURL(wifiQR);
}
```

---

## 4. WiFi Connection Timeout & Retry Logic

### Decision
**30-second timeout** before ESP8266 returns to AP mode after WiFi failure.

### Rationale
- Balances user feedback speed with network tolerance
- Allows time for slower routers to authenticate (DHCP can take 10-15s)
- Short enough to avoid user frustration
- Standard practice in IoT devices (Nest, Philips Hue use 20-40s)

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| 15 seconds | Too fast for some enterprise WiFi networks |
| 60 seconds | Too slow, user thinks device is frozen |
| Exponential backoff | Over-engineered for single retry scenario |

### Firmware Implementation
```cpp
#define WIFI_CONNECT_TIMEOUT 30000  // 30 seconds

void connectToWiFi(const char* ssid, const char* password) {
  WiFi.begin(ssid, password);
  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime > WIFI_CONNECT_TIMEOUT) {
      // Connection failed - show error LED, return to AP mode
      blinkLEDError();
      setupAccessPoint();
      return;
    }
    delay(500);
    blinkLEDConnecting();
  }

  // Success - solid LED, send heartbeat
  digitalWrite(LED_PIN, HIGH);
  sendHeartbeat();
}
```

---

## 5. LED Error Feedback Patterns

### Decision
Use **distinct blink patterns** for different states:
- **Solid ON**: Connected and online
- **Slow blink (1Hz)**: Connecting to WiFi
- **Fast blink (10Hz)**: WiFi connection failed
- **Off**: AP mode ready for configuration

### Rationale
- Clear visual distinction for users without webapp access
- Standard Arduino/IoT convention
- Works on all ESP8266 boards (single LED)
- No additional hardware required

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| RGB LED colors | Not available on all ESP8266 NodeMCU boards |
| Beeper/buzzer | Annoying in home environment |
| LCD display | Adds cost and complexity |
| Different blink counts | Harder to distinguish than frequency |

### Firmware Implementation
```cpp
void blinkLEDError() {
  for (int i = 0; i < 50; i++) {  // Blink fast for 5 seconds
    digitalWrite(LED_PIN, i % 2);
    delay(100);  // 10Hz
  }
  digitalWrite(LED_PIN, LOW);
}

void blinkLEDConnecting() {
  digitalWrite(LED_PIN, (millis() / 1000) % 2);  // 1Hz slow blink
}
```

---

## 6. Device ID Field Structure

### Decision
**Dual identifier system**:
- `id` (UUID): Immutable, auto-generated, used for all database operations
- `name` (text): User-customizable label, editable on ESP8266, can be duplicated

### Rationale
- UUID provides guaranteed uniqueness for system operations
- User-friendly name allows organization ("Greenhouse 1", "Greenhouse 2")
- Duplicate names don't break system (relies on UUID)
- Matches existing database schema (no migration needed)

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Single editable ID field | Risk of duplicates breaking queries |
| Enforce unique names | Too restrictive, users want duplicate names |
| Auto-increment IDs | Not suitable for distributed systems |
| MAC address as ID | Not user-friendly, can't be customized |

### Database Schema (Existing)
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Immutable system ID
  name TEXT NOT NULL,                             -- User-customizable label
  device_hostname TEXT,                           -- mDNS hostname (e.g., serrasetup-a1b2.local)
  user_id UUID REFERENCES auth.users(id),
  -- ... other fields
);
```

---

## 7. Connection Status State Machine

### Decision
Add **"connection_failed"** status to existing enum, with timeout-based transition logic.

### Current States
- `offline`: Device never connected or not seen in >5 minutes
- `online`: Device actively sending heartbeats
- **`connection_failed`** (NEW): Device attempted WiFi connection but failed

### State Transitions
```
[Registration] → offline
offline + [heartbeat received] → online
online + [no heartbeat for 5min] → offline
offline + [30s timeout, no heartbeat] → connection_failed
connection_failed + [heartbeat received] → online
connection_failed + [user resets device] → offline
```

### Implementation
```sql
-- Add new enum value
ALTER TYPE connection_status ADD VALUE IF NOT EXISTS 'connection_failed';

-- Heartbeat function updates status
CREATE OR REPLACE FUNCTION device_heartbeat(device_id_param UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE devices
  SET
    connection_status = 'online',
    last_seen_at = NOW()
  WHERE id = device_id_param;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Timeout monitoring (separate cron job or frontend logic)
-- After 30s of no heartbeat post-registration → set to 'connection_failed'
```

---

## 8. QR Code Access Permissions

### Decision
**Always show QR code button** on device detail page (no restrictions).

### Rationale
- User owns the device, should always access setup info
- Needed for device troubleshooting/reconfiguration
- No security risk (QR only contains AP SSID, not credentials)
- Simplifies UI (no conditional rendering based on device state)

### Alternatives Considered
| Alternative | Why Rejected |
|-------------|--------------|
| Hide QR after first connection | Users can't reconfigure if WiFi changes |
| Show only for offline devices | Arbitrary restriction, adds UI complexity |
| Time-limited access | Over-engineered for home IoT use case |

### UI Implementation
```typescript
// Always render QR code button
<button onClick={() => setShowQRModal(true)}>
  View QR Code
</button>

// Modal handles QR generation on-demand
{showQRModal && (
  <QRCodeDisplay deviceId={device.id} onClose={() => setShowQRModal(false)} />
)}
```

---

## Summary of Key Decisions

| Topic | Decision | Impact |
|-------|----------|--------|
| QR Code Library | `qrcode` npm package | Frontend dependency |
| Status Sync | TanStack Query polling (30s) | No new backend infrastructure |
| QR Storage | Generate on-demand | No database schema change |
| WiFi Timeout | 30 seconds | Firmware constant |
| LED Patterns | Frequency-based (1Hz, 10Hz) | Firmware LED logic |
| Device ID | UUID + editable name | Existing schema works |
| Connection Status | Add `connection_failed` enum | Migration needed |
| QR Access | Always available | Simplified UI logic |

---

**Next Phase**: Create data-model.md with detailed entity definitions and relationships.
