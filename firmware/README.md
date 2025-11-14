# ESP8266 Greenhouse Firmware

Firmware for ESP8266/ESP32 devices used in the greenhouse management system.

## Current Versions

### ✅ v3.1.0 (Recommended) - Cloud-Based Configuration
**Status**: Production Ready
**Released**: 2025-11-14

**Key Features**:
- ⭐ Cloud-based sensor configuration (webapp as single source of truth)
- ⭐ Automatic config sync via heartbeat (max 60s propagation)
- ⭐ Config version tracking for change detection
- Read-only ESP8266 web portal
- Automatic sensor reinitialization on config changes

**When to Use**: All new deployments and existing devices

**Directory**: `ESP8266_Greenhouse_v3.1.0/`

---

### v3.0.0 - Manual Configuration
**Status**: Deprecated
**Released**: 2025-11-13

**Key Features**:
- Composite Device IDs
- Auto-generated device keys
- Manual web-based sensor configuration (ESP8266 portal)
- 2-level reset button system

**When to Use**: Legacy devices only, migrate to v3.1.0 recommended

**Directory**: `ESP8266_Greenhouse_v3.0/`

---

## Quick Start

### New Device Setup (v3.1.0)

1. **Register Device in Webapp**
   - Navigate to webapp devices page
   - Click "Register New Device"
   - Enter name and number (e.g., "Serra Principale", 3)
   - Copy generated ID (e.g., `PROJ1-ESP3`)

2. **Flash Firmware**
   ```bash
   cd ESP8266_Greenhouse_v3.1.0/
   # Open in Arduino IDE and upload
   # OR use PlatformIO
   pio run --target upload
   ```

