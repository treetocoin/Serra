# Unified Sensor Configuration System

## Overview

The sensor configuration system has been **unified** to use the webapp as the single source of truth. This eliminates the need for duplicate configuration on both the ESP8266 web portal and the webapp.

## How It Works

### 1. Configure from Webapp

Users configure sensors directly from the webapp device detail page:

1. Navigate to `/devices/{device-id}`
2. Use the **Sensor Configuration** section
3. Select sensor type (Temperature, Humidity, Soil Moisture, Water Level)
4. Specify GPIO port (e.g., "GPIO4", "D1", "A0")
5. Click "Add Configuration"

### 2. Automatic Sync to ESP8266

The system automatically syncs configuration to the ESP8266:

**Database Layer:**
- When configuration changes, `config_version` increments automatically (via trigger)
- `device_sensor_configs` table stores active configurations

**ESP8266 Firmware:**
- Every 60 seconds, sends heartbeat with config version check
- Compares cloud `config_version` with local cached version
- If cloud version is newer, fetches config via `get_device_sensor_config()`
- Applies config to EEPROM and reinitializes sensors
- Updates local `config_version` to match cloud

### 3. Read-Only ESP8266 Portal

The ESP8266 web portal (`http://<device-ip>/config`) now displays:
- Current sensor configuration (read-only)
- Cloud config version number
- Message directing users to webapp for changes

## Architecture

```
Webapp (User configures)
    ↓
Database (config_version++)
    ↓
ESP8266 Heartbeat (detects version change)
    ↓
Fetch Config (get_device_sensor_config)
    ↓
Apply to EEPROM & Reinitialize Sensors
```

## Database Functions

### `device_heartbeat_with_config(composite_device_id, firmware_version)`
Returns current `config_version` with heartbeat response.

### `get_device_sensor_config(composite_device_id)`
Returns active sensor configurations as JSON array:
```json
[
  {
    "sensor_type": "dht_sopra_temp",
    "port_id": "GPIO4",
    "configured_at": "2025-11-14T10:30:00Z"
  }
]
```

### `increment_device_config_version()`
Trigger function that auto-increments `config_version` when sensor configs change.

## Port ID Mapping

The firmware supports multiple port naming conventions:

| Format     | Example | Maps To |
|------------|---------|---------|
| GPIO prefix | "GPIO4" | GPIO 4  |
| D prefix    | "D1"    | GPIO 5  |
| Analog      | "A0"    | ADC pin |
| Number only | "4"     | GPIO 4  |

**Wemos D1 Mini Pin Mapping:**
- D0 → GPIO 16
- D1 → GPIO 5
- D2 → GPIO 4
- D3 → GPIO 0
- D4 → GPIO 2
- D5 → GPIO 14
- D6 → GPIO 12
- D7 → GPIO 13
- D8 → GPIO 15

## Sensor Type Mapping

| Database Type       | Firmware Enum | Hardware |
|---------------------|---------------|----------|
| dht_sopra_temp      | 1 (DHT22)     | DHT22/DHT11 |
| dht_sopra_humidity  | 1 (DHT22)     | DHT22/DHT11 |
| dht_sotto_temp      | 1 (DHT22)     | DHT22/DHT11 |
| dht_sotto_humidity  | 1 (DHT22)     | DHT22/DHT11 |
| soil_moisture_1-5   | 3 (Soil)      | Capacitive/Resistive |
| water_level         | 4 (Water)     | Ultrasonic/Float |

## Firmware Changes (v3.1.0)

### Added:
- `HeartbeatResponse` struct with `config_version` field
- `fetchAndApplyCloudConfig()` function
- Config version comparison in main loop
- Automatic sensor reinitialization on config change

### Modified:
- `DeviceConfig` struct: added `config_version` field
- `sendHeartbeat()`: now returns `HeartbeatResponse`
- `/config` web page: converted to read-only display

### Removed:
- `handleSaveConfig()` POST handler
- Manual sensor configuration form

## Migration Path

**Existing Devices (v3.0):**
1. Upgrade firmware to v3.1.0
2. On first heartbeat, device fetches cloud config
3. If webapp config exists, it overwrites local EEPROM config
4. Device config syncs automatically going forward

**New Devices:**
1. Register device in webapp
2. Flash v3.1.0 firmware
3. Connect to WiFi via portal
4. Configure sensors in webapp
5. Device fetches config on next heartbeat (max 60s wait)

## Troubleshooting

### Config Not Syncing

**Check:**
1. Device is online (heartbeat succeeding)
2. Cloud `config_version` is higher than device version
3. Serial monitor shows "Config update detected" message
4. HTTP 200 response from `get_device_sensor_config`

**Debug Commands:**
```bash
# Check device config_version in DB
SELECT composite_device_id, config_version FROM devices;

# Check active sensor configs
SELECT * FROM device_sensor_configs WHERE device_id = '<uuid>' AND is_active = true;

# Manually increment config_version to force resync
UPDATE devices SET config_version = config_version + 1 WHERE composite_device_id = 'PROJ1-ESP1';
```

### Port Mapping Issues

If sensors aren't working after config sync, verify GPIO mappings match your hardware. Use Wemos D1 Mini pin names (D1-D8) in webapp for consistency.

## Benefits

1. **Single Source of Truth**: No configuration drift between webapp and device
2. **Automatic Updates**: Changes propagate within 60 seconds
3. **User-Friendly**: Configure everything from webapp UI
4. **Auditable**: All config changes tracked in database
5. **Resilient**: Device retains config in EEPROM if offline

## API Endpoints

### Heartbeat with Config Check
```
POST /rest/v1/rpc/device_heartbeat_with_config
{
  "composite_device_id_param": "PROJ1-ESP1",
  "firmware_version_param": "v3.1.0"
}
```

### Get Sensor Config
```
POST /rest/v1/rpc/get_device_sensor_config
{
  "composite_device_id_param": "PROJ1-ESP1"
}
```

## Future Enhancements

- [ ] Immediate push notifications (WebSocket/SSE)
- [ ] Config validation before applying
- [ ] Rollback on sensor initialization failure
- [ ] A/B testing multiple configs
- [ ] Scheduled config changes
