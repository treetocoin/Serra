/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 with Web Configuration
 * Firmware v1.3 - WiFiManager + OTA + Web Config
 * ================================================================================
 *
 * NOVITÀ v1.3:
 * - 🔧 Configura sensori e attuatori via browser web!
 * - 💾 Configurazione salvata in EEPROM (permanente)
 * - 📍 Pin GPIO personalizzabili per ogni sensore/attuatore
 * - 🏷️ Nomi e tipi personalizzabili
 * - Tutte le funzionalità v1.2 (WiFiManager, OTA)
 *
 * ================================================================================
 * PRIMO AVVIO - CONFIGURAZIONE COMPLETA
 * ================================================================================
 *
 * 1. Carica firmware via USB
 * 2. Connetti al WiFi tramite WiFiManager (come v1.2)
 * 3. Vai su http://serrasetup.local (sempre lo stesso nome!)
 *    Se non funziona: controlla IP sul Serial Monitor
 * 4. Click "⚙️ Configure Sensors/Actuators"
 * 5. Aggiungi sensori:
 *    - Tipo: DHT22_TEMP, DHT22_HUM, SOIL_MOISTURE
 *    - Pin GPIO (es: D2 = GPIO4)
 *    - Sensor ID (deve corrispondere a quello in Supabase)
 * 6. Aggiungi attuatori:
 *    - Tipo: RELAY, PWM
 *    - Pin GPIO (es: D5 = GPIO14)
 *    - Actuator ID (deve corrispondere a quello in Supabase)
 * 7. Click "Save Configuration"
 * 8. ESP8266 si riavvia con nuova configurazione!
 *
 * ================================================================================
 * RESET CONFIGURAZIONE - DUE LIVELLI
 * ================================================================================
 *
 * PULSANTE FLASH (GPIO0/D3):
 *
 * LIVELLO 1 - Reset WiFi (3-10 secondi):
 * - Tieni premuto FLASH button
 * - Dopo 3 secondi LED lampeggia VELOCE (ogni 100ms)
 * - Rilascia pulsante PRIMA dei 10 secondi
 * - ✅ WiFi resettato (configurazione sensori/attuatori CONSERVATA!)
 * - ESP riavvia in modalità AP "Serra-Setup"
 *
 * LIVELLO 2 - Reset Completo (10+ secondi):
 * - Tieni premuto FLASH button
 * - Dopo 3 secondi LED lampeggia VELOCE
 * - Continua a tenere premuto...
 * - Dopo 10 secondi LED lampeggia LENTO (ogni 300ms)
 * - LED lampeggia VELOCISSIMO = reset in corso!
 * - ✅ WiFi + Sensori + Attuatori TUTTO CANCELLATO
 * - ESP riavvia in modalità AP "Serra-Setup"
 *
 * Indicatori visivi:
 * - 🟢 Lampeggio veloce (100ms) = WiFi reset ready
 * - 🔵 Lampeggio lento (300ms) = Full reset ready
 * - 🔴 Lampeggio velocissimo (30ms) = Reset in esecuzione
 *
 * ================================================================================
 * PIN GPIO MAPPING (NodeMCU) - SOLO PIN SICURI
 * ================================================================================
 *
 * PIN DISPONIBILI NELL'INTERFACCIA WEB:
 *
 * DIGITALI (sensori/attuatori):
 * - D1 = GPIO5  ✅ Safe
 * - D2 = GPIO4  ✅ Safe
 * - D5 = GPIO14 ✅ Safe
 * - D6 = GPIO12 ✅ Safe
 * - D7 = GPIO13 ✅ Safe
 *
 * ANALOGICI (solo sensori):
 * - A0 = ADC    ✅ Safe (0-1V, max 3.3V con voltage divider)
 *
 * PIN NON DISPONIBILI (funzioni speciali al boot):
 * - D0 = GPIO16 ❌ No PWM, no interrupts
 * - D3 = GPIO0  ❌ Boot mode (deve essere HIGH)
 * - D4 = GPIO2  ❌ Boot mode + LED interno
 * - D8 = GPIO15 ❌ Boot mode (deve essere LOW)
 *
 * ================================================================================
 * TIPI SENSORI SUPPORTATI
 * ================================================================================
 *
 * DHT22_TEMP      - Temperatura da DHT22 (pin digitale)
 * DHT22_HUM       - Umidità da DHT22 (pin digitale)
 * SOIL_MOISTURE   - Sensore umidità terreno analogico (solo A0)
 * DS18B20         - Sensore temperatura Dallas (pin digitale)
 *
 * ================================================================================
 * TIPI ATTUATORI SUPPORTATI
 * ================================================================================
 *
 * RELAY_NO        - Relè normalmente aperto (ON=HIGH)
 * RELAY_NC        - Relè normalmente chiuso (ON=LOW)
 * PWM             - Controllo PWM 0-255 (ventole, dimmer)
 *
 * ================================================================================
 * LIBRERIE NECESSARIE
 * ================================================================================
 *
 * INSTALLA TRAMITE LIBRARY MANAGER:
 * - WiFiManager by tzapu (v2.0.16-rc.2+)
 * - ArduinoJson by Benoit Blanchon (v6.x)
 * - DHT sensor library by Adafruit
 * - Adafruit Unified Sensor
 * - OneWire by Paul Stoffregen (per DS18B20)
 * - DallasTemperature by Miles Burton (per DS18B20)
 *
 * ================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <ESP8266mDNS.h>         // ← mDNS per hostname.local
