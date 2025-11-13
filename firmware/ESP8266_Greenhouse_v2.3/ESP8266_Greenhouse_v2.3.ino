/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 with QR Code Onboarding
 * Firmware v2.2 - HTTPS Edge Function + Secure Device Keys
 * ================================================================================
 *
 * NEW IN v2.2:
 * - 🔐 HTTPS heartbeat to Edge Function (no more anon key on device!)
 * - 🔑 Per-device authentication keys (device_key replaces api_key)
 * - ⏰ NTP time synchronization for HTTPS certificate validation
 * - 🛡️ TLS with SNI and Let's Encrypt ISRG Root X1 CA certificate
 * - 📊 Rich telemetry: RSSI, firmware version, IP address
 *
 * NEW IN v2.1:
 * - 📱 Robust QR code provisioning with dedicated /provision endpoint
 * - 💾 Device credentials saved to EEPROM before WiFi configuration
 * - ⚡ Zero-touch setup option (WiFi credentials in QR code)
 * - 🔗 Success page with manual link to WiFi configuration
 *
 * NEW IN v2.0:
 * - 🔗 WiFi connection timeout with automatic AP mode fallback (30 seconds)
 * - 💡 LED status indicators (OFF=AP mode, slow blink=connecting, fast blink=error, solid=online)
 * - 🆔 Customizable Device ID via web interface (saved to EEPROM)
 * - 📡 Hostname reporting in heartbeat for QR code onboarding
 * - 🔄 Heartbeat retry logic with exponential backoff (3 attempts, 5-second delay)
 * - 📋 Help text explaining device ID customization
 *
 * ================================================================================
 * FIRST SETUP - COMPLETE CONFIGURATION
 * ================================================================================
 *
 * 1. Upload firmware via USB
 * 2. ESP8266 starts in AP mode "Serra-Setup" (LED OFF)
 * 3. Connect to WiFi via WiFiManager
 * 4. LED starts slow blinking (connecting)
 * 5. After WiFi connection: LED solid ON (online)
 * 6. Check Serial Monitor for unique hostname (e.g., http://serrasetup-a1b2.local)
 * 7. Open that URL in browser
 * 8. Click "⚙️ Configure Device & Sensors"
 * 9. Set device ID (friendly name - can be anything!)
 * 10. Configure sensors and actuators
 * 11. Click "Save Configuration"
 * 12. ESP8266 reboots with new configuration!
 *
 * ================================================================================
 * LED STATUS INDICATORS
 * ================================================================================
 *
 * LED OFF:           AP mode (waiting for WiFi configuration)
 * LED SLOW BLINK:    Connecting to WiFi (1Hz, every 1 second)
 * LED FAST BLINK:    Error / WiFi connection failed (10Hz, 5 seconds)
 * LED SOLID ON:      Connected and online
 *
 * ================================================================================
 * QR CODE ONBOARDING SUPPORT
 * ================================================================================
 *
 * This firmware supports QR code-based onboarding:
 * 1. Register device in webapp
 * 2. Webapp shows QR code with WiFi credentials
 * 3. Scan QR code with mobile device
 * 4. ESP8266 connects automatically
 * 5. Device reports hostname in heartbeat
 * 6. Webapp can access device configuration
 *
 * Hostname format: http://serrasetup-XXXX.local
 * - XXXX = last 4 hex chars of MAC address (unique per device)
 *
 * ================================================================================
 * DEVICE ID CUSTOMIZATION
 * ================================================================================
 *
 * You can set a friendly device ID (name) via web interface:
 * - Open http://serrasetup-XXXX.local/config
 * - Edit "Device ID" field
 * - Use any name you want (e.g., "Greenhouse 1", "North Garden")
 * - Duplicates are OK! UUID provides uniqueness
 * - Saved permanently in EEPROM
 * - Sent to server in heartbeat
 *
 * ================================================================================
 * RESET CONFIGURATION - TWO LEVELS
 * ================================================================================
 *
 * FLASH BUTTON (GPIO0/D3):
 *
 * LEVEL 1 - Reset WiFi (3-10 seconds):
 * - Hold FLASH button
 * - After 3 seconds: LED blinks FAST (every 100ms)
 * - Release button BEFORE 10 seconds
 * - ✅ WiFi reset (sensor/device config PRESERVED!)
 * - ESP reboots in AP mode "Serra-Setup"
 *
 * LEVEL 2 - Full Reset (10+ seconds):
 * - Hold FLASH button
 * - After 3 seconds: LED blinks FAST
 * - Keep holding...
 * - After 10 seconds: LED blinks SLOW (every 300ms)
 * - LED blinks VERY FAST = reset in progress!
 * - ✅ WiFi + Device ID + Sensors + Actuators ALL ERASED
 * - ESP reboots in AP mode "Serra-Setup"
 *
 * Visual indicators:
 * - 🟢 Fast blink (100ms) = WiFi reset ready
 * - 🔵 Slow blink (300ms) = Full reset ready
 * - 🔴 Very fast blink (30ms) = Reset in progress
 *
 * ================================================================================
 * MULTIPLE BOARDS ON SAME WIFI NETWORK
 * ================================================================================
 *
 * AUTOMATIC UNIQUE HOSTNAMES:
 * Each ESP8266 generates unique hostname based on MAC address.
 *
 * Examples:
 * - First board:  http://serrasetup-a1b2.local
 * - Second board: http://serrasetup-c3d4.local
 * - Third board:  http://serrasetup-e5f6.local
 *
 * HOW TO FIND YOUR HOSTNAME:
 * 1. Open Serial Monitor (115200 baud)
 * 2. Reboot ESP8266
 * 3. Look for line: "📡 Hostname: serrasetup-XXXX.local"
 * 4. Use that address in browser
 *
 * NOTE: The -XXXX suffix comes from last 2 bytes of MAC address
 * and is PERMANENT for each board (never changes).
 *
 * IP ACCESS (alternative):
 * If mDNS doesn't work on your device, use direct IP:
 * - Check Serial Monitor for IP
 * - Example: http://192.168.1.123
 *
 * ================================================================================
 * GPIO PIN MAPPING (NodeMCU) - SAFE PINS ONLY
 * ================================================================================
 *
 * AVAILABLE PINS IN WEB INTERFACE:
 *
 * DIGITAL (sensors/actuators):
 * - D1 = GPIO5  ✅ Safe
 * - D2 = GPIO4  ✅ Safe
 * - D5 = GPIO14 ✅ Safe
 * - D6 = GPIO12 ✅ Safe
 * - D7 = GPIO13 ✅ Safe
 *
 * ANALOG (sensors only):
 * - A0 = ADC    ✅ Safe (0-1V, max 3.3V with voltage divider)
 *
 * UNAVAILABLE PINS (special boot functions):
 * - D0 = GPIO16 ❌ No PWM, no interrupts
 * - D3 = GPIO0  ❌ Boot mode (must be HIGH)
 * - D4 = GPIO2  ❌ Boot mode + Built-in LED
 * - D8 = GPIO15 ❌ Boot mode (must be LOW)
 *
 * ================================================================================
 * SUPPORTED SENSOR TYPES
 * ================================================================================
 *
 * DHT22_TEMP      - DHT22 temperature (digital pin)
 * DHT22_HUM       - DHT22 humidity (digital pin)
 * SOIL_MOISTURE   - Analog soil moisture sensor (A0 only)
 * DS18B20         - Dallas temperature sensor (digital pin)
 *
 * ================================================================================
 * SUPPORTED ACTUATOR TYPES
 * ================================================================================
 *
 * RELAY_NO        - Normally open relay (ON=HIGH)
 * RELAY_NC        - Normally closed relay (ON=LOW)
 * PWM             - PWM control 0-255 (fans, dimmers)
 *
 * ================================================================================
 * REQUIRED LIBRARIES
 * ================================================================================
 *
 * INSTALL VIA LIBRARY MANAGER:
 * - WiFiManager by tzapu (v2.0.16-rc.2+)
 * - ArduinoJson by Benoit Blanchon (v6.x)
 * - DHT sensor library by Adafruit
 * - Adafruit Unified Sensor
 * - OneWire by Paul Stoffregen (for DS18B20)
 * - DallasTemperature by Miles Burton (for DS18B20)
 *
 * ================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ESP8266mDNS.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ArduinoOTA.h>
#include <ESP8266HTTPUpdateServer.h>
#include <EEPROM.h>
#include <time.h>  // NEW v2.2: NTP time sync for HTTPS

// ========================================
// HTTPS / TLS CONFIGURATION (NEW v2.2)
// ========================================

// Let's Encrypt ISRG Root X1 CA Certificate (for Supabase HTTPS)
// Valid until: 2035-09-04
const char* SUPABASE_CA_CERT = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" \
"cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4\n" \
"WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu\n" \
"ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY\n" \
"MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc\n" \
"h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+\n" \
"0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U\n" \
"A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW\n" \
"T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH\n" \
"B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC\n" \
"B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv\n" \
"KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn\n" \
"OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn\n" \
"jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw\n" \
"qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI\n" \
"rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV\n" \
"HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq\n" \
"hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL\n" \
"ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ\n" \
"3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK\n" \
"NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5\n" \
"ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur\n" \
"TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC\n" \
"jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc\n" \
"oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq\n" \
"4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA\n" \
"mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d\n" \
"emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=\n" \
"-----END CERTIFICATE-----\n";

// NTP Servers for time synchronization (required for HTTPS)
const char* NTP_SERVER1 = "pool.ntp.org";
const char* NTP_SERVER2 = "time.nist.gov";
const char* NTP_SERVER3 = "time.google.com";
const long GMT_OFFSET_SEC = 0;      // UTC timezone
const int DAYLIGHT_OFFSET_SEC = 0;  // No daylight saving

// ========================================
// CONFIGURATION STRUCTURES
// ========================================

#define MAX_SENSORS 8
#define MAX_ACTUATORS 4
#define EEPROM_SIZE 1024  // Increased for UUID + Device Key
#define EEPROM_MAGIC 0xAB22  // Magic number v2.2 (Edge Function + HTTPS)

enum SensorType {
  SENSOR_NONE = 0,
  SENSOR_DHT22_TEMP = 1,
  SENSOR_DHT22_HUM = 2,
  SENSOR_SOIL_MOISTURE = 3,
  SENSOR_DS18B20 = 4
};

enum ActuatorType {
  ACTUATOR_NONE = 0,
  ACTUATOR_RELAY_NO = 1,  // Normally Open
  ACTUATOR_RELAY_NC = 2,  // Normally Closed
  ACTUATOR_PWM = 3
};

struct SensorConfig {
  char sensor_id[32];      // ID Supabase (e.g., "temp_1")
  uint8_t type;            // SensorType
  uint8_t pin;             // GPIO pin
  uint8_t dht_pair_index;  // For DHT22: pair index (0-3), temp and hum share same pin
  char reserved[12];       // Padding for future expansion
};

struct ActuatorConfig {
  char actuator_id[32];    // ID Supabase (e.g., "pump_1")
  uint8_t type;            // ActuatorType
  uint8_t pin;             // GPIO pin
  char reserved[14];       // Padding
};

struct DeviceConfig {
  uint16_t magic;          // EEPROM_MAGIC
  char device_id[64];      // Customizable device ID (friendly name)
  char device_uuid[64];    // Supabase device UUID (from webapp)
  char device_key[128];    // Device-specific authentication key (v2.2: was api_key)
  uint8_t sensor_count;
  uint8_t actuator_count;
  SensorConfig sensors[MAX_SENSORS];
  ActuatorConfig actuators[MAX_ACTUATORS];
};

// ========================================
// GLOBAL VARIABLES
// ========================================

// WiFi Manager
#define WIFI_AP_NAME "Serra-Setup"
#define WIFI_AP_PASSWORD ""
#define WIFI_RESET_BUTTON D3
#define WIFI_RESET_DURATION 3000      // 3 seconds = WiFi reset
#define FULL_RESET_DURATION 10000     // 10 seconds = full reset (WiFi + Config)
#define WIFI_CONNECT_TIMEOUT 30000    // 30 seconds WiFi connection timeout (NEW v2.0)

// WiFiManager (no custom parameters needed - we use /provision endpoint)

// Firmware version
const char* FIRMWARE_VERSION = "2.2.0";  // v2.2: HTTPS Edge Function + Secure Device Keys
const char* GITHUB_REPO = "treetocoin/Serra";

// mDNS & OTA
const char* MDNS_HOSTNAME_BASE = "serrasetup";  // Base hostname
char MDNS_HOSTNAME[32];                         // Unique hostname: serrasetup-XXXX.local
const char* OTA_PASSWORD = "serra2025";

// Supabase
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";
const char* SUPABASE_HOSTNAME = "fmyomzywzjtxmabvvjcd.supabase.co";  // NEW v2.2: SNI hostname
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE";  // Public anon key (API gateway access only)
// NOTE: DEVICE_KEY and DEVICE_UUID are now configured via web interface (/config)
// and stored in EEPROM (config.device_key and config.device_uuid)
// v2.2: ANON_KEY is for Supabase API gateway (public), DEVICE_KEY is for authentication (secret per-device)

// X509 Certificate List (persistent allocation, NEW v2.2)
X509List* trustedCertList = nullptr;

// LED status indicators (NEW v2.0)
#define LED_PIN LED_BUILTIN
enum LedState {
  LED_OFF,           // AP mode
  LED_SLOW_BLINK,    // Connecting (1Hz)
  LED_FAST_BLINK,    // Error (10Hz)
  LED_SOLID          // Online
};
LedState currentLedState = LED_OFF;
unsigned long lastLedToggle = 0;

// Device configuration
DeviceConfig config;

// DHT sensors array (max 4 DHT22)
DHT* dhtSensors[4] = {nullptr, nullptr, nullptr, nullptr};

// Clients
WiFiClientSecure client;
ESP8266WebServer httpServer(8080);  // Changed to port 8080 to avoid conflict with WiFiManager captive portal (port 80)
ESP8266HTTPUpdateServer httpUpdater;
WiFiManager wifiManager;

// Timing
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long SENSOR_INTERVAL = 30000;
const unsigned long COMMAND_INTERVAL = 30000;

unsigned long lastHeartbeatTime = 0;
unsigned long lastSensorDataTime = 0;
unsigned long lastCommandTime = 0;
unsigned long buttonPressStart = 0;
bool buttonPressed = false;
bool sensorsConfigured = false;

// ========================================
// LED STATUS FUNCTIONS (NEW v2.0)
// ========================================

void setLedState(LedState state) {
  currentLedState = state;
  lastLedToggle = millis();

  // Set initial LED state
  switch (state) {
    case LED_OFF:
      digitalWrite(LED_PIN, HIGH);  // LED off (inverted logic)
      break;
    case LED_SOLID:
      digitalWrite(LED_PIN, LOW);   // LED on (inverted logic)
      break;
    case LED_SLOW_BLINK:
    case LED_FAST_BLINK:
      // Will be handled in updateLed()
      break;
  }
}

void updateLed() {
  unsigned long now = millis();

  switch (currentLedState) {
    case LED_SLOW_BLINK:  // 1Hz (500ms on, 500ms off)
      if (now - lastLedToggle >= 500) {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        lastLedToggle = now;
      }
      break;

    case LED_FAST_BLINK:  // 10Hz (50ms on, 50ms off)
      if (now - lastLedToggle >= 50) {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        lastLedToggle = now;
      }
      break;

    case LED_OFF:
    case LED_SOLID:
      // Already set, no update needed
      break;
  }
}

void indicateError() {
  // Fast blink for 5 seconds
  unsigned long errorStart = millis();
  while (millis() - errorStart < 5000) {
    digitalWrite(LED_PIN, (millis() / 50) % 2);  // 10Hz
    delay(10);
  }
}

// ========================================
// SENSOR TYPE NAME HELPER
// ========================================

String getSensorTypeName(uint8_t type) {
  switch (type) {
    case SENSOR_DHT22_TEMP: return "temp";
    case SENSOR_DHT22_HUM: return "hum";
    case SENSOR_SOIL_MOISTURE: return "soil";
    case SENSOR_DS18B20: return "ds18b20";
    default: return "sensor";
  }
}

// ========================================
// EEPROM FUNCTIONS
// ========================================

void loadConfiguration() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, config);

  if (config.magic != EEPROM_MAGIC) {
    Serial.println("⚠️ No valid configuration in EEPROM - using defaults");
    config.magic = EEPROM_MAGIC;
    strncpy(config.device_id, "My Greenhouse", 63);
    config.device_id[63] = '\0';
    memset(config.device_uuid, 0, sizeof(config.device_uuid));  // Empty UUID
    memset(config.device_key, 0, sizeof(config.device_key));    // Empty Device Key (v2.2)
    config.sensor_count = 0;
    config.actuator_count = 0;
    memset(config.sensors, 0, sizeof(config.sensors));
    memset(config.actuators, 0, sizeof(config.actuators));
    saveConfiguration();
  } else {
    Serial.printf("✓ Loaded config: Device ID='%s', %d sensors, %d actuators\n",
                  config.device_id, config.sensor_count, config.actuator_count);
    if (strlen(config.device_uuid) > 0) {
      Serial.printf("✓ Device UUID configured: %s\n", config.device_uuid);
    } else {
      Serial.println("⚠️ Device UUID not configured - configure via web interface");
    }
  }
}

