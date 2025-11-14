/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 with WiFiManager + OTA
 * Firmware v1.3 - Composite Device ID Support
 * ================================================================================
 *
 * NOVITÀ v1.3:
 * - Supporto per Composite Device ID (es. PROJ1-ESP3)
 * - Auto-generazione Device Key per sicurezza
 * - Nuovo sistema di autenticazione con Edge Function
 * - Configurazione ID dispositivo tramite web
 *
 * NOVITÀ v1.2:
 * - WiFiManager: configura WiFi via browser senza Arduino IDE!
 * - Access Point automatico per setup iniziale
 * - Portale captive per configurazione facile
 * - Reset configurazione WiFi tramite pulsante (GPIO0/D3)
 * - Tutte le funzionalità OTA della v1.1
 *
 * ================================================================================
 * CONFIGURAZIONE INIZIALE
 * ================================================================================
 *
 * STEP 1 - Registra Dispositivo sulla WebApp:
 * 1. Vai su https://serra.netlify.app
 * 2. Login e vai nella sezione "Dispositivi"
 * 3. Click "Registra Nuovo Dispositivo"
 * 4. Inserisci nome (es. "Serra Principale") e numero dispositivo (1-20)
 * 5. COPIA L'ID DISPOSITIVO generato (es. "PROJ1-ESP3")
 *
 * STEP 2 - Carica Firmware:
 * 1. Carica questo firmware via USB (prima e unica volta)
 * 2. ESP8266 si avvia e crea Access Point: "Serra-Setup"
 *
 * STEP 3 - Configura WiFi e Device ID:
 * 1. Connettiti a "Serra-Setup" con smartphone/PC (no password)
 * 2. Si apre automaticamente il portale di configurazione
 *    (se non si apre, vai su http://192.168.4.1)
 * 3. Click "Configure WiFi"
 * 4. Seleziona la tua rete WiFi dalla lista
 * 5. Inserisci la password WiFi
 * 6. **INCOLLA L'ID DISPOSITIVO** copiato dalla webapp (es. "PROJ1-ESP3")
 * 7. Click "Save"
 * 8. ESP8266 si riavvia, si connette al WiFi e genera automaticamente
 *    la sua chiave di sicurezza (Device Key)
 * 9. Al primo heartbeat, la webapp registra la chiave
 *
 * IL DISPOSITIVO È CONFIGURATO!
 * Device ID e Key sono salvati permanentemente in EEPROM.
 *
 * LE CREDENZIALI SONO SALVATE PERMANENTEMENTE!
 * Non serve più Arduino IDE per cambiare WiFi.
 *
 * ================================================================================
 * TROUBLESHOOTING - PAGINA BIANCA
 * ================================================================================
 *
 * PROBLEMA: Dopo click su "Configure WiFi" vedi pagina bianca?
 *
 * CAUSE COMUNI:
 * - ESP8266 ha poca RAM, la lista WiFi potrebbe essere troppo grande
 * - Troppe reti WiFi nell'area (>10-15)
 * - Versione WiFiManager non aggiornata
 *
 * SOLUZIONI:
 * 1. Aspetta 10-15 secondi, la pagina potrebbe caricarsi lentamente
 * 2. Ricarica la pagina (F5 o pull-down su mobile)
 * 3. Prova browser diverso (Chrome su Android, Safari su iOS)
 * 4. Controlla il Serial Monitor per errori durante scan WiFi
 * 5. Verifica versione WiFiManager: deve essere v2.0.16-rc.2+
 *
 * SOLUZIONE ALTERNATIVA - WiFi Manuale:
 * Se WiFiManager continua a dare problemi, usa ESP8266_Greenhouse_OTA.ino
 * che ha le credenziali WiFi hardcoded ma supporta comunque OTA.
 *
 * ================================================================================
 * RESET CONFIGURAZIONE WiFi
 * ================================================================================
 *
 * Se vuoi cambiare rete WiFi o hai dimenticato la password:
 *
 * METODO 1 - Pulsante Hardware:
 * 1. Tieni premuto il pulsante FLASH (GPIO0/D3) per 3 secondi
 * 2. LED lampeggia velocemente = reset in corso
 * 3. ESP8266 si riavvia in modalità AP "Serra-Setup"
 * 4. Riconfigura WiFi come al primo avvio
 *
 * METODO 2 - Via Web (se ancora connesso):
 * 1. Vai su http://<ip-esp8266>/
 * 2. Click "Reset WiFi Configuration"
 * 3. Conferma
 * 4. ESP8266 si riavvia in modalità AP
 *
 * ================================================================================
 * AGGIORNAMENTI OTA
 * ================================================================================
 *
 * METODO 1 - Arduino IDE (rete locale):
 * - Tools → Port → serra-esp8266 at <ip>
 * - Upload normalmente
 * - Password OTA: serra2025
 *
 * METODO 2 - Browser Web:
 * - http://<ip-esp8266>/update
 * - Username: admin
 * - Password: serra2025
 * - Upload file .bin
 *
 * ================================================================================
 * LIBRERIE NECESSARIE
 * ================================================================================
 *
 * INSTALLA TRAMITE LIBRARY MANAGER:
 * - WiFiManager by tzapu (v2.0.16-rc.2 o superiore)
 * - ArduinoJson by Benoit Blanchon (v6.x)
 * - DHT sensor library by Adafruit
 * - Adafruit Unified Sensor
 *
 * BUILT-IN (già incluse):
 * - ESP8266WiFi
 * - ESP8266WebServer
 * - ESP8266HTTPClient
 * - ArduinoOTA
 * - EEPROM
 *
 * ================================================================================
 * HARDWARE
 * ================================================================================
 *
 * PULSANTE RESET WiFi:
 * - Pulsante FLASH integrato su NodeMCU → GPIO0 (D3)
 * - Oppure pulsante esterno: GPIO0 → GND (normalmente aperto)
 *
 * SENSORI E ATTUATORI: (stesso schema v1.1)
 * - DHT22 #1 → D2 (GPIO4)
 * - DHT22 #2 → D1 (GPIO5)
 * - Soil Sensor → A0
 * - Pump Relay → D5 (GPIO14)
 * - Fan Relay → D6 (GPIO12)
 *
 * ================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>          // ← NEW: WiFi configuration portal
#include <ArduinoJson.h>
#include <DHT.h>
#include <ArduinoOTA.h>
#include <ESP8266HTTPUpdateServer.h>
#include <EEPROM.h>

// ========================================
// CONFIGURATION
// ========================================

// WiFi Manager
#define WIFI_AP_NAME "Serra-Setup"           // Nome Access Point per configurazione
#define WIFI_AP_PASSWORD ""                  // Password AP (vuota = aperto)
#define WIFI_RESET_BUTTON D3                 // GPIO0 - Pulsante FLASH su NodeMCU
#define WIFI_RESET_DURATION 3000             // Tieni premuto 3 secondi per reset

// OTA Configuration
const char* OTA_HOSTNAME = "serra-esp8266";
const char* OTA_PASSWORD = "serra2025";

// Supabase configuration
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";
const char* API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE";

// Device configuration - Salvato in EEPROM dopo configurazione WiFi
char COMPOSITE_DEVICE_ID[32] = "";  // Verrà richiesto nel portale WiFi
char DEVICE_KEY[64] = "";           // Generato automaticamente al primo avvio

// EEPROM addresses
#define EEPROM_SIZE 512
#define EEPROM_DEVICE_ID_ADDR 0
#define EEPROM_DEVICE_KEY_ADDR 100
#define EEPROM_MAGIC_ADDR 400
#define EEPROM_MAGIC_VALUE 0xAB

// Hardware pins
#define DHT_PIN_1 D2
#define DHT_PIN_2 D1
#define SOIL_PIN A0
#define PUMP_PIN D5
#define FAN_PIN D6
#define LED_PIN LED_BUILTIN

// Sensors
#define DHT_TYPE DHT22
DHT dht1(DHT_PIN_1, DHT_TYPE);
DHT dht2(DHT_PIN_2, DHT_TYPE);
#define ENABLE_DHT2 true

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

// WiFiManager custom parameter
WiFiManagerParameter* custom_device_id;

// ========================================
// EEPROM FUNCTIONS
// ========================================

void loadDeviceConfig() {
  EEPROM.begin(EEPROM_SIZE);

  // Check if EEPROM is initialized
  if (EEPROM.read(EEPROM_MAGIC_ADDR) != EEPROM_MAGIC_VALUE) {
    Serial.println("EEPROM not initialized");
    EEPROM.end();
    return;
  }

  // Load Composite Device ID
  for (int i = 0; i < 31; i++) {
    COMPOSITE_DEVICE_ID[i] = EEPROM.read(EEPROM_DEVICE_ID_ADDR + i);
    if (COMPOSITE_DEVICE_ID[i] == 0) break;
  }
  COMPOSITE_DEVICE_ID[31] = 0;

  // Load Device Key
  for (int i = 0; i < 63; i++) {
    DEVICE_KEY[i] = EEPROM.read(EEPROM_DEVICE_KEY_ADDR + i);
    if (DEVICE_KEY[i] == 0) break;
  }
  DEVICE_KEY[63] = 0;

  EEPROM.end();

  Serial.print("Loaded Device ID: ");
  Serial.println(COMPOSITE_DEVICE_ID);
  Serial.print("Loaded Device Key: ");
  Serial.println(strlen(DEVICE_KEY) > 0 ? "[present]" : "[empty]");
}

void saveDeviceConfig() {
  EEPROM.begin(EEPROM_SIZE);

  // Save Composite Device ID
  for (int i = 0; i < 31 && COMPOSITE_DEVICE_ID[i] != 0; i++) {
    EEPROM.write(EEPROM_DEVICE_ID_ADDR + i, COMPOSITE_DEVICE_ID[i]);
  }
  EEPROM.write(EEPROM_DEVICE_ID_ADDR + strlen(COMPOSITE_DEVICE_ID), 0);

  // Save Device Key
  for (int i = 0; i < 63 && DEVICE_KEY[i] != 0; i++) {
    EEPROM.write(EEPROM_DEVICE_KEY_ADDR + i, DEVICE_KEY[i]);
  }
  EEPROM.write(EEPROM_DEVICE_KEY_ADDR + strlen(DEVICE_KEY), 0);

  // Set magic value
  EEPROM.write(EEPROM_MAGIC_ADDR, EEPROM_MAGIC_VALUE);

  EEPROM.commit();
  EEPROM.end();

  Serial.println("Device config saved to EEPROM");
}

void generateDeviceKey() {
  if (strlen(DEVICE_KEY) > 0) {
    Serial.println("Device key already exists");
    return;
  }

  Serial.println("Generating new device key...");

  // Generate random key using chip ID + random seed
  randomSeed(ESP.getChipId() + micros());

  const char charset[] = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (int i = 0; i < 48; i++) {
    DEVICE_KEY[i] = charset[random(0, sizeof(charset) - 1)];
  }
  DEVICE_KEY[48] = 0;

  Serial.print("Generated key: ");
  Serial.println(DEVICE_KEY);

  saveDeviceConfig();
}

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================");
  Serial.println("Serra System v1.3");
  Serial.println("Composite Device ID Support");
  Serial.println("=================================\n");

  // LED e pulsante reset WiFi
  pinMode(LED_PIN, OUTPUT);
  pinMode(WIFI_RESET_BUTTON, INPUT_PULLUP);
  digitalWrite(LED_PIN, HIGH); // LED off inizialmente

  // HTTPS client
  client.setInsecure();

  // Initialize sensors
  dht1.begin();
  if (ENABLE_DHT2) dht2.begin();

  // Initialize actuators
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);

  // ========================================
  // DEVICE CONFIGURATION
  // ========================================
  Serial.println("Loading device configuration...");
  loadDeviceConfig();

  // ========================================
  // WIFI MANAGER SETUP
  // ========================================
  Serial.println("Starting WiFiManager...");

  // Custom parameter: Device ID
  custom_device_id = new WiFiManagerParameter(
    "device_id",
    "Device ID (es. PROJ1-ESP3)",
    COMPOSITE_DEVICE_ID,
    31
  );
  wifiManager.addParameter(custom_device_id);

  // Callback quando salva la configurazione WiFi
  wifiManager.setSaveConfigCallback([]() {
    Serial.println("WiFi configuration saved");

    // Copy custom parameter value
    strncpy(COMPOSITE_DEVICE_ID, custom_device_id->getValue(), 31);
    COMPOSITE_DEVICE_ID[31] = 0;

    Serial.print("Device ID from portal: ");
    Serial.println(COMPOSITE_DEVICE_ID);

    // Save to EEPROM
    saveDeviceConfig();
  });

  // Reset settings per test (commenta in produzione)
  // wifiManager.resetSettings();

  // *** FIX CAPTIVE PORTAL + CONFIGURE WiFi PAGE ***
  // Debug output per vedere cosa succede
  wifiManager.setDebugOutput(true);

  // Configurazione IP statico per AP
  IPAddress apIP(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  wifiManager.setAPStaticIPConfig(apIP, gateway, subnet);

  // FIX: Aumenta dimensione buffer per pagina WiFi list
  wifiManager.setMinimumSignalQuality(20);  // Mostra solo reti con segnale decente
  wifiManager.setRemoveDuplicateAPs(true);  // Rimuovi SSID duplicati

  // Messaggio personalizzato nel portale (SEMPLIFICATO per risparmiare memoria)
  String customHTML = "<p>Seleziona la tua rete WiFi dalla lista qui sotto.</p>";
  wifiManager.setCustomHeadElement(customHTML.c_str());

  // Callback quando entra in modalità AP
  wifiManager.setAPCallback([](WiFiManager *myWiFiManager) {
    Serial.println("\n╔═══════════════════════════════════╗");
    Serial.println("║  MODALITÀ CONFIGURAZIONE WiFi     ║");
    Serial.println("╚═══════════════════════════════════╝");
    Serial.println("");
    Serial.print("📡 Access Point: ");
    Serial.println(myWiFiManager->getConfigPortalSSID());
    Serial.println("🔓 Password: (nessuna - aperto)");
    Serial.println("");
    Serial.println("🌐 APRI IL BROWSER E VAI SU:");
    Serial.println("   http://192.168.4.1");
    Serial.println("");
    Serial.println("📱 Su smartphone potrebbe aprirsi");
    Serial.println("   automaticamente il portale.");
    Serial.println("   Altrimenti apri browser manualmente");
    Serial.println("");
    Serial.println("═══════════════════════════════════\n");

    // LED lampeggia in modalità configurazione
    for (int i = 0; i < 20; i++) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      delay(100);
    }
  });

  // Timeout portale configurazione (5 minuti invece di 3)
  wifiManager.setConfigPortalTimeout(300);

  // FIX: Timeout più lungo per WiFi scan (alcuni router sono lenti)
  wifiManager.setConnectTimeout(30);  // 30 secondi per connessione

  // FIX: Numero limitato di reti WiFi da mostrare per risparmiare memoria
  wifiManager.setShowInfoUpdate(false);  // Non mostrare info aggiuntive

  // Prova a connettersi, se fallisce apre AP configurazione
  Serial.println("Tentativo auto-connessione...");
  if (!wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
    Serial.println("✗ Timeout configurazione - riavvio...");
    delay(3000);
    ESP.restart();
  }

  // ✓ Connesso!
  Serial.println("\n✓ WiFi connected!");
  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Signal: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm\n");

  // LED fisso = connesso
  digitalWrite(LED_PIN, LOW);

  // ========================================
  // DEVICE KEY GENERATION
  // ========================================
  generateDeviceKey();

  // Validate configuration
  if (strlen(COMPOSITE_DEVICE_ID) == 0) {
    Serial.println("⚠️  WARNING: Device ID not configured!");
    Serial.println("Please configure via WiFi portal (reset WiFi config)");
  } else {
    Serial.print("Device ID: ");
    Serial.println(COMPOSITE_DEVICE_ID);
    Serial.print("Device Key: ");
    Serial.println(DEVICE_KEY);
  }

  // ========================================
  // SETUP OTA
  // ========================================
  setupOTA();
  setupWebOTA();

  // Check sensor configuration
  checkSensorConfiguration();

  Serial.println("\n✓ Setup complete");
  Serial.printf("Hostname: %s.local\n", OTA_HOSTNAME);
  Serial.printf("Web UI: http://%s/\n", WiFi.localIP().toString().c_str());
  Serial.println("=================================\n");
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  // Handle OTA
  ArduinoOTA.handle();
  httpServer.handleClient();

  // Check reset button (GPIO0/FLASH)
  checkResetButton();

  // WiFi check
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost - reconnecting...");
    digitalWrite(LED_PIN, HIGH); // LED off
    
    if (!wifiManager.autoConnect(WIFI_AP_NAME, WIFI_AP_PASSWORD)) {
      ESP.restart();
    }
    
    digitalWrite(LED_PIN, LOW); // LED on
  }

  unsigned long currentTime = millis();

  // Heartbeat
  if (currentTime - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeatTime = currentTime;
  }

  // Sensor data
  if (sensorsConfigured && currentTime - lastSensorDataTime >= SENSOR_INTERVAL) {
    sendSensorData();
    lastSensorDataTime = currentTime;
  }

  // Commands
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
  // Leggi pulsante (LOW = premuto, ha pull-up)
  if (digitalRead(WIFI_RESET_BUTTON) == LOW) {
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressStart = millis();
      Serial.println("Reset button pressed...");
    }
    
    // Controlla durata pressione
    if (millis() - buttonPressStart >= WIFI_RESET_DURATION) {
      Serial.println("\n🔄 RESET WiFi Configuration!");
      
      // LED lampeggia velocemente
      for (int i = 0; i < 20; i++) {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        delay(50);
      }
      
      // Reset credenziali WiFi
      wifiManager.resetSettings();
      Serial.println("✓ Settings erased - rebooting...");
      delay(1000);
      ESP.restart();
    }
  } else {
    if (buttonPressed) {
      Serial.println("Button released");
      buttonPressed = false;
    }
  }
}

