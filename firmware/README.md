# ESP8266 Greenhouse Firmware

Complete firmware collection for ESP8266-based greenhouse management system with cloud integration.

## Overview

This directory contains all firmware versions for the Serra greenhouse management system. Each version is self-contained and includes complete source code, configuration files, and documentation.

## Current Version

**v2.0.0** - QR Code Onboarding Support (Latest)

Latest features:
- WiFi connection timeout with automatic AP mode fallback
- LED status indicators for visual connection feedback
- Customizable device ID via web interface
- Hostname reporting in heartbeat for QR code onboarding
- Heartbeat retry logic with exponential backoff
- Enhanced error handling and recovery

[→ View v2.0 Documentation](./ESP8266_Greenhouse_v2.0/README.md)

## Version History

### v2.0.0 (Latest) - QR Code Onboarding
**Released**: 2025-10-09
**Directory**: `ESP8266_Greenhouse_v2.0/`

Major features:
- ✅ WiFi connection timeout (30 seconds)
- ✅ LED status indicators (OFF/slow blink/fast blink/solid)
- ✅ Customizable device ID (friendly name)
- ✅ Hostname reporting in heartbeat
- ✅ Heartbeat retry logic (3 attempts)
- ✅ QR code onboarding support

Best for: New installations, QR code setup, reliable connectivity

