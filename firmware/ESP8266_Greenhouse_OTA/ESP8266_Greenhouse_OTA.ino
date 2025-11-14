/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 NodeMCU with OTA Support
 * Firmware v1.1 - OTA Enabled
 * ================================================================================
 *
 * FUNZIONALITÀ:
 * - Aggiornamenti firmware Over-The-Air (OTA)
 * - Interface web per upload firmware via browser
 * - Gestione sensori DHT22 (temperatura/umidità)
 * - Sensore umidità terreno (analogico)
 * - Controllo attuatori (pompa, ventola con PWM)
 * - Heartbeat automatico ogni 30 secondi
 * - Auto-discovery sensori tramite webapp
 * - Polling comandi da database Supabase
 *
 * ================================================================================
 * CONFIGURAZIONE OTA
 * ================================================================================
 *
 * Hostname:    serra-esp8266.local
 * OTA Port:    8266
 * Web Port:    80
 * Username:    admin
 * Password:    serra2025
 *
 * ================================================================================
 * PRIMO UPLOAD (via USB - OBBLIGATORIO)
 * ================================================================================
 *
 * 1. Collega ESP8266 via USB al computer
 * 2. Arduino IDE → Tools → Board → NodeMCU 1.0 (ESP-12E Module)
 * 3. Arduino IDE → Tools → Port → Seleziona la porta COM/USB
 * 4. Modifica le credenziali WiFi (righe 44-45):
 *    - const char* WIFI_SSID = "TUO_WIFI";
 *    - const char* WIFI_PASSWORD = "TUA_PASSWORD";
 * 5. Click Upload
 * 6. Apri Serial Monitor (115200 baud) e annota l'indirizzo IP
 *
 * ================================================================================
 * METODO 1: AGGIORNAMENTO OTA VIA ARDUINO IDE
 * ================================================================================
 *
 * Dopo il primo upload via USB, i successivi aggiornamenti possono essere fatti
 * via WiFi senza collegare il cavo USB:
 *
 * 1. Assicurati che ESP8266 sia acceso e connesso al WiFi
 * 2. Arduino IDE → Tools → Port
 * 3. Vedrai apparire: "serra-esp8266 at <indirizzo-ip>"
 * 4. Seleziona questa porta di rete
 * 5. Modifica il codice come necessario
 * 6. Click Upload
 * 7. Inserisci password OTA quando richiesta: serra2025
 * 8. Aspetta il completamento dell'upload (vedi progresso nel Serial Monitor)
 *
 * NOTE:
 * - ESP8266 si riavvierà automaticamente dopo l'upload
 * - Durante l'upload, il dispositivo non risponderà ai comandi
 * - L'upload OTA richiede circa 30-60 secondi
 *
 * ================================================================================
 * METODO 2: AGGIORNAMENTO OTA VIA WEB BROWSER
 * ================================================================================
 *
 * Puoi aggiornare il firmware usando un browser web, utile per aggiornamenti
 * da computer che non hanno Arduino IDE installato:
 *
 * 1. Trova l'indirizzo IP dell'ESP8266:
 *    - Guarda il Serial Monitor dopo il boot
 *    - Oppure cerca "serra-esp8266.local" sulla tua rete
 *
 * 2. Compila il firmware in un file .bin:
 *    - Arduino IDE → Sketch → Export Compiled Binary
 *    - Aspetta la compilazione
 *    - Il file .bin sarà nella cartella dello sketch
 *
 * 3. Apri il browser e vai a: http://<indirizzo-ip>/update
 *    - Esempio: http://192.168.1.100/update
 *
 * 4. Login con credenziali:
 *    - Username: admin
 *    - Password: serra2025
 *
 * 5. Click "Scegli file" e seleziona il file .bin
 *
 * 6. Click "Update"
 *
 * 7. Aspetta il completamento (vedrai una barra di progresso)
 *
 * 8. Il dispositivo si riavvierà automaticamente
 *
 * WEB INTERFACE - PAGINA INFO:
 * Puoi vedere informazioni sul dispositivo visitando: http://<indirizzo-ip>/
 * Mostra: Device ID, Firmware version, IP, WiFi signal, memoria, uptime
 *
 * ================================================================================
 * LIBRERIE NECESSARIE
 * ================================================================================
 *
 * Installa tramite Arduino Library Manager (Sketch → Include Library → Manage Libraries):
 *
 * - ESP8266WiFi (built-in con ESP8266 board support)
 * - ESP8266HTTPClient (built-in)
 * - WiFiClientSecure (built-in)
 * - ArduinoOTA (built-in)
 * - ESP8266WebServer (built-in)
 * - ESP8266HTTPUpdateServer (built-in)
 * - ArduinoJson by Benoit Blanchon (v6.x) - INSTALLARE MANUALMENTE
 * - DHT sensor library by Adafruit - INSTALLARE MANUALMENTE
 * - Adafruit Unified Sensor - INSTALLARE MANUALMENTE (dipendenza DHT)
 *
 * ================================================================================
 * HARDWARE REQUIREMENTS
 * ================================================================================
 *
 * OBBLIGATORIO:
 * - ESP8266 NodeMCU v3 (CH340C driver)
 *
 * OPZIONALE:
 * - DHT22 Sensore temperatura/umidità #1 → Pin D2 (GPIO4)
 * - DHT22 Sensore temperatura/umidità #2 → Pin D1 (GPIO5)
 * - Sensore umidità terreno (analogico) → Pin A0
 * - Modulo relè per pompa → Pin D5 (GPIO14)
 * - Modulo relè per ventola (PWM) → Pin D6 (GPIO12)
 *
 * ALIMENTAZIONE:
 * - 5V via USB (durante sviluppo)
 * - 5V esterno tramite pin VIN (in produzione)
 * - Consumo: ~80mA idle, ~170mA con WiFi attivo
 *
 * ================================================================================
 * TROUBLESHOOTING OTA
 * ================================================================================
 *
 * PROBLEMA: Non vedo la porta di rete in Arduino IDE
 * SOLUZIONE:
 * - Verifica che ESP8266 sia connesso al WiFi (controlla Serial Monitor)
 * - Assicurati che computer ed ESP8266 siano sulla stessa rete WiFi
 * - Prova a pingare l'IP: ping <ip-esp8266>
 * - Riavvia Arduino IDE
 * - Su Windows: disabilita temporaneamente il firewall
 *
 * PROBLEMA: Upload OTA fallisce con "Authentication failed"
 * SOLUZIONE:
 * - Verifica password OTA: serra2025
 * - Ricompila e ricarica via USB se hai cambiato la password
 *
 * PROBLEMA: Upload OTA si blocca al 0%
 * SOLUZIONE:
 * - ESP8266 potrebbe essere occupato, aspetta 1-2 minuti
 * - Riavvia ESP8266 e riprova
 * - Verifica che la memoria flash sia sufficiente (almeno 50% libera)
 *
 * PROBLEMA: Device si riavvia continuamente dopo OTA update
 * SOLUZIONE:
 * - Il nuovo firmware potrebbe avere errori
 * - Ricarica il firmware precedente via USB
 * - Controlla Serial Monitor per messaggi di errore
 *
 * PROBLEMA: Web update ritorna errore 401
 * SOLUZIONE:
 * - Username: admin (minuscolo)
 * - Password: serra2025
 * - Svuota cache del browser
 *
 * ================================================================================
 * SICUREZZA
 * ================================================================================
 *
 * ⚠️ IMPORTANTE PER PRODUZIONE:
 *
 * 1. Cambia la password OTA (riga 49):
 *    const char* OTA_PASSWORD = "TUA_PASSWORD_SICURA";
 *
 * 2. Non esporre mai ESP8266 direttamente su internet
 *    - Usa solo su rete locale privata
 *    - Oppure configura VPN per accesso remoto
 *
 * 3. Considera di disabilitare OTA dopo deployment finale:
 *    - Commenta setupOTA() e setupWebOTA() nella funzione setup()
 *    - Rimuovi ArduinoOTA.handle() e httpServer.handleClient() dal loop()
 *
 * ================================================================================
 * SUPPORTO E DOCUMENTAZIONE
 * ================================================================================
 *
 * Repository: https://github.com/treetocoin/Serra
 * Documentazione Supabase: https://supabase.com/docs
 * ESP8266 Arduino Core: https://arduino-esp8266.readthedocs.io/
 * ArduinoOTA: https://arduino-esp8266.readthedocs.io/en/latest/ota_updates/readme.html
 *
 * ================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ArduinoOTA.h>          // ← NEW: OTA updates