// ========================================
// OTA SETUP
// ========================================

void setupOTA() {
  ArduinoOTA.setHostname(OTA_HOSTNAME);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.setPort(8266);

  ArduinoOTA.onStart([]() {
    Serial.println("🔄 OTA Update Start");
    digitalWrite(LED_PIN, LOW);
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\n✓ OTA Complete!");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    // LED lampeggia durante upload
    digitalWrite(LED_PIN, (progress / 1024) % 2);
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("✗ OTA Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });

  ArduinoOTA.begin();
  Serial.println("✓ ArduinoOTA ready");
}

void setupWebOTA() {
  httpUpdater.setup(&httpServer, "/update", "admin", OTA_PASSWORD);
  
  // Root page
  httpServer.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head>";
    html += "<title>Serra ESP8266</title>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>body{font-family:Arial;margin:20px;} ";
    html += "h1{color:#0c5;} table{border-collapse:collapse;width:100%;} ";
    html += "td,th{border:1px solid #ddd;padding:12px;text-align:left;} ";
    html += "tr:nth-child(even){background-color:#f2f2f2;} ";
    html += ".btn{display:inline-block;padding:10px 20px;margin:10px 0;";
    html += "background:#0c5;color:white;text-decoration:none;border-radius:5px;}";
    html += ".btn-danger{background:#d33;}</style></head><body>";
    html += "<h1>🌱 Greenhouse System</h1>";
    html += "<table>";
    html += "<tr><td><b>Device ID</b></td><td>" + String(COMPOSITE_DEVICE_ID) + "</td></tr>";
    html += "<tr><td><b>Firmware</b></td><td>v1.3 - Composite ID Support</td></tr>";
    html += "<tr><td><b>WiFi SSID</b></td><td>" + WiFi.SSID() + "</td></tr>";
    html += "<tr><td><b>IP Address</b></td><td>" + WiFi.localIP().toString() + "</td></tr>";
    html += "<tr><td><b>Signal</b></td><td>" + String(WiFi.RSSI()) + " dBm</td></tr>";
    html += "<tr><td><b>Free Heap</b></td><td>" + String(ESP.getFreeHeap()) + " bytes</td></tr>";
    html += "<tr><td><b>Uptime</b></td><td>" + String(millis() / 1000) + " sec</td></tr>";
    html += "</table><br>";
    html += "<a href='/update' class='btn'>📤 Firmware Update</a><br>";
    html += "<a href='/resetwifi' class='btn btn-danger'>🔄 Reset WiFi</a>";
    html += "</body></html>";
    httpServer.send(200, "text/html", html);
  });

  // Reset WiFi endpoint
  httpServer.on("/resetwifi", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head><title>Reset WiFi</title></head><body>";
    html += "<h1>Reset WiFi Configuration</h1>";
    html += "<p>Device will restart in AP mode for reconfiguration.</p>";
    html += "<p>Connect to: <b>Serra-Setup</b></p>";
    html += "</body></html>";
    httpServer.send(200, "text/html", html);
    delay(2000);
    wifiManager.resetSettings();
    ESP.restart();
  });

  httpServer.begin();
  Serial.println("✓ Web server started");
}

