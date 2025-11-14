#include "sensors.h"
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Arduino.h>

#define SUPABASE_URL "https://fmyomzywzjtxmabvvjcd.supabase.co"
#define SENSOR_DATA_ENDPOINT "/rest/v1/rpc/insert_sensor_readings"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE"

DHT* dhtSensors[MAX_DHT_SENSORS] = {nullptr, nullptr, nullptr, nullptr};

void initializeSensors() {
  Serial.println("Initializing sensors...");
  Serial.printf("Config version: %d\n", deviceConfig.config_version);

  // Debug: Print all sensor configs
  for (int i = 0; i < MAX_SENSORS; i++) {
    Serial.printf("Sensor[%d]: pin=%d, type=%d, name='%s'\n",
      i,
      deviceConfig.sensors[i].pin,
      deviceConfig.sensors[i].type,
      deviceConfig.sensors[i].name);
  }

  // Clean up existing sensors
  for (int i = 0; i < MAX_DHT_SENSORS; i++) {
    if (dhtSensors[i] != nullptr) {
      delete dhtSensors[i];
      dhtSensors[i] = nullptr;
    }
  }

  // Initialize configured DHT sensors
  int sensorsInitialized = 0;
  for (int i = 0; i < MAX_SENSORS; i++) {
    if (deviceConfig.sensors[i].pin > 0 &&
        (deviceConfig.sensors[i].type == 1 || deviceConfig.sensors[i].type == 2)) {

      uint8_t dhtType = (deviceConfig.sensors[i].type == 1) ? DHT22 : DHT11;
      dhtSensors[i] = new DHT(deviceConfig.sensors[i].pin, dhtType);
      dhtSensors[i]->begin();

      Serial.printf("✓ DHT%d initialized on pin %d\n",
        (dhtType == DHT22 ? 22 : 11),
        deviceConfig.sensors[i].pin);
      sensorsInitialized++;
    }
  }

  Serial.printf("Total sensors initialized: %d\n", sensorsInitialized);
}

void readAndSendSensorData() {
  if (!sendSensorReadings()) {
    Serial.println("Failed to send sensor readings");
  }
}

bool sendSensorReadings() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping sensor read");
    return false;
  }

  // Build readings array
  StaticJsonDocument<1024> doc;
  JsonArray readings = doc.createNestedArray("readings");

  bool hasData = false;

  for (int i = 0; i < MAX_SENSORS; i++) {
    if (dhtSensors[i] != nullptr) {
      float temp = dhtSensors[i]->readTemperature();
      float hum = dhtSensors[i]->readHumidity();

      if (!isnan(temp) && !isnan(hum)) {
        // Build port_id from pin number
        String portId = "GPIO" + String(deviceConfig.sensors[i].pin);

        // Temperature reading
        JsonObject tempReading = readings.createNestedObject();
        tempReading["composite_device_id"] = deviceConfig.composite_device_id;
        tempReading["sensor_type"] = "temperature";
        tempReading["sensor_name"] = strlen(deviceConfig.sensors[i].name) > 0
          ? String(deviceConfig.sensors[i].name) + " (Temp)"
          : "DHT Sensor " + String(i + 1) + " (Temp)";
        tempReading["port_id"] = portId;
        tempReading["value"] = temp;
        tempReading["unit"] = "°C";

        // Humidity reading
        JsonObject humReading = readings.createNestedObject();
        humReading["composite_device_id"] = deviceConfig.composite_device_id;
        humReading["sensor_type"] = "humidity";
        humReading["sensor_name"] = strlen(deviceConfig.sensors[i].name) > 0
          ? String(deviceConfig.sensors[i].name) + " (Hum)"
          : "DHT Sensor " + String(i + 1) + " (Hum)";
        humReading["port_id"] = portId;
        humReading["value"] = hum;
        humReading["unit"] = "%";

        hasData = true;

        Serial.printf("Sensor %d: %.1f°C, %.1f%%\n", i + 1, temp, hum);
      } else {
        Serial.printf("Sensor %d: Failed to read\n", i + 1);
      }
    }
  }

  if (!hasData) {
    Serial.println("No sensor data to send");
    return true; // Not an error, just no data
  }

  // Send to Supabase
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = String(SUPABASE_URL) + String(SENSOR_DATA_ENDPOINT);
  http.begin(client, url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("x-device-key", deviceConfig.device_key);

  String payload;
  serializeJson(doc, payload);

  Serial.println("Sending sensor data...");
  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    Serial.println("Sensor data sent successfully");
    http.end();
    return true;
  } else {
    Serial.print("Failed to send sensor data: ");
    Serial.println(httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
    http.end();
    return false;
  }
}
