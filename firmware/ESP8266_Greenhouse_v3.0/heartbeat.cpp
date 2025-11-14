#include "heartbeat.h"
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

#define SUPABASE_URL "https://fmyomzywzjtxmabvvjcd.supabase.co"
#define HEARTBEAT_ENDPOINT "/functions/v1/device-heartbeat"
#define HEARTBEAT_CONFIG_ENDPOINT "/rest/v1/rpc/device_heartbeat_with_config"
#define GET_CONFIG_ENDPOINT "/rest/v1/rpc/get_device_sensor_config"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE"

HeartbeatResponse sendHeartbeat() {
  HeartbeatResponse response = {false, -1};

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping heartbeat");
    return response;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + String(HEARTBEAT_CONFIG_ENDPOINT);
  http.begin(client, url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));

  // Body - call device_heartbeat_with_config()
  StaticJsonDocument<256> doc;
  doc["composite_device_id_param"] = deviceConfig.composite_device_id;
  doc["firmware_version_param"] = "v3.1.0";

  String payload;
  serializeJson(doc, payload);

  Serial.println("Sending heartbeat with config check...");
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    String responseBody = http.getString();
    Serial.println("✓ Heartbeat OK");

    // Parse response to get config_version
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, responseBody);

    if (!error) {
      response.success = true;
      response.config_version = responseDoc["config_version"] | -1;
      Serial.print("Cloud config_version: ");
      Serial.println(response.config_version);
    }
  } else {
    Serial.print("✗ Heartbeat failed: ");
    Serial.println(httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
  }

  http.end();
  return response;
}

// Mapping from database sensor_type to firmware type enum
uint8_t mapSensorType(const char* dbType) {
  if (strstr(dbType, "temp") || strstr(dbType, "humidity")) {
    return 1; // DHT22
  } else if (strstr(dbType, "soil_moisture")) {
    return 3; // Soil moisture
  } else if (strcmp(dbType, "water_level") == 0) {
    return 4; // Water level
  }
  return 0; // None/unconfigured
}

// Extract GPIO pin number from port_id (e.g., "GPIO4" -> 4, "D1" -> 5)
uint8_t parsePortId(const char* portId) {
  // Handle "GPIO" prefix
  if (strncmp(portId, "GPIO", 4) == 0) {
    return atoi(portId + 4);
  }
  // Handle "D" prefix (Wemos D1 Mini pin names)
  if (portId[0] == 'D' && isdigit(portId[1])) {
    int dPin = atoi(portId + 1);
    // Wemos D1 Mini pin mapping
    const uint8_t dPinMap[] = {16, 5, 4, 0, 2, 14, 12, 13, 15, 3, 1};
    if (dPin >= 0 && dPin <= 10) {
      return dPinMap[dPin];
    }
  }
  // Handle "A0"
  if (strcmp(portId, "A0") == 0) {
    return A0;
  }
  // Fallback: try to parse as number
  return atoi(portId);
}

bool fetchAndApplyCloudConfig() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot fetch config");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + String(GET_CONFIG_ENDPOINT);
  http.begin(client, url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));

  // Body
  StaticJsonDocument<128> doc;
  doc["composite_device_id_param"] = deviceConfig.composite_device_id;

  String payload;
  serializeJson(doc, payload);

  Serial.println("Fetching sensor config from cloud...");
  int httpCode = http.POST(payload);

  if (httpCode != 200) {
    Serial.print("✗ Failed to fetch config: ");
    Serial.println(httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
    http.end();
    return false;
  }

  String responseBody = http.getString();
  http.end();

  Serial.println("✓ Config fetched");

  // Parse JSON array of sensor configs
  DynamicJsonDocument responseDoc(2048);
  DeserializationError error = deserializeJson(responseDoc, responseBody);

  if (error) {
    Serial.print("✗ JSON parse error: ");
    Serial.println(error.c_str());
    return false;
  }

  // Clear existing sensors
  memset(deviceConfig.sensors, 0, sizeof(deviceConfig.sensors));

  // Parse configs from cloud
  JsonArray configs = responseDoc.as<JsonArray>();
  int sensorIndex = 0;

  for (JsonObject config : configs) {
    if (sensorIndex >= MAX_SENSORS) {
      Serial.println("⚠ Max sensors reached, ignoring remaining configs");
      break;
    }

    const char* sensorType = config["sensor_type"];
    const char* portId = config["port_id"];

    if (!sensorType || !portId) {
      continue;
    }

    // Skip unconfigured sensors
    if (strcmp(sensorType, "unconfigured") == 0) {
      continue;
    }

    deviceConfig.sensors[sensorIndex].type = mapSensorType(sensorType);
    deviceConfig.sensors[sensorIndex].pin = parsePortId(portId);
    strncpy(deviceConfig.sensors[sensorIndex].name, sensorType, 31);
    deviceConfig.sensors[sensorIndex].name[31] = '\0';

    Serial.print("  Sensor ");
    Serial.print(sensorIndex);
    Serial.print(": ");
    Serial.print(sensorType);
    Serial.print(" on pin ");
    Serial.println(deviceConfig.sensors[sensorIndex].pin);

    sensorIndex++;
  }

  // Update config_version to match cloud
  // (will be set by caller)

  // Save to EEPROM
  saveConfig();

  Serial.println("✓ Cloud config applied to EEPROM");
  return true;
}
