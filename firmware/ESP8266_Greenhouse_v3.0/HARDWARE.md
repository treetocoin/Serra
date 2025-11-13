# ESP8266 Hardware Requirements

**Feature**: 004-tutto-troppo-complicato (Simplified Device Onboarding)
**Firmware Version**: v3.0
**Last Updated**: 2025-11-12

## Overview

This document specifies the hardware requirements for ESP8266-based greenhouse monitoring devices using the simplified project-scoped device ID system.

## Supported Boards

### Primary (Tested)
- **NodeMCU v1.0 (ESP-12E)** - Recommended
  - Flash: 4MB
  - RAM: 80KB
  - USB-to-Serial: CP2102 or CH340
  - Operating Voltage: 3.3V
  - Input Voltage: 5V via USB

- **Wemos D1 Mini**
  - Flash: 4MB
  - RAM: 80KB
  - USB-to-Serial: CH340
  - Operating Voltage: 3.3V
  - Input Voltage: 5V via USB

### Compatible (Not Tested)
- ESP-01 (1MB flash - requires code optimization)
- ESP-12F
- ESP-12S

## Minimum Requirements

### Flash Memory
- **Required**: 1MB (1024KB)
- **Recommended**: 4MB for OTA updates
- **Partition Layout**:
  - Sketch: ~300KB (with WiFiManager library)
  - SPIFFS: Optional (not currently used)
  - OTA: 512KB reserved (for future updates)

### RAM
- **Required**: 80KB
- **Available Heap at Runtime**: ~45KB free after WiFiManager initialization
- **Critical**: WiFiManager captive portal requires ~30KB heap

### Flash Speed
- **Required**: 40MHz minimum
- **Recommended**: 80MHz for faster boot and web server response

## Pin Configuration

### Default Pin Assignments

```
GPIO Pin  | NodeMCU | Function         | Notes
----------|---------|------------------|------------------
GPIO0     | D3      | Flash Button     | Used for WiFi reset (hold 5s)
GPIO2     | D4      | Built-in LED     | Status indicator
GPIO4     | D2      | I2C SDA          | Reserved for sensors
GPIO5     | D1      | I2C SCL          | Reserved for sensors
GPIO12    | D6      | DHT22 Data       | Temperature/Humidity sensor
GPIO13    | D7      | Relay 1          | Actuator control
GPIO14    | D5      | Relay 2          | Actuator control
GPIO15    | D8      | Relay 3          | Actuator control
GPIO16    | D0      | Wake from Sleep  | Reserved for deep sleep
ADC0      | A0      | Analog Sensor    | Soil moisture, light level
TX        | TX      | Serial Debug     | 115200 baud
RX        | RX      | Serial Debug     | 115200 baud
```

### Pin Constraints

**Boot Mode Pins** (must be in specific states at boot):
- GPIO0: HIGH (internal pull-up) - LOW enters flash mode
- GPIO2: HIGH (internal pull-up) - Must be HIGH at boot
- GPIO15: LOW (internal pull-down) - Must be LOW at boot

**Avoid Using**:
- GPIO6-11: Connected to internal flash (SPI)
- GPIO1 (TX) and GPIO3 (RX): Reserved for serial debugging

## Power Requirements

### Operating Conditions
- **Supply Voltage**: 3.3V ± 0.3V
- **Supply Current**:
  - Active (WiFi transmitting): 170mA average, 300mA peak
  - Active (WiFi connected, idle): 50-80mA
  - Deep Sleep: 20µA (not currently implemented)

### Power Supply Options

1. **USB Power (Development)**
   - 5V USB → Built-in 3.3V regulator
   - Maximum sustained current: 500mA
   - ✅ Sufficient for ESP8266 + DHT22 + 3 relays

2. **External 5V Supply (Production)**
   - Use AMS1117-3.3 or similar LDO regulator
   - Minimum 1A capacity recommended
   - Add bulk capacitor (100µF) near ESP8266

3. **Battery Power**
   - 3× AA batteries (4.5V) → AMS1117-3.3 regulator
   - 1× 18650 Li-Ion (3.7V) → No regulator needed
   - Deep sleep implementation required for longevity

