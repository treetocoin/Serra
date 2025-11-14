# ESP32 Integration Guide

**Target**: ESP32 Microcontroller Firmware Developers
**Purpose**: Integrate ESP32 devices with the Greenhouse Management System

---

## Overview

ESP32 devices communicate with the system via Supabase REST API using HTTP/HTTPS. Each device authenticates using a unique API key generated during registration.

### Communication Flow

```
ESP32 Device
    │
    ├─→ [Poll every 30-60s] POST /rest/v1/sensor_readings
    │   ├─ Send sensor data
    │   └─ Updates device last_seen_at (triggers "online" status)
    │
    └─→ [Poll every 30-60s] POST /rest/v1/rpc/get_pending_commands
        ├─ Retrieve queued actuator commands
        └─ Execute and confirm via /rest/v1/rpc/confirm_command_execution
```

---

## Step 1: Register Device in Web App

1. Log in to the web application
2. Navigate to **Devices** page
3. Click **Register New Device**
4. Enter device name (e.g., "Greenhouse ESP32")
5. Copy the generated **API Key** (64-character hex string)
   - ⚠️ Save this securely - you won't see it again!

Example API Key:
```
a1b2c3d4e5f6...0123456789abcdef (64 characters)
```

---

## Step 2: Configure ESP32 Firmware

### Required Libraries

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
```

Install via Arduino Library Manager:
- **WiFi** (built-in)
- **HTTPClient** (built-in)
- **ArduinoJson** by Benoit Blanchon

### WiFi and API Configuration

```cpp
// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Supabase configuration
const char* SUPABASE_URL = "https://your-project.supabase.co";
const char* API_KEY = "your-64-char-api-key-here";
const char* DEVICE_ID = "your-device-uuid-here";  // Get from web app after registration
```

---

## Step 3: Implement Sensor Data Sending

### Send Sensor Readings

ESP32 should send sensor data every 30-60 seconds to keep device status "online".

```cpp
void sendSensorData() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    // Endpoint: Insert sensor readings
    String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";
    http.begin(url);

    // Headers
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + String(API_KEY));
    http.addHeader("Prefer", "return=minimal");

    // Prepare JSON payload
    StaticJsonDocument<512> doc;
    doc["sensor_id"] = "temp_1";  // Your sensor identifier
    doc["value"] = 22.5;          // Sensor reading
    doc["timestamp"] = "2025-10-08T10:30:00Z";  // ISO 8601 format

    String payload;
    serializeJson(doc, payload);

    // Send POST request
    int httpCode = http.POST(payload);

    if (httpCode > 0) {
      Serial.printf("Sensor data sent. HTTP code: %d\n", httpCode);
    } else {
      Serial.printf("Error sending sensor data: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
  }
}
```

### Auto-Discovery: Send Multiple Sensors

```cpp
void sendMultipleSensorReadings() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";
    http.begin(url);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + String(API_KEY));
    http.addHeader("Prefer", "return=minimal");

    // Read multiple sensors
    float temperature = readTemperature();  // Your sensor reading function
    float humidity = readHumidity();
    float soilMoisture = readSoilMoisture();

    // Create array of readings
    String payload = "[";
    payload += "{\"sensor_id\":\"temp_1\",\"value\":" + String(temperature) + "},";
    payload += "{\"sensor_id\":\"humidity_1\",\"value\":" + String(humidity) + "},";
    payload += "{\"sensor_id\":\"soil_1\",\"value\":" + String(soilMoisture) + "}";
    payload += "]";

    int httpCode = http.POST(payload);

    if (httpCode == 201) {
      Serial.println("✓ All sensor data sent successfully");
    } else {
      Serial.printf("✗ Error: HTTP %d\n", httpCode);
    }

    http.end();
  }
}
```

---

## Step 4: Actuator Auto-Discovery and Control

### Auto-Discovery: Register Actuators

Similar to sensors, actuators are automatically registered when ESP32 first sends data about them. Include actuator metadata when sending sensor readings:

```cpp
void registerActuators() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";
    http.begin(url);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + String(API_KEY));
    http.addHeader("Prefer", "return=minimal");

    // Include actuator metadata in the first sensor reading
    // Database triggers will auto-create actuator rows
    String payload = "[";
    payload += "{\"sensor_id\":\"temp_1\",\"value\":22.5,";
    payload += "\"actuators\":[";
    payload += "{\"actuator_id\":\"pump_1\",\"type\":\"pump\",\"supports_pwm\":true},";
    payload += "{\"actuator_id\":\"fan_1\",\"type\":\"fan\",\"supports_pwm\":true},";
    payload += "{\"actuator_id\":\"heater_1\",\"type\":\"heater\",\"supports_pwm\":false}";
    payload += "]}";
    payload += "]";

    int httpCode = http.POST(payload);

    if (httpCode == 201) {
      Serial.println("✓ Actuators registered successfully");
    }

    http.end();
  }
}
```

**Note**: After the first successful data send, actuators will appear in the web UI automatically.

### Poll for Actuator Commands

ESP32 polls for pending commands every 30-60 seconds.

### Retrieve Pending Commands

```cpp
void pollForCommands() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    // Endpoint: RPC function to get pending commands
    String url = String(SUPABASE_URL) + "/rest/v1/rpc/get_pending_commands";
    http.begin(url);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", API_KEY);
    http.addHeader("Authorization", "Bearer " + String(API_KEY));

    // Pass device_id as parameter
    String payload = "{\"device_id_param\":\"" + String(DEVICE_ID) + "\"}";

    int httpCode = http.POST(payload);

    if (httpCode == 200) {
      String response = http.getString();

      // Parse JSON response
      DynamicJsonDocument doc(2048);
      deserializeJson(doc, response);

      // Process each command
      for (JsonObject command : doc.as<JsonArray>()) {
        String commandId = command["id"];
        String actuatorId = command["actuator_id"];
        String commandType = command["command_type"];
        int value = command["value"] | 0;

        Serial.printf("Command received: %s for actuator %s\n",
                      commandType.c_str(), actuatorId.c_str());

        // Execute command
        executeActuatorCommand(actuatorId, commandType, value);

        // Confirm execution
        confirmCommandExecution(commandId);
      }
    }

    http.end();
  }
}
```

### Execute Actuator Commands

```cpp
void executeActuatorCommand(String actuatorId, String commandType, int value) {
  // Map actuator_id to physical pins
  if (actuatorId == "pump_1") {
    int pumpPin = 26;  // GPIO pin for pump

    if (commandType == "on") {
      digitalWrite(pumpPin, HIGH);
      Serial.println("✓ Pump turned ON");
    } else if (commandType == "off") {
      digitalWrite(pumpPin, LOW);
      Serial.println("✓ Pump turned OFF");
    } else if (commandType == "set_value") {
      // PWM control (0-255 = 0-100%)
      int pwmValue = map(value, 0, 100, 0, 255);
      analogWrite(pumpPin, pwmValue);
      Serial.printf("✓ Pump set to %d%%\n", value);
    }
  }
  // Add more actuators as needed
}
```

### Confirm Command Execution

```cpp
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
  }

  http.end();
}
```

---

## Step 5: Main Loop

### Complete Arduino Sketch Structure

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL = "https://your-project.supabase.co";
const char* API_KEY = "your-api-key";
const char* DEVICE_ID = "your-device-uuid";

unsigned long lastSensorSend = 0;
unsigned long lastCommandPoll = 0;
const unsigned long SEND_INTERVAL = 30000;  // 30 seconds
const unsigned long POLL_INTERVAL = 30000;  // 30 seconds

void setup() {
  Serial.begin(115200);

  // Initialize GPIO pins
  pinMode(26, OUTPUT);  // Pump
  pinMode(27, OUTPUT);  // Fan

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✓ Connected to WiFi");
}

void loop() {
  unsigned long now = millis();

  // Send sensor data every 30s
  if (now - lastSensorSend >= SEND_INTERVAL) {
    sendMultipleSensorReadings();
    lastSensorSend = now;
  }

  // Poll for commands every 30s
  if (now - lastCommandPoll >= POLL_INTERVAL) {
    pollForCommands();
    lastCommandPoll = now;
  }

  delay(1000);
}

// ... (include all functions from above)
```