#include <ESP8266WebServer.h>    // ← NEW: Web interface for OTA
#include <ESP8266HTTPUpdateServer.h> // ← NEW: HTTP update server

// ========================================
// PIN DEFINITIONS
// ========================================
#ifndef D0
  #define D0 16
  #define D1 5
  #define D2 4
  #define D3 0
  #define D4 2
  #define D5 14
  #define D6 12
  #define D7 13
  #define D8 15
#endif

// ========================================
// CONFIGURATION
// ========================================

// WiFi credentials
const char* WIFI_SSID = "TP-Link_D61B";
const char* WIFI_PASSWORD = "61248080";

// OTA Configuration
const char* OTA_HOSTNAME = "serra-esp8266";  // Nome del dispositivo in rete
const char* OTA_PASSWORD = "serra2025";      // Password per aggiornamenti OTA

// Supabase configuration
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";
const char* API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE";
const char* DEVICE_ID = "0f24ada1-b6f6-45a2-aa0e-0e417daae659";

// Hardware pins
#define DHT_PIN_1 D2
#define DHT_PIN_2 D1
#define SOIL_PIN A0
#define PUMP_PIN D5
#define FAN_PIN D6

// Sensors
#define DHT_TYPE DHT22
DHT dht1(DHT_PIN_1, DHT_TYPE);
DHT dht2(DHT_PIN_2, DHT_TYPE);
#define ENABLE_DHT2 true