[Documentation](./ESP8266_Greenhouse_v2.0/README.md) | [Changelog](./CHANGELOG.md#200---2025-10-09)

---

### v1.3.0 - Web Configuration
**Released**: 2025-10-09
**Status**: Stable (superseded by v1.4)

Major features:
- ✅ Web-based sensor/actuator configuration
- ✅ EEPROM storage for persistent config
- ✅ Two-level reset system
- ✅ Unique hostnames per device
- ✅ Safe GPIO pin selection

Best for: Multiple devices, easy configuration without code changes

[Changelog](./CHANGELOG.md#130---2025-10-09)

---

### v1.2.0 - WiFiManager & OTA
**Released**: 2025-10-08
**Status**: Legacy

Major features:
- ✅ WiFiManager for easy WiFi setup
- ✅ OTA updates over WiFi
- ✅ mDNS support
- ✅ Basic web interface

Best for: First WiFiManager implementation, OTA testing

[Changelog](./CHANGELOG.md#120---2025-10-08)

---

### v1.1.0 - Sensor Support
**Released**: 2025-09-15
**Status**: Legacy

Major features:
- ✅ DHT22, soil moisture, DS18B20 sensors
- ✅ Supabase cloud integration
- ✅ Relay and PWM actuators
- ✅ Remote command control

Best for: Basic sensor integration testing

[Changelog](./CHANGELOG.md#110---2025-09-15)

---

### v1.0.0 - Initial Release
**Released**: 2025-09-01
**Status**: Deprecated

Basic ESP8266 firmware with hardcoded WiFi and minimal features.

[Changelog](./CHANGELOG.md#100---2025-09-01)

## Choosing a Version

### For New Projects
👉 **Use v2.0.0**
- Latest features and bug fixes
- QR code onboarding support
- Best reliability and error handling
- Active development and support

### For Existing v1.3 Installations
👉 **Upgrade to v2.0.0**
- Simple OTA upgrade
- Configuration preserved
- Only adds device ID field (defaults to "My Greenhouse")
- Backward compatible

### For Existing v1.2 or Earlier
👉 **Upgrade to v2.0.0 via v1.3**
1. First upgrade to v1.3 (requires reconfiguration)
2. Then upgrade to v2.0 (automatic)

## Quick Start

### 1. Choose Hardware

**Recommended**: NodeMCU v1.0 (ESP-12E)

**Minimum Requirements**:
- ESP8266 board (any variant)
- USB cable for initial programming
- 5V power supply (1A minimum)

**Optional Sensors/Actuators**:
- DHT22 (temperature/humidity)
- Capacitive soil moisture sensor
- DS18B20 (waterproof temperature)
- Relay modules (5V or 3.3V)
- Fans, pumps, lights, etc.

### 2. Install Required Libraries

Open Arduino IDE Library Manager and install:

1. **WiFiManager** by tzapu (v2.0.16-rc.2+)
2. **ArduinoJson** by Benoit Blanchon (v6.x)
3. **DHT sensor library** by Adafruit
4. **Adafruit Unified Sensor**
5. **OneWire** by Paul Stoffregen
6. **DallasTemperature** by Miles Burton

### 3. Configure Firmware

1. Download latest version (v2.0)
2. Open `ESP8266_Greenhouse_v2.0.ino` in Arduino IDE
3. Edit `config.h`:
   ```cpp
   // Your Supabase project
   const char* SUPABASE_URL = "https://your-project.supabase.co";
   const char* SUPABASE_ANON_KEY = "your-anon-key";

   // Your device UUID (from webapp)
   const char* DEVICE_UUID = "your-device-uuid";
   ```

### 4. Upload Firmware

1. Connect ESP8266 via USB
2. Select board: "NodeMCU 1.0 (ESP-12E Module)"
3. Select port (COM port on Windows, /dev/ttyUSB* on Linux)
4. Click Upload
5. Wait for completion

### 5. First Boot Setup

1. Open Serial Monitor (115200 baud)
2. ESP8266 creates WiFi AP "Serra-Setup"
3. Connect from phone/computer
4. Configure WiFi credentials
5. Note the hostname (e.g., `serrasetup-a1b2.local`)

### 6. Configure Device

1. Open `http://serrasetup-XXXX.local` in browser
2. Click "Configure Device & Sensors"
3. Set device ID (friendly name)
4. Add sensors and actuators
5. Save configuration
6. Done!

## Common Tasks

### OTA Update (Existing Device)

**Via Web Interface**:
1. Go to `http://serrasetup-XXXX.local/update`
2. Username: `admin`, Password: `serra2025`
3. Upload `.bin` file
4. Wait for automatic restart

**Via Arduino IDE**:
1. Tools → Port → Select network port
2. Upload normally (updates over WiFi)

### Change Device ID

1. Go to `http://serrasetup-XXXX.local/config`
2. Edit "Device ID" field
3. Click "Save Configuration"
4. ESP8266 restarts with new name

### Reset WiFi (Preserve Configuration)

**Method 1**: Hold FLASH button for 3-10 seconds
**Method 2**: Go to `http://serrasetup-XXXX.local/resetwifi`

### Full Reset (Erase Everything)

**Method 1**: Hold FLASH button for 10+ seconds
**Method 2**: Web interface → Reset All → Confirm

### Add Sensor

1. Go to `http://serrasetup-XXXX.local/config`
2. Click "Add Sensor"
3. Fill in:
   - Sensor ID (must match Supabase)
   - Type (DHT22_TEMP, DHT22_HUM, SOIL_MOISTURE)
   - GPIO Pin (D1, D2, D5, D6, D7, or A0)
4. Click "Save Configuration"

### Add Actuator

1. Go to `http://serrasetup-XXXX.local/config`
2. Click "Add Actuator"
3. Fill in:
   - Actuator ID (must match Supabase)
   - Type (RELAY_NO, RELAY_NC, PWM)
   - GPIO Pin (D1, D2, D5, D6, D7)
4. Click "Save Configuration"

## Directory Structure

```
firmware/
├── README.md                           # This file
├── CHANGELOG.md                        # Complete version history
├── ESP8266_Greenhouse_v2.0/           # Latest version (v2.0.0)
│   ├── ESP8266_Greenhouse_v2.0.ino    # Main firmware file
│   ├── config.h                       # User configuration
│   └── README.md                      # Version-specific docs
├── ESP8266_Greenhouse_v1.3/           # Previous version (v1.3.0)
└── [older versions...]                # Historical versions
```

## File Organization

Each firmware version includes:

- **`.ino` file**: Main Arduino sketch (upload this)
- **`config.h`**: User-configurable settings (edit before upload)
- **`README.md`**: Version-specific documentation and instructions

## Feature Comparison

| Feature | v1.0 | v1.1 | v1.2 | v1.3 | v2.0 |
|---------|------|------|------|------|------|
| WiFiManager | ❌ | ❌ | ✅ | ✅ | ✅ |
| OTA Updates | ❌ | ❌ | ✅ | ✅ | ✅ |
| Web Config | ❌ | ❌ | ❌ | ✅ | ✅ |
| EEPROM Storage | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reset Levels | ❌ | ❌ | ❌ | ✅ | ✅ |
| Unique Hostnames | ❌ | ❌ | ❌ | ✅ | ✅ |
| WiFi Timeout | ❌ | ❌ | ❌ | ❌ | ✅ |
| LED Indicators | ❌ | ❌ | ❌ | ❌ | ✅ |
| Device ID Config | ❌ | ❌ | ❌ | ❌ | ✅ |
| QR Code Support | ❌ | ❌ | ❌ | ❌ | ✅ |

## Upgrade Paths

### v1.3 → v2.0 (Recommended)
**Difficulty**: Easy
**Steps**: Upload v2.0 firmware via OTA
**Data Loss**: None (config preserved)
**Time**: 5 minutes

### v1.2 → v2.0
**Difficulty**: Medium
**Steps**:
1. Upgrade to v1.3 first
2. Reconfigure sensors/actuators via web
3. Then upgrade to v2.0 via OTA
**Data Loss**: Sensor configuration only
**Time**: 15-20 minutes

### v1.1 or earlier → v2.0
**Difficulty**: Medium
**Steps**:
1. Fresh install of v2.0
2. Reconfigure WiFi, sensors, actuators
**Data Loss**: All configuration
**Time**: 20-30 minutes

## Hardware Compatibility

### Supported Boards
- ✅ NodeMCU v1.0 (ESP-12E) - **Recommended**
- ✅ NodeMCU v0.9 (ESP-12)
- ✅ Wemos D1 Mini
- ✅ Wemos D1 Mini Pro
- ✅ ESP-01 (limited GPIO pins)
- ✅ Generic ESP8266 modules

### Safe GPIO Pins

These pins are safe for sensors/actuators:
- **D1 (GPIO5)** - Digital I/O
- **D2 (GPIO4)** - Digital I/O
- **D5 (GPIO14)** - Digital I/O, PWM
- **D6 (GPIO12)** - Digital I/O, PWM
- **D7 (GPIO13)** - Digital I/O, PWM
- **A0 (ADC)** - Analog input (0-1V)

### Pins to Avoid

These pins have special boot functions:
- ❌ **D0 (GPIO16)** - No PWM, limited use
- ❌ **D3 (GPIO0)** - Boot mode (used for FLASH button)
- ❌ **D4 (GPIO2)** - Boot mode (built-in LED)
- ❌ **D8 (GPIO15)** - Boot mode

### Supported Sensors
- DHT11, DHT22, DHT21 (AM2301)
- DS18B20 (Dallas/Maxim temperature)
- Capacitive soil moisture sensors
- Resistive soil moisture sensors
- Generic analog sensors (0-1V)

### Supported Actuators
- 5V relay modules (NO/NC)
- 3.3V relay modules (NO/NC)
- Solid state relays
- MOSFETs for high power switching
- DC motors via PWM
- LED strips via PWM
- Fans, pumps, valves, lights

## Troubleshooting

### Serial Monitor Shows Nothing

**Problem**: No output in Serial Monitor
**Solution**:
1. Set baud rate to **115200**
2. Check COM port is correct
3. Try pressing RESET button
4. Check USB cable (data, not charge-only)

### Can't Upload Firmware

**Problem**: Upload fails or timeout
**Solution**:
1. Close Serial Monitor during upload
2. Try lower upload speed (115200)
3. Hold FLASH button while clicking Upload
4. Install CH340 driver (for NodeMCU)
5. Try different USB cable/port

### Device Not Creating AP

**Problem**: "Serra-Setup" WiFi network doesn't appear
**Solution**:
1. Hold FLASH button for 3-10 seconds (WiFi reset)
2. Wait 30 seconds after boot
3. Check Serial Monitor for AP messages
4. Try full reset (hold FLASH 10+ seconds)

### Can't Access Web Interface

**Problem**: `http://serrasetup-XXXX.local` doesn't work
**Solution**:
1. Use IP address instead (check Serial Monitor)
2. Try `http://192.168.4.1` in AP mode
3. Check you're on same network as ESP8266
4. On Android, use IP (mDNS not supported)
5. Install Bonjour Print Services (Windows)

### Sensors Return NaN or 0

**Problem**: DHT22 or soil sensor not reading
**Solution**:
1. Check wiring (VCC, GND, DATA)
2. Verify correct GPIO pin in config
3. For DHT22: Use same pin for temp+humidity
4. For soil sensor: Must use A0 (analog)
5. Check sensor power (3.3V or 5V)
6. Try different sensor or cable

### Heartbeat Failing

**Problem**: Device offline despite WiFi connection
**Solution**:
1. Verify Supabase URL and API key
2. Check `device_heartbeat` RPC exists
3. Check device UUID matches webapp
4. v2.0 retries automatically (check Serial Monitor)
5. Test with `curl` or Postman

## Best Practices

### Security
- ✅ Change default OTA password
- ✅ Use strong WiFi password
- ✅ Keep firmware updated
- ✅ Don't expose device directly to internet
- ✅ Use VPN for remote access

### Deployment
- ✅ Test on breadboard before permanent install
- ✅ Use proper power supply (1A minimum)
- ✅ Add capacitors for stable power
- ✅ Use pull-up resistors for sensors
- ✅ Keep wires short for analog sensors
- ✅ Use shielded cables in noisy environments

### Maintenance
- ✅ Check Serial Monitor periodically
- ✅ Monitor free heap memory
- ✅ Keep backups of working configs
- ✅ Document your sensor/actuator setup
- ✅ Test updates in development first

### Configuration
- ✅ Use descriptive device IDs
- ✅ Match sensor IDs to Supabase exactly
- ✅ Verify GPIO pins before connecting hardware
- ✅ Test sensors individually before integration
- ✅ Keep notes on pin assignments

## Support & Resources

### Documentation
- [Complete System Docs](../docs/)
- [Supabase Setup](../SUPABASE_SETUP.md)
- [ESP8266 Integration Guide](../ESP8266_INTEGRATION.md)
- [Implementation Status](../IMPLEMENTATION_STATUS.md)

### Community
- **GitHub Issues**: [Report bugs](https://github.com/treetocoin/Serra/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/treetocoin/Serra/discussions)
- **Repository**: [Source code](https://github.com/treetocoin/Serra)

### External Resources
- [ESP8266 Arduino Core](https://github.com/esp8266/Arduino)
- [WiFiManager Library](https://github.com/tzapu/WiFiManager)
- [ArduinoJson Documentation](https://arduinojson.org/)
- [Supabase Documentation](https://supabase.com/docs)

## Contributing

Contributions welcome! To contribute:

1. Fork the repository
2. Create feature branch (`firmware-feature-name`)
3. Test thoroughly on real hardware
4. Update CHANGELOG.md
5. Submit pull request with:
   - Description of changes
   - Hardware tested on
   - Before/after behavior
   - Serial Monitor output

## License

See repository LICENSE file for details.

---

**Current Version**: v2.0.0
**Last Updated**: 2025-10-09
**Repository**: https://github.com/treetocoin/Serra