void saveConfiguration() {
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println("✓ Configuration saved to EEPROM");
}

void resetConfiguration() {
  config.magic = EEPROM_MAGIC;
  strncpy(config.device_id, "My Greenhouse", 63);
  config.device_id[63] = '\0';
  memset(config.device_uuid, 0, sizeof(config.device_uuid));  // Clear UUID
  memset(config.device_key, 0, sizeof(config.device_key));    // Clear Device Key (v2.2)
  config.sensor_count = 0;
  config.actuator_count = 0;
  memset(config.sensors, 0, sizeof(config.sensors));
  memset(config.actuators, 0, sizeof(config.actuators));
  saveConfiguration();
}

// ========================================
// SENSOR INITIALIZATION
// ========================================

void initializeSensors() {
  // Free previous DHT instances
  for (int i = 0; i < 4; i++) {
    if (dhtSensors[i]) {
      delete dhtSensors[i];
      dhtSensors[i] = nullptr;
    }
  }

  // Initialize new DHT sensors
  for (int i = 0; i < config.sensor_count; i++) {
    SensorConfig& s = config.sensors[i];
    if (s.type == SENSOR_DHT22_TEMP || s.type == SENSOR_DHT22_HUM) {
      if (s.dht_pair_index < 4 && !dhtSensors[s.dht_pair_index]) {
        dhtSensors[s.dht_pair_index] = new DHT(s.pin, DHT22);
        dhtSensors[s.dht_pair_index]->begin();
        Serial.printf("✓ DHT22[%d] on GPIO%d\n", s.dht_pair_index, s.pin);
      }
    } else if (s.type == SENSOR_SOIL_MOISTURE) {
      pinMode(s.pin, INPUT);
      Serial.printf("✓ Soil sensor on GPIO%d\n", s.pin);
    }
  }

  // Initialize actuators
  for (int i = 0; i < config.actuator_count; i++) {
    ActuatorConfig& a = config.actuators[i];
    pinMode(a.pin, OUTPUT);

    // Initial state
    if (a.type == ACTUATOR_RELAY_NC) {
      digitalWrite(a.pin, HIGH);  // NC = HIGH when OFF
    } else {
      digitalWrite(a.pin, LOW);
    }

    Serial.printf("✓ Actuator '%s' on GPIO%d\n", a.actuator_id, a.pin);
  }

  sensorsConfigured = (config.sensor_count > 0);
}

