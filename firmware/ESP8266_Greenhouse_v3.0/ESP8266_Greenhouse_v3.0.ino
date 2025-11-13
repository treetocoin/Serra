#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include "config.h"
#include "portal.h"
#include "heartbeat.h"
#include "webserver.h"
#include "sensors.h"

WiFiManager wifiManager;
WiFiManagerParameter* param_composite_id;

#define RESET_BUTTON_PIN 0  // GPIO 0 (FLASH button on most ESP8266 boards)

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 60000; // 60 seconds

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 30000; // 30 seconds

void saveConfigCallback() {
  Serial.println("Saving configuration...");

  // Get composite device ID from webapp
  String compositeId = String(param_composite_id->getValue());
  compositeId.toUpperCase(); // Normalize to uppercase

  // Save to config struct
  strncpy(deviceConfig.composite_device_id, compositeId.c_str(), 14);

  // Auto-generate device key if empty
  if (strlen(deviceConfig.device_key) == 0) {
    Serial.println("Generating new device key...");
    generateDeviceKey();
  }

  // WiFi credentials are saved automatically by WiFiManager
  // We'll retrieve them after connection

  Serial.print("Composite Device ID: ");
  Serial.println(deviceConfig.composite_device_id);
}

void checkResetButton() {
  static unsigned long buttonPressStart = 0;
  const unsigned long LONG_PRESS_DURATION = 5000; // 5 seconds

  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    if (buttonPressStart == 0) {
      buttonPressStart = millis();
    }

    if (millis() - buttonPressStart >= LONG_PRESS_DURATION) {
      Serial.println("Factory reset triggered");
      clearConfig();
      wifiManager.resetSettings();
      Serial.println("Configuration cleared, restarting...");
      delay(1000);
      ESP.restart();
    }
  } else {
    buttonPressStart = 0;
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nESP8266 Greenhouse v3.0");

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);

  // Seed random number generator for device key generation
  randomSeed(analogRead(0) ^ micros());

  // Load existing config
  loadConfig();

  // Check if config is valid
  if (validateConfig()) {
    Serial.println("Valid configuration found");
    Serial.print("Device ID: ");
    Serial.println(deviceConfig.composite_device_id);

    // Ensure device key exists (for devices configured before auto-generation)
    if (strlen(deviceConfig.device_key) == 0) {
      Serial.println("No device key found, generating...");
      generateDeviceKey();
      saveConfig();
    }

    // Try to connect to WiFi
    WiFi.begin(deviceConfig.wifi_ssid, deviceConfig.wifi_password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(1000);
      Serial.print(".");
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi connected!");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());

      // Setup web server
      setupWebServer();

      // Initialize sensors
      initializeSensors();

      // Send first heartbeat immediately
      Serial.println("Sending first heartbeat...");
      sendHeartbeat();
      lastHeartbeat = millis();

      return; // Skip portal, go to main loop
    } else {
      Serial.println("\nWiFi connection failed, starting portal");
    }
  } else {
    Serial.println("No valid configuration, starting portal");
  }

  // Setup WiFiManager parameters
  param_composite_id = new WiFiManagerParameter(
    "composite_id",
    "Device ID (from webapp)",
    "",
    15,
    " placeholder='PROJ1-ESP1' onchange='this.value=this.value.toUpperCase()'"
  );

  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.setBreakAfterConfig(true);

  wifiManager.setCustomHeadElement(
    "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
  );

  wifiManager.addParameter(param_composite_id);

  // Start portal
  if (!wifiManager.autoConnect("Serra-Setup")) {
    Serial.println("Failed to connect, restarting...");
    ESP.restart();
  }

  // If we get here, WiFi is connected
  Serial.println("WiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Save WiFi credentials to config
  strncpy(deviceConfig.wifi_ssid, WiFi.SSID().c_str(), 32);
  strncpy(deviceConfig.wifi_password, WiFi.psk().c_str(), 63);

  // Save full config to EEPROM
  saveConfig();

  // Setup web server
  setupWebServer();

  // Initialize sensors
  initializeSensors();

  // Send first heartbeat immediately
  Serial.println("Sending first heartbeat...");
  sendHeartbeat();

  Serial.println("Configuration saved, restarting...");
  delay(1000);
  ESP.restart();
}

void loop() {
  checkResetButton();

  // Handle web server requests
  server.handleClient();

  unsigned long now = millis();

  // Send heartbeat
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  // Read and send sensor data
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readAndSendSensorData();
    lastSensorRead = now;
  }

  delay(100);
}