---

## Troubleshooting

### Device Shows "Offline"
- Check WiFi connection
- Verify API key is correct
- Ensure sensor data is sent at least every 90 seconds
- Check Supabase project is active

### Sensor Data Not Appearing
- Verify `sensor_id` format (alphanumeric + underscore)
- Check RLS policies in Supabase
- Ensure API key has correct permissions
- Verify timestamp format (ISO 8601)

### Commands Not Received
- Check `device_id` matches registered device UUID
- Verify RPC function `get_pending_commands` exists
- Ensure polling interval is adequate

### HTTP Errors
- **401 Unauthorized**: Invalid API key
- **404 Not Found**: Wrong endpoint or RPC function missing
- **500 Internal Error**: Check Supabase logs

---

## Security Best Practices

1. **Never hardcode API keys in public repositories**
   - Use `.env` files or EEPROM storage

2. **Use HTTPS** (enabled by default with Supabase)

3. **Rotate API keys periodically**
   - Delete old device and register new one

4. **Monitor failed authentication attempts**
   - Check Supabase logs for suspicious activity

---

## Next Steps

1. Upload firmware to ESP32
2. Monitor Serial output for connection status
3. Check web app to see device appear as "Online"
4. Test actuator control from web interface
5. View sensor data in dashboard

---

**Support**: For issues, check `supabase/schema.sql` for database structure and RPC functions.