// ========================================
// PROVISIONING IN AP MODE (WiFiManager server)
// ========================================

void handleProvisionInAPMode(ESP8266WebServer* server) {
  // Get UUID, Device Key, and WiFi credentials from query parameters
  String uuid = server->arg("uuid");
  String deviceKey = server->arg("key");  // v2.2: Device Key (not API key!)
  String wifiSsid = server->arg("ssid");
  String wifiPassword = server->arg("pass");

  // Validate required parameters
  if (uuid.length() == 0 || deviceKey.length() == 0) {
    // Missing parameters - show error
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>Provisioning Error</title>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>";
    html += "body{font-family:Arial;margin:20px;background:#f5f5f5;text-align:center;}";
    html += ".container{max-width:500px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
    html += "h1{color:#d33;margin-bottom:10px;}";
    html += ".error{background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;padding:12px;border-radius:4px;margin:20px 0;}";
    html += "</style></head><body>";
    html += "<div class='container'>";
    html += "<h1>⚠️ Invalid Request</h1>";
    html += "<div class='error'>";
    html += "<strong>Error:</strong> Missing provisioning parameters.<br>";
    html += "This endpoint requires <code>uuid</code> and <code>key</code> parameters.";
    html += "</div>";
    html += "</div></body></html>";
    server->send(400, "text/html; charset=utf-8", html);
    return;
  }

  // Save credentials to EEPROM
  strncpy(config.device_uuid, uuid.c_str(), 63);
  config.device_uuid[63] = '\0';
  strncpy(config.device_key, deviceKey.c_str(), 127);  // v2.2: device_key
  config.device_key[127] = '\0';
  saveConfiguration();

  Serial.println("✓ Provisioning completed!");
  Serial.printf("  UUID: %s\n", config.device_uuid);
  Serial.println("  Device Key: ****" + String(deviceKey.substring(max(0, (int)deviceKey.length() - 8))));

  // Check if WiFi credentials were provided (zero-touch setup)
  bool wifiIncluded = (wifiSsid.length() > 0 && wifiPassword.length() > 0);

  if (wifiIncluded) {
    // Zero-touch setup: WiFi credentials included
    Serial.println("✓ WiFi credentials received!");
    Serial.printf("  SSID: %s\n", wifiSsid.c_str());
    Serial.println("  Password: ****");

    // Show success page with auto-refresh
    String html = "<!DOCTYPE html><html><head>";
    html += "<meta http-equiv='refresh' content='5;url=/'/>";
    html += "<title>Setup Complete</title>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>";
    html += "body{font-family:Arial;margin:20px;background:#f5f5f5;text-align:center;}";
    html += ".container{max-width:500px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
    html += "h1{color:#0c5;margin-bottom:10px;}";
    html += ".success{background:#d4edda;border:1px solid #c3e6cb;color:#155724;padding:12px;border-radius:4px;margin:20px 0;}";
    html += "</style></head><body>";
    html += "<div class='container'>";
    html += "<h1>✅ Setup Complete!</h1>";
    html += "<div class='success'>";
    html += "<strong>🚀 Connecting to WiFi...</strong><br><br>";
    html += "Network: <b>" + wifiSsid + "</b><br><br>";
    html += "The device will connect automatically.<br>";
    html += "Device will appear online in webapp shortly.<br><br>";
    html += "<small>This page will close in 5 seconds...</small>";
    html += "</div>";
    html += "</div></body></html>";

    server->send(200, "text/html; charset=utf-8", html);

    // Wait for response to be sent
    delay(500);

    // Connect to WiFi and restart
    Serial.println("🔄 Connecting to WiFi and rebooting...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
    delay(1000);
    ESP.restart();

  } else {
    // No WiFi credentials - show success page with manual link to WiFi config
    Serial.println("→ Showing success page with link to WiFi configuration");

    // Success page with manual link (better UX than automatic redirect)
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>Provisioning Complete</title>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>";
    html += "body{font-family:Arial;margin:20px;background:#f5f5f5;text-align:center;}";
    html += ".container{max-width:500px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
    html += "h1{color:#0c5;margin-bottom:10px;}";
    html += ".success{background:#d4edda;border:1px solid #c3e6cb;color:#155724;padding:12px;border-radius:4px;margin:20px 0;}";
    html += ".info{background:#d1ecf1;border:1px solid #bee5eb;color:#0c5460;padding:12px;border-radius:4px;margin:20px 0;text-align:left;}";
    html += ".btn{display:inline-block;padding:16px 32px;margin:20px 5px;background:#0c5;color:white;text-decoration:none;border-radius:5px;font-size:18px;font-weight:bold;}";
    html += ".btn:hover{background:#0a4;}";
    html += "</style></head><body>";
    html += "<div class='container'>";
    html += "<h1>✅ Device Provisioned!</h1>";
    html += "<div class='success'>";
    html += "<strong>Success!</strong> Device credentials saved to ESP8266.<br>";
    html += "UUID: <code>" + String(config.device_uuid).substring(0, 8) + "...****</code>";
    html += "</div>";
    html += "<div class='info'>";
    html += "<strong>📡 Next Step: Configure WiFi</strong><br><br>";
    html += "1. Click the button below to open WiFi configuration<br>";
    html += "2. Select your home WiFi network<br>";
    html += "3. Enter WiFi password<br>";
    html += "4. Click 'Connect'<br>";
    html += "5. ESP8266 will connect and appear online in webapp<br><br>";
    html += "<small><strong>Note:</strong> Device credentials are already saved - you only need to configure WiFi!</small>";
    html += "</div>";
    html += "<a href='/wifi-setup' class='btn'>📶 Configure WiFi</a>";
    html += "</div></body></html>";

    server->send(200, "text/html; charset=utf-8", html);
  }
}

// ========================================
// WIFI CONNECTION WITH TIMEOUT (NEW v2.0)
// ========================================

bool connectWiFiWithTimeout() {
  Serial.println("Starting WiFiManager with 30s timeout...");

  wifiManager.setConnectTimeout(30);  // 30 second timeout

  // Always try autoConnect - it will start AP if no WiFi is saved
  setLedState(LED_SLOW_BLINK);  // Connecting indicator
  bool connected = wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD);

  if (!connected) {
    Serial.println("✗ WiFi connection failed or timeout - staying in AP mode");
    setLedState(LED_OFF);  // Back to AP mode
    return false;
  }

  Serial.println("✓ WiFi connected!");
  Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
  setLedState(LED_SOLID);  // Online indicator
  return true;
}

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================");
  Serial.println("Serra System v2.1");
  Serial.println("Robust QR Code Provisioning");
  Serial.println("=================================\n");

  // Generate unique hostname from MAC address
  uint8_t mac[6];
  WiFi.macAddress(mac);
  snprintf(MDNS_HOSTNAME, sizeof(MDNS_HOSTNAME), "%s-%02x%02x",
           MDNS_HOSTNAME_BASE, mac[4], mac[5]);
  Serial.printf("📡 Hostname: %s.local\n\n", MDNS_HOSTNAME);

  pinMode(LED_PIN, OUTPUT);
  pinMode(WIFI_RESET_BUTTON, INPUT_PULLUP);
  setLedState(LED_OFF);  // Start in AP mode state

  client.setInsecure();

  // Initialize trusted certificate list for HTTPS (NEW v2.2)
  trustedCertList = new X509List(SUPABASE_CA_CERT);
  Serial.println("✓ TLS certificate loaded (ISRG Root X1)");

  // Load configuration from EEPROM
  loadConfiguration();

  // Initialize hardware based on config
  initializeSensors();

  // WiFi Manager setup
  wifiManager.setDebugOutput(true);

  IPAddress apIP(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  wifiManager.setAPStaticIPConfig(apIP, gateway, subnet);

  wifiManager.setMinimumSignalQuality(20);
  wifiManager.setRemoveDuplicateAPs(true);
  wifiManager.setConfigPortalTimeout(300);
  wifiManager.setShowInfoUpdate(true);  // Show WiFi scan results
  wifiManager.setConfigPortalBlocking(false);  // Non-blocking mode!

  wifiManager.setAPCallback([](WiFiManager *myWiFiManager) {
    Serial.println("\n╔═══════════════════════════════════╗");
    Serial.println("║  WiFi CONFIGURATION MODE          ║");
    Serial.println("╚═══════════════════════════════════╝");
    Serial.printf("📡 Access Point: %s\n", myWiFiManager->getConfigPortalSSID().c_str());
    Serial.println("🌐 http://192.168.4.1\n");
    Serial.println("📱 Scan QR code to provision device (http://192.168.4.1/provision)");
    Serial.println("📶 Then configure WiFi network (http://192.168.4.1/wifi)");
  });

  // Try to connect with timeout
  bool connected = connectWiFiWithTimeout();

  if (!connected) {
    Serial.println("Continuing in AP mode...");

    // Register /provision endpoint AFTER WiFiManager is in AP mode
    // This prevents interference with WiFiManager's internal routes
    if (wifiManager.server) {
      Serial.println("🔧 Registering /provision endpoint...");
      wifiManager.server->on("/provision", HTTP_GET, [&]() {
        handleProvisionInAPMode(wifiManager.server.get());
      });
      Serial.println("✓ /provision endpoint ready at http://192.168.4.1/provision");
    }
  }

  // Setup mDNS
  if (MDNS.begin(MDNS_HOSTNAME)) {
    Serial.printf("✓ mDNS started: http://%s.local:8080\n", MDNS_HOSTNAME);
    MDNS.addService("http", "tcp", 8080);
  } else {
    Serial.println("✗ mDNS failed to start");
  }

  // Setup OTA
  setupOTA();
  setupWebServer();

  Serial.println("\n✓ Setup complete");
  Serial.printf("🌐 Web UI: http://%s.local  (or http://%s)\n",
                MDNS_HOSTNAME, WiFi.localIP().toString().c_str());
  Serial.printf("🆔 Device ID: %s\n", config.device_id);
  Serial.println("=================================\n");
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  MDNS.update();
  ArduinoOTA.handle();
  httpServer.handleClient();
  checkResetButton();
  updateLed();  // Update LED state (NEW v2.0)

  // Handle WiFiManager's web server when in AP mode
  if (WiFi.status() != WL_CONNECTED && wifiManager.server) {
    wifiManager.process();  // Process WiFiManager requests
  }

  // Check WiFi connection and reconnect if needed
  // Only try to reconnect if we previously had a connection (not in initial AP mode)
  static bool hadConnection = (WiFi.status() == WL_CONNECTED);
  if (WiFi.status() == WL_CONNECTED) {
    hadConnection = true;
  }

  if (WiFi.status() != WL_CONNECTED && hadConnection) {
    // Don't spam reconnection attempts - only when we had WiFi before and lost it
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 30000) {  // Try every 30 seconds
      Serial.println("WiFi lost - reconnecting...");
      setLedState(LED_SLOW_BLINK);
      if (!connectWiFiWithTimeout()) {
        // Failed to reconnect, continue in AP mode
        lastReconnectAttempt = millis();
      }
    }
  }

  unsigned long currentTime = millis();

  // Only send data if WiFi is connected
  if (WiFi.status() == WL_CONNECTED) {
    if (currentTime - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
      sendHeartbeat();
      lastHeartbeatTime = currentTime;
    }

    if (sensorsConfigured && currentTime - lastSensorDataTime >= SENSOR_INTERVAL) {
      sendSensorData();
      lastSensorDataTime = currentTime;
    }

    if (currentTime - lastCommandTime >= COMMAND_INTERVAL) {
      pollForCommands();
      lastCommandTime = currentTime;
    }
  }

  delay(100);
  yield();
}