### Power Consumption by Component

| Component      | Current Draw | Notes                    |
|----------------|--------------|--------------------------|
| ESP8266 WiFi TX| 170mA avg    | Peak 300mA              |
| ESP8266 Idle   | 50-80mA      | WiFi connected          |
| DHT22 Sensor   | 1-1.5mA      | Only during reading     |
| Relay (each)   | 70mA         | When energized          |
| LED Indicators | 5mA          | If added (not default)  |

**Total Maximum**: 80mA (idle) + 210mA (3 relays) + 1.5mA (DHT22) = ~292mA

## Memory Usage

### Flash Usage (Firmware v3.0)
```
Sketch: ~295KB / 1024KB (28%)
├── Core Libraries: 180KB
├── WiFiManager: 45KB
├── ArduinoJson: 25KB
├── HTTPClient: 20KB
└── Application Code: 25KB
```

### EEPROM Usage
```
Address | Size | Content
--------|------|------------------
0x00    | 10   | Project ID (PROJ1)
0x0A    | 2    | Device Number (5)
0x0C    | 32   | Device Key (API key)
0x2C    | 32   | WiFi SSID (backup)
0x4C    | 32   | WiFi Password (backup)
```

**Total EEPROM Used**: 108 bytes / 4096 bytes available

### Runtime Heap

| State                    | Free Heap |
|--------------------------|-----------|
| Boot (before WiFi)       | ~50KB     |
| WiFi Connected           | ~45KB     |
| Captive Portal Active    | ~38KB     |
| HTTP Request Active      | ~35KB     |
| **Critical Threshold**   | **< 15KB**|

## Environmental Specifications

### Operating Temperature
- **ESP8266 Module**: -40°C to +125°C
- **NodeMCU Board**: -20°C to +70°C (limited by USB connector)
- **Recommended Greenhouse**: 0°C to +50°C

### Humidity
- **Maximum**: 95% RH non-condensing
- **Protection**: Use conformal coating for high humidity environments

### Enclosure Requirements
- IP54 minimum for greenhouse deployment
- Ventilation slots required (heat dissipation)
- Cable gland for sensor wiring

## Sensor Compatibility

### Digital Sensors (I2C/OneWire)
- DHT22 (Temperature/Humidity)
- DS18B20 (Temperature)
- BME280 (Temperature/Humidity/Pressure)
- BH1750 (Light intensity)

### Analog Sensors (ADC0)
- Soil moisture sensors (capacitive or resistive)
- Photoresistors (LDR)
- pH sensors (with signal conditioning)

**Note**: ESP8266 ADC is 10-bit (0-1023) with 0-1V range. Use voltage dividers for higher voltages.

## Actuator Compatibility

### Relay Modules
- **Recommended**: 5V relay modules with optocoupler isolation
- **Maximum per GPIO**: 1 relay (40mA GPIO limit)
- **Total Relays**: 3 (configurable on D5, D6, D7)
- **Relay Type**: NO/NC both supported
- **Load Rating**: Depends on relay (typically 10A @ 250VAC)

### Direct GPIO Control (Low Power)
- LEDs (with current-limiting resistor)
- Small MOSFETs (for PWM dimming)
- Solid-state relays (SSR)

## WiFi Specifications

### Supported Standards
- IEEE 802.11 b/g/n
- 2.4 GHz only (5 GHz NOT supported)

### WiFi Modes
- **Station (STA)**: Connect to existing network
- **Access Point (AP)**: Captive portal for configuration
- **AP+STA**: Simultaneous (used during configuration)

### Network Requirements
- **Security**: WPA/WPA2-PSK (WEP not recommended)
- **DHCP**: Required (static IP not currently supported)
- **Firewall**: Must allow outbound HTTPS (443) to Supabase
- **Range**: Typical 50m indoor, 100m outdoor (line of sight)

### Signal Strength (RSSI)
- **Excellent**: > -50 dBm
- **Good**: -50 to -60 dBm
- **Fair**: -60 to -70 dBm
- **Poor**: -70 to -80 dBm
- **Unusable**: < -80 dBm

