# ESP8266 Greenhouse Firmware v3.0

Simplified device onboarding firmware for ESP8266 with project-scoped device IDs.

## Features

- **WiFi Portal Configuration**: Creates "Serra-Setup" access point for easy setup
- **Project-Scoped Device IDs**: Uses composite format `PROJ1-ESP5`
- **Automatic Heartbeat**: Sends status updates every 60 seconds
- **Factory Reset**: Long-press button to clear configuration
- **EEPROM Persistence**: Configuration survives power cycles

## Hardware Requirements

### Supported Boards
- ESP8266 (ESP-12E, ESP-12F)
- NodeMCU v1.0 (ESP-12E Module)
- WeMos D1 Mini
- Any ESP8266 board with >= 4MB flash

### Memory Requirements
- Flash: 4MB minimum (512KB EEPROM recommended)
- RAM: Built-in ESP8266 RAM sufficient

### Pin Configuration
- **Reset Button**: D3 (GPIO 0) - with internal pull-up
  - Hold for 5 seconds to trigger factory reset

### Power Requirements
- Input: 5V via USB or external power supply
- Current: ~80mA active, ~20mA idle

## Library Dependencies

Install these libraries via Arduino Library Manager:

```
WiFiManager by tzapu v2.0.16-rc.2
ArduinoJson by Benoit Blanchon v6.21.3
```

Built-in libraries (no installation needed):
- ESP8266WiFi
- ESP8266HTTPClient
- EEPROM

## Upload Instructions

### 1. Install Arduino IDE

Download from: https://www.arduino.cc/en/software

### 2. Add ESP8266 Board Support

1. Open Arduino IDE
2. Go to **File > Preferences**
3. Add to "Additional Board Manager URLs":
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
4. Go to **Tools > Board > Boards Manager**
5. Search for "esp8266"
6. Install "esp8266 by ESP8266 Community" v3.1.2+

### 3. Install Required Libraries

1. Go to **Tools > Manage Libraries**
2. Search and install:
   - "WiFiManager" by tzapu
   - "ArduinoJson" by Benoit Blanchon

### 4. Configure Board Settings

1. Select **Tools > Board > ESP8266 Boards > NodeMCU 1.0 (ESP-12E Module)**
2. Set upload settings:
   - **Upload Speed**: 115200
   - **CPU Frequency**: 80 MHz
   - **Flash Size**: 4MB (FS:2MB OTA:~1019KB)
   - **Port**: Select your ESP8266 COM port

### 5. Upload Firmware

1. Open `ESP8266_Greenhouse_v3.0.ino`
2. Click **Verify** (checkmark icon) to compile
3. Connect ESP8266 via USB
4. Click **Upload** (arrow icon)
5. Wait for upload to complete

## Configuration Workflow

### First-Time Setup

1. **Power on ESP8266**
   - Device creates "Serra-Setup" WiFi access point
   - Blue LED blinks slowly

2. **Connect to WiFi Portal**
   - Phone/computer: Connect to "Serra-Setup" WiFi
   - Captive portal opens automatically
   - If not: Navigate to http://192.168.4.1

3. **Configure Device**
   - **Project ID**: Enter project ID from webapp (e.g., "PROJ1")
     - Field auto-converts to uppercase
   - **Device ID**: Select ESP number (ESP1-ESP20) from dropdown
   - **WiFi SSID**: Your home WiFi network name
   - **WiFi Password**: Your WiFi password
   - **Device Key**: 64-character key from webapp registration
     - Copy this from webapp after registering the device

4. **Save and Connect**
   - Click "Save"
   - ESP restarts and connects to your WiFi
   - Serial monitor shows: "WiFi connected! IP: 192.168.x.x"

5. **Verify Connection**
   - Check webapp - device status should change to "online"
   - Heartbeat sent every 60 seconds

### Factory Reset

To clear configuration and reconfigure device:

1. Hold reset button (D3/GPIO 0) for **5 seconds**
2. Serial monitor shows: "Factory reset triggered"
3. ESP clears EEPROM and recreates "Serra-Setup" AP
4. Repeat configuration workflow

## Serial Monitor Output