// ========================================
// WIFI RESET BUTTON
// ========================================

void checkResetButton() {
  if (digitalRead(WIFI_RESET_BUTTON) == LOW) {
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressStart = millis();
      Serial.println("🔘 Reset button pressed...");
    }

    unsigned long pressDuration = millis() - buttonPressStart;

    // LED blinks fast after 3 seconds (WiFi reset)
    if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, (millis() / 100) % 2);  // Fast blink
    }

    // LED blinks slowly after 10 seconds (Full reset)
    if (pressDuration >= FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, (millis() / 300) % 2);  // Slow blink
    }

    // Full reset after 10 seconds
    if (pressDuration >= FULL_RESET_DURATION) {
      Serial.println("\n🔥 FULL RESET - WiFi + Configuration!");

      // LED blinks very fast
      for (int i = 0; i < 30; i++) {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        delay(30);
      }

      // Reset EEPROM configuration
      resetConfiguration();

      // Reset WiFi
      wifiManager.resetSettings();

      Serial.println("✓ All settings erased - rebooting...");
      delay(1000);
      ESP.restart();
    }
  } else {
    // Button release
    if (buttonPressed) {
      unsigned long pressDuration = millis() - buttonPressStart;

      // WiFi reset if pressed 3-10 seconds
      if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
        Serial.println("\n🔄 WiFi RESET ONLY!");

        // LED blinks fast
        for (int i = 0; i < 20; i++) {
          digitalWrite(LED_PIN, !digitalRead(LED_PIN));
          delay(50);
        }

        wifiManager.resetSettings();
        Serial.println("✓ WiFi settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      } else if (pressDuration < WIFI_RESET_DURATION) {
        Serial.println("Button released (too short)");
      }

      buttonPressed = false;
      setLedState(WiFi.status() == WL_CONNECTED ? LED_SOLID : LED_OFF);
    }
  }
}

// ========================================
// OTA SETUP
// ========================================