// Clients
WiFiClientSecure client;
ESP8266WebServer httpServer(80);           // ← NEW: Web server on port 80
ESP8266HTTPUpdateServer httpUpdater;       // ← NEW: Update server

// Timing
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long SENSOR_INTERVAL = 30000;
const unsigned long COMMAND_INTERVAL = 30000;

unsigned long lastHeartbeatTime = 0;
unsigned long lastSensorDataTime = 0;
unsigned long lastCommandTime = 0;

bool sensorsConfigured = false;

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================");
  Serial.println("Greenhouse System with OTA");
  Serial.println("Firmware v1.1 - OTA Enabled");
  Serial.println("=================================\n");

  client.setInsecure();

  // Initialize sensors
  dht1.begin();
  if (ENABLE_DHT2) dht2.begin();

  // Initialize actuators
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);

  // Connect to WiFi
  connectWiFi();

  // ========================================
  // SETUP OTA - ArduinoOTA
  // ========================================
  setupOTA();

  // ========================================
  // SETUP WEB OTA UPDATE SERVER
  // ========================================
  setupWebOTA();

  // Check sensor configuration
  checkSensorConfiguration();

  Serial.println("\n✓ Setup complete - OTA enabled");
  Serial.printf("Device IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("OTA Hostname: %s.local\n", OTA_HOSTNAME);
  Serial.printf("Web Update: http://%s/update\n", WiFi.localIP().toString().c_str());
  Serial.println("=================================\n");
}

// ========================================
// OTA SETUP FUNCTIONS
// ========================================

void setupOTA() {
  // Set OTA hostname
  ArduinoOTA.setHostname(OTA_HOSTNAME);
  
  // Set OTA password (optional but recommended)
  ArduinoOTA.setPassword(OTA_PASSWORD);

  // OTA port (default 8266)
  ArduinoOTA.setPort(8266);

  // Callbacks for monitoring
  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_FS
      type = "filesystem";
    }
    Serial.println("🔄 OTA Update Start: " + type);
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\n✓ OTA Update Complete!");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
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
  Serial.println("✓ ArduinoOTA initialized");
}

void setupWebOTA() {
  // Setup HTTP Update Server with password
  httpUpdater.setup(&httpServer, "/update", "admin", OTA_PASSWORD);
  
  // Root page - Device info
  httpServer.on("/", HTTP_GET, []() {
    String html = "<html><head><title>Serra ESP8266</title></head><body>";
    html += "<h1>Greenhouse Management System</h1>";
    html += "<p><b>Device ID:</b> " + String(DEVICE_ID) + "</p>";
    html += "<p><b>Firmware:</b> v1.1 - OTA Enabled</p>";
    html += "<p><b>IP Address:</b> " + WiFi.localIP().toString() + "</p>";
    html += "<p><b>WiFi Signal:</b> " + String(WiFi.RSSI()) + " dBm</p>";
    html += "<p><b>Free Heap:</b> " + String(ESP.getFreeHeap()) + " bytes</p>";
    html += "<p><b>Uptime:</b> " + String(millis() / 1000) + " seconds</p>";
    html += "<hr><p><a href='/update'>Firmware Update</a></p>";
    html += "</body></html>";
    httpServer.send(200, "text/html", html);
  });

  httpServer.begin();
  Serial.println("✓ Web OTA Server started");
  Serial.printf("  Access: http://%s/update\n", WiFi.localIP().toString().c_str());
  Serial.println("  Username: admin");
  Serial.println("  Password: serra2025");
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  // IMPORTANT: Handle OTA requests
  ArduinoOTA.handle();
  httpServer.handleClient();

  // WiFi check
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected - reconnecting...");
    connectWiFi();
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
// WiFi CONNECTION
// ========================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi connection failed!");
  }
}

void checkSensorConfiguration() {
  Serial.println("\nChecking sensor configuration...");
  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/check_device_sensors");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(256);
    if (!deserializeJson(doc, response) && doc["has_sensors"].as<bool>()) {
      sensorsConfigured = true;
      Serial.println("✓ Sensors configured");
    }
  }
  http.end();
}

