# ESP8266 Greenhouse Firmware v2.0

Complete firmware for ESP8266-based greenhouse management system with QR code onboarding support.

## What's New in v2.0

### QR Code Onboarding Features
- **WiFi Connection Timeout**: Automatic AP mode fallback after 30 seconds
- **LED Status Indicators**: Visual feedback for connection status
- **Customizable Device ID**: Set friendly name via web interface
- **Hostname Reporting**: Automatic hostname reporting in heartbeat for QR code onboarding
- **Heartbeat Retry Logic**: 3 attempts with 5-second delay for reliable connectivity

### LED Status Indicators
- **OFF**: AP mode (waiting for WiFi configuration)
- **SLOW BLINK** (1Hz): Connecting to WiFi
- **FAST BLINK** (10Hz, 5 seconds): Error / WiFi connection failed
- **SOLID ON**: Connected and online

## Features

- **WiFiManager**: Easy WiFi configuration via captive portal
- **Web Configuration**: Configure device ID, sensors, and actuators via browser
- **OTA Updates**: Upload new firmware over WiFi
- **mDNS Support**: Access device via `http://serrasetup-XXXX.local`
- **Supabase Integration**: Real-time data sync with cloud database
- **Multiple Sensor Support**: DHT22 (temp/humidity), soil moisture, DS18B20
- **Multiple Actuator Support**: Relays (NO/NC), PWM outputs
- **EEPROM Storage**: Persistent configuration storage
- **Two-Level Reset**: WiFi-only or full configuration reset

## Hardware Requirements

### Minimum Requirements
- ESP8266 development board (NodeMCU recommended)
- USB cable for programming
- 5V power supply (1A minimum)

### Supported Sensors
- **DHT22**: Temperature and humidity (digital pin)
- **Soil Moisture**: Capacitive/resistive sensors (analog A0)
- **DS18B20**: Dallas temperature sensor (digital pin)

### Supported Actuators
- **Relays**: Both Normally Open (NO) and Normally Closed (NC)
- **PWM Outputs**: For fans, dimmers (0-255 range)

### Safe GPIO Pins (NodeMCU)
- **D1 (GPIO5)**: Safe for digital I/O
- **D2 (GPIO4)**: Safe for digital I/O
- **D5 (GPIO14)**: Safe for digital I/O, PWM
- **D6 (GPIO12)**: Safe for digital I/O, PWM
- **D7 (GPIO13)**: Safe for digital I/O, PWM
- **A0 (ADC)**: Safe for analog input (0-1V)

**Avoid these pins**:
- D0 (GPIO16): No PWM, no interrupts
- D3 (GPIO0): Boot mode (used for FLASH button)
- D4 (GPIO2): Boot mode + Built-in LED
- D8 (GPIO15): Boot mode

## Required Libraries

Install these libraries via Arduino IDE Library Manager:

1. **WiFiManager** by tzapu (v2.0.16-rc.2 or later)
2. **ArduinoJson** by Benoit Blanchon (v6.x)
3. **DHT sensor library** by Adafruit
4. **Adafruit Unified Sensor**
5. **OneWire** by Paul Stoffregen (for DS18B20)
6. **DallasTemperature** by Miles Burton (for DS18B20)

Built-in libraries (no installation needed):
- ESP8266WiFi
- ESP8266WebServer
- ESP8266HTTPClient
- ESP8266mDNS
- EEPROM
- ArduinoOTA

## Installation Instructions

### Step 1: Configure Settings

1. Open `config.h` in Arduino IDE
2. Update these critical settings:
   ```cpp
   const char* SUPABASE_URL = "https://your-project.supabase.co";
   const char* SUPABASE_ANON_KEY = "your-anon-key-here";
   const char* DEVICE_UUID = "your-device-uuid-here";
   ```
3. (Optional) Change OTA password:
   ```cpp
   const char* OTA_PASSWORD = "your-secure-password";
   ```

### Step 2: Upload Firmware