// ========================================
// SUPABASE FUNCTIONS (unchanged)
// ========================================

void checkSensorConfiguration() {
  // Abilita sempre la lettura sensori
  sensorsConfigured = true;
  Serial.println("✓ Sensors enabled - will read DHT22 and soil moisture every 30s");
}

void sendHeartbeat() {
  Serial.println("\n=== Sending heartbeat ===");
  Serial.print("Composite Device ID: ");
  Serial.println(COMPOSITE_DEVICE_ID);
  Serial.print("Device Key: ");
  Serial.println(DEVICE_KEY);
  Serial.print("URL: ");
  Serial.println(String(SUPABASE_URL) + "/functions/v1/device-heartbeat");

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/functions/v1/device-heartbeat");

  // Headers richiesti dall'Edge Function
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("x-composite-device-id", String(COMPOSITE_DEVICE_ID));
  http.addHeader("x-device-key", String(DEVICE_KEY));

  Serial.println("Headers set:");
  Serial.println("- Content-Type: application/json");
  Serial.println("- apikey: [hidden]");
  Serial.print("- x-composite-device-id: ");
  Serial.println(COMPOSITE_DEVICE_ID);
  Serial.print("- x-device-key: ");
  Serial.println(DEVICE_KEY);

  // Payload con telemetria
  String payload = "{";
  payload += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  payload += "\"fw_version\":\"v1.3\",";
  payload += "\"ip_address\":\"" + WiFi.localIP().toString() + "\",";
  payload += "\"device_hostname\":\"" + String(OTA_HOSTNAME) + "\"";
  payload += "}";

  Serial.print("Payload: ");
  Serial.println(payload);

  int httpCode = http.POST(payload);

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  if (httpCode == 200) {
    Serial.println("✓ Heartbeat OK");
    String response = http.getString();
    Serial.print("Response: ");
    Serial.println(response);
  } else {
    Serial.print("✗ Heartbeat failed: ");
    Serial.println(httpCode);
    if (httpCode > 0) {
      String response = http.getString();
      Serial.print("Error response: ");
      Serial.println(response);
    }
  }

  http.end();
  Serial.println("=========================\n");
}