#include <ArduinoJson.h>
#include <DHT.h>
#include <ArduinoOTA.h>
#include <ESP8266HTTPUpdateServer.h>
#include <EEPROM.h>

// ========================================
// CONFIGURATION STRUCTURES
// ========================================

#define MAX_SENSORS 8
#define MAX_ACTUATORS 4
#define EEPROM_SIZE 512
#define EEPROM_MAGIC 0xAB12  // Magic number per validare EEPROM

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
  char sensor_id[32];      // ID Supabase (es: "temp_1")
  uint8_t type;            // SensorType
  uint8_t pin;             // GPIO pin
  uint8_t dht_pair_index;  // Per DHT22: indice coppia (0-3), temp e hum condividono stesso pin
  char reserved[12];       // Padding per future espansioni
};

struct ActuatorConfig {
  char actuator_id[32];    // ID Supabase (es: "pump_1")
  uint8_t type;            // ActuatorType
  uint8_t pin;             // GPIO pin
  char reserved[14];       // Padding
};

struct DeviceConfig {
  uint16_t magic;          // EEPROM_MAGIC
  uint8_t sensor_count;
  uint8_t actuator_count;
  SensorConfig sensors[MAX_SENSORS];
  ActuatorConfig actuators[MAX_ACTUATORS];
  char reserved[32];       // Padding
};

// ========================================
// GLOBAL VARIABLES
// ========================================

// WiFi Manager
#define WIFI_AP_NAME "Serra-Setup"
#define WIFI_AP_PASSWORD ""
#define WIFI_RESET_BUTTON D3
#define WIFI_RESET_DURATION 3000      // 3 secondi = reset WiFi
#define FULL_RESET_DURATION 10000     // 10 secondi = reset completo (WiFi + Config)

// Firmware version
const char* FIRMWARE_VERSION = "1.3.0";
const char* GITHUB_REPO = "treetocoin/Serra";

// mDNS & OTA
const char* MDNS_HOSTNAME = "serrasetup";      // Accesso via http://serrasetup.local
const char* OTA_PASSWORD = "serra2025";

// Supabase
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";
const char* API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE";
const char* DEVICE_ID = "0f24ada1-b6f6-45a2-aa0e-0e417daae659";