// ========================================
// SUPABASE FUNCTIONS (unchanged)
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
    Serial.println("✓ Heartbeat sent");
  } else {
    Serial.printf("✗ Heartbeat error: %d\n", httpCode);
  }
  http.end();
}

void sendSensorData() {
  float temperature1 = dht1.readTemperature();
  float humidity1 = dht1.readHumidity();

  if (isnan(temperature1) || isnan(humidity1)) {
    temperature1 = 22.5;
    humidity1 = 55.0;
  }

  Serial.printf("T1: %.1f°C, H1: %.1f%%\n", temperature1, humidity1);

  float temperature2 = 0, humidity2 = 0;
  bool hasDHT2 = false;
  if (ENABLE_DHT2) {
    temperature2 = dht2.readTemperature();
    humidity2 = dht2.readHumidity();
    if (!isnan(temperature2) && !isnan(humidity2)) {
      hasDHT2 = true;
      Serial.printf("T2: %.1f°C, H2: %.1f%%\n", temperature2, humidity2);
    }
  }

  int soilRaw = analogRead(SOIL_PIN);
  float soilMoisture = map(soilRaw, 0, 1023, 0, 100);

  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/insert_sensor_readings");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\",\"readings\":[";
  payload += "{\"sensor_id\":\"temp_1\",\"value\":" + String(temperature1) + "},";
  payload += "{\"sensor_id\":\"humidity_1\",\"value\":" + String(humidity1) + "},";
  if (hasDHT2) {
    payload += "{\"sensor_id\":\"temp_2\",\"value\":" + String(temperature2) + "},";
    payload += "{\"sensor_id\":\"humidity_2\",\"value\":" + String(humidity2) + "},";
  }
  payload += "{\"sensor_id\":\"soil_1\",\"value\":" + String(soilMoisture) + "}]}";

  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    Serial.println("✓ Sensor data sent");
  }
  http.end();
}

void configureSensorsAndActuators() {
  sendSensorData();
  sensorsConfigured = true;
  Serial.println("✓ Configuration complete");
}

void pollForCommands() {
  HTTPClient http;
  
  // Check configuration
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/check_device_configuration");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(512);
    if (!deserializeJson(doc, response)) {
      bool configRequested = doc["configuration_requested"].as<bool>();
      if (configRequested && !sensorsConfigured) {
        http.end();
        configureSensorsAndActuators();
        
        HTTPClient httpClear;
        httpClear.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/clear_device_configuration");
        httpClear.addHeader("Content-Type", "application/json");
        httpClear.addHeader("apikey", API_KEY);
        httpClear.addHeader("Authorization", "Bearer " + String(API_KEY));
        httpClear.POST("{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}");
        httpClear.end();
        return;
      }
    }
  }
  http.end();

  // Poll commands
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  httpCode = http.POST("{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}");

  if (httpCode == 200) {
    String response = http.getString();
    DynamicJsonDocument doc(2048);
    if (!deserializeJson(doc, response)) {
      JsonArray commands = doc.as<JsonArray>();
      for (JsonObject command : commands) {
        String commandId = command["id"].as<String>();
        String actuatorId = command["actuator_id"].as<String>();
        String commandType = command["command_type"].as<String>();
        int value = command["value"] | 0;

        if (executeCommand(actuatorId, commandType, value)) {
          confirmCommandExecution(commandId);
        }
      }
    }
  }
  http.end();
}

bool executeCommand(String actuatorId, String commandType, int value) {
  if (actuatorId == "pump_1") {
    if (commandType == "turn_on") {
      digitalWrite(PUMP_PIN, HIGH);
      Serial.println("✓ Pump ON");
      return true;
    } else if (commandType == "turn_off") {
      digitalWrite(PUMP_PIN, LOW);
      Serial.println("✓ Pump OFF");
      return true;
    }
  }

  if (actuatorId == "fan_1") {
    if (commandType == "turn_on") {
      digitalWrite(FAN_PIN, HIGH);
      Serial.println("✓ Fan ON");
      return true;
    } else if (commandType == "turn_off") {
      digitalWrite(FAN_PIN, LOW);
      Serial.println("✓ Fan OFF");
      return true;
    } else if (commandType == "set_pwm") {
      int pwmValue = map(value, 0, 255, 0, 1023);
      analogWrite(FAN_PIN, pwmValue);
      Serial.printf("✓ Fan PWM=%d\n", pwmValue);
      return true;
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

  String payload = "{\"command_id\":\"" + commandId + "\"}";
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Command confirmed");
  }
  http.end();
}
