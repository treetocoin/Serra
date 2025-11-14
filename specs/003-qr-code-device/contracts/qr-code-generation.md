# API Contract: QR Code Generation

**Endpoint**: Generate QR Code for Device
**Feature**: QR Code Device Onboarding
**Date**: 2025-10-09

---

## Frontend Service Method

### `devicesService.generateQRCode()`

Generates a WiFi QR code from device hostname for mobile scanning.

#### TypeScript Signature

```typescript
interface QRCodeData {
  ssid: string;           // WiFi AP SSID (e.g., "serrasetup-a1b2")
  wifiQRString: string;   // Standard WiFi QR format
  qrDataURL: string;      // Base64-encoded PNG image
  hostname: string;       // Original device hostname
}

async function generateQRCode(deviceId: string): Promise<QRCodeData>;
```

#### Request Example

```typescript
const qrCode = await devicesService.generateQRCode('550e8400-e29b-41d4-a716-446655440000');
```

#### Implementation

```typescript
// frontend/src/services/devices.service.ts

import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';

class DevicesService {
  async generateQRCode(deviceId: string): Promise<QRCodeData> {
    // Step 1: Get device hostname
    const { data: device, error } = await supabase
      .from('devices')
      .select('device_hostname')
      .eq('id', deviceId)
      .single();

    if (error) throw error;

    if (!device.device_hostname) {
      throw new Error('Device has not connected yet - hostname not available');
    }

    // Step 2: Extract SSID from hostname
    // Hostname format: "http://serrasetup-a1b2.local"
    // SSID: "serrasetup-a1b2"
    const url = new URL(device.device_hostname);
    const ssid = url.hostname.split('.')[0];

    // Step 3: Build WiFi QR string (standard format for open networks)
    const wifiQRString = `WIFI:S:${ssid};;`;

    // Step 4: Generate QR code image
    const qrDataURL = await QRCode.toDataURL(wifiQRString, {
      width: 256,           // 256x256 pixels
      margin: 2,            // 2-module margin
      errorCorrectionLevel: 'M',  // Medium error correction (15% damage tolerance)
      color: {
        dark: '#000000',    // Black QR modules
        light: '#FFFFFF',   // White background
      },
    });

    return {
      ssid,
      wifiQRString,
      qrDataURL,
      hostname: device.device_hostname,
    };
  }
}
```

---

## Response Schema

### Success Response

```json
{
  "ssid": "serrasetup-a1b2",
  "wifiQRString": "WIFI:S:serrasetup-a1b2;;",
  "qrDataURL": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...(truncated)",
  "hostname": "http://serrasetup-a1b2.local"
}
```

### Error Responses

#### 404 Not Found

Device does not exist or user does not have permission.

```json
{
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device not found or access denied"
  }
}
```

#### 400 Bad Request

Device has not sent first heartbeat yet (hostname is NULL).

```json
{
  "error": {
    "code": "HOSTNAME_NOT_SET",
    "message": "Device has not connected yet - hostname not available",
    "hint": "Wait for device to send its first heartbeat after WiFi configuration"
  }
}
```

---

## WiFi QR Code Format

### Standard WiFi QR String

**Format**: `WIFI:S:<SSID>;T:<WPA|WEP|>;P:<password>;;`

**For Open Networks (No Password)**:
```
WIFI:S:serrasetup-a1b2;;
```

**Fields**:
- `S`: SSID (required)
- `T`: Security type (optional, omitted for open networks)
- `P`: Password (optional, omitted for open networks)
- `;;`: Terminator (required)

**Why Open Network**:
- ESP8266 AP mode typically has no password for initial setup
- Simpler QR code (less data to encode)
- Standard practice for IoT device onboarding

### QR Code Parameters

```typescript
const qrOptions = {
  width: 256,              // Size in pixels (mobile-friendly)
  margin: 2,               // White border (2 modules)
  errorCorrectionLevel: 'M', // 15% damage tolerance
  color: {
    dark: '#000000',       // Black modules
    light: '#FFFFFF',      // White background
  },
};
```

**Error Correction Levels**:
| Level | Damage Tolerance | Use Case |
|-------|------------------|----------|
| L | 7% | Clean environments |
| M | 15% | General use (recommended) |
| Q | 25% | Outdoor/printed |
| H | 30% | High damage risk |