3. **Configure WiFi**
   - Device creates AP "Serra-Setup"
   - Connect to AP
   - Portal opens automatically (or visit http://192.168.4.1)
   - Enter WiFi credentials and device ID
   - Save and restart

4. **Configure Sensors in Webapp**
   - Go to webapp `/devices/{device-id}`
   - In "Sensor Configuration" section:
     - Select sensor type (Temperature, Humidity, Soil Moisture, etc.)
     - Enter port ID (e.g., "D2", "GPIO4", "A0")
     - Click "Add Configuration"
   - Wait up to 60 seconds for device to sync

5. **Verify**
   - Check serial monitor for "Config update detected!"
   - Visit `http://<device-ip>/config` to see synced config
   - Sensor data should appear in webapp within 30 seconds

---

## Migration Guide

### From v3.0 to v3.1.0

#### Option 1: In-Place Upgrade (Recommended)
1. Flash v3.1.0 firmware to device
2. Device boots and sends heartbeat
3. If webapp config exists, it syncs automatically
4. EEPROM overwritten with cloud config
5. Done!

#### Option 2: Clean Install
1. Hold FLASH button for 10+ seconds (full reset)
2. Device erases EEPROM
3. Reconfigure WiFi and device ID via portal
4. Configure sensors in webapp
5. Wait for sync

---

## Port Naming Conventions

The firmware supports multiple port naming formats:

| Format     | Example | Maps To    | Notes              |
|------------|---------|------------|--------------------|
| GPIO       | "GPIO4" | GPIO 4     | Standard format    |
| D-pin      | "D2"    | GPIO 4     | Wemos D1 Mini      |
| Analog     | "A0"    | ADC pin    | For analog sensors |
| Number     | "4"     | GPIO 4     | Fallback           |

### Wemos D1 Mini Pin Mapping
- D0 → GPIO 16
- D1 → GPIO 5 ⭐ (I2C SCL)
- D2 → GPIO 4 ⭐ (I2C SDA)
- D3 → GPIO 0 (FLASH button)
- D4 → GPIO 2 (Built-in LED)
- D5 → GPIO 14 (SPI SCK)
- D6 → GPIO 12 (SPI MISO)
- D7 → GPIO 13 (SPI MOSI)
- D8 → GPIO 15 (SPI CS)
- A0 → ADC (0-1V input)

**Recommended for DHT22**: D2 (GPIO4) or D1 (GPIO5)

---

## Supported Sensors

### DHT22/DHT11 (Temperature & Humidity)
- **Type**: `dht_sopra_temp`, `dht_sopra_humidity`, `dht_sotto_temp`, `dht_sotto_humidity`
- **Connection**: Data pin to GPIO
- **Power**: 3.3V or 5V
- **Pull-up**: 10kΩ resistor recommended

### Capacitive Soil Moisture
- **Type**: `soil_moisture_1` through `soil_moisture_5`
- **Connection**: Analog out to A0
- **Power**: 3.3V
- **Range**: 0-1023 (wet to dry)

### Water Level
- **Type**: `water_level`
- **Connection**: Analog out to A0
- **Power**: 3.3V

---

## Troubleshooting

### Config Not Syncing

**Symptoms**: Device online, but sensors not initializing

**Check**:
1. Serial monitor shows "Config update detected!"
2. Cloud config_version > device config_version
3. HTTP 200 response from `get_device_sensor_config`

**Fix**:
```sql
-- Manually increment cloud version to force resync
UPDATE devices
SET config_version = config_version + 1
WHERE composite_device_id = 'PROJ1-ESP1';
```

### Sensors Not Reading

**Symptoms**: "No sensor data to send"

**Check**:
1. Serial monitor shows "Initializing sensors..."
2. Sensor configs printed: `Sensor[0]: pin=4, type=1, name='...'`
3. "Total sensors initialized: 1" (or more)

**Fix**:
- Verify DHT22 wiring (VCC, GND, Data)
- Check 10kΩ pull-up resistor on data line
- Try different GPIO pin
- Test sensor with simple sketch first

### Device Offline

**Symptoms**: Heartbeat failing, no data in webapp

**Check**:
1. WiFi connection: `WiFi.status() == WL_CONNECTED`
2. IP address assigned
3. Can ping device IP
4. Router firewall blocking outbound HTTPS?

**Fix**:
- Level 1 reset (3s) to reconfigure WiFi
- Check WiFi signal strength (RSSI)
- Verify Supabase URL reachable

---

## Serial Monitor Output

### Normal Boot (v3.1.0)
```
================================================================================
ESP8266 Greenhouse v3.1.0
Cloud-Based Configuration Sync
================================================================================

Config loaded from EEPROM
Device ID: PROJ1-ESP3
WiFi SSID: MyNetwork
Config validation: OK
...........
WiFi connected!
IP: 192.168.1.100
✓ Web server started on port 80
Initializing sensors...
Config version: 1
Sensor[0]: pin=4, type=1, name='dht_sopra_temp'
Sensor[1]: pin=0, type=0, name=''
✓ DHT22 initialized on pin 4
Total sensors initialized: 1
Sending heartbeat with config check...
✓ Heartbeat OK
Cloud config_version: 1
Local config_version: 1, Cloud config_version: 1
Config versions match, no update needed
```

### Config Update Detected
```
Sending heartbeat with config check...
✓ Heartbeat OK
Cloud config_version: 2
Local config_version: 1, Cloud config_version: 2
⚡ Config update detected! Fetching new config...
Fetching sensor config from cloud...
✓ Config fetched
  Sensor 0: dht_sopra_temp on pin 4
  Sensor 1: soil_moisture_1 on pin A0
✓ Cloud config applied to EEPROM
Initializing sensors...
✓ DHT22 initialized on pin 4
Total sensors initialized: 2
```

---

## Files Structure

```
firmware/
├── CHANGELOG.md                    # Version history
├── README.md                       # This file
├── ESP8266_Greenhouse_v3.1.0/      # Current version (recommended)
│   ├── ESP8266_Greenhouse_v3.1.0.ino
│   ├── config.h / config.cpp       # EEPROM config management
│   ├── heartbeat.h / heartbeat.cpp # Cloud sync + heartbeat
│   ├── sensors.h / sensors.cpp     # Sensor reading + sending
│   ├── webserver.h / webserver.cpp # Read-only web portal
│   ├── portal.h / portal.cpp       # WiFi setup portal
│   └── VERSION.md                  # v3.1.0 release notes
│
└── ESP8266_Greenhouse_v3.0/        # Legacy version
    └── ...
```

---

## Development

### Compiling

**Arduino IDE**:
1. Install ESP8266 board support
2. Install libraries: WiFiManager, ArduinoJson, DHT sensor
3. Open `.ino` file
4. Select board: "Wemos D1 Mini" or "Generic ESP8266"
5. Upload

**PlatformIO**:
```bash
cd ESP8266_Greenhouse_v3.1.0/
pio run --target upload
```

### Creating New Version

1. Copy latest version directory
   ```bash
   cp -r ESP8266_Greenhouse_v3.1.0 ESP8266_Greenhouse_v3.2.0
   ```

2. Rename main `.ino` file to match directory

3. Update version strings in code:
   - Header comment
   - `Serial.println()` boot message
   - Heartbeat firmware version

4. Create `VERSION.md` documenting changes

5. Update `CHANGELOG.md` with new version entry

---

## License

Internal project - Greenhouse Management System

## Support

For issues or questions:
- Check troubleshooting section above
- Review serial monitor output
- Check UNIFIED_CONFIG_GUIDE.md in project root
- Inspect database with provided SQL queries
