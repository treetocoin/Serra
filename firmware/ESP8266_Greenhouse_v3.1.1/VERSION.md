# ESP8266 Greenhouse Firmware v3.1.0

## Release Date
2025-11-14

## Major Changes

### Cloud-Based Configuration System
- **Single Source of Truth**: Webapp is now the exclusive configuration interface
- **Automatic Sync**: Device polls for config changes every 60 seconds via heartbeat
- **Config Version Tracking**: Database tracks version, device compares and fetches updates
- **Auto Reinitialization**: Sensors reinitialize automatically when config changes

### Modified Components

#### heartbeat.cpp
- New `device_heartbeat_with_config()` RPC call returns config_version
- New `get_device_sensor_config()` RPC call fetches sensor configurations
- New `fetchAndApplyCloudConfig()` function parses and applies cloud config
- Port mapping supports: GPIO#, D#, A0 formats
- Sensor type mapping from database enums to firmware types

#### config.h/config.cpp
- Added `config_version` field to `DeviceConfig` struct
- Config version persisted in EEPROM for change detection

#### webserver.cpp
- `/config` endpoint now read-only
- Removed `handleSaveConfig()` POST handler
- Displays current config with cloud sync status

#### ESP8266_Greenhouse_v3.1.0.ino
- Main loop checks for config version mismatches
- Triggers config fetch when cloud version > local version
- Calls `initializeSensors()` after applying new config

#### sensors.cpp
- Enhanced debug output showing all sensor configs
- Reports total sensors initialized

## Database Changes

### New Functions
- `device_heartbeat_with_config(composite_device_id, firmware_version)` - Returns config_version
- `get_device_sensor_config(composite_device_id)` - Returns active sensor configs as JSON
- `increment_device_config_version()` - Trigger that auto-increments version on config changes

### Schema Changes
- `devices.config_version` column added (INTEGER, default 1)
- Trigger on `device_sensor_configs` table increments version on INSERT/UPDATE/DELETE

## Migration Path

### From v3.0 to v3.1.0

1. **Flash v3.1.0 firmware** to device
2. Device boots and sends first heartbeat
3. If webapp config exists, version mismatch detected
4. Device fetches cloud config automatically
5. EEPROM overwritten with cloud config
6. Sensors reinitialize with new config

### New Devices

1. Register device in webapp (get composite_device_id)
2. Flash v3.1.0 firmware
3. Connect via "Serra-Setup" AP
4. Enter WiFi credentials + device ID
5. Configure sensors in webapp
6. Wait up to 60 seconds for sync
7. Device fetches and applies config

## Breaking Changes

- **ESP8266 /config web portal is now read-only**
- Manual sensor configuration via ESP8266 portal removed
- All configuration must be done through webapp

## Bug Fixes

- Fixed anon key in heartbeat.cpp (was using incorrect JWT signature)
- Added debug output for config version comparison
- Added sensor initialization logging

## Known Issues

- Config fetch only happens every 60 seconds (heartbeat interval)
- No immediate push notification for config changes
- Device must be online to receive config updates

## Testing

- Database migration: `20251114000000_unified_sensor_config.sql`
- Verified config fetch on version mismatch
- Verified sensor reinitialization
- Verified read-only web portal display

## Firmware Size

Approximately same as v3.0 (~350KB compiled)

## Dependencies

- ESP8266WiFi
- WiFiManager
- ArduinoJson
- DHT sensor library
- ESP8266HTTPClient
- WiFiClientSecure

## Configuration

Supabase credentials hardcoded in `heartbeat.cpp`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Future Enhancements

- [ ] WebSocket/SSE for instant config push
- [ ] Config validation before applying
- [ ] Rollback on sensor init failure
- [ ] OTA firmware updates
- [ ] Config change notifications in webapp