---

## Caching Strategy

### Frontend Caching

```typescript
// Use TanStack Query for caching
const { data: qrCode, isLoading } = useQuery({
  queryKey: ['qr-code', deviceId],
  queryFn: () => devicesService.generateQRCode(deviceId),
  staleTime: Infinity,  // QR code never stales (hostname doesn't change)
  cacheTime: 1000 * 60 * 60 * 24,  // Keep in cache for 24 hours
});
```

**Rationale**:
- QR code is deterministic (same hostname → same QR code)
- Hostname rarely changes after initial setup
- Cache indefinitely to avoid redundant generation

### Invalidation Triggers

Invalidate QR code cache only when:
1. Device hostname is manually updated
2. Device is re-provisioned (rare)

```typescript
// Invalidate on hostname update
queryClient.invalidateQueries(['qr-code', deviceId]);
```

---

## Usage Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase
    participant ESP8266

    Note over ESP8266: Device sends first heartbeat with hostname
    ESP8266->>Supabase: POST /rpc/device_heartbeat (hostname="http://serrasetup-a1b2.local")
    Supabase->>Supabase: UPDATE devices SET device_hostname = ...

    User->>Frontend: Click "View QR Code"
    Frontend->>Supabase: GET /devices/:id (select device_hostname)
    Supabase-->>Frontend: Return hostname
    Frontend->>Frontend: Extract SSID from hostname
    Frontend->>Frontend: Build WiFi QR string: "WIFI:S:serrasetup-a1b2;;"
    Frontend->>Frontend: Generate QR code image (qrcode library)
    Frontend-->>User: Display QR code modal
    User->>User: Scan QR code with phone
    User->>ESP8266: Phone auto-connects to "serrasetup-a1b2" AP
```

---

## Component Integration

### QRCodeDisplay Component

```typescript
// frontend/src/components/devices/QRCodeDisplay.tsx

import { useQuery } from '@tanstack/react-query';
import { devicesService } from '../../services/devices.service';

interface QRCodeDisplayProps {
  deviceId: string;
  onClose: () => void;
}

export function QRCodeDisplay({ deviceId, onClose }: QRCodeDisplayProps) {
  const { data: qrCode, isLoading, error } = useQuery({
    queryKey: ['qr-code', deviceId],
    queryFn: () => devicesService.generateQRCode(deviceId),
    staleTime: Infinity,
  });

  if (isLoading) return <div>Generating QR code...</div>;

  if (error) {
    return (
      <div className="error">
        <p>Failed to generate QR code</p>
        <p>{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="modal">
      <h2>Scan QR Code to Connect</h2>
      <img src={qrCode!.qrDataURL} alt="WiFi QR Code" />
      <p>SSID: {qrCode!.ssid}</p>
      <p>Scan with your phone to connect to the device's WiFi network</p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

---

## Performance Considerations

### Generation Time

- **Client-side QR generation**: ~50-100ms
- **Network request for hostname**: ~100-200ms
- **Total time**: <500ms (target met)

### Optimization

```typescript
// Pre-load QR code when device detail page loads
useEffect(() => {
  if (device.device_hostname) {
    queryClient.prefetchQuery({
      queryKey: ['qr-code', device.id],
      queryFn: () => devicesService.generateQRCode(device.id),
    });
  }
}, [device]);
```

---

## Mobile Compatibility

### Tested Platforms

| Platform | QR Reader | Result |
|----------|-----------|--------|
| iOS 15+ | Native Camera app | ✅ Auto-connects to WiFi |
| Android 10+ | Google Lens / Camera | ✅ Auto-connects to WiFi |
| iOS <15 | Requires third-party app | ⚠️ Manual WiFi setup needed |

### Fallback for Non-Compatible Devices

```typescript
// Show manual SSID if QR scan fails
<div className="fallback">
  <p>If QR code doesn't work:</p>
  <ol>
    <li>Go to WiFi settings</li>
    <li>Connect to network: <code>{qrCode.ssid}</code></li>
    <li>No password required</li>
  </ol>
</div>
```

---

**Related Contracts**:
- [device-registration.md](./device-registration.md) - Create device before QR generation
- [device-heartbeat.md](./device-heartbeat.md) - ESP8266 provides hostname for QR code
