/**
 * Greenhouse Management System - ESP32 Example Firmware
 *
 * This Arduino sketch demonstrates how to integrate ESP32 with the
 * Greenhouse Management System using Supabase REST API.
 *
 * Features:
 * - WiFi connection
 * - Sensor data transmission (temperature, humidity, soil moisture)
 * - Actuator auto-registration
 * - Command polling for actuator control
 * - Command execution confirmation
 *
 * Hardware Requirements:
 * - ESP32 Development Board
 * - DHT22 Temperature/Humidity Sensor (GPIO 4)
 * - Soil Moisture Sensor (GPIO 34)
 * - Relay Module for Pump (GPIO 26)
 * - Relay Module for Fan (GPIO 27)
 *
 * Library Dependencies:
 * - WiFi (built-in)
 * - HTTPClient (built-in)
 * - ArduinoJson by Benoit Blanchon (v6.x)
 * - DHT sensor library by Adafruit
 *
 * Installation:
 * 1. Install libraries via Arduino Library Manager
 * 2. Update WiFi credentials below
 * 3. Update Supabase URL and API key
 * 4. Update device ID from web app
 * 5. Upload to ESP32
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ========================================
// CONFIGURATION - UPDATE THESE VALUES
// ========================================

// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase configuration
const char* SUPABASE_URL = "https://your-project.supabase.co";
const char* API_KEY = "your-64-character-api-key-here";
const char* DEVICE_ID = "your-device-uuid-from-webapp";

// Pin definitions
#define DHT_PIN 4          // DHT22 sensor
#define SOIL_PIN 34        // Soil moisture sensor (analog)
#define PUMP_PIN 26        // Water pump relay
#define FAN_PIN 27         // Fan relay

// DHT sensor setup
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// Timing constants
const unsigned long SENSOR_INTERVAL = 30000;  // Send sensor data every 30 seconds
const unsigned long COMMAND_INTERVAL = 30000; // Poll commands every 30 seconds

unsigned long lastSensorTime = 0;
unsigned long lastCommandTime = 0;

// ========================================
// SETUP
// ========================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================");
  Serial.println("Greenhouse Management System");
  Serial.println("ESP32 Firmware v1.0");
  Serial.println("=================================\n");

  // Initialize DHT sensor
  dht.begin();

  // Initialize actuator pins
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  digitalWrite(FAN_PIN, LOW);

  // Connect to WiFi
  connectWiFi();

  // Register actuators on first boot
  registerActuators();

  Serial.println("\n✓ Setup complete - entering main loop\n");
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

  // Send sensor data periodically
  if (currentTime - lastSensorTime >= SENSOR_INTERVAL) {
    sendSensorData();
    lastSensorTime = currentTime;
  }

  // Poll for actuator commands periodically
  if (currentTime - lastCommandTime >= COMMAND_INTERVAL) {
    pollForCommands();
    lastCommandTime = currentTime;
  }

  delay(100); // Small delay to prevent watchdog issues
}

// ========================================
// WiFi CONNECTION
// ========================================

void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

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
// SENSOR DATA TRANSMISSION
// ========================================

void sendSensorData() {
  // Read sensors
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int soilRaw = analogRead(SOIL_PIN);
  float soilMoisture = map(soilRaw, 0, 4095, 0, 100);

  // Check for sensor errors
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("✗ DHT sensor read error");
    return;
  }

  Serial.println("\n--- Sending Sensor Data ---");
  Serial.printf("Temperature: %.1f°C\n", temperature);
  Serial.printf("Humidity: %.1f%%\n", humidity);
  Serial.printf("Soil Moisture: %.1f%%\n", soilMoisture);

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";
  http.begin(url);

  // Headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));
  http.addHeader("Prefer", "return=minimal");

  // Build JSON payload
  String payload = "[";
  payload += "{\"sensor_id\":\"temp_1\",\"value\":" + String(temperature) + "},";
  payload += "{\"sensor_id\":\"humidity_1\",\"value\":" + String(humidity) + "},";
  payload += "{\"sensor_id\":\"soil_1\",\"value\":" + String(soilMoisture) + "}";
  payload += "]";

  // Send POST request
  int httpCode = http.POST(payload);

  if (httpCode == 201) {
    Serial.println("✓ Sensor data sent successfully");
  } else {
    Serial.printf("✗ HTTP Error: %d - %s\n", httpCode, http.errorToString(httpCode).c_str());
    if (httpCode > 0) {
      Serial.println("Response: " + http.getString());
    }
  }

  http.end();
}

// ========================================
// ACTUATOR REGISTRATION
// ========================================

void registerActuators() {
  Serial.println("\n--- Registering Actuators ---");

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";
  http.begin(url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));
  http.addHeader("Prefer", "return=minimal");

  // Send a dummy sensor reading with actuator metadata
  String payload = "[{";
  payload += "\"sensor_id\":\"temp_1\",";
  payload += "\"value\":20.0,";
  payload += "\"actuators\":[";
  payload += "{\"actuator_id\":\"pump_1\",\"type\":\"pump\",\"supports_pwm\":false},";
  payload += "{\"actuator_id\":\"fan_1\",\"type\":\"fan\",\"supports_pwm\":true}";
  payload += "]}]";

  int httpCode = http.POST(payload);

  if (httpCode == 201) {
    Serial.println("✓ Actuators registered successfully");
  } else {
    Serial.printf("⚠ Actuator registration response: %d\n", httpCode);
  }

  http.end();
}

// ========================================
// COMMAND POLLING
// ========================================

void pollForCommands() {
  HTTPClient http;

  String url = String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands";
  http.begin(url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", API_KEY);
  http.addHeader("Authorization", "Bearer " + String(API_KEY));

  String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";

  int httpCode = http.POST(payload);

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
      // For PWM control, use analogWrite (0-255)
      analogWrite(FAN_PIN, value);
      Serial.printf(" [FAN PWM=%d]\n", value);
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
  http.begin(url);

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
