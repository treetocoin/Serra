/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 v3.1.0
 * Firmware v3.1.0 - Cloud-Based Configuration Sync
 * ================================================================================
 *
 * FEATURES v3.1.0 (NEW):
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
#define LED_PIN LED_BUILTIN
#define WIFI_RESET_DURATION 3000   // 3 secondi = reset WiFi
#define FULL_RESET_DURATION 10000  // 10 secondi = reset completo

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 60000; // 60 seconds

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 30000; // 30 seconds

unsigned long buttonPressStart = 0;
bool buttonPressed = false;

void setup() {
  Serial.begin(115200);
  Serial.println("\n================================================================================");
  Serial.println("ESP8266 Greenhouse v3.1.0");
  Serial.println("Cloud-Based Configuration Sync");
  Serial.println("================================================================================\n");

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // LED off initially

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
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi connected!");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());

      digitalWrite(LED_PIN, LOW); // LED on = connected

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

  // Start portal
  wifiManager.autoConnect("Serra-Setup");
}

void loop() {
  // Handle web server requests
  server.handleClient();

  // Check reset button
  checkResetButton();

  unsigned long now = millis();

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

  delay(100);
}

// ========================================
// 2-LEVEL RESET BUTTON
// ========================================

void checkResetButton() {
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressStart = millis();
      Serial.println("🔘 Reset button pressed...");
    }

    unsigned long pressDuration = millis() - buttonPressStart;

    // LED lampeggia veloce dopo 3 secondi (WiFi reset ready)
    if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, (millis() / 100) % 2);  // Fast blink (100ms)
    }

    // LED lampeggia lento dopo 10 secondi (Full reset ready)
    if (pressDuration >= FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, (millis() / 300) % 2);  // Slow blink (300ms)
    }
  } else {
    // Button released
    if (buttonPressed) {
      unsigned long pressDuration = millis() - buttonPressStart;

      // FULL RESET (10+ seconds)
      if (pressDuration >= FULL_RESET_DURATION) {
        Serial.println("\n🔥 FULL RESET - WiFi + Configuration + Device Key!");

        // Ultra-fast blink confirmation
        for (int i = 0; i < 30; i++) {
          digitalWrite(LED_PIN, !digitalRead(LED_PIN));
          delay(30);
        }

        // Erase EEPROM configuration
        clearConfig();

        // Reset WiFi credentials
        wifiManager.resetSettings();

        Serial.println("✓ All settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      }
      // WIFI RESET ONLY (3-10 seconds)
      else if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
        Serial.println("\n🔄 WiFi RESET ONLY!");

        // Fast blink confirmation
        for (int i = 0; i < 20; i++) {
          digitalWrite(LED_PIN, !digitalRead(LED_PIN));
          delay(50);
        }

        // Reset WiFi only, keep device config
        wifiManager.resetSettings();

        Serial.println("✓ WiFi settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      }
      // SHORT PRESS (<3 seconds) - ignore
      else {
        Serial.println("Button released (no action)");
      }

      buttonPressed = false;
    }
  }
}
