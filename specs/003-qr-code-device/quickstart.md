# Quick Start: QR Code Device Onboarding Testing

**Feature**: QR Code Device Onboarding
**Date**: 2025-10-09
**Branch**: `003-qr-code-device`

## Overview

This guide provides step-by-step testing scenarios for the QR code device onboarding feature. Use this to verify all user stories and acceptance criteria.

---

## Prerequisites

### Environment Setup

1. **Frontend Running**:
   ```bash
   cd frontend
   npm install
   npm run dev
   # Should be accessible at http://localhost:5173
   ```

2. **Supabase Database**:
   - Migrations applied (connection_failed status added)
   - RPC function `device_heartbeat` deployed
   - Row Level Security (RLS) policies configured

3. **ESP8266 Hardware** (Optional, can simulate with curl):
   - ESP8266 NodeMCU board
   - USB cable for programming
   - Arduino IDE with ESP8266 board support
   - WiFiManager library installed

4. **Mobile Device**:
   - iOS 15+ or Android 10+ with QR code reader
   - Connected to same network as computer (for testing)

---

## Test Scenario 1: Happy Path - Full Onboarding Flow

**User Story**: P1 - Device Registration with QR Code
**Goal**: User successfully registers device, scans QR code, connects to WiFi, and device comes online

### Steps

#### 1. Register New Device

1. Open web app: `http://localhost:5173`
2. Log in with test account
3. Navigate to "Devices" page
4. Click **"Add Device"** button
5. Enter device name: `Test Greenhouse`
6. Click **"Register"**

**Expected Result**:
- Modal displays device UUID and API key
- Copy both values (will be needed later)
- QR code section shows "Device not online yet - QR code will appear when device connects"

**Verification**:
```sql
-- Check device was created
SELECT id, name, connection_status, device_hostname
FROM devices
WHERE name = 'Test Greenhouse';

-- Expected: connection_status = 'offline', device_hostname = NULL
```

---

#### 2. Configure ESP8266 (or Simulate with curl)

**Option A: Real ESP8266**

1. Upload firmware to ESP8266:
   - Open `ESP8266_Greenhouse_WebConfig.ino`
   - Update `DEVICE_ID` with UUID from step 1
   - Upload to board
2. Power on ESP8266
3. Wait for LED to blink (AP mode active)
4. ESP8266 creates WiFi network: `serrasetup-XXXX` (XXXX = MAC address suffix)

**Option B: Simulate with curl**

```bash
# Simulate first heartbeat with hostname
curl -X POST \
  'https://fmyomzywzjtxmabvvjcd.supabase.co/rest/v1/rpc/device_heartbeat' \
  -H 'Content-Type: application/json' \
  -H 'apikey: [SUPABASE_ANON_KEY]' \
  -H 'Authorization: Bearer [SUPABASE_ANON_KEY]' \
  -d '{
    "device_id_param": "[UUID_FROM_STEP_1]",
    "hostname_param": "http://serrasetup-a1b2.local"
  }'

# Expected response: {"success":true,"timestamp":"2025-10-09T..."}
```

---

#### 3. View QR Code

1. Return to Devices page
2. Refresh (or wait for auto-refresh after 30 seconds)
3. Device status should change to **"Online"** (green indicator)
4. Click device row to open detail page
5. Click **"View QR Code"** button

**Expected Result**:
- QR code modal appears
- QR code image is displayed (256x256 pixels)
- SSID shown: `serrasetup-XXXX`
- Instructions: "Scan with your phone to connect to the device's WiFi network"

**Verification**:
```typescript
// In browser console
console.log(await devicesService.generateQRCode('[DEVICE_ID]'));

// Expected output:
// {
//   ssid: "serrasetup-a1b2",
//   wifiQRString: "WIFI:S:serrasetup-a1b2;;",
//   qrDataURL: "data:image/png;base64,...",
//   hostname: "http://serrasetup-a1b2.local"
// }
```

---

#### 4. Scan QR Code and Connect

1. Open Camera app on mobile phone
2. Point camera at QR code on screen
3. Tap notification: "Connect to serrasetup-XXXX?"
4. Phone connects to ESP8266 AP