### Successful Boot
```
ESP8266 Greenhouse v3.0
Valid configuration found
Device ID: PROJ1-ESP5
.........................
WiFi connected!
IP: 192.168.1.100
Heartbeat sent successfully
{"success":true,"device_id":"PROJ1-ESP5","status":"online"}
```

### First Boot (No Config)
```
ESP8266 Greenhouse v3.0
No valid configuration, starting portal
WiFiManager starting in AP mode: Serra-Setup
```

### Configuration Saved
```
Saving configuration...
Composite Device ID: PROJ1-ESP5
WiFi connected!
Configuration saved, restarting...
```

## Troubleshooting

### Portal Not Appearing

**Problem**: "Serra-Setup" WiFi network not visible

**Solutions**:
- Wait 30 seconds after power-on
- Check ESP8266 has power (LED should be on)
- Trigger factory reset (hold button 5 seconds)
- Reflash firmware

### WiFi Connection Failed

**Problem**: ESP restarts portal after configuration

**Solutions**:
- Verify WiFi SSID and password are correct
- Check WiFi is 2.4GHz (ESP8266 doesn't support 5GHz)
- Move ESP closer to router
- Check router allows new device connections

### Heartbeat Fails

**Problem**: Device shows "offline" in webapp despite WiFi connection

**Solutions**:
- Verify device key is correct (64 hex characters)
- Check project ID and device number match webapp registration
- Ensure device composite ID is uppercase (e.g., "PROJ1-ESP5")
- Check serial monitor for HTTP error codes:
  - `401`: Invalid device key
  - `404`: Device not registered in webapp
  - `500`: Backend error (check Edge Function logs)

### EEPROM Corruption

**Problem**: ESP boots to portal despite previous configuration

**Solutions**:
- Trigger factory reset
- Upload and run `examples/test_eeprom.ino`
- Reconfigure device

### Button Not Working

**Problem**: Factory reset doesn't trigger

**Solutions**:
- Verify button connected to D3 (GPIO 0)
- Check button wiring (should pull D3 to ground when pressed)
- Try different GPIO pin and update `RESET_BUTTON_PIN` constant

## API Integration

### Heartbeat Endpoint

The firmware sends heartbeat to:
```
POST https://fmyomzywzjtxmabvvjcd.supabase.co/functions/v1/device-heartbeat
```

**Headers**:
```
Content-Type: application/json
x-device-key: <64-char device key>
x-composite-device-id: <PROJ1-ESP5>
```

**Body**:
```json
{
  "rssi": -67,
  "ip_address": "192.168.1.100",
  "fw_version": "v3.0.0"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "device_id": "PROJ1-ESP5",
  "status": "online",
  "timestamp": "2025-11-12T14:30:00.000Z"
}
```

### Error Responses

**401 Unauthorized**: Invalid device key
```json
{
  "success": false,
  "error": "Invalid device key"
}
```

**404 Not Found**: Device not registered
```json
{
  "success": false,
  "error": "Device not found"
}
```

## Development

### Testing EEPROM

Run the test sketch to verify EEPROM functions:

```bash
# Open examples/test_eeprom.ino in Arduino IDE
# Upload to ESP8266
# Open Serial Monitor (115200 baud)
# Verify output shows config saved and loaded correctly
```

### Modifying Configuration

Edit these constants in `ESP8266_Greenhouse_v3.0.ino`:

```cpp
#define SUPABASE_URL "https://your-project.supabase.co"
#define HEARTBEAT_ENDPOINT "/functions/v1/device-heartbeat"
#define RESET_BUTTON_PIN D3  // Change GPIO pin
const unsigned long HEARTBEAT_INTERVAL = 60000; // Change interval (ms)
```

### Adding Sensors/Actuators

See `HARDWARE.md` for pin configuration examples with sensors:
- DHT22 temperature/humidity
- Soil moisture sensor
- Relay modules for pumps/lights

## Version History

### v3.0.0 (2025-11-12)
- Simplified onboarding with project-scoped device IDs
- WiFi portal with composite ID configuration
- Factory reset button support
- EEPROM persistence with CRC32 validation
- Automatic heartbeat with RSSI and IP reporting

## Support

For issues or questions:
- Check `HARDWARE.md` for hardware setup
- Review serial monitor output for error messages
- Verify webapp registration completed before ESP configuration
- Test EEPROM with included test sketch

## License

Part of Serra Greenhouse Management System
