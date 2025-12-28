/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 v3.2.0
 * Firmware v3.2.0 - Remote Device Management (Reset, WiFi Update, OTA)
 * ================================================================================
 *
 * FEATURES v3.2.0 (NEW):
 * - REMOTE RESET: Restart device from webapp
 * - REMOTE WIFI UPDATE: Change WiFi credentials from webapp (with fallback)
 * - OTA FIRMWARE UPDATE: Update firmware over-the-air from webapp
 * - WiFi Fallback: If new WiFi fails, automatically restore previous credentials
 * - Command acknowledgement: Device reports command execution status
 *
 * FEATURES v3.1.x:
 * - Cloud-based sensor configuration (webapp as single source of truth)
 * - Automatic config sync via heartbeat (max 60s propagation)
 * - Config version tracking for change detection
 * - 2-level reset button (WiFi reset 3s, Full reset 10s)
 *
 * ================================================================================
 * REMOTE COMMANDS (from webapp)
 * ================================================================================
 *
 * 1. RESET: Device restarts immediately
 *    - Useful for troubleshooting connection issues
 *
 * 2. WIFI UPDATE: Update WiFi credentials
 *    - Device backs up current credentials
 *    - Attempts connection to new network (30s timeout)
 *    - If fails, automatically restores backup and reconnects
 *
 * 3. FIRMWARE UPDATE (OTA):
 *    - Device downloads new firmware from Supabase Storage
 *    - Installs and restarts automatically
 *    - LED blinks during update
 *
 * ================================================================================
 * RESET BUTTON SYSTEM (unchanged from v3.1.x)
 * ================================================================================
 *
 * LEVEL 1 - WiFi Reset (3-10 seconds):
 * - Hold FLASH button (GPIO0)
 * - After 3s LED blinks FAST (100ms)
 * - Release before 10s
 * - ESP restarts in AP mode "Serra-Setup"
 *
 * LEVEL 2 - Full Reset (10+ seconds):
 * - Hold FLASH button (GPIO0)
 * - After 10s LED blinks SLOW (300ms)
 * - Release after 10s
 * - ESP erases: WiFi + Config + Device key
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
#include "commands.h"

WiFiManager wifiManager;
WiFiManagerParameter* param_composite_id;