1. Connect ESP8266 to computer via USB
2. In Arduino IDE:
   - **Board**: Select "NodeMCU 1.0 (ESP-12E Module)" or your specific board
   - **Port**: Select the correct COM/serial port
   - **Upload Speed**: 115200 (or 921600 for faster uploads)
3. Click **Upload** button
4. Wait for upload to complete

### Step 3: First Boot

1. Open Serial Monitor (115200 baud)
2. ESP8266 will start in AP mode
3. Look for WiFi network "Serra-Setup"
4. Connect to it from your phone/computer
5. Configure your WiFi credentials in the captive portal
6. ESP8266 will connect and display its hostname

Example Serial Monitor output:
```
=================================
Serra System v1.4
QR Code Onboarding Support
=================================

📡 Hostname: serrasetup-a1b2.local
🆔 Device UUID: 0f24ada1-b6f6-45a2-aa0e-0e417daae659

✓ WiFi connected!
IP: 192.168.1.123
✓ mDNS started: http://serrasetup-a1b2.local
```

### Step 4: Configure Device

1. Open browser and go to `http://serrasetup-XXXX.local` (use YOUR hostname)
   - Or use IP address if mDNS doesn't work: `http://192.168.1.123`
2. Click "⚙️ Configure Device & Sensors"
3. Set **Device ID** (friendly name like "Greenhouse 1")
4. Add sensors:
   - Sensor ID (must match Supabase, e.g., "temp_1")
   - Type (DHT22_TEMP, DHT22_HUM, SOIL_MOISTURE)
   - GPIO Pin
5. Add actuators:
   - Actuator ID (must match Supabase, e.g., "pump_1")
   - Type (RELAY_NO, RELAY_NC, PWM)
   - GPIO Pin
6. Click "💾 Save Configuration"
7. ESP8266 will restart with new configuration

## QR Code Onboarding

This firmware supports QR code-based onboarding:

1. **Register device** in webapp
2. Webapp generates **QR code** with WiFi credentials
3. **Scan QR code** with mobile device to connect to WiFi
4. ESP8266 **connects automatically**
5. Device **reports hostname** in heartbeat
6. Webapp can **access device configuration**

The firmware automatically:
- Generates unique hostname based on MAC address
- Reports hostname in every heartbeat
- Handles WiFi connection failures gracefully
- Provides visual LED feedback

## Configuration Reset

### Level 1: WiFi Reset (Preserves Sensor/Device Configuration)

1. Hold **FLASH button** (D3/GPIO0)
2. After 3 seconds: LED blinks FAST (every 100ms)
3. Release button **before 10 seconds**
4. ✅ WiFi credentials erased (device/sensor config preserved)
5. ESP8266 reboots in AP mode

### Level 2: Full Reset (Erases Everything)

1. Hold **FLASH button** (D3/GPIO0)
2. After 3 seconds: LED blinks FAST
3. Keep holding...
4. After 10 seconds: LED blinks SLOW (every 300ms)
5. LED blinks VERY FAST = reset in progress
6. ✅ WiFi + Device ID + Sensors + Actuators ALL ERASED
7. ESP8266 reboots in AP mode

## Over-The-Air (OTA) Updates

### Via Web Interface

1. Open `http://serrasetup-XXXX.local/update`
2. Username: `admin`
3. Password: `serra2025` (or your custom OTA password)
4. Choose compiled `.bin` file
5. Click **Update**
6. Wait for upload and automatic restart

### Via Arduino IDE

1. After first upload, device appears in **Tools → Port** menu
2. Select network port: `serrasetup-XXXX at 192.168.1.123`
3. Upload normally - firmware updates over WiFi!

## Troubleshooting

### ESP8266 Won't Connect to WiFi

**Problem**: LED blinks fast for 5 seconds, then goes OFF
**Solution**:
1. WiFi credentials may be incorrect
2. Signal too weak (check RSSI in web interface)
3. Router may be blocking device
4. Try WiFi reset (hold FLASH 3-10 seconds)

