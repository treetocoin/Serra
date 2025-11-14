/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 v3.1.1
 * Firmware v3.1.1 - Cloud-Based Configuration Sync + Fixed Reset Button
 * ================================================================================
 *
 * FEATURES v3.1.1 (NEW):
 * - 🔧 FIXED: Reset button now works in both normal and portal mode
 * - 🔧 FIXED: LED blinking feedback (active LOW logic for ESP8266)
 * - 🔧 FIXED: Button check during WiFiManager portal (non-blocking mode)
 * - 🔧 Added debug output showing button state and duration
 *
 * FEATURES v3.1.0:
 * - ⭐ Cloud-based sensor configuration (webapp as single source of truth)
 * - ⭐ Automatic config sync via heartbeat (max 60s propagation)
 * - ⭐ Config version tracking for change detection
 * - ⭐ Read-only ESP8266 web portal (config managed from webapp)
 * - ⭐ Automatic sensor reinitialization on config changes
 *
 * FEATURES v3.0:
 * - Composite Device IDs (PROJ1-ESP3)
 * - Auto-generated device keys (ESP generates, backend stores hash)
 * - 2-level reset button (WiFi reset 3s, Full reset 10s)
 * - DHT22/DHT11 support
 * - Edge Function heartbeat
 *
 * ================================================================================
 * RESET BUTTON SYSTEM
 * ================================================================================
 *
 * LIVELLO 1 - Reset WiFi (3-10 secondi):
 * - Tieni premuto pulsante FLASH (GPIO0)
 * - Dopo 3 secondi LED lampeggia VELOCE (ogni 100ms)
 * - Rilascia pulsante PRIMA dei 10 secondi
 * - ESP si riavvia in modalità AP "Serra-Setup"
 * - Credenziali WiFi cancellate
 * - Configurazione sensori CONSERVATA
 *
 * LIVELLO 2 - Reset Completo (10+ secondi):
 * - Tieni premuto pulsante FLASH (GPIO0)
 * - Dopo 3 secondi LED lampeggia veloce
 * - Dopo 10 secondi LED lampeggia LENTO (ogni 300ms)
 * - Rilascia pulsante DOPO 10 secondi (o continua a tenere)
 * - ESP cancella: WiFi + Configurazione sensori + Device key
 * - RESET TOTALE
 *
 * Indicatori LED:
 * - 🟢 LED fisso = Connesso WiFi
 * - 🟡 Lampeggio veloce (100ms) = WiFi reset ready
 * - 🔴 Lampeggio lento (300ms) = Full reset ready
 *
 * ================================================================================
 * SETUP INIZIALE
 * ================================================================================
 *
 * 1. Registra dispositivo dalla webapp:
 *    - Nome: es. "Serra Principale"
 *    - Numero: 1-20 (es. 3)
 *    - Ottieni: PROJ1-ESP3
 *
 * 2. Carica questo firmware via USB
 * 3. ESP crea AP "Serra-Setup"
 * 4. Connettiti a "Serra-Setup"
 * 5. Inserisci:
 *    - WiFi SSID e password
 *    - Device ID: PROJ1-ESP3
 * 6. ESP genera automaticamente la device key (64 char hex)
 * 7. Salva e riavvia
 *
 * 8. ESP si connette al WiFi
 * 9. Invia heartbeat → Backend salva hash della device key
 * 10. Configura sensori dalla WEBAPP (non più da http://<ip>/config)
 * 11. Entro 60 secondi, ESP scarica configurazione da cloud
 * 12. Sensori si inizializzano automaticamente
 *
 * ================================================================================
 * CONFIGURATION v3.1.0 - UNIFIED CLOUD CONFIG
 * ================================================================================
 *
 * La configurazione dei sensori è ora gestita ESCLUSIVAMENTE dalla webapp.
 * Il portale web ESP8266 (http://<ip>/config) mostra solo la configurazione
 * corrente in modalità READ-ONLY.
 *
 * Flusso di configurazione:
 * 1. Utente configura sensori nella webapp (/devices/{id})
 * 2. Database incrementa automaticamente config_version
 * 3. Heartbeat ESP8266 rileva cambio versione (ogni 60s)
 * 4. ESP scarica nuova config da cloud
 * 5. Applica config a EEPROM e reinizializza sensori
 *
 * Port ID supportati: "GPIO4", "D1", "A0", etc.
 * Mapping automatico per Wemos D1 Mini (D1→GPIO5, D2→GPIO4, etc.)
 *
 * ================================================================================
 */

#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include "config.h"
#include "portal.h"
#include "heartbeat.h"
#include "webserver.h"
#include "sensors.h"

WiFiManager wifiManager;
WiFiManagerParameter* param_composite_id;

#define RESET_BUTTON_PIN 0  // GPIO 0 (FLASH button)
#define LED_PIN LED_BUILTIN  // D4 on most ESP8266 boards
#define WIFI_RESET_DURATION 3000   // 3 secondi = reset WiFi
#define FULL_RESET_DURATION 10000  // 10 secondi = reset completo

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 60000; // 60 seconds

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 30000; // 30 seconds

unsigned long buttonPressStart = 0;
bool buttonPressed = false;

// Forward declaration
void checkResetButton();

void setup() {
  Serial.begin(115200);
  Serial.println("\n================================================================================");
  Serial.println("ESP8266 Greenhouse v3.1.1");
  Serial.println("Cloud-Based Configuration Sync + Fixed Reset Button");
  Serial.println("================================================================================\n");

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // LED off initially (active LOW on ESP8266)

  Serial.println("✓ Reset button initialized (GPIO0/FLASH)");
  Serial.println("  Hold 3-10s = WiFi reset");
  Serial.println("  Hold 10+s = Full reset\n");

  // Seed random for device key generation
  randomSeed(analogRead(0) ^ micros());

  // Load config
  loadConfig();

  // Check if we have valid config
  if (validateConfig()) {
    Serial.println("Valid configuration found");

    // Ensure device key exists
    if (strlen(deviceConfig.device_key) == 0) {
      Serial.println("No device key found, generating...");
      generateDeviceKey();
      saveConfig();
    }

    // Try to connect to WiFi
    WiFi.begin(deviceConfig.wifi_ssid, deviceConfig.wifi_password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      // Check reset button even during WiFi connection
      checkResetButton();
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi connected!");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());

      digitalWrite(LED_PIN, LOW); // LED on = connected (active LOW)

      // Setup web server
      setupWebServer();

      // Initialize sensors
      initializeSensors();

      // Send first heartbeat immediately and check for config updates
      Serial.println("Sending first heartbeat...");
      HeartbeatResponse hbResponse = sendHeartbeat();
      if (hbResponse.success && hbResponse.config_version > deviceConfig.config_version) {
        Serial.println("⚡ Config update detected on first heartbeat, fetching...");
        if (fetchAndApplyCloudConfig()) {
          deviceConfig.config_version = hbResponse.config_version;
          saveConfig();
          Serial.println("✓ Config synced from cloud");
          // Reinitialize sensors with new config
          initializeSensors();
        }
      }
      lastHeartbeat = millis();

      return;
    }
  }

  // If we reach here, we need to setup via portal
  Serial.println("Starting configuration portal...");
  Serial.println("⚠️  Portal mode - reset button IS active");

  // Setup portal parameters
  param_composite_id = new WiFiManagerParameter(
    "composite_id",
    "Device ID (from webapp)",
    "",
    15,
    " placeholder='PROJ1-ESP1' onchange='this.value=this.value.toUpperCase()'"
  );

  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.addParameter(param_composite_id);

  // IMPORTANT: Set non-blocking mode so loop() continues running
  wifiManager.setConfigPortalBlocking(false);

  // Start portal
  if (wifiManager.autoConnect("Serra-Setup")) {
    Serial.println("✓ Portal: WiFi configured!");
    delay(1000);
    ESP.restart();
  }
}

void loop() {
  // Process WiFiManager (needed for non-blocking portal mode)
  wifiManager.process();

  // Handle web server requests (only if WiFi connected)
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }

  // ALWAYS check reset button (works in both normal and portal mode)
  checkResetButton();

  unsigned long now = millis();

  // Only do heartbeat and sensor reads if WiFi is connected
  if (WiFi.status() == WL_CONNECTED) {
    // Send heartbeat and check for config updates
    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
      HeartbeatResponse hbResponse = sendHeartbeat();

      // Debug: Show version comparison
      Serial.printf("Local config_version: %d, Cloud config_version: %d\n",
                    deviceConfig.config_version, hbResponse.config_version);

      // Check if cloud config has been updated
      if (hbResponse.success && hbResponse.config_version > deviceConfig.config_version) {
        Serial.println("⚡ Config update detected! Fetching new config...");
        if (fetchAndApplyCloudConfig()) {
          deviceConfig.config_version = hbResponse.config_version;
          saveConfig();
          Serial.println("✓ Config synced from cloud");
          // Reinitialize sensors with new config
          initializeSensors();
        }
      } else if (hbResponse.success) {
        Serial.println("Config versions match, no update needed");
      }

      lastHeartbeat = now;
    }

    // Read and send sensor data
    if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
      readAndSendSensorData();
      lastSensorRead = now;
    }
  }

  delay(10); // Small delay to prevent watchdog issues
}

