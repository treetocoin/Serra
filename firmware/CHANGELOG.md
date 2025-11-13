# Firmware Changelog

All notable changes to the ESP8266 Greenhouse firmware will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-09

### Added - QR Code Onboarding Support

#### WiFi Connection Management
- **WiFi Connection Timeout**: Automatic AP mode fallback after 30 seconds when WiFi connection fails
- **Connection Retry Logic**: ESP8266 automatically retries WiFi connection after failure
- **Graceful Degradation**: Device continues to operate in AP mode if WiFi connection fails

#### LED Status Indicators
- **LED OFF**: Indicates AP mode (waiting for WiFi configuration)
- **LED SLOW BLINK** (1Hz): Indicates connecting to WiFi
- **LED FAST BLINK** (10Hz, 5 seconds): Indicates error / WiFi connection failed
- **LED SOLID ON**: Indicates connected and online
- **Visual Feedback**: Users can see connection status without Serial Monitor

#### Device Identification
- **Customizable Device ID**: Users can set friendly device name via web interface (e.g., "Greenhouse 1", "North Garden")
- **EEPROM Storage**: Device ID persists across reboots
- **Web Configuration Page**: New device ID field in `/config` page with help text
- **Duplicate Names Allowed**: Multiple devices can have same friendly name (UUID provides uniqueness)
- **Default Device ID**: "My Greenhouse" set on first boot

#### Heartbeat Enhancements
- **Hostname Reporting**: Device reports hostname (e.g., `http://serrasetup-a1b2.local`) in every heartbeat
- **Retry Logic**: Heartbeat function retries 3 times with 5-second delay on failure
- **Exponential Backoff**: Graceful handling of temporary network issues
- **Error Logging**: Serial Monitor shows retry attempts and failure reasons

#### Web Interface Improvements
- **Device ID Configuration**: New field in configuration page for editing friendly name
- **Help Text**: Explanatory text about device ID being customizable
- **UUID Display**: Shows both UUID (permanent) and Device ID (customizable) on home page
- **"NEW" Badge**: v1.4 badge on home page to highlight new features
- **What's New Section**: Dedicated section on home page explaining v1.4 features

### Changed

- **EEPROM Magic Number**: Changed from `0xAB12` to `0xAB20` for v2.0 (forces config migration)
- **Configuration Structure**: Added `device_id` field (64 bytes) to `DeviceConfig` struct
- **LED Logic**: Centralized LED state management with `setLedState()` and `updateLed()` functions
- **WiFi Connection**: Now uses `connectWiFiWithTimeout()` function instead of direct `autoConnect()`
- **Heartbeat Payload**: Now includes `hostname_param` field in RPC call
- **Web UI**: Enhanced home page and configuration page with new fields
- **Firmware Version**: Bumped to v2.0.0 to reflect major feature release

### Fixed

- **WiFi Reconnection**: Better handling of WiFi connection loss with timeout
- **AP Mode Recovery**: Device reliably returns to AP mode after connection failure
- **LED State Persistence**: LED state correctly reflects connection status after reset button release
- **Heartbeat Reliability**: Retry logic prevents single network glitch from marking device offline

### Technical Details

#### New Functions
- `setLedState(LedState state)` - Set LED status indicator
- `updateLed()` - Update LED state based on current status
- `indicateError()` - Flash LED fast for 5 seconds to indicate error
- `connectWiFiWithTimeout()` - Connect to WiFi with timeout and LED feedback

#### Modified Functions
- `sendHeartbeat()` - Now includes retry logic and hostname reporting
- `loadConfiguration()` - Handles new device ID field
- `saveConfiguration()` - Saves device ID to EEPROM
- `resetConfiguration()` - Resets device ID to default
- `handleRoot()` - Shows device ID and v1.4 features
- `handleConfigPage()` - Includes device ID edit field
- `handleGetConfig()` - Returns device ID in JSON
- `handleSaveConfig()` - Saves device ID from form

#### New Constants
- `WIFI_CONNECT_TIMEOUT` (30000ms) - WiFi connection timeout
- `HEARTBEAT_RETRY_ATTEMPTS` (3) - Number of heartbeat retry attempts
- `HEARTBEAT_RETRY_DELAY` (5000ms) - Delay between retry attempts
- `FIRMWARE_VERSION` ("2.0.0") - Updated firmware version string

#### New Enums
- `LedState` enum with states: LED_OFF, LED_SLOW_BLINK, LED_FAST_BLINK, LED_SOLID

## [1.3.0] - 2025-10-09

### Added
- **Web-based Configuration**: Configure sensors and actuators via browser interface
- **EEPROM Storage**: Persistent configuration storage (survives power loss)
- **Pin Mapping Interface**: Select GPIO pins from dropdown menu
- **DHT Pair Management**: Configure DHT22 temperature/humidity pairs
- **Configuration API**: RESTful JSON API for configuration management
- **Two-Level Reset System**:
  - Level 1 (3-10s): WiFi reset only (preserves sensor config)
  - Level 2 (10+s): Full reset (erases everything)
- **Visual Reset Indicators**: LED patterns show reset level
- **Unique Hostnames**: Automatic hostname generation based on MAC address
- **Safe Pin Selection**: Only safe GPIO pins available in web interface

### Changed
- **EEPROM Magic Number**: Changed to `0xAB12` for v1.3
- **Configuration Storage**: Moved from hardcoded to EEPROM-based
- **Hostname Format**: `serrasetup-XXXX.local` where XXXX is MAC-derived

### Fixed
- **Boot Pin Issues**: Removed D0, D3, D4, D8 from available pins
- **Multiple Device Support**: Unique hostnames prevent conflicts