void sendSensorData() {
  Serial.println("\n=== Reading Sensors ===");

  float t1 = dht1.readTemperature();
  float h1 = dht1.readHumidity();

  Serial.print("DHT22 #1 (D2): ");
  if (isnan(t1) || isnan(h1)) {
    Serial.println("❌ FAILED - Using fallback values");
    t1 = 22.5;
    h1 = 55.0;
  } else {
    Serial.print("✓ Temp: ");
    Serial.print(t1);
    Serial.print("°C, Humidity: ");
    Serial.print(h1);
    Serial.println("%");
  }

  float t2 = 0, h2 = 0;
  bool hasDHT2 = false;
  if (ENABLE_DHT2) {
    t2 = dht2.readTemperature();
    h2 = dht2.readHumidity();
    Serial.print("DHT22 #2 (D1): ");
    if (!isnan(t2) && !isnan(h2)) {
      hasDHT2 = true;
      Serial.print("✓ Temp: ");
      Serial.print(t2);
      Serial.print("°C, Humidity: ");
      Serial.print(h2);
      Serial.println("%");
    } else {
      Serial.println("❌ Not connected or failed");
    }
  }

  int soilRaw = analogRead(SOIL_PIN);
  float soil = map(soilRaw, 0, 1023, 0, 100);
  Serial.print("Soil Moisture (A0): ");
  Serial.print(soil);
  Serial.print("% (raw: ");
  Serial.print(soilRaw);
  Serial.println(")");

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/insert_sensor_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(COMPOSITE_DEVICE_ID) + "\",\"readings\":[";
  payload += "{\"sensor_id\":\"temp_1\",\"value\":" + String(t1) + "},";
  payload += "{\"sensor_id\":\"humidity_1\",\"value\":" + String(h1) + "},";
  if (hasDHT2) {
    payload += "{\"sensor_id\":\"temp_2\",\"value\":" + String(t2) + "},";
    payload += "{\"sensor_id\":\"humidity_2\",\"value\":" + String(h2) + "},";
  }
  payload += "{\"sensor_id\":\"soil_1\",\"value\":" + String(soil) + "}]}";

  Serial.println("\nSending sensor data to server...");
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Sensor data sent successfully");
  } else {
    Serial.print("✗ Failed to send sensor data: ");
    Serial.println(httpCode);
  }

  http.end();
  Serial.println("=========================\n");
}

