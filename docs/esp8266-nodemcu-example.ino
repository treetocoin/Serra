/**
 * Greenhouse Management System - ESP8266 NodeMCU Example Firmware
 *
 * This Arduino sketch demonstrates how to integrate ESP8266 NodeMCU with the
 * Greenhouse Management System using Supabase REST API.
 *
 * ⚠️ TWO-STEP SETUP PROCESS:
 *    Step 1: Device connects and sends heartbeat → appears ONLINE in webapp
 *    Step 2: Click "Setup Sensors" in webapp → device registers sensors/actuators
 *
 * Features:
 * - WiFi connection with automatic heartbeat
 * - Two-phase setup (heartbeat first, then sensor configuration)
 * - Sensor data transmission (after configuration)
 * - Actuator control via command polling
 * - Command execution confirmation
 *
 * Hardware Requirements:
 * - ESP8266 NodeMCU v3 (CH340C) - REQUIRED
 * - DHT22 Temperature/Humidity Sensor (D2/GPIO4) - OPTIONAL
 * - Soil Moisture Sensor (A0 - analog pin) - OPTIONAL
 * - Relay Module for Pump (D5/GPIO14) - OPTIONAL
 * - Relay Module for Fan (D6/GPIO12) - OPTIONAL
 *
 * Library Dependencies:
 * - ESP8266WiFi (built-in with ESP8266 board support)
 * - ESP8266HTTPClient (built-in with ESP8266 board support)
 * - ArduinoJson by Benoit Blanchon (v6.x)
 * - DHT sensor library by Adafruit (OPTIONAL - only if using real sensors)
 *
 * Installation:
 * 1. Install ESP8266 board support in Arduino IDE
 * 2. Install libraries via Arduino Library Manager
 * 3. Update WiFi credentials below
 * 4. Update Supabase URL and API key
 * 5. Update device ID from web app
 * 6. Select board: Tools -> Board -> NodeMCU 1.0 (ESP-12E Module)
 * 7. Upload to ESP8266
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <DHT.h>  // DHT22 sensor enabled

// ========================================
// SHIM PIN NODEMCU
// ========================================
// Se gli alias D* non sono definiti, mappali ai GPIO reali
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
// CONFIGURATION - UPDATE THESE VALUES
// ========================================

// WiFi credentials
const char* WIFI_SSID = "CasaKresh";
const char* WIFI_PASSWORD = "1234567890";

// Supabase configuration
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";
const char* API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE";
const char* DEVICE_ID = "d01d6a03-63a7-46c7-b02c-94fff390fcee";

// Pin definitions (NodeMCU pin mapping)
#define DHT_PIN_1 D2       // GPIO4 - DHT22 sensor #1
#define DHT_PIN_2 D1       // GPIO5 - DHT22 sensor #2 (optional)
#define SOIL_PIN A0        // A0 - Soil moisture sensor (analog, 0-1023)
#define PUMP_PIN D5        // GPIO14 - Water pump relay
#define FAN_PIN D6         // GPIO12 - Fan relay (PWM capable)

// DHT sensors setup
#define DHT_TYPE DHT22
DHT dht1(DHT_PIN_1, DHT_TYPE);
DHT dht2(DHT_PIN_2, DHT_TYPE);  // Secondo sensore

// Enable/disable second DHT22 sensor
#define ENABLE_DHT2 true  // Set to false if you don't have a second DHT22

// WiFi client for HTTPS
WiFiClientSecure client;

// Timing constants
const unsigned long HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds
const unsigned long SENSOR_INTERVAL = 30000;    // Send sensor data every 30 seconds
const unsigned long COMMAND_INTERVAL = 30000;   // Poll commands every 30 seconds

unsigned long lastHeartbeatTime = 0;
unsigned long lastSensorDataTime = 0;
unsigned long lastCommandTime = 0;

// Configuration mode flag
bool sensorsConfigured = false; // Set to true after sensor setup

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================");
  Serial.println("Greenhouse Management System");
  Serial.println("ESP8266 NodeMCU Firmware v1.0");
  Serial.println("=================================\n");

  // Configure HTTPS client to ignore SSL certificate validation
  // This is needed for ESP8266 to connect to Supabase HTTPS endpoints
  client.setInsecure();

  // Initialize DHT sensors
  dht1.begin();
  if (ENABLE_DHT2) {
    dht2.begin();
    Serial.println("✓ Two DHT22 sensors enabled");
  } else {
    Serial.println("✓ One DHT22 sensor enabled");
  }

  // Initialize actuator pins
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);

  // Connect to WiFi
  connectWiFi();

  // Check if sensors are already configured by checking database
  Serial.println("\nChecking if sensors are already configured...");
  HTTPClient http;
  http.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/check_device_sensors");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Sensor check response: " + response);

    DynamicJsonDocument doc(256);
    DeserializationError error = deserializeJson(doc, response);

    if (!error && doc["has_sensors"].as<bool>()) {
      sensorsConfigured = true;
      Serial.println("✓ Sensors already configured - will send data automatically");
    } else {
      Serial.println("⏳ No sensors found - waiting for configuration from webapp");
    }
  } else {
    Serial.printf("✗ Sensor check error: %d\n", httpCode);
  }
  http.end();

  Serial.println("\n✓ Setup complete - entering main loop");
  if (sensorsConfigured) {
    Serial.println("Mode: Sending sensor data every 30 seconds\n");
  } else {
    Serial.println("Mode: Heartbeat only (waiting for sensor configuration from webapp)\n");
  }
}

// ========================================
// MAIN LOOP
// ========================================

void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected - reconnecting...");
    connectWiFi();
  }

  unsigned long currentTime = millis();

  // Send heartbeat to keep device online
  if (currentTime - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeatTime = currentTime;
  }

  // If sensors are configured, send sensor data
  if (sensorsConfigured && currentTime - lastSensorDataTime >= SENSOR_INTERVAL) {
    sendSensorData();
    lastSensorDataTime = currentTime;
  }

  // Poll for actuator commands periodically
  if (currentTime - lastCommandTime >= COMMAND_INTERVAL) {
    pollForCommands();
    lastCommandTime = currentTime;
  }

  delay(100); // Small delay to prevent watchdog issues
  yield();    // Feed watchdog timer
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

// ========================================
// DEVICE HEARTBEAT
// ========================================

void sendHeartbeat() {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rpc/device_heartbeat";
  http.begin(client, url);

  // Headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  // Build JSON payload
  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";

  // Send POST request
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Heartbeat sent - device online");
  } else {
    Serial.printf("✗ Heartbeat error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
    if (httpCode > 0) {
      Serial.println("Response: " + http.getString());
    }
  }

  http.end();
}

// ========================================
// SENSOR DATA TRANSMISSION
// ========================================

void sendSensorData() {
  // Read first DHT22 sensor
  float temperature1 = dht1.readTemperature();
  float humidity1 = dht1.readHumidity();

  // Check for sensor errors
  if (isnan(temperature1) || isnan(humidity1)) {
    Serial.println("✗ DHT1 sensor read error - using dummy data");
    temperature1 = 22.5;
    humidity1 = 55.0;
  }

  Serial.println("\n--- Sending Sensor Data ---");
  Serial.printf("DHT1 - Temperature: %.1f°C, Humidity: %.1f%%\n", temperature1, humidity1);

  // Read second DHT22 sensor (if enabled)
  float temperature2 = 0;
  float humidity2 = 0;
  bool hasDHT2 = false;

  if (ENABLE_DHT2) {
    temperature2 = dht2.readTemperature();
    humidity2 = dht2.readHumidity();

    if (!isnan(temperature2) && !isnan(humidity2)) {
      hasDHT2 = true;
      Serial.printf("DHT2 - Temperature: %.1f°C, Humidity: %.1f%%\n", temperature2, humidity2);
    } else {
      Serial.println("✗ DHT2 sensor read error - skipping");
    }
  }

  // Read soil moisture sensor (or use dummy value)
  int soilRaw = analogRead(SOIL_PIN);
  float soilMoisture = map(soilRaw, 0, 1023, 0, 100);
  Serial.printf("Soil Moisture: %.1f%% (raw: %d)\n", soilMoisture, soilRaw);

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rpc/insert_sensor_readings";
  http.begin(client, url);

  // Headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  // Build JSON payload with device_id and readings array
  String payload = "{";
  payload += "\"device_id_param\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"readings\":[";
  payload += "{\"sensor_id\":\"temp_1\",\"value\":" + String(temperature1) + "},";
  payload += "{\"sensor_id\":\"humidity_1\",\"value\":" + String(humidity1) + "},";

  // Add second DHT22 readings if available
  if (hasDHT2) {
    payload += "{\"sensor_id\":\"temp_2\",\"value\":" + String(temperature2) + "},";
    payload += "{\"sensor_id\":\"humidity_2\",\"value\":" + String(humidity2) + "},";
  }

  payload += "{\"sensor_id\":\"soil_1\",\"value\":" + String(soilMoisture) + "}";
  payload += "]}";

  Serial.println("Payload: " + payload);

  // Send POST request
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Sensor data sent successfully");
    String response = http.getString();
    Serial.println("Response: " + response);
  } else {
    Serial.printf("✗ HTTP Error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
    if (httpCode > 0) {
      Serial.println("Response: " + http.getString());
    }
  }

  http.end();
}

// ========================================
// SENSOR & ACTUATOR CONFIGURATION
// ========================================
// This function is called when user clicks "Setup Sensors" in webapp
// It sends the first sensor data to auto-discover sensors and registers actuators

void configureSensorsAndActuators() {
  Serial.println("\n=================================");
  Serial.println("CONFIGURING SENSORS & ACTUATORS");
  Serial.println("=================================\n");

  // Send first sensor data (this will auto-create sensor entries)
  sendSensorData();

  // Mark as configured so sensor data will be sent periodically
  sensorsConfigured = true;

  Serial.println("\n✓ Configuration complete!");
  Serial.println("Device will now send sensor data every 30 seconds\n");
}

// ========================================
// COMMAND POLLING
// ========================================

void pollForCommands() {
  Serial.println("\n--- Polling for commands ---");
  HTTPClient http;

  // Check for special configuration command using RPC function
  String url = String(SUPABASE_URL) + "/rest/v1/rpc/check_device_configuration";
  Serial.println("Checking configuration flag...");
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
  int httpCode = http.POST(payload);
  Serial.printf("Config check response: %d\n", httpCode);

  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("Response: " + response);

    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, response);

    if (error) {
      Serial.print("✗ JSON parse error: ");
      Serial.println(error.c_str());
      http.end();
      return;
    }

    bool configRequested = doc["configuration_requested"].as<bool>();
    Serial.printf("Configuration requested: %s\n", configRequested ? "YES" : "NO");
    Serial.printf("Sensors configured: %s\n", sensorsConfigured ? "YES" : "NO");

    if (configRequested && !sensorsConfigured) {
      http.end();
      Serial.println("🎯 Starting sensor configuration!");

      // Configuration requested - set up sensors
      configureSensorsAndActuators();

      // Clear configuration flag using RPC
      HTTPClient httpClear;
      httpClear.begin(client, String(SUPABASE_URL) + "/rest/v1/rpc/clear_device_configuration");
      httpClear.addHeader("Content-Type", "application/json");
      httpClear.addHeader("apikey", API_KEY);
      httpClear.addHeader("Authorization", "Bearer " + String(API_KEY));
      String clearPayload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
      int clearCode = httpClear.POST(clearPayload);
      Serial.printf("Clear config flag response: %d\n", clearCode);
      httpClear.end();
      return;
    }
  } else {
    Serial.printf("✗ Config check error: %d\n", httpCode);
  }
  http.end();

  // Normal command polling for actuators
  url = String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";
  httpCode = http.POST(payload);

  if (httpCode == 200) {
    String response = http.getString();

    // Parse JSON response
    DynamicJsonDocument doc(2048);
    DeserializationError error = deserializeJson(doc, response);

    if (error) {
      Serial.print("✗ JSON parse error: ");
      Serial.println(error.c_str());
      http.end();
      return;
    }

    // Process each command
    JsonArray commands = doc.as<JsonArray>();

    if (commands.size() > 0) {
      Serial.printf("\n--- Processing %d Commands ---\n", commands.size());

      for (JsonObject command : commands) {
        String commandId = command["id"].as<String>();
        String actuatorId = command["actuator_id"].as<String>();
        String commandType = command["command_type"].as<String>();
        int value = command["value"] | 0;

        Serial.printf("Command: %s for %s\n", commandType.c_str(), actuatorId.c_str());

        // Execute command
        bool success = executeCommand(actuatorId, commandType, value);

        // Confirm execution
        if (success) {
          confirmCommandExecution(commandId);
        }
      }
    }
  } else if (httpCode != 404) {
    Serial.printf("✗ Command poll error: %d\n", httpCode);
  }

  http.end();
}

// ========================================
// COMMAND EXECUTION
// ========================================

bool executeCommand(String actuatorId, String commandType, int value) {
  Serial.printf("Executing: %s -> %s", actuatorId.c_str(), commandType.c_str());

  if (actuatorId == "pump_1") {
    if (commandType == "turn_on") {
      digitalWrite(PUMP_PIN, HIGH);
      Serial.println(" [PUMP ON]");
      return true;
    } else if (commandType == "turn_off") {
      digitalWrite(PUMP_PIN, LOW);
      Serial.println(" [PUMP OFF]");
      return true;
    }
  }

  if (actuatorId == "fan_1") {
    if (commandType == "turn_on") {
      digitalWrite(FAN_PIN, HIGH);
      Serial.println(" [FAN ON]");
      return true;
    } else if (commandType == "turn_off") {
      digitalWrite(FAN_PIN, LOW);
      Serial.println(" [FAN OFF]");
      return true;
    } else if (commandType == "set_pwm") {
      // ESP8266 PWM range is 0-1023 (not 0-255 like ESP32)
      // If value comes as 0-255, map it to 0-1023
      int pwmValue = map(value, 0, 255, 0, 1023);
      analogWrite(FAN_PIN, pwmValue);
      Serial.printf(" [FAN PWM=%d (mapped from %d)]\n", pwmValue, value);
      return true;
    }
  }

  Serial.println(" [UNKNOWN ACTUATOR]");
  return false;
}

// ========================================
// COMMAND CONFIRMATION
// ========================================

void confirmCommandExecution(String commandId) {
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/rpc/confirm_command_execution";
  http.begin(client, url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"command_id\":\"" + commandId + "\"}";

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("✓ Command execution confirmed");
  } else {
    Serial.printf("✗ Confirmation failed: %d\n", httpCode);
  }

  http.end();
}