#define RESET_BUTTON_PIN 0  // GPIO 0 (FLASH button)
#define LED_PIN LED_BUILTIN  // D4 on most ESP8266 boards
#define WIFI_RESET_DURATION 3000   // 3 seconds = WiFi reset
#define FULL_RESET_DURATION 10000  // 10 seconds = full reset

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
  Serial.println("ESP8266 Greenhouse v3.2.0");
  Serial.println("Remote Device Management (Reset, WiFi Update, OTA)");
  Serial.println("================================================================================\n");

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // LED off initially (active LOW on ESP8266)

  Serial.println("Reset button initialized (GPIO0/FLASH)");
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

      // Send first heartbeat and check for commands
      Serial.println("Sending first heartbeat...");
      HeartbeatResponse hbResponse = sendHeartbeat();

      if (hbResponse.success) {
        // Check for config updates
        if (hbResponse.config_version > deviceConfig.config_version) {
          Serial.println("Config update detected on first heartbeat, fetching...");
          if (fetchAndApplyCloudConfig()) {
            deviceConfig.config_version = hbResponse.config_version;
            saveConfig();
            Serial.println("Config synced from cloud");
            initializeSensors();
          }
        }

        // Check for pending commands
        if (hbResponse.command.valid) {
          Serial.println("Pending command found on first heartbeat!");
          executeCommand(hbResponse.command);
        }
      }

      lastHeartbeat = millis();
      return;
    }
  }

  // If we reach here, we need to setup via portal
  Serial.println("Starting configuration portal...");
  Serial.println("Portal mode - reset button IS active");

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

  // Set non-blocking mode so loop() continues running
  wifiManager.setConfigPortalBlocking(false);

  // Start portal
  if (wifiManager.autoConnect("Serra-Setup")) {
    Serial.println("Portal: WiFi configured!");
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
    // Send heartbeat and check for commands/config updates
    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
      HeartbeatResponse hbResponse = sendHeartbeat();

      Serial.printf("Local config_version: %d, Cloud config_version: %d\n",
                    deviceConfig.config_version, hbResponse.config_version);

      if (hbResponse.success) {
        // Check for config updates
        if (hbResponse.config_version > deviceConfig.config_version) {
          Serial.println("Config update detected! Fetching new config...");
          if (fetchAndApplyCloudConfig()) {
            deviceConfig.config_version = hbResponse.config_version;
            saveConfig();
            Serial.println("Config synced from cloud");
            initializeSensors();
          }
        }

        // Check for pending commands
        if (hbResponse.command.valid) {
          Serial.println("Pending command received!");
          executeCommand(hbResponse.command);
          // Note: some commands (reset, wifi_update, ota) will restart device
        }
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
      Serial.println("\nRESET BUTTON PRESSED (GPIO0 = LOW)");
      Serial.println("  Hold for 3s = WiFi reset");
      Serial.println("  Hold for 10s = Full reset");
    }

    unsigned long pressDuration = millis() - buttonPressStart;

    // Print duration every second
    static unsigned long lastPrint = 0;
    if (pressDuration - lastPrint >= 1000) {
      Serial.printf("Holding: %.1f seconds\n", pressDuration / 1000.0);
      lastPrint = pressDuration;
    }

    // LED blinking feedback (ESP8266 LED is ACTIVE LOW: LOW = ON, HIGH = OFF)

    // Fast blink after 3 seconds (WiFi reset ready)
    if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, ((millis() / 100) % 2) ? HIGH : LOW);

      if (pressDuration >= WIFI_RESET_DURATION && pressDuration < WIFI_RESET_DURATION + 200) {
        Serial.println("WiFi reset ready! Release now for WiFi reset only");
      }
    }

    // Slow blink after 10 seconds (Full reset ready)
    if (pressDuration >= FULL_RESET_DURATION) {
      digitalWrite(LED_PIN, ((millis() / 300) % 2) ? HIGH : LOW);

      if (pressDuration >= FULL_RESET_DURATION && pressDuration < FULL_RESET_DURATION + 200) {
        Serial.println("FULL RESET ready! Release now or keep holding");
      }
    }
  } else {
    // Button released
    if (buttonPressed) {
      unsigned long pressDuration = millis() - buttonPressStart;
      Serial.printf("\nButton RELEASED after %.1f seconds\n", pressDuration / 1000.0);

      // FULL RESET (10+ seconds)
      if (pressDuration >= FULL_RESET_DURATION) {
        Serial.println("\nFULL RESET ACTIVATED!");
        Serial.println("Erasing:");
        Serial.println("  - WiFi credentials");
        Serial.println("  - Device configuration");
        Serial.println("  - Device key");
        Serial.println("  - Sensor settings");

        // Ultra-fast blink confirmation
        for (int i = 0; i < 30; i++) {
          digitalWrite(LED_PIN, (i % 2) ? HIGH : LOW);
          delay(30);
        }

        // Erase EEPROM configuration
        clearConfig();

        // Reset WiFi credentials
        wifiManager.resetSettings();

        Serial.println("\nAll settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      }
      // WIFI RESET ONLY (3-10 seconds)
      else if (pressDuration >= WIFI_RESET_DURATION && pressDuration < FULL_RESET_DURATION) {
        Serial.println("\nWiFi RESET ACTIVATED!");
        Serial.println("Erasing:");
        Serial.println("  - WiFi credentials ONLY");
        Serial.println("Keeping:");
        Serial.println("  - Device configuration");
        Serial.println("  - Sensor settings");

        // Fast blink confirmation
        for (int i = 0; i < 20; i++) {
          digitalWrite(LED_PIN, (i % 2) ? HIGH : LOW);
          delay(50);
        }

        // Reset WiFi only, keep device config
        wifiManager.resetSettings();

        Serial.println("\nWiFi settings erased - rebooting...");
        delay(1000);
        ESP.restart();
      }
      // SHORT PRESS (<3 seconds) - ignore
      else {
        Serial.printf("Short press (%.1f seconds) - no action taken\n", pressDuration / 1000.0);
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
