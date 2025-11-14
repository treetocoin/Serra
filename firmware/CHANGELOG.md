# ESP8266 Greenhouse Firmware Changelog

All notable changes to the ESP8266 firmware will be documented in this file.

## [v3.1.0] - 2025-11-14

### Added
- **Cloud-based configuration system** - Webapp is now the single source of truth
- `device_heartbeat_with_config()` RPC endpoint for config version checks
- `get_device_sensor_config()` RPC endpoint for fetching sensor configurations
- `fetchAndApplyCloudConfig()` function to download and apply cloud config
- `config_version` field in DeviceConfig struct for change detection
- Automatic config sync on heartbeat (max 60 second propagation)
- Automatic sensor reinitialization when config changes
- Port ID mapping support: GPIO#, D#, A0 formats
- Wemos D1 Mini pin name mapping (D1→GPIO5, D2→GPIO4, etc.)
- Enhanced debug logging in `initializeSensors()`
- Version comparison debug output in main loop
- VERSION.md file documenting v3.1.0 features

### Changed
- **BREAKING**: ESP8266 `/config` web portal is now read-only
- **BREAKING**: Manual sensor configuration removed from ESP8266
- All sensor configuration must be done through webapp
- Heartbeat now returns config_version for comparison
- Web portal displays cloud config status and current version
- Boot message updated to show v3.1.0 and cloud sync features
- Firmware version string updated to "v3.1.0" in heartbeat

### Removed
- `handleSaveConfig()` POST handler from webserver
- Manual sensor configuration form from ESP8266 web portal

### Fixed
- Corrected Supabase anon key in heartbeat.cpp
- Added proper JWT signature for API authentication

### Database
- Added `devices.config_version` column (INTEGER, default 1)
- Added `device_heartbeat_with_config()` function
- Added `get_device_sensor_config()` function
- Added `increment_device_config_version()` trigger function
- Trigger on `device_sensor_configs` auto-increments version

### Documentation
- Added UNIFIED_CONFIG_GUIDE.md with complete system documentation
- Migration path from v3.0 to v3.1.0
- Troubleshooting guide for config sync issues
- Port mapping reference table

## [v3.0.0] - 2025-11-13

### Added
- Composite Device ID system (format: PROJ#-ESP#)
- Auto-generated device keys (64-char hex)
- 2-level reset button system:
  - Level 1 (3s): WiFi reset only
  - Level 2 (10s): Full reset (WiFi + config + device key)
- Web-based sensor configuration portal at `/config`
- DHT22/DHT11 temperature and humidity sensor support
- Soil moisture sensor support
- Water level sensor support
- LED indicators for reset states
- WiFiManager captive portal for initial setup
- EEPROM-based configuration persistence
- CRC32 checksum validation for config integrity
- Edge Function heartbeat system
- Device hostname tracking
- RSSI reporting

### Features
- Support for up to 4 sensors per device
- Custom sensor naming
- GPIO pin configuration
- Status web page showing device info
- Automatic WiFi reconnection
- Device key hashing on backend

### Setup
- AP mode: "Serra-Setup"
- Web portal for WiFi configuration
- Composite Device ID input during setup
- Auto device key generation

---

## Version Format

`[MAJOR.MINOR.PATCH]` - YYYY-MM-DD

- **MAJOR**: Breaking changes, incompatible API changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Vulnerability fixes
- **Database**: Database schema or function changes
- **Breaking**: Breaking changes that require migration