### Can't Access http://serrasetup-XXXX.local

**Problem**: mDNS not working
**Solution**:
1. Check Serial Monitor for IP address
2. Use IP directly: `http://192.168.1.123`
3. mDNS may not work on all networks/devices
4. On Android, try Bonjour browser app

### Sensors Not Reading

**Problem**: DHT22 returns NaN or soil sensor reads 0
**Solution**:
1. Check wiring (VCC, GND, DATA)
2. Verify correct GPIO pin in configuration
3. DHT22: Ensure temp and hum use same pin and pair index
4. Soil sensor: Must use A0 (analog pin)
5. Check Serial Monitor for initialization messages

### Device UUID Mismatch

**Problem**: Device not appearing in webapp
**Solution**:
1. Verify `DEVICE_UUID` in `config.h` matches webapp
2. Device UUID is different from Device ID (friendly name)
3. Check Serial Monitor for UUID at boot
4. Re-upload firmware with correct UUID

### Heartbeat Failing

**Problem**: Device shows offline in webapp despite WiFi connection
**Solution**:
1. Check Supabase URL and API key in `config.h`
2. Verify `device_heartbeat` RPC function exists in Supabase
3. Check Serial Monitor for HTTP error codes
4. v1.4 automatically retries 3 times with 5-second delay

## Multiple Devices on Same Network

Each ESP8266 generates a **unique hostname** based on MAC address:

- First board: `http://serrasetup-a1b2.local`
- Second board: `http://serrasetup-c3d4.local`
- Third board: `http://serrasetup-e5f6.local`

The suffix `-XXXX` comes from the last 2 bytes of the MAC address and **never changes**.

**To find your hostname**:
1. Open Serial Monitor (115200 baud)
2. Reboot ESP8266
3. Look for: `📡 Hostname: serrasetup-XXXX.local`
4. Use that address in your browser

## Web Interface Pages

- **/** - Home page (device status, firmware version, system info)
- **/config** - Device & sensor configuration
- **/update** - OTA firmware update (username: admin, password: serra2025)
- **/resetwifi** - Trigger WiFi reset

## API Endpoints

- **GET /api/config** - Get current configuration (JSON)
- **POST /api/config** - Save configuration (JSON)
- **POST /api/config/reset** - Reset all configuration

## Default Settings

- **WiFi AP**: Serra-Setup (no password)
- **AP IP**: 192.168.4.1
- **OTA Password**: serra2025
- **Heartbeat Interval**: 30 seconds
- **Sensor Read Interval**: 30 seconds
- **Command Poll Interval**: 30 seconds
- **WiFi Timeout**: 30 seconds
- **Default Device ID**: "My Greenhouse"

## Serial Monitor Commands

Enable Serial Monitor at **115200 baud** to see:
- Boot messages and hostname
- WiFi connection status
- Sensor readings
- Heartbeat success/failure
- Error messages
- Configuration changes

## Version History

See [CHANGELOG.md](../CHANGELOG.md) for complete version history.

### v2.0.0 (Current)
- QR code onboarding support
- WiFi connection timeout (30s)
- LED status indicators
- Customizable device ID via web
- Hostname reporting in heartbeat
- Heartbeat retry logic (3 attempts)

### v1.3.0
- Web-based sensor/actuator configuration
- EEPROM configuration storage
- Two-level reset system
- Unique hostnames per device

### v1.2.0
- WiFiManager integration
- OTA update support
- Basic web interface

### v1.1.0
- Initial sensor support
- Basic Supabase integration

## Support

- **Repository**: https://github.com/treetocoin/Serra
- **Issues**: https://github.com/treetocoin/Serra/issues
- **Documentation**: See `/docs` folder in repository

## License

See repository LICENSE file for details.

---

**Firmware v2.0.0** | QR Code Onboarding | ESP8266 Greenhouse Management System