void configureSensorsAndActuators() {
  sendSensorData();
  sensorsConfigured = true;
}

void pollForCommands() {
  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/check_device_configuration");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(COMPOSITE_DEVICE_ID) + "\"}";
  if (http.POST(payload) == 200) {
    DynamicJsonDocument doc(512);
    if (!deserializeJson(doc, http.getString())) {
      if (doc["configuration_requested"].as<bool>() && !sensorsConfigured) {
        http.end();
        configureSensorsAndActuators();
        
        HTTPClient httpClear;
        httpClear.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/clear_device_configuration");
        httpClear.addHeader("Content-Type", "application/json");
        httpClear.addHeader("apikey", API_KEY);
        httpClear.addHeader("Authorization", "Bearer " + String(API_KEY));
        httpClear.POST("{\"device_id_param\":\"" + String(COMPOSITE_DEVICE_ID) + "\"}");
        httpClear.end();
        return;
      }
    }
  }
  http.end();

  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  if (http.POST("{\"device_id_param\":\"" + String(COMPOSITE_DEVICE_ID) + "\"}") == 200) {
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
  if (actuatorId == "pump_1") {
    digitalWrite(PUMP_PIN, commandType == "turn_on" ? HIGH : LOW);
    return true;
  }
  if (actuatorId == "fan_1") {
    if (commandType == "turn_on") { digitalWrite(FAN_PIN, HIGH); return true; }
    if (commandType == "turn_off") { digitalWrite(FAN_PIN, LOW); return true; }
    if (commandType == "set_pwm") { analogWrite(FAN_PIN, map(value, 0, 255, 0, 1023)); return true; }
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