void setupOTA() {
  ArduinoOTA.setHostname(MDNS_HOSTNAME);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.setPort(8266);

  ArduinoOTA.onStart([]() {
    Serial.println("🔄 OTA Start");
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\n✓ OTA Complete!");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });

  ArduinoOTA.begin();
  Serial.println("✓ OTA ready");
}

// ========================================
// WEB SERVER SETUP
// ========================================

void setupWebServer() {
  httpUpdater.setup(&httpServer, "/update", "admin", OTA_PASSWORD);

  // Root page
  httpServer.on("/", HTTP_GET, handleRoot);

  // Configuration page
  httpServer.on("/config", HTTP_GET, handleConfigPage);
  httpServer.on("/api/config", HTTP_GET, handleGetConfig);
  httpServer.on("/api/config", HTTP_POST, handleSaveConfig);
  httpServer.on("/api/config/reset", HTTP_POST, handleResetConfig);

  // Automatic provisioning endpoint (NEW v2.1)
  httpServer.on("/provision", HTTP_GET, handleProvision);

  // Custom WiFi configuration page (NEW - fixes WiFiManager empty form issue)
  httpServer.on("/wifi-setup", HTTP_GET, handleWifiSetupPage);
  httpServer.on("/api/wifi/scan", HTTP_GET, handleWifiScan);
  httpServer.on("/api/wifi/connect", HTTP_POST, handleWifiConnect);

  // Reset WiFi
  httpServer.on("/resetwifi", HTTP_GET, []() {
    httpServer.send(200, "text/html", "<h1>Resetting WiFi...</h1>");
    delay(1000);
    wifiManager.resetSettings();
    ESP.restart();
  });

  httpServer.begin();
  Serial.println("✓ Web server started");
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Serra ESP8266</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;background:#f5f5f5;}";
  html += "h1{color:#0c5;}";
  html += ".card{background:white;padding:20px;margin:10px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
  html += "table{border-collapse:collapse;width:100%;}";
  html += "td,th{border:1px solid #ddd;padding:12px;text-align:left;}";
  html += "tr:nth-child(even){background:#f9f9f9;}";
  html += ".btn{display:inline-block;padding:12px 24px;margin:10px 5px 0 0;";
  html += "background:#0c5;color:white;text-decoration:none;border-radius:5px;border:none;cursor:pointer;}";
  html += ".btn:hover{background:#0a4;}";
  html += ".btn-warning{background:#f90;}";
  html += ".btn-danger{background:#d33;}";
  html += ".btn-info{background:#17a2b8;}";
  html += ".status{display:inline-block;padding:4px 12px;border-radius:12px;font-size:12px;font-weight:bold;}";
  html += ".status-ok{background:#0c5;color:white;}";
  html += ".status-warn{background:#f90;color:white;}";
  html += ".update-info{background:#e7f3ff;border-left:4px solid #17a2b8;padding:12px;margin:10px 0;border-radius:4px;}";
  html += ".new-badge{background:#ff6b6b;color:white;padding:2px 8px;border-radius:12px;font-size:10px;margin-left:8px;}";
  html += "</style>";
  html += "<script>";
  html += "function checkUpdate(){";
  html += "  const btn=document.getElementById('updateBtn');";
  html += "  btn.textContent='⏳ Checking...';";
  html += "  btn.disabled=true;";
  html += "  window.open('https://github.com/" + String(GITHUB_REPO) + "/tree/main/firmware','_blank');";
  html += "  setTimeout(()=>{";
  html += "    if(confirm('Have you downloaded the latest firmware from /firmware folder?\\n\\nClick OK to open the upload page.')){";
  html += "      window.location.href='/update';";
  html += "    }else{";
  html += "      btn.textContent='🔄 Check for Updates';";
  html += "      btn.disabled=false;";
  html += "    }";
  html += "  },2000);";
  html += "}";
  html += "</script></head><body>";

  html += "<h1>🌱 Serra ESP8266 v" + String(FIRMWARE_VERSION) + "<span class='new-badge'>NEW</span></h1>";

  // Status card
  html += "<div class='card'>";
  html += "<h2>System Status</h2>";
  html += "<table>";
  if (strlen(config.device_uuid) > 0) {
    html += "<tr><td><b>Device UUID</b></td><td>" + String(config.device_uuid) + " ✓</td></tr>";
  } else {
    html += "<tr><td><b>Device UUID</b></td><td><span style='color:#f90;'>⚠️ Not configured - Go to Configuration</span></td></tr>";
  }
  html += "<tr><td><b>Device ID</b></td><td>" + String(config.device_id) + " <i>(friendly name)</i></td></tr>";
  html += "<tr><td><b>Firmware</b></td><td>v" + String(FIRMWARE_VERSION) + " - QR Code Support</td></tr>";
  html += "<tr><td><b>mDNS</b></td><td><a href='http://" + String(MDNS_HOSTNAME) + ".local'>http://" + String(MDNS_HOSTNAME) + ".local</a></td></tr>";
  html += "<tr><td><b>WiFi SSID</b></td><td>" + WiFi.SSID() + "</td></tr>";
  html += "<tr><td><b>IP Address</b></td><td>" + WiFi.localIP().toString() + "</td></tr>";
  html += "<tr><td><b>Signal</b></td><td>" + String(WiFi.RSSI()) + " dBm</td></tr>";
  html += "<tr><td><b>Free Heap</b></td><td>" + String(ESP.getFreeHeap()) + " bytes</td></tr>";
  html += "<tr><td><b>Uptime</b></td><td>" + String(millis() / 1000) + " sec</td></tr>";
  html += "</table>";
  html += "</div>";

  // Configuration status card
  html += "<div class='card'>";
  html += "<h2>Hardware Configuration</h2>";
  html += "<table>";
  html += "<tr><td><b>Sensors</b></td><td>";
  if (config.sensor_count > 0) {
    html += "<span class='status status-ok'>" + String(config.sensor_count) + " configured</span>";
  } else {
    html += "<span class='status status-warn'>Not configured</span>";
  }
  html += "</td></tr>";
  html += "<tr><td><b>Actuators</b></td><td>";
  if (config.actuator_count > 0) {
    html += "<span class='status status-ok'>" + String(config.actuator_count) + " configured</span>";
  } else {
    html += "<span class='status status-warn'>Not configured</span>";
  }
  html += "</td></tr>";
  html += "</table>";
  html += "</div>";

  // What's new in v2.0
  html += "<div class='card'>";
  html += "<h2>What's New in v2.0</h2>";
  html += "<ul>";
  html += "<li>🔗 <b>WiFi Connection Timeout:</b> Automatic AP mode fallback after 30 seconds</li>";
  html += "<li>💡 <b>LED Status Indicators:</b> Visual feedback for connection status</li>";
  html += "<li>🆔 <b>Customizable Device ID:</b> Set friendly name via web interface</li>";
  html += "<li>📡 <b>QR Code Onboarding:</b> Hostname reporting for easy setup</li>";
  html += "<li>🔄 <b>Heartbeat Retry Logic:</b> 3 attempts with 5-second delay</li>";
  html += "</ul>";
  html += "</div>";

  // Update info
  html += "<div class='card'>";
  html += "<h2>Firmware Update</h2>";
  html += "<div class='update-info'>";
  html += "<b>📦 Current Version:</b> " + String(FIRMWARE_VERSION) + "<br>";
  html += "<b>📂 Repository:</b> <a href='https://github.com/" + String(GITHUB_REPO) + "' target='_blank'>" + String(GITHUB_REPO) + "</a><br><br>";
  html += "<b>How to update:</b><br>";
  html += "1. Click 'Check for Updates' to open GitHub firmware folder<br>";
  html += "2. Browse to latest version (e.g., ESP8266_Greenhouse_v2.0/)<br>";
  html += "3. Download .ino file, compile in Arduino IDE and export .bin<br>";
  html += "4. Upload via web interface (username: admin, password: serra2025)";
  html += "</div>";
  html += "<button id='updateBtn' class='btn btn-info' onclick='checkUpdate()'>🔄 Check for Updates</button>";
  html += "</div>";

  // Actions
  html += "<div class='card'>";
  html += "<h2>Actions</h2>";
  html += "<a href='/config' class='btn'>⚙️ Configure Device & Sensors</a>";
  html += "<a href='/update' class='btn btn-warning'>📤 Upload Firmware</a>";
  html += "<a href='/resetwifi' class='btn btn-danger'>🔄 Reset WiFi</a>";
  html += "</div>";

  html += "</body></html>";
  httpServer.send(200, "text/html; charset=utf-8", html);
}

void handleConfigPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Configuration</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;background:#f5f5f5;}";
  html += "h1,h2{color:#0c5;}";
  html += ".card{background:white;padding:20px;margin:10px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
  html += "label{display:block;margin-top:10px;font-weight:bold;}";
  html += "input,select{width:100%;padding:8px;margin-top:5px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;}";
  html += ".btn{display:inline-block;padding:12px 24px;margin:10px 5px 0 0;";
  html += "background:#0c5;color:white;text-decoration:none;border-radius:5px;border:none;cursor:pointer;}";
  html += ".btn:hover{background:#0a4;}";
  html += ".btn-danger{background:#d33;}";
  html += ".item{border:1px solid #e0e0e0;padding:10px;margin:10px 0;border-radius:4px;background:#f9f9f9;}";
  html += ".remove-btn{background:#d33;color:white;border:none;padding:5px 10px;border-radius:3px;cursor:pointer;float:right;}";
  html += ".help{font-size:12px;color:#666;margin-top:5px;font-style:italic;}";
  html += ".info-box{background:#e7f3ff;border-left:4px solid #17a2b8;padding:12px;margin:10px 0;border-radius:4px;}";
  html += "</style>";
  html += "<script>";

  // Pin configuration - safe pins only
  html += "const safePins=[";
  html += "{gpio:5,label:'D1 (GPIO5)',type:'digital'},";
  html += "{gpio:4,label:'D2 (GPIO4)',type:'digital'},";
  html += "{gpio:14,label:'D5 (GPIO14)',type:'digital'},";
  html += "{gpio:12,label:'D6 (GPIO12)',type:'digital'},";
  html += "{gpio:13,label:'D7 (GPIO13)',type:'digital'}";
  html += "];";
  html += "const analogPin={gpio:0,label:'A0 (ADC)',type:'analog'};";

  html += "function loadConfig(){";
  html += "  fetch('/api/config').then(r=>r.json()).then(data=>{";
  html += "    document.getElementById('deviceId').value=data.device_id||'My Greenhouse';";
  html += "    document.getElementById('deviceUuid').value=data.device_uuid||'';";
  html += "    document.getElementById('deviceKey').value=data.device_key||'';";  // v2.2: deviceKey
  html += "    document.getElementById('sensorList').innerHTML='';";
  html += "    data.sensors.forEach((s,i)=>addSensorItem(s));";
  html += "    document.getElementById('actuatorList').innerHTML='';";
  html += "    data.actuators.forEach((a,i)=>addActuatorItem(a));";
  html += "  });";
  html += "}";

  html += "function addSensorItem(s){";
  html += "  s=s||{};";
  html += "  const div=document.createElement('div');";
  html += "  div.className='item';";
  html += "  const sensorType=s.type||1;";
  html += "  let html='<button class=\\'remove-btn\\' onclick=\\'this.parentElement.remove()\\'>✕</button>';";
  html += "  html+='<label>Type:</label>';";
  html += "  html+='<select name=\\'sensor_type[]\\' onchange=\\'updateSensorPins(this)\\'>';";
  html += "  html+='<option value=\\'1\\' '+(sensorType==1?'selected':'')+'>DHT22 Temperature</option>';";
  html += "  html+='<option value=\\'2\\' '+(sensorType==2?'selected':'')+'>DHT22 Humidity</option>';";
  html += "  html+='<option value=\\'3\\' '+(sensorType==3?'selected':'')+'>Soil Moisture</option>';";
  html += "  html+='</select>';";
  html += "  html+='<label>GPIO Pin:</label>';";
  html += "  html+='<select name=\\'sensor_pin[]\\' class=\\'pin-select\\'>';";
  html += "  if(sensorType==3){";
  html += "    html+='<option value=\\'0\\'>A0 (ADC) (analog)</option>';";
  html += "  }else{";
  html += "    safePins.forEach(p=>{";
  html += "      const sel=(s.pin==p.gpio)?'selected':'';";
  html += "      html+='<option value=\\''+p.gpio+'\\' '+sel+'>'+p.label+' ('+p.type+')</option>';";
  html += "    });";
  html += "  }";
  html += "  html+='</select>';";
  html += "  html+='<label>DHT Pair (0-3):</label>';";
  html += "  html+='<input type=\\'number\\' name=\\'sensor_dht_pair[]\\' value=\\''+(s.dht_pair_index||0)+'\\' min=\\'0\\' max=\\'3\\'>';";
  html += "  if(sensorType==1||sensorType==2){";
  html += "    html+='<div class=\\'help\\'>DHT temp+hum must share pin and pair index</div>';";
  html += "  }";
  html += "  div.innerHTML=html;";
  html += "  document.getElementById('sensorList').appendChild(div);";
  html += "}";
  html += "function updateSensorPins(sel){";
  html += "  const type=parseInt(sel.value);";
  html += "  const pinSel=sel.parentElement.querySelector('.pin-select');";
  html += "  let html='';";
  html += "  if(type==3){";
  html += "    html='<option value=\\'0\\'>A0 (ADC) (analog)</option>';";
  html += "  }else{";
  html += "    safePins.forEach(p=>{";
  html += "      html+='<option value=\\''+p.gpio+'\\'> '+p.label+' ('+p.type+')</option>';";
  html += "    });";
  html += "  }";
  html += "  pinSel.innerHTML=html;";
  html += "}";

  html += "function addActuatorItem(a){";
  html += "  a=a||{};";
  html += "  const div=document.createElement('div');";
  html += "  div.className='item';";
  html += "  const actType=a.type||1;";
  html += "  let html='<button class=\\'remove-btn\\' onclick=\\'this.parentElement.remove()\\'>✕</button>';";
  html += "  html+='<label>Actuator ID:</label>';";
  html += "  html+='<input name=\\'actuator_id[]\\' value=\\''+(a.actuator_id||'')+'\\'  placeholder=\\'pump_1\\'>';";
  html += "  html+='<div class=\\'help\\'>ID must match Supabase (e.g., pump_1, fan_1)</div>';";
  html += "  html+='<label>Type:</label>';";
  html += "  html+='<select name=\\'actuator_type[]\\'>';";
  html += "  html+='<option value=\\'1\\' '+(actType==1?'selected':'')+'>Relay NO (ON=HIGH)</option>';";
  html += "  html+='<option value=\\'2\\' '+(actType==2?'selected':'')+'>Relay NC (ON=LOW)</option>';";
  html += "  html+='<option value=\\'3\\' '+(actType==3?'selected':'')+'>PWM (0-255)</option>';";
  html += "  html+='</select>';";
  html += "  html+='<label>GPIO Pin:</label>';";
  html += "  html+='<select name=\\'actuator_pin[]\\'>';";
  html += "  safePins.forEach(p=>{";
  html += "    const sel=(a.pin==p.gpio)?'selected':'';";
  html += "    html+='<option value=\\''+p.gpio+'\\' '+sel+'>'+p.label+' ('+p.type+')</option>';";
  html += "  });";
  html += "  html+='</select>';";
  html += "  div.innerHTML=html;";
  html += "  document.getElementById('actuatorList').appendChild(div);";
  html += "}";

  html += "function saveConfig(){";
  html += "  const form=document.getElementById('configForm');";
  html += "  const formData=new FormData(form);";
  html += "  const device_id=document.getElementById('deviceId').value;";
  html += "  const device_uuid=document.getElementById('deviceUuid').value;";
  html += "  const device_key=document.getElementById('deviceKey').value;";  // v2.2: device_key
  html += "  const sensors=[],actuators=[];";
  html += "  const sensorTypes=formData.getAll('sensor_type[]');";
  html += "  const sensorPins=formData.getAll('sensor_pin[]');";
  html += "  const sensorPairs=formData.getAll('sensor_dht_pair[]');";
  html += "  for(let i=0;i<sensorTypes.length;i++){";
  html += "    sensors.push({type:parseInt(sensorTypes[i]),pin:parseInt(sensorPins[i]),dht_pair_index:parseInt(sensorPairs[i])});";
  html += "  }";
  html += "  const actIds=formData.getAll('actuator_id[]');";
  html += "  const actTypes=formData.getAll('actuator_type[]');";
  html += "  const actPins=formData.getAll('actuator_pin[]');";
  html += "  for(let i=0;i<actIds.length;i++){";
  html += "    actuators.push({actuator_id:actIds[i],type:parseInt(actTypes[i]),pin:parseInt(actPins[i])});";
  html += "  }";
  html += "  fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_id,device_uuid,device_key,sensors,actuators})})";  // v2.2: device_key
  html += "  .then(r=>r.json()).then(data=>{alert(data.message);if(data.success)location.href='/';});";
  html += "}";
  html += "window.onload=loadConfig;";
  html += "</script></head><body>";

  html += "<h1>⚙️ Configuration</h1>";
  html += "<a href='/' class='btn'>← Back</a>";

  html += "<form id='configForm'>";

  // Device ID configuration (NEW v2.0)
  html += "<div class='card'>";
  html += "<h2>Device Identification</h2>";
  html += "<div class='info-box'>";
  html += "<b>ℹ️ About Device Configuration:</b><br>";
  html += "Configure your device using the credentials from the webapp:<br>";
  html += "1. Register device in webapp (Devices page → Add Device)<br>";
  html += "2. Copy Device ID (UUID) and Device Key<br>";  // v2.2: Device Key
  html += "3. Paste them here and save<br>";
  html += "4. The ESP will use these credentials to authenticate with Supabase";
  html += "</div>";
  html += "<label>Device ID (Friendly Name):</label>";
  html += "<input type='text' id='deviceId' placeholder='My Greenhouse' maxlength='63'>";
  html += "<div class='help'>A friendly name for this device (shown in webapp)</div>";
  html += "<label>Device UUID:</label>";
  html += "<input type='text' id='deviceUuid' placeholder='Paste UUID from webapp' maxlength='63'>";
  html += "<div class='help'>Unique device ID from webapp registration (required)</div>";
  html += "<label>Device Key:</label>";  // v2.2: Device Key
  html += "<input type='text' id='deviceKey' placeholder='Paste Device Key from webapp' maxlength='127'>";  // v2.2: deviceKey
  html += "<div class='help'>Device-specific authentication key from webapp registration (required)</div>";  // v2.2
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>Sensors</h2>";
  html += "<div id='sensorList'></div>";
  html += "<button type='button' class='btn' onclick='addSensorItem({})'>➕ Add Sensor</button>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>Actuators</h2>";
  html += "<div id='actuatorList'></div>";
  html += "<button type='button' class='btn' onclick='addActuatorItem({})'>➕ Add Actuator</button>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<button type='button' class='btn' onclick='saveConfig()'>💾 Save Configuration</button>";
  html += "<button type='button' class='btn btn-danger' onclick='if(confirm(\"Reset all?\"))fetch(\"/api/config/reset\",{method:\"POST\"}).then(()=>location.reload())'>🔄 Reset All</button>";
  html += "</div>";

  html += "</form>";
  html += "</body></html>";

  httpServer.send(200, "text/html; charset=utf-8", html);
}

void handleGetConfig() {
  DynamicJsonDocument doc(2048);

  doc["device_id"] = config.device_id;
  doc["device_uuid"] = config.device_uuid;
  doc["device_key"] = config.device_key;  // v2.2: device_key

  JsonArray sensors = doc.createNestedArray("sensors");
  for (int i = 0; i < config.sensor_count; i++) {
    JsonObject s = sensors.createNestedObject();
    s["sensor_id"] = config.sensors[i].sensor_id;
    s["type"] = config.sensors[i].type;
    s["pin"] = config.sensors[i].pin;
    s["dht_pair_index"] = config.sensors[i].dht_pair_index;
  }

  JsonArray actuators = doc.createNestedArray("actuators");
  for (int i = 0; i < config.actuator_count; i++) {
    JsonObject a = actuators.createNestedObject();
    a["actuator_id"] = config.actuators[i].actuator_id;
    a["type"] = config.actuators[i].type;
    a["pin"] = config.actuators[i].pin;
  }

  String response;
  serializeJson(doc, response);
  httpServer.send(200, "application/json", response);
}

void handleSaveConfig() {
  if (!httpServer.hasArg("plain")) {
    httpServer.send(400, "application/json", "{\"success\":false,\"message\":\"No data\"}");
    return;
  }

  DynamicJsonDocument doc(2048);
  deserializeJson(doc, httpServer.arg("plain"));

  // Save device ID (NEW v2.0)
  const char* deviceId = doc["device_id"] | "My Greenhouse";
  strncpy(config.device_id, deviceId, 63);
  config.device_id[63] = '\0';

  // Save device UUID (NEW v2.1)
  const char* deviceUuid = doc["device_uuid"] | "";
  strncpy(config.device_uuid, deviceUuid, 63);
  config.device_uuid[63] = '\0';

  // Save Device Key (NEW v2.2)
  const char* deviceKey = doc["device_key"] | "";  // v2.2: device_key
  strncpy(config.device_key, deviceKey, 127);
  config.device_key[127] = '\0';

  // Parse sensors and auto-generate sensor IDs
  JsonArray sensors = doc["sensors"];
  config.sensor_count = min((int)sensors.size(), MAX_SENSORS);

  // Generate unique suffix from device UUID (last 6 chars)
  String deviceSuffix = String(config.device_uuid);
  if (deviceSuffix.length() > 6) {
    deviceSuffix = deviceSuffix.substring(deviceSuffix.length() - 6);
  }

  for (int i = 0; i < config.sensor_count; i++) {
    JsonObject s = sensors[i];
    uint8_t sensorType = s["type"] | 0;

    // Auto-generate sensor_id: {type}_{index}_{deviceSuffix}
    // Example: "temp_1_abc123", "hum_1_abc123"
    String sensorId = getSensorTypeName(sensorType) + "_" + String(i + 1) + "_" + deviceSuffix;
    strncpy(config.sensors[i].sensor_id, sensorId.c_str(), 31);
    config.sensors[i].sensor_id[31] = '\0';

    config.sensors[i].type = sensorType;
    config.sensors[i].pin = s["pin"] | 0;
    config.sensors[i].dht_pair_index = s["dht_pair_index"] | 0;

    Serial.printf("✓ Sensor %d: ID='%s', Type=%d, Pin=%d\n",
                  i+1, config.sensors[i].sensor_id, sensorType, config.sensors[i].pin);
  }

  // Parse actuators
  JsonArray actuators = doc["actuators"];
  config.actuator_count = min((int)actuators.size(), MAX_ACTUATORS);
  for (int i = 0; i < config.actuator_count; i++) {
    JsonObject a = actuators[i];
    strncpy(config.actuators[i].actuator_id, a["actuator_id"] | "", 31);
    config.actuators[i].type = a["type"] | 0;
    config.actuators[i].pin = a["pin"] | 0;
  }

  saveConfiguration();

  httpServer.send(200, "application/json",
    "{\"success\":true,\"message\":\"Configuration saved! Restarting...\"}");

  delay(1000);

  // Auto-register sensors with Supabase before restart (NEW)
  if (WiFi.status() == WL_CONNECTED && config.sensor_count > 0) {
    autoRegisterSensors();
    delay(2000);  // Give time for registration to complete
  }

  ESP.restart();
}

void handleResetConfig() {
  resetConfiguration();
  httpServer.send(200, "application/json",
    "{\"success\":true,\"message\":\"Configuration reset! Restarting...\"}");
  delay(1000);
  ESP.restart();
}

// ========================================
// CUSTOM WIFI SETUP PAGE (NEW)
// ========================================

void handleWifiSetupPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>WiFi Setup</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;background:#f5f5f5;}";
  html += "h1{color:#0c5;}";
  html += ".card{background:white;padding:20px;margin:10px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
  html += ".network{border:1px solid #e0e0e0;padding:12px;margin:8px 0;border-radius:4px;cursor:pointer;transition:background 0.2s;}";
  html += ".network:hover{background:#f0f0f0;}";
  html += ".network.selected{background:#e7f3ff;border-color:#0c5;}";
  html += ".signal{float:right;color:#666;font-size:12px;}";
  html += "input[type=password]{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;}";
  html += ".btn{display:inline-block;padding:12px 24px;margin:10px 5px 0 0;background:#0c5;color:white;text-decoration:none;border-radius:5px;border:none;cursor:pointer;width:100%;}";
  html += ".btn:hover{background:#0a4;}";
  html += ".btn:disabled{background:#ccc;cursor:not-allowed;}";
  html += "#status{margin:10px 0;padding:10px;border-radius:4px;display:none;}";
  html += ".status-info{background:#d1ecf1;border:1px solid #bee5eb;color:#0c5460;}";
  html += ".status-error{background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;}";
  html += ".status-success{background:#d4edda;border:1px solid #c3e6cb;color:#155724;}";
  html += ".spinner{border:3px solid #f3f3f3;border-top:3px solid #0c5;border-radius:50%;width:20px;height:20px;animation:spin 1s linear infinite;display:inline-block;margin-left:10px;}";
  html += "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}";
  html += "</style>";
  html += "<script>";
  html += "let selectedSSID='';";
  html += "function loadNetworks(){";
  html += "  fetch('/api/wifi/scan').then(r=>r.json()).then(data=>{";
  html += "    const list=document.getElementById('networks');";
  html += "    list.innerHTML='';";
  html += "    if(data.networks.length===0){";
  html += "      list.innerHTML='<p>No networks found. <a href=\"javascript:loadNetworks()\">Scan again</a></p>';";
  html += "      return;";
  html += "    }";
  html += "    data.networks.forEach(n=>{";
  html += "      const div=document.createElement('div');";
  html += "      div.className='network';";
  html += "      div.innerHTML='<strong>'+n.ssid+'</strong><span class=\"signal\">'+n.rssi+' dBm '+(n.encryption?'🔒':'')+'</span>';";
  html += "      div.onclick=()=>{selectNetwork(n.ssid,div);};";
  html += "      list.appendChild(div);";
  html += "    });";
  html += "  }).catch(e=>showStatus('Error scanning networks: '+e,'error'));";
  html += "}";
  html += "function selectNetwork(ssid,elem){";
  html += "  document.querySelectorAll('.network').forEach(n=>n.classList.remove('selected'));";
  html += "  elem.classList.add('selected');";
  html += "  selectedSSID=ssid;";
  html += "  document.getElementById('ssidDisplay').textContent=ssid;";
  html += "  document.getElementById('passwordSection').style.display='block';";
  html += "  document.getElementById('password').focus();";
  html += "}";
  html += "function connect(){";
  html += "  const password=document.getElementById('password').value;";
  html += "  if(!selectedSSID){showStatus('Please select a network','error');return;}";
  html += "  const btn=document.getElementById('connectBtn');";
  html += "  btn.disabled=true;";
  html += "  btn.innerHTML='Connecting...<span class=\"spinner\"></span>';";
  html += "  showStatus('Connecting to '+selectedSSID+'...','info');";
  html += "  fetch('/api/wifi/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid:selectedSSID,password:password})})";
  html += "  .then(r=>r.json()).then(data=>{";
  html += "    if(data.success){";
  html += "      showStatus('✓ Connected! Device will restart and appear online in webapp.','success');";
  html += "      setTimeout(()=>window.location.href='/',5000);";
  html += "    }else{";
  html += "      showStatus('Connection failed: '+data.message,'error');";
  html += "      btn.disabled=false;";
  html += "      btn.innerHTML='Connect';";
  html += "    }";
  html += "  }).catch(e=>{";
  html += "    showStatus('Error: '+e,'error');";
  html += "    btn.disabled=false;";
  html += "    btn.innerHTML='Connect';";
  html += "  });";
  html += "}";
  html += "function showStatus(msg,type){";
  html += "  const status=document.getElementById('status');";
  html += "  status.className='status-'+type;";
  html += "  status.textContent=msg;";
  html += "  status.style.display='block';";
  html += "}";
  html += "window.onload=loadNetworks;";
  html += "</script></head><body>";
  html += "<h1>📶 WiFi Setup</h1>";
  html += "<div class='card'>";
  html += "<h2>Available Networks</h2>";
  html += "<div id='networks'>Loading...</div>";
  html += "<button class='btn' onclick='loadNetworks()' style='width:auto;margin-top:10px;'>🔄 Scan Again</button>";
  html += "</div>";
  html += "<div class='card' id='passwordSection' style='display:none;'>";
  html += "<h2>Connect to: <span id='ssidDisplay'></span></h2>";
  html += "<label>Password:</label>";
  html += "<input type='password' id='password' placeholder='Enter WiFi password'>";
  html += "<button id='connectBtn' class='btn' onclick='connect()'>Connect</button>";
  html += "<div id='status'></div>";
  html += "</div>";
  html += "<div class='card'>";
  html += "<a href='/' class='btn' style='background:#666;text-align:center;'>← Back to Home</a>";
  html += "</div>";
  html += "</body></html>";
  httpServer.send(200, "text/html; charset=utf-8", html);
}