## Development Tools

### Required Software
- Arduino IDE 1.8.19+ or 2.0+
- ESP8266 Board Package 3.0.0+
- USB-to-Serial drivers (CP2102 or CH340)

### Required Arduino Libraries
```
WiFiManager @ ^2.0.16-rc.2
ArduinoJson @ ^6.21.0
ESP8266WiFi (included in core)
ESP8266HTTPClient (included in core)
EEPROM (included in core)
```

### Programming Settings (Arduino IDE)
```
Board: "NodeMCU 1.0 (ESP-12E Module)"
Upload Speed: 115200
CPU Frequency: 80 MHz
Flash Size: "4MB (FS:1MB OTA:~1019KB)"
lwIP Variant: "v2 Lower Memory"
VTables: "Flash"
Erase Flash: "Only Sketch" (or "All Flash Contents" for clean install)
```

## Troubleshooting

### Common Issues

**1. Device won't boot / stuck in boot loop**
- Check GPIO0, GPIO2, GPIO15 pull-up/down resistors
- Verify 3.3V power supply stability
- Check for shorts on GPIO pins

**2. WiFi connection fails**
- Verify 2.4 GHz network (5 GHz not supported)
- Check WiFi password (case-sensitive)
- Ensure router allows new devices
- Verify DHCP is enabled on router

**3. Out of memory errors**
- Reduce WiFiManager timeout (default 180s)
- Disable debug serial output in production
- Use F() macro for string literals
- Check for memory leaks in loops

**4. Captive portal doesn't appear**
- Wait 30 seconds after reset
- Try airplane mode on/off on phone
- Connect manually to "ESP_Setup_XXXX" network
- Navigate to http://192.168.4.1

**5. Heartbeat fails to send**
- Check RSSI (must be > -80 dBm)
- Verify outbound HTTPS (443) not blocked
- Check device key is saved in EEPROM
- Verify Supabase project ID in firmware

## Bill of Materials (BOM)

### Minimum Setup (Single Device)
| Component           | Quantity | Estimated Cost |
|---------------------|----------|----------------|
| NodeMCU v1.0        | 1        | $4-6           |
| Micro-USB Cable     | 1        | $2-3           |
| 5V 1A Power Supply  | 1        | $3-5           |
| DHT22 Sensor        | 1        | $5-8           |
| 3-Channel Relay     | 1        | $3-5           |
| Jumper Wires        | 10       | $2             |
| Breadboard          | 1        | $3-5           |
| **Total**           |          | **$22-37**     |

### Production Setup (Recommended)
| Component           | Quantity | Estimated Cost |
|---------------------|----------|----------------|
| NodeMCU v1.0        | 1        | $4-6           |
| 5V 2A Power Supply  | 1        | $5-8           |
| DHT22 Sensor        | 1        | $5-8           |
| 3-Channel Relay     | 1        | $3-5           |
| PCB/Prototype Board | 1        | $2-4           |
| Enclosure (IP54)    | 1        | $8-12          |
| Cable Glands        | 2-3      | $3-5           |
| Screw Terminals     | 5-10     | $2-3           |
| **Total**           |          | **$32-51**     |

## Safety Warnings

⚠️ **ELECTRICAL SAFETY**
- Never connect AC mains voltage directly to ESP8266 pins
- Use proper relay isolation for high-voltage loads
- Enclose all mains connections in approved enclosures
- Follow local electrical codes and regulations

⚠️ **STATIC DISCHARGE**
- ESP8266 is sensitive to ESD (Electrostatic Discharge)
- Use ESD wrist strap when handling bare modules
- Store in anti-static bags

⚠️ **THERMAL**
- ESP8266 can get hot during WiFi transmission (>60°C)
- Ensure adequate ventilation in enclosures
- Don't cover WiFi antenna area with metal

---

**For technical support**: See project README.md
**Firmware source**: `firmware/ESP8266_Greenhouse_v3.0/`
**Specification**: `specs/004-tutto-troppo-complicato/spec.md`