**Expected Result**:
- Phone WiFi shows connected to `serrasetup-XXXX`
- Captive portal opens automatically (or navigate to http://serrasetup-a1b2.local)

**Troubleshooting**:
- If captive portal doesn't open: Manually open browser and go to `http://192.168.4.1`
- If QR doesn't scan: Increase QR code size or brightness

---

#### 5. Configure WiFi via Captive Portal

1. In captive portal, select your home WiFi network
2. Enter WiFi password
3. Click **"Connect"**
4. ESP8266 attempts to connect to home WiFi

**Expected Result**:
- ESP8266 LED changes to slow blink (connecting)
- After 5-10 seconds, LED solid ON (connected)
- Phone automatically disconnects from ESP8266 AP
- Phone reconnects to home WiFi

---

#### 6. Verify Device Online

1. Return to web app on computer
2. Navigate to Devices page
3. Device status should show **"Online"** (if not, wait 30 seconds for next poll)
4. Click device to open detail page
5. **"Settings"** button should be enabled

**Expected Result**:
- Device status: Online (green)
- Last seen: <30 seconds ago
- Settings button: Enabled
- Device hostname displayed in info card

**Verification**:
```sql
SELECT id, name, connection_status, last_seen_at, device_hostname
FROM devices
WHERE name = 'Test Greenhouse';

-- Expected:
-- connection_status = 'online'
-- last_seen_at = [recent timestamp]
-- device_hostname = 'http://serrasetup-XXXX.local'
```

---

#### 7. Configure Sensors (Bonus)

1. Click **"Settings"** button
2. Device setup page opens with device ID pre-filled (read-only)
3. Add sensors and actuators as needed

**Expected Result**:
- Device ID field shows UUID (disabled/read-only)
- Can add sensors with GPIO pin selection
- Can add actuators with GPIO pin selection

---

## Test Scenario 2: Error Handling - Wrong WiFi Credentials

**User Story**: P1 - WiFi Connection Failure with Multi-channel Feedback
**Goal**: User enters wrong WiFi password, device shows error, webapp updates status, device returns to AP mode

### Steps

1. Follow Scenario 1 steps 1-4 (register device, scan QR, open captive portal)
2. Enter **incorrect WiFi password**
3. Click "Connect"

**Expected Result**:
- ESP8266 LED blinks fast (10Hz) for 5 seconds = WiFi error pattern
- After 30-second timeout, ESP8266 returns to AP mode (LED off)
- Web app shows device status as **"Connection Failed"** (red indicator)
- User can re-scan QR code and retry with correct password

**Verification**:
```sql
SELECT connection_status, last_seen_at
FROM devices
WHERE name = 'Test Greenhouse';

-- Expected after 30 seconds:
-- connection_status = 'connection_failed'
-- last_seen_at = NULL (no successful heartbeat)
```

**Recovery**:
1. ESP8266 is back in AP mode (`serrasetup-XXXX` network visible)
2. Re-scan QR code
3. Connect to AP again
4. Enter **correct** WiFi password
5. Device connects successfully → Status changes to "Online"

---

## Test Scenario 3: QR Code Re-Access

**User Story**: QR Code Always Accessible
**Goal**: User can view QR code multiple times, even after closing modal

### Steps

1. Register and connect device (follow Scenario 1)
2. Click "View QR Code" → Modal opens
3. Click "Close" or click outside modal
4. Wait 5 seconds
5. Click "View QR Code" again

**Expected Result**:
- QR code regenerates instantly (cached in TanStack Query)
- Same QR code as before (deterministic from hostname)
- No database query needed (served from cache)

**Verification**:
```typescript
// Check query cache in browser DevTools
queryClient.getQueryData(['qr-code', deviceId]);

// Expected: Non-null cached value with QR data
```

---

## Test Scenario 4: Device ID Display

**User Story**: P2 - Display Device ID in Management Interface
**Goal**: Device ID (UUID) is prominently shown in device detail page

### Steps

1. Navigate to Devices page
2. Click any online device
3. Device detail page opens

**Expected Result**:
- Device info card shows:
  - **Device ID**: [UUID] (in its own row)
  - Status: Online/Offline
  - Last Seen: [timestamp]
  - Firmware Version: [version]
  - ESP Configuration: [link to hostname]

**Verification**:
- UUID matches the ID from registration
- UUID is displayed as read-only text (not editable)

---

## Test Scenario 5: Device ID Customization on ESP8266

**User Story**: P3 - Configure Device ID During Setup
**Goal**: User can edit device ID on ESP8266 web interface, changes sync to webapp

### Steps

1. Connect device (follow Scenario 1)
2. In browser, navigate to ESP8266 web interface: `http://serrasetup-XXXX.local/config`
3. Find **"Device ID"** field (should show current UUID)
4. Edit to custom name: `custom-greenhouse-1`
5. Click "Save"
6. Wait 30 seconds for next heartbeat

**Expected Result**:
- ESP8266 web interface shows success message
- Device sends heartbeat with updated device ID
- Webapp device management page shows **"custom-greenhouse-1"** (read-only)

**Verification**:
```sql
SELECT id, name
FROM devices
WHERE id = '[ORIGINAL_UUID]';

-- Expected:
-- id = [original UUID, unchanged]
-- name = 'custom-greenhouse-1' (updated)
```

**Note**: The UUID (`id` field) never changes. Only the `name` field (user-friendly label) is editable.

---

## Test Scenario 6: Duplicate Device IDs

**User Story**: System Allows Duplicate Device IDs
**Goal**: Multiple devices can have same name, system relies on UUID for uniqueness

### Steps

1. Register device #1: Name = `Greenhouse`
2. Register device #2: Name = `Greenhouse` (same name)
3. Both devices connect successfully

**Expected Result**:
- Both devices show in list with same name
- UUID differentiates them internally
- No error or conflict
- Each device has its own QR code (different hostname)

**Verification**:
```sql
SELECT id, name, device_hostname
FROM devices
WHERE name = 'Greenhouse';

-- Expected: 2 rows with different UUIDs and hostnames
```

---

## Performance Testing

### QR Code Generation Speed

**Target**: <500ms from button click to QR display

**Test**:
```javascript
console.time('QR Generation');
const qr = await devicesService.generateQRCode(deviceId);
console.timeEnd('QR Generation');

// Expected: QR Generation: 50-150ms
```

### Heartbeat Response Time

**Target**: <200ms for RPC call

**Test**:
```bash
time curl -X POST \
  'https://fmyomzywzjtxmabvvjcd.supabase.co/rest/v1/rpc/device_heartbeat' \
  -H 'Content-Type: application/json' \
  -H 'apikey: [KEY]' \
  -H 'Authorization: Bearer [KEY]' \
  -d '{"device_id_param":"[UUID]","hostname_param":"http://serrasetup-a1b2.local"}'

# Expected: real time < 0.200s
```

### Status Update Latency

**Target**: Device online within 30 seconds of WiFi connection

**Test**:
1. Note time when ESP8266 LED goes solid ON (connected)
2. Note time when webapp status changes to "Online"
3. Difference should be <30 seconds (next polling interval)

---

## Cleanup

### Reset Test Environment

```sql
-- Delete test devices
DELETE FROM devices WHERE name LIKE 'Test%';

-- Reset connection status for all devices
UPDATE devices SET connection_status = 'offline' WHERE connection_status != 'offline';
```

### ESP8266 Factory Reset

1. Press and hold RESET button for 10+ seconds
2. LED blinks very fast → Full reset
3. WiFi credentials cleared
4. Sensor/actuator config cleared
5. Device ready for re-onboarding

---

## Common Issues & Solutions

### Issue: QR Code Shows "Hostname not available"

**Cause**: Device hasn't sent first heartbeat yet
**Solution**: Wait for device to connect to WiFi and send heartbeat (up to 30 seconds)

### Issue: Phone Doesn't Auto-Connect After QR Scan

**Cause**: Older iOS/Android version
**Solution**: Manually go to WiFi settings and connect to `serrasetup-XXXX`

### Issue: Captive Portal Doesn't Open

**Cause**: Phone's captive portal detection disabled
**Solution**: Manually navigate to `http://192.168.4.1` in browser

### Issue: Device Status Stuck on "Offline"

**Cause**: Heartbeat not reaching Supabase (wrong URL or API key)
**Solution**: Check ESP8266 serial monitor for HTTP error codes

### Issue: QR Code Not Generating

**Cause**: Missing `qrcode` npm package
**Solution**: `cd frontend && npm install qrcode`

---

## Success Criteria Checklist

Based on feature specification success criteria:

- [ ] **SC-001**: Complete onboarding in <5 minutes
- [ ] **SC-002**: QR code scannable by mobile devices
- [ ] **SC-003**: Status updates within 30 seconds
- [ ] **SC-004**: 95% first-attempt WiFi success (manual test)
- [ ] **SC-005**: Settings button enables when online
- [ ] **SC-006**: Device ID displayed in webapp and ESP8266
- [ ] **SC-007**: Sensor/actuator config within 2 minutes

---

**Next Steps**: Run `/speckit.tasks` to generate implementation task breakdown.