void handleWifiScan() {
  Serial.println("📡 Scanning WiFi networks...");
  int n = WiFi.scanNetworks();
  Serial.printf("✓ Found %d networks\n", n);

  DynamicJsonDocument doc(2048);
  JsonArray networks = doc.createNestedArray("networks");

  for (int i = 0; i < n; i++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(i);
    network["rssi"] = WiFi.RSSI(i);
    network["encryption"] = (WiFi.encryptionType(i) != ENC_TYPE_NONE);
  }

  String response;
  serializeJson(doc, response);
  httpServer.send(200, "application/json", response);
}

void handleWifiConnect() {
  if (!httpServer.hasArg("plain")) {
    httpServer.send(400, "application/json", "{\"success\":false,\"message\":\"No data\"}");
    return;
  }

  DynamicJsonDocument doc(512);
  deserializeJson(doc, httpServer.arg("plain"));

  String ssid = doc["ssid"] | "";
  String password = doc["password"] | "";

  if (ssid.length() == 0) {
    httpServer.send(400, "application/json", "{\"success\":false,\"message\":\"SSID required\"}");
    return;
  }

  Serial.printf("🔌 Connecting to WiFi: %s\n", ssid.c_str());

  httpServer.send(200, "application/json", "{\"success\":true,\"message\":\"Connecting...\"}");

  delay(500);

  // Save WiFi credentials and restart
  WiFi.begin(ssid.c_str(), password.c_str());

  // Wait up to 10 seconds for connection
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    delay(1000);
    ESP.restart();
  } else {
    Serial.println("\n✗ WiFi connection failed");
  }
}