## [1.2.0] - 2025-10-08

### Added
- **WiFiManager Integration**: Easy WiFi setup via captive portal
- **OTA Update Support**: Update firmware over WiFi
- **mDNS Support**: Access device via `serrasetup.local`
- **Web Interface**: Basic status and control page
- **HTTP Update Server**: Web-based firmware upload at `/update`

### Changed
- **WiFi Configuration**: Moved from hardcoded to WiFiManager
- **AP Mode**: Automatic AP mode on first boot or reset

## [1.1.0] - 2025-09-15

### Added
- **DHT22 Support**: Temperature and humidity sensors
- **Soil Moisture Support**: Analog capacitive sensors
- **DS18B20 Support**: Dallas temperature sensors
- **Supabase Integration**: Cloud database sync
- **Heartbeat System**: Regular device status reporting
- **Command Polling**: Remote actuator control
- **Relay Support**: Both NO and NC relays
- **PWM Support**: Variable speed control

### Changed
- **Sensor Reading**: Moved to separate function
- **Error Handling**: Better error messages and recovery

## [1.0.0] - 2025-09-01

### Added
- **Initial Release**: Basic ESP8266 firmware
- **WiFi Connection**: Hardcoded credentials
- **Basic Sensors**: DHT22 only
- **Serial Monitor**: Debug output
- **LED Indicator**: Basic on/off status

---

## Version Numbering

Firmware uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Incompatible API changes or database schema changes
- **MINOR** version: New features in a backwards-compatible manner
- **PATCH** version: Backwards-compatible bug fixes

Example: `2.0.0` = Major 2, Minor 0, Patch 0

## Upgrade Path

### From v1.3 to v2.0

**Automatic**: Just upload new firmware. Configuration is preserved.

**Changes**:
- EEPROM magic number changes (forces config validation)
- Device ID field added (defaults to "My Greenhouse")
- Existing sensor/actuator config is preserved

**Steps**:
1. Upload v2.0 firmware via OTA or USB
2. ESP8266 reboots
3. Device ID defaults to "My Greenhouse"
4. Go to `/config` to set custom device ID
5. Save configuration

### From v1.2 to v1.3

**Manual**: Requires reconfiguration via web interface.

**Changes**:
- Configuration moved from code to EEPROM
- Sensors/actuators must be configured via web UI
- WiFi credentials preserved

**Steps**:
1. Upload v1.3 firmware
2. ESP8266 reboots (no sensors configured yet)
3. Go to `/config` page
4. Add sensors and actuators
5. Save configuration

### From v1.1 to v1.2

**Manual**: Requires WiFi reconfiguration.

**Changes**:
- WiFi credentials moved from code to WiFiManager
- Must reconfigure WiFi on first boot

**Steps**:
1. Upload v1.2 firmware
2. ESP8266 enters AP mode "Serra-Setup"
3. Connect and configure WiFi
4. ESP8266 connects and works normally

## Feature Matrix

| Feature | v1.0 | v1.1 | v1.2 | v1.3 | v2.0 |
|---------|------|------|------|------|------|
| Basic WiFi | ✅ | ✅ | ✅ | ✅ | ✅ |
| WiFiManager | ❌ | ❌ | ✅ | ✅ | ✅ |
| DHT22 Sensors | ✅ | ✅ | ✅ | ✅ | ✅ |
| Soil Moisture | ❌ | ✅ | ✅ | ✅ | ✅ |
| DS18B20 | ❌ | ✅ | ✅ | ✅ | ✅ |
| Relay Control | ❌ | ✅ | ✅ | ✅ | ✅ |
| PWM Control | ❌ | ✅ | ✅ | ✅ | ✅ |
| Supabase Sync | ❌ | ✅ | ✅ | ✅ | ✅ |
| OTA Updates | ❌ | ❌ | ✅ | ✅ | ✅ |
| mDNS | ❌ | ❌ | ✅ | ✅ | ✅ |
| Web Interface | ❌ | ❌ | ✅ | ✅ | ✅ |
| Web Config | ❌ | ❌ | ❌ | ✅ | ✅ |
| EEPROM Storage | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reset Levels | ❌ | ❌ | ❌ | ✅ | ✅ |
| Unique Hostnames | ❌ | ❌ | ❌ | ✅ | ✅ |
| **WiFi Timeout** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **LED Indicators** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Device ID Config** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Hostname Reporting** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Heartbeat Retry** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **QR Code Support** | ❌ | ❌ | ❌ | ❌ | ✅ |

## Known Issues

### v2.0.0

- **mDNS on Android**: Some Android devices don't support mDNS. Use IP address instead.
- **LED Inverted**: Built-in LED uses inverted logic (LOW=ON, HIGH=OFF)
- **Serial Monitor Required**: Hostname only visible in Serial Monitor at boot

### v1.3.0

- **Configuration Migration**: Upgrading from v1.2 requires manual reconfiguration
- **Pin Conflicts**: Using boot pins will cause boot issues (addressed by safe pin list)

### v1.2.0

- **First Boot Delay**: WiFiManager portal timeout causes 5-minute delay if not configured
- **mDNS Reliability**: mDNS may not work on all networks

## Reporting Issues

Found a bug? Please report it on GitHub:

1. Check existing issues: https://github.com/treetocoin/Serra/issues
2. Create new issue with:
   - Firmware version
   - Hardware details (board type, sensors, etc.)
   - Steps to reproduce
   - Serial Monitor output
   - Expected vs actual behavior

## Contributing

Contributions welcome! See repository CONTRIBUTING.md for guidelines.

---

**Last Updated**: 2025-10-09
**Current Version**: 2.0.0