#define LED_PIN LED_BUILTIN

// Device configuration
DeviceConfig config;

// DHT sensors array (max 4 DHT22)
DHT* dhtSensors[4] = {nullptr, nullptr, nullptr, nullptr};

// Clients
WiFiClientSecure client;
ESP8266WebServer httpServer(80);
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
// EEPROM FUNCTIONS
// ========================================

void loadConfiguration() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(0, config);

  if (config.magic != EEPROM_MAGIC) {
    Serial.println("⚠️ No valid configuration in EEPROM - using defaults");
    config.magic = EEPROM_MAGIC;
    config.sensor_count = 0;
    config.actuator_count = 0;
    memset(config.sensors, 0, sizeof(config.sensors));
    memset(config.actuators, 0, sizeof(config.actuators));
    saveConfiguration();
  } else {
    Serial.printf("✓ Loaded config: %d sensors, %d actuators\n",
                  config.sensor_count, config.actuator_count);
  }
}

void saveConfiguration() {
  EEPROM.put(0, config);
  EEPROM.commit();
  Serial.println("✓ Configuration saved to EEPROM");
}

void resetConfiguration() {
  config.magic = EEPROM_MAGIC;
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
  // Libera DHT precedenti
  for (int i = 0; i < 4; i++) {
    if (dhtSensors[i]) {
      delete dhtSensors[i];
      dhtSensors[i] = nullptr;
    }
  }

  // Inizializza nuovi DHT
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

  // Inizializza attuatori
  for (int i = 0; i < config.actuator_count; i++) {
    ActuatorConfig& a = config.actuators[i];
    pinMode(a.pin, OUTPUT);

    // Stato iniziale
    if (a.type == ACTUATOR_RELAY_NC) {
      digitalWrite(a.pin, HIGH);  // NC = HIGH quando OFF
    } else {
      digitalWrite(a.pin, LOW);
    }

    Serial.printf("✓ Actuator '%s' on GPIO%d\n", a.actuator_id, a.pin);
  }

  sensorsConfigured = (config.sensor_count > 0);
}

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================");
  Serial.println("Serra System v1.3");
  Serial.println("Web Configuration");
  Serial.println("=================================\n");

  pinMode(LED_PIN, OUTPUT);
  pinMode(WIFI_RESET_BUTTON, INPUT_PULLUP);
  digitalWrite(LED_PIN, HIGH);

  client.setInsecure();

  // Load configuration from EEPROM
  loadConfiguration();

  // Initialize hardware based on config
  initializeSensors();

  // WiFi Manager setup
  Serial.println("Starting WiFiManager...");
  wifiManager.setDebugOutput(true);

  IPAddress apIP(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  wifiManager.setAPStaticIPConfig(apIP, gateway, subnet);

  wifiManager.setMinimumSignalQuality(20);
  wifiManager.setRemoveDuplicateAPs(true);
  wifiManager.setConfigPortalTimeout(300);
  wifiManager.setConnectTimeout(30);
  wifiManager.setShowInfoUpdate(false);

  wifiManager.setAPCallback([](WiFiManager *myWiFiManager) {
    Serial.println("\n╔═══════════════════════════════════╗");
    Serial.println("║  MODALITÀ CONFIGURAZIONE WiFi     ║");
    Serial.println("╚═══════════════════════════════════╝");
    Serial.printf("📡 Access Point: %s\n", myWiFiManager->getConfigPortalSSID().c_str());
    Serial.println("🌐 http://192.168.4.1\n");
  });

  if (!wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
    Serial.println("✗ Timeout - riavvio...");
    ESP.restart();
  }

  Serial.println("\n✓ WiFi connected!");
  Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());

  digitalWrite(LED_PIN, LOW);

  // Setup mDNS
  if (MDNS.begin(MDNS_HOSTNAME)) {
    Serial.printf("✓ mDNS started: http://%s.local\n", MDNS_HOSTNAME);
    MDNS.addService("http", "tcp", 80);
  } else {
    Serial.println("✗ mDNS failed to start");
  }

  // Setup OTA
  setupOTA();
  setupWebServer();

  Serial.println("\n✓ Setup complete");
  Serial.printf("🌐 Web UI: http://%s.local  (or http://%s)\n",
                MDNS_HOSTNAME, WiFi.localIP().toString().c_str());
  Serial.println("=================================\n");
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  MDNS.update();  // Mantieni mDNS attivo
  ArduinoOTA.handle();
  httpServer.handleClient();
  checkResetButton();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost - reconnecting...");
    if (!wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
      ESP.restart();
    }
  }

  unsigned long currentTime = millis();

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

    // LED lampeggia velocemente dopo 3 secondi (WiFi reset)
    if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, (millis() / 100) % 2);  // Lampeggio veloce
    }

    // LED lampeggia lentamente dopo 10 secondi (Full reset)
    if (pressDuration >= FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, (millis() / 300) % 2);  // Lampeggio lento
    }

    // Reset completo dopo 10 secondi
    if (pressDuration >= FULL_RESET_DURATION) {
      Serial.println("\n🔥 FULL RESET - WiFi + Configuration!");

      // LED lampeggia velocissimo
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
    // Rilascio pulsante
    if (buttonPressed) {
      unsigned long pressDuration = millis() - buttonPressStart;

      // Reset WiFi se premuto 3-10 secondi
      if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
        Serial.println("\n🔄 WiFi RESET ONLY!");

        // LED lampeggia velocemente
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
      digitalWrite(LED_PIN, LOW);  // LED on (stato normale)
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
  html += "</style>";
  html += "<script>";
  html += "function checkUpdate(){";
  html += "  const btn=document.getElementById('updateBtn');";
  html += "  btn.textContent='⏳ Checking...';";
  html += "  btn.disabled=true;";
  html += "  window.open('https://github.com/" + String(GITHUB_REPO) + "/releases','_blank');";
  html += "  setTimeout(()=>{";
  html += "    if(confirm('Have you downloaded the latest .ino file?\\n\\nClick OK to open the upload page.')){";
  html += "      window.location.href='/update';";
  html += "    }else{";
  html += "      btn.textContent='🔄 Check for Updates';";
  html += "      btn.disabled=false;";
  html += "    }";
  html += "  },2000);";
  html += "}";
  html += "</script></head><body>";

  html += "<h1>🌱 Serra ESP8266 v" + String(FIRMWARE_VERSION) + "</h1>";

  // Status card
  html += "<div class='card'>";
  html += "<h2>System Status</h2>";
  html += "<table>";
  html += "<tr><td><b>Device ID</b></td><td>" + String(DEVICE_ID) + "</td></tr>";
  html += "<tr><td><b>Firmware</b></td><td>v" + String(FIRMWARE_VERSION) + " - Web Config</td></tr>";
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

  // Update info
  html += "<div class='card'>";
  html += "<h2>Firmware Update</h2>";
  html += "<div class='update-info'>";
  html += "<b>📦 Current Version:</b> " + String(FIRMWARE_VERSION) + "<br>";
  html += "<b>📂 Repository:</b> <a href='https://github.com/" + String(GITHUB_REPO) + "' target='_blank'>" + String(GITHUB_REPO) + "</a><br><br>";
  html += "<b>How to update:</b><br>";
  html += "1. Click 'Check for Updates' to open GitHub releases<br>";
  html += "2. Download latest ESP8266_Greenhouse_WebConfig.ino<br>";
  html += "3. Compile in Arduino IDE and export .bin<br>";
  html += "4. Upload via web interface (username: admin, password: serra2025)";
  html += "</div>";
  html += "<button id='updateBtn' class='btn btn-info' onclick='checkUpdate()'>🔄 Check for Updates</button>";
  html += "</div>";

  // Actions
  html += "<div class='card'>";
  html += "<h2>Actions</h2>";
  html += "<a href='/config' class='btn'>⚙️ Configure Sensors/Actuators</a>";
  html += "<a href='/update' class='btn btn-warning'>📤 Upload Firmware</a>";
  html += "<a href='/resetwifi' class='btn btn-danger'>🔄 Reset WiFi</a>";
  html += "</div>";

  html += "</body></html>";
  httpServer.send(200, "text/html", html);
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
  html += ".help{font-size:12px;color:#666;margin-top:5px;}";
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
  html += "  html+='<label>Sensor ID:</label>';";
  html += "  html+='<input name=\\'sensor_id[]\\' value=\\''+(s.sensor_id||'')+'\\'  placeholder=\\'temp_1\\'>';";
  html += "  html+='<div class=\\'help\\'>ID must match Supabase (es: temp_1, humidity_1)</div>';";
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
  html += "  html+='<div class=\\'help\\'>ID must match Supabase (es: pump_1, fan_1)</div>';";
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
  html += "  const sensors=[],actuators=[];";
  html += "  const sensorIds=formData.getAll('sensor_id[]');";
  html += "  const sensorTypes=formData.getAll('sensor_type[]');";
  html += "  const sensorPins=formData.getAll('sensor_pin[]');";
  html += "  const sensorPairs=formData.getAll('sensor_dht_pair[]');";
  html += "  for(let i=0;i<sensorIds.length;i++){";
  html += "    sensors.push({sensor_id:sensorIds[i],type:parseInt(sensorTypes[i]),pin:parseInt(sensorPins[i]),dht_pair_index:parseInt(sensorPairs[i])});";
  html += "  }";
  html += "  const actIds=formData.getAll('actuator_id[]');";
  html += "  const actTypes=formData.getAll('actuator_type[]');";
  html += "  const actPins=formData.getAll('actuator_pin[]');";
  html += "  for(let i=0;i<actIds.length;i++){";
  html += "    actuators.push({actuator_id:actIds[i],type:parseInt(actTypes[i]),pin:parseInt(actPins[i])});";
  html += "  }";
  html += "  fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sensors,actuators})})";
  html += "  .then(r=>r.json()).then(data=>{alert(data.message);if(data.success)location.href='/';});";
  html += "}";
  html += "window.onload=loadConfig;";
  html += "</script></head><body>";

  html += "<h1>⚙️ Configuration</h1>";
  html += "<a href='/' class='btn'>← Back</a>";

  html += "<form id='configForm'>";

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

  httpServer.send(200, "text/html", html);
}

void handleGetConfig() {
  DynamicJsonDocument doc(2048);

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

  // Parse sensors
  JsonArray sensors = doc["sensors"];
  config.sensor_count = min((int)sensors.size(), MAX_SENSORS);
  for (int i = 0; i < config.sensor_count; i++) {
    JsonObject s = sensors[i];
    strncpy(config.sensors[i].sensor_id, s["sensor_id"] | "", 31);
    config.sensors[i].type = s["type"] | 0;
    config.sensors[i].pin = s["pin"] | 0;
    config.sensors[i].dht_pair_index = s["dht_pair_index"] | 0;
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
// SUPABASE FUNCTIONS
// ========================================

void sendHeartbeat() {
  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/device_heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Heartbeat");
  }
  http.end();
}

void sendSensorData() {
  if (config.sensor_count == 0) return;

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/insert_sensor_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\",\"readings\":[";
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

  if (!first) {  // Solo se abbiamo almeno un sensore valido
    http.POST(payload);
  }
  http.end();
}

void pollForCommands() {
  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  if (http.POST("{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}") == 200) {
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
  // Trova attuatore
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
  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/confirm_command_execution");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));
  http.POST("{\"command_id\":\"" + commandId + "\"}");
  http.end();
}