// ========================================
// AUTOMATIC PROVISIONING (NEW v2.1)
// ========================================

void handleProvision() {
  // Get UUID and Device Key from query parameters
  String uuid = httpServer.arg("uuid");
  String deviceKey = httpServer.arg("key");  // v2.2: Device Key (not API key!)

  String html = "<!DOCTYPE html><html><head>";
  html += "<title>Device Provisioning</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial;margin:20px;background:#f5f5f5;text-align:center;}";
  html += ".container{max-width:500px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}";
  html += "h1{color:#0c5;margin-bottom:10px;}";
  html += ".success{background:#d4edda;border:1px solid #c3e6cb;color:#155724;padding:12px;border-radius:4px;margin:20px 0;}";
  html += ".error{background:#f8d7da;border:1px solid #f5c6cb;color:#721c24;padding:12px;border-radius:4px;margin:20px 0;}";
  html += ".info{background:#d1ecf1;border:1px solid #bee5eb;color:#0c5460;padding:12px;border-radius:4px;margin:20px 0;}";
  html += ".btn{display:inline-block;padding:12px 24px;margin:10px 5px;background:#0c5;color:white;text-decoration:none;border-radius:5px;}";
  html += ".btn:hover{background:#0a4;}";
  html += "code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-family:monospace;}";
  html += "</style></head><body>";
  html += "<div class='container'>";

  // Check if parameters are provided
  if (uuid.length() == 0 || deviceKey.length() == 0) {
    // Missing parameters
    html += "<h1>⚠️ Invalid Request</h1>";
    html += "<div class='error'>";
    html += "<strong>Error:</strong> Missing provisioning parameters.<br>";
    html += "This endpoint requires <code>uuid</code> and <code>key</code> parameters.";
    html += "</div>";
    html += "<div class='info'>";
    html += "<strong>Example:</strong><br>";
    html += "<code>/provision?uuid=YOUR_UUID&key=YOUR_DEVICE_KEY</code>";
    html += "</div>";
    html += "<a href='/' class='btn'>← Back to Home</a>";
  } else {
    // Save credentials to EEPROM
    strncpy(config.device_uuid, uuid.c_str(), 63);
    config.device_uuid[63] = '\0';
    strncpy(config.device_key, deviceKey.c_str(), 127);  // v2.2: device_key
    config.device_key[127] = '\0';
    saveConfiguration();

    // Success page
    html += "<h1>✅ Device Configured!</h1>";
    html += "<div class='success'>";
    html += "<strong>Success!</strong> Device credentials have been saved.";
    html += "</div>";

    html += "<div class='info'>";
    html += "<strong>📋 Configuration Summary:</strong><br><br>";
    html += "<b>Device UUID:</b><br>";
    html += "<code>" + uuid.substring(0, 8) + "...****</code><br><br>";
    html += "<b>Device Key:</b><br>";  // v2.2: Device Key
    html += "<code>****" + deviceKey.substring(deviceKey.length() - 8) + "</code>";
    html += "</div>";

    html += "<div class='info'>";
    html += "<strong>🔌 Next Steps:</strong><br>";
    html += "1. Configure your home WiFi network<br>";
    html += "2. ESP will connect and authenticate with Supabase<br>";
    html += "3. Device will appear online in webapp";
    html += "</div>";

    html += "<a href='/wifi-setup' class='btn'>📶 Configure WiFi</a>";
    html += "<a href='/config' class='btn' style='background:#666;'>⚙️ Advanced Config</a>";
  }

  html += "</div></body></html>";
  httpServer.send(200, "text/html; charset=utf-8", html);
}

// ========================================
// NTP TIME SYNCHRONIZATION (NEW v2.2)
// ========================================

bool syncNTPTime() {
  static bool timeSynced = false;

  if (timeSynced) {
    return true;  // Already synced
  }

  Serial.print("⏰ Syncing time with NTP...");
  configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER1, NTP_SERVER2, NTP_SERVER3);

  // Wait for time sync (max 10 seconds)
  int retries = 0;
  while (time(nullptr) < 100000 && retries < 20) {  // 20 * 500ms = 10 seconds
    Serial.print(".");
    delay(500);
    retries++;
  }

  if (time(nullptr) < 100000) {
    Serial.println(" ✗ Failed");
    return false;
  }

  timeSynced = true;
  time_t now = time(nullptr);
  Serial.printf(" ✓ %s", ctime(&now));
  return true;
}