// ========================================
// 2-LEVEL RESET BUTTON
// ========================================

void checkResetButton() {
  int buttonState = digitalRead(RESET_BUTTON_PIN);

  if (buttonState == LOW) {  // Button pressed (active LOW)
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressStart = millis();
      Serial.println("\n🔘 RESET BUTTON PRESSED (GPIO0 = LOW)");
      Serial.println("  Hold for 3s = WiFi reset");
      Serial.println("  Hold for 10s = Full reset");
    }

    unsigned long pressDuration = millis() - buttonPressStart;

    // Print duration every second
    static unsigned long lastPrint = 0;
    if (pressDuration - lastPrint >= 1000) {
      Serial.printf("⏱️  Holding: %.1f seconds\n", pressDuration / 1000.0);
      lastPrint = pressDuration;
    }

    // LED blinking feedback (ESP8266 LED is ACTIVE LOW: LOW = ON, HIGH = OFF)

    // Fast blink after 3 seconds (WiFi reset ready)
    if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
      // Blink every 100ms: ((millis() / 100) % 2) gives 0 or 1
      // When 0: digitalWrite LOW (LED ON), when 1: digitalWrite HIGH (LED OFF)
      digitalWrite(LED_PIN, ((millis() / 100) % 2) ? HIGH : LOW);

      if (pressDuration >= WIFI_RESET_DURATION && pressDuration < WIFI_RESET_DURATION + 200) {
        Serial.println("🟡 WiFi reset ready! Release now for WiFi reset only");
      }
    }

    // Slow blink after 10 seconds (Full reset ready)
    if (pressDuration >= FULL_RESET_DURATION) {
      // Blink every 300ms
      digitalWrite(LED_PIN, ((millis() / 300) % 2) ? HIGH : LOW);

      if (pressDuration >= FULL_RESET_DURATION && pressDuration < FULL_RESET_DURATION + 200) {
        Serial.println("🔴 FULL RESET ready! Release now or keep holding");
      }
    }
  } else {
    // Button released
    if (buttonPressed) {
      unsigned long pressDuration = millis() - buttonPressStart;
      Serial.printf("\n🔘 Button RELEASED after %.1f seconds\n", pressDuration / 1000.0);

      // FULL RESET (10+ seconds)
      if (pressDuration >= FULL_RESET_DURATION) {
        Serial.println("\n🔥 FULL RESET ACTIVATED!");
        Serial.println("Erasing:");
        Serial.println("  - WiFi credentials");
        Serial.println("  - Device configuration");
        Serial.println("  - Device key");
        Serial.println("  - Sensor settings");

        // Ultra-fast blink confirmation (active LOW)
        for (int i = 0; i < 30; i++) {
          digitalWrite(LED_PIN, (i % 2) ? HIGH : LOW);
          delay(30);
        }

        // Erase EEPROM configuration
        clearConfig();

        // Reset WiFi credentials
        wifiManager.resetSettings();

        Serial.println("\n✓ All settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      }
      // WIFI RESET ONLY (3-10 seconds)
      else if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
        Serial.println("\n🔄 WiFi RESET ACTIVATED!");
        Serial.println("Erasing:");
        Serial.println("  - WiFi credentials ONLY");
        Serial.println("Keeping:");
        Serial.println("  ✓ Device configuration");
        Serial.println("  ✓ Sensor settings");

        // Fast blink confirmation (active LOW)
        for (int i = 0; i < 20; i++) {
          digitalWrite(LED_PIN, (i % 2) ? HIGH : LOW);
          delay(50);
        }

        // Reset WiFi only, keep device config
        wifiManager.resetSettings();

        Serial.println("\n✓ WiFi settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      }
      // SHORT PRESS (<3 seconds) - ignore
      else {
        Serial.printf("⚪ Short press (%.1f seconds) - no action taken\n", pressDuration / 1000.0);
      }

      buttonPressed = false;

      // Restore normal LED state
      if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(LED_PIN, LOW); // LED on when connected (active LOW)
      } else {
        digitalWrite(LED_PIN, HIGH); // LED off when disconnected
      }
    }
  }
}