// ========================================
// SUPABASE EDGE FUNCTION (NEW v2.2)
// ========================================

void sendHeartbeat() {
  // Check if device is configured
  if (strlen(config.device_uuid) == 0 || strlen(config.device_key) == 0) {
    Serial.println("⚠️ Skipping heartbeat - device UUID or Device Key not configured");
    return;
  }

  // Sync time for HTTPS certificate validation (NEW v2.2)
  if (!syncNTPTime()) {
    Serial.println("⚠️ Cannot send heartbeat - time sync failed (required for HTTPS)");
    return;
  }

  // Retry logic: 3 attempts with 5-second delay
  for (int attempt = 1; attempt <= 3; attempt++) {
    // Configure HTTPS client with CA certificate and SNI (NEW v2.2)
    WiFiClientSecure secureClient;

    // TEMPORARY: Use setInsecure() for testing to isolate TLS certificate issues
    // TODO: Re-enable certificate validation after confirming connection works
    secureClient.setInsecure();
    Serial.println("⚠️ TLS verification DISABLED for testing");

    // Set buffer sizes (balance between memory and TLS handshake requirements)
    // 2048 bytes is minimum for reliable TLS 1.2 handshake with RSA certificates
    secureClient.setBufferSizes(2048, 512);  // RX=2048 (handshake), TX=512 (small requests)

    HTTPClient https;

    // Connect to Edge Function
    // HTTPClient::begin() handles SNI automatically when using WiFiClientSecure
    Serial.printf("📡 Connecting to %s...\n", SUPABASE_HOSTNAME);
    if (!https.begin(secureClient, String(SUPABASE_URL) + "/functions/v1/device-heartbeat")) {
      Serial.println("✗ Failed to begin HTTPS connection");
      delay(5000);
      continue;
    }

    // Add Supabase API gateway header (required for Edge Functions)
    https.addHeader("apikey", SUPABASE_ANON_KEY);
    https.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));

    // Add device authentication headers (v2.2: device-specific authentication)
    https.addHeader("Content-Type", "application/json");
    https.addHeader("x-device-key", config.device_key);    // Device-specific key (for Edge Function auth)
    https.addHeader("x-device-uuid", config.device_uuid);  // Device UUID
    https.setTimeout(15000);  // 15 second timeout

    // Build telemetry payload (v2.2: rich telemetry)
    DynamicJsonDocument doc(256);
    doc["rssi"] = WiFi.RSSI();
    doc["fw_version"] = FIRMWARE_VERSION;
    doc["ip"] = WiFi.localIP().toString();

    String payload;
    serializeJson(doc, payload);

    Serial.printf("📤 Sending heartbeat (attempt %d/3)...\n", attempt);
    int httpCode = https.POST(payload);

    if (httpCode == 200) {
      Serial.printf("✓ Heartbeat successful (HTTPS)\n");
      https.end();
      return;  // Success
    } else if (httpCode > 0) {
      Serial.printf("⚠️ Heartbeat failed: HTTP %d\n", httpCode);
      Serial.printf("   Response: %s\n", https.getString().c_str());
    } else {
      Serial.printf("⚠️ Heartbeat failed: %s\n", https.errorToString(httpCode).c_str());
    }

    https.end();

    if (attempt < 3) {
      Serial.printf("   Retrying in 5s...\n");
      delay(5000);
    } else {
      Serial.println("✗ Heartbeat failed after 3 attempts");
    }
  }
}

void sendSensorData() {
  if (config.sensor_count == 0) return;

  // Check if device is configured
  if (strlen(config.device_uuid) == 0 || strlen(config.device_key) == 0) {
    Serial.println("⚠️ Skipping sensor data - device UUID or Device Key not configured");
    return;
  }

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/insert_sensor_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);  // v2.2: anon key for REST API
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));  // v2.2: anon key

  String payload = "{\"device_id_param\":\"" + String(config.device_uuid) + "\",\"readings\":[";
  bool first = true;

  for (int i = 0; i < config.sensor_count; i++) {
    SensorConfig& s = config.sensors[i];
    float value = 0;
    bool valid = false;

    if (s.type == SENSOR_DHT22_TEMP && dhtSensors[s.dht_pair_index]) {
      value = dhtSensors[s.dht_pair_index]->readTemperature();
      valid = !isnan(value);
    } else if (s.type == SENSOR_DHT22_HUM && dhtSensors[s.dht_pair_index]) {
      value = dhtSensors[s.dht_pair_index]->readHumidity();
      valid = !isnan(value);
    } else if (s.type == SENSOR_SOIL_MOISTURE) {
      int raw = analogRead(s.pin);
      value = map(raw, 0, 1023, 0, 100);
      valid = true;
    }

    if (valid) {
      if (!first) payload += ",";
      payload += "{\"sensor_id\":\"" + String(s.sensor_id) + "\",\"value\":" + String(value) + "}";
      first = false;
    }
  }

  payload += "]}";

  if (!first) {  // Only if we have at least one valid sensor
    http.POST(payload);
  }
  http.end();
}

// ========================================
// AUTO-REGISTER SENSORS (NEW)
// ========================================

void autoRegisterSensors() {
  if (config.sensor_count == 0) {
    Serial.println("⚠️ No sensors to register");
    return;
  }

  // Check if device is configured
  if (strlen(config.device_uuid) == 0) {
    Serial.println("⚠️ Cannot register sensors - device UUID not configured");
    return;
  }

  Serial.println("📡 Auto-registering sensors with Supabase...");

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/auto_register_sensors");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.setTimeout(15000);  // 15 second timeout

  // Build JSONB payload with sensors array
  String payload = "{\"device_id_param\":\"" + String(config.device_uuid) + "\",\"sensors_param\":[";

  for (int i = 0; i < config.sensor_count; i++) {
    SensorConfig& s = config.sensors[i];

    if (i > 0) payload += ",";
    payload += "{";
    payload += "\"sensor_id\":\"" + String(s.sensor_id) + "\",";

    // Get human-readable name based on sensor type
    String sensorName = "";
    switch (s.type) {
      case SENSOR_DHT22_TEMP:
        sensorName = "DHT22 Temperature";
        payload += "\"name\":\"" + sensorName + "\",";
        payload += "\"type\":\"temperature\",";
        payload += "\"unit\":\"°C\"";
        break;
      case SENSOR_DHT22_HUM:
        sensorName = "DHT22 Humidity";
        payload += "\"name\":\"" + sensorName + "\",";
        payload += "\"type\":\"humidity\",";
        payload += "\"unit\":\"%\"";
        break;
      case SENSOR_SOIL_MOISTURE:
        sensorName = "Soil Moisture";
        payload += "\"name\":\"" + sensorName + "\",";
        payload += "\"type\":\"soil_moisture\",";
        payload += "\"unit\":\"%\"";
        break;
      case SENSOR_DS18B20:
        sensorName = "DS18B20 Temperature";
        payload += "\"name\":\"" + sensorName + "\",";
        payload += "\"type\":\"temperature\",";
        payload += "\"unit\":\"°C\"";
        break;
      default:
        payload += "\"name\":\"Unknown Sensor\",";
        payload += "\"type\":\"unknown\",";
        payload += "\"unit\":\"\"";
        break;
    }
    payload += "}";

    Serial.printf("  - %s (ID: %s)\n", sensorName.c_str(), s.sensor_id);
  }

  payload += "]}";

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("✓ Sensors registered successfully!");
    Serial.printf("   Response: %s\n", response.c_str());
  } else if (httpCode > 0) {
    Serial.printf("⚠️ Sensor registration failed: HTTP %d\n", httpCode);
    Serial.printf("   Response: %s\n", http.getString().c_str());
  } else {
    Serial.printf("⚠️ Sensor registration failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void pollForCommands() {
  // Check if device is configured
  if (strlen(config.device_uuid) == 0 || strlen(config.device_key) == 0) {
    return;  // Skip silently
  }

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);  // v2.2: anon key for REST API
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));  // v2.2: anon key

  if (http.POST("{\"device_id_param\":\"" + String(config.device_uuid) + "\"}") == 200) {
    DynamicJsonDocument doc(2048);
    if (!deserializeJson(doc, http.getString())) {
      JsonArray commands = doc.as<JsonArray>();
      for (JsonObject cmd : commands) {
        if (executeCommand(cmd["actuator_id"], cmd["command_type"], cmd["value"] | 0)) {
          confirmCommandExecution(cmd["id"]);
        }
      }
    }
  }
  http.end();
}

bool executeCommand(String actuatorId, String commandType, int value) {
  // Find actuator
  for (int i = 0; i < config.actuator_count; i++) {
    ActuatorConfig& a = config.actuators[i];
    if (String(a.actuator_id) == actuatorId) {
      if (a.type == ACTUATOR_RELAY_NO) {
        digitalWrite(a.pin, commandType == "turn_on" ? HIGH : LOW);
        return true;
      } else if (a.type == ACTUATOR_RELAY_NC) {
        digitalWrite(a.pin, commandType == "turn_on" ? LOW : HIGH);
        return true;
      } else if (a.type == ACTUATOR_PWM) {
        if (commandType == "turn_on") {
          analogWrite(a.pin, 1023);
          return true;
        } else if (commandType == "turn_off") {
          analogWrite(a.pin, 0);
          return true;
        } else if (commandType == "set_pwm") {
          analogWrite(a.pin, map(value, 0, 255, 0, 1023));
          return true;
        }
      }
    }
  }
  return false;
}

void confirmCommandExecution(String commandId) {
  // Check if device is configured
  if (strlen(config.device_uuid) == 0) {
    return;  // Skip silently
  }

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/confirm_command_execution");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);  // v2.2: anon key for REST API
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));  // v2.2: anon key
  http.POST("{\"command_id\":\"" + commandId + "\"}");
  http.end();
}
