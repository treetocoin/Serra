#include "commands.h"
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266httpUpdate.h>
#include <WiFiClientSecure.h>

#define SUPABASE_URL "https://fmyomzywzjtxmabvvjcd.supabase.co"
#define ACK_COMMAND_ENDPOINT "/rest/v1/rpc/acknowledge_device_command"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE"

#define WIFI_CONNECT_TIMEOUT 30000  // 30 seconds timeout for WiFi connection

DeviceCommand parseCommand(const JsonObject& cmdJson) {
  DeviceCommand cmd;
  memset(&cmd, 0, sizeof(cmd));
  cmd.valid = false;

  if (cmdJson.isNull()) {
    return cmd;
  }

  // Parse command ID and type
  const char* id = cmdJson["id"];
  const char* type = cmdJson["type"];

  if (!id || !type) {
    Serial.println("Command missing id or type");
    return cmd;
  }

  strncpy(cmd.id, id, sizeof(cmd.id) - 1);
  strncpy(cmd.type, type, sizeof(cmd.type) - 1);

  // Parse payload based on command type
  JsonObject payload = cmdJson["payload"];

  if (strcmp(type, CMD_WIFI_UPDATE) == 0) {
    if (payload.containsKey("ssid")) {
      strncpy(cmd.ssid, payload["ssid"], sizeof(cmd.ssid) - 1);
    }
    if (payload.containsKey("password")) {
      strncpy(cmd.password, payload["password"], sizeof(cmd.password) - 1);
    }
    if (strlen(cmd.ssid) == 0) {
      Serial.println("WiFi update command missing SSID");
      return cmd;
    }
  } else if (strcmp(type, CMD_FIRMWARE_UPDATE) == 0) {
    if (payload.containsKey("url")) {
      strncpy(cmd.url, payload["url"], sizeof(cmd.url) - 1);
    }
    if (payload.containsKey("version")) {
      strncpy(cmd.version, payload["version"], sizeof(cmd.version) - 1);
    }
    if (strlen(cmd.url) == 0) {
      Serial.println("Firmware update command missing URL");
      return cmd;
    }
  }

  cmd.valid = true;
  Serial.printf("Parsed command: id=%s, type=%s\n", cmd.id, cmd.type);
  return cmd;
}

bool executeCommand(const DeviceCommand& cmd) {
  if (!cmd.valid) {
    return false;
  }

  Serial.printf("\n========================================\n");
  Serial.printf("EXECUTING COMMAND: %s\n", cmd.type);
  Serial.printf("========================================\n");

  if (strcmp(cmd.type, CMD_RESET) == 0) {
    // Simple reset - acknowledge and restart
    Serial.println("Executing RESET command...");
    acknowledgeCommand(cmd.id, true);
    delay(500);

    Serial.println("Restarting device...");
    ESP.restart();
    return true;  // Won't reach here

  } else if (strcmp(cmd.type, CMD_WIFI_UPDATE) == 0) {
    Serial.printf("Executing WIFI_UPDATE: SSID=%s\n", cmd.ssid);

    if (updateWiFiCredentials(cmd.ssid, cmd.password)) {
      acknowledgeCommand(cmd.id, true);
      delay(500);
      ESP.restart();
      return true;
    } else {
      acknowledgeCommand(cmd.id, false, "WiFi connection failed, restored backup");
      return false;
    }

  } else if (strcmp(cmd.type, CMD_FIRMWARE_UPDATE) == 0) {
    Serial.printf("Executing FIRMWARE_UPDATE: URL=%s, Version=%s\n", cmd.url, cmd.version);

    if (performOTAUpdate(cmd.url, cmd.version)) {
      // OTA success - device will restart automatically
      // Acknowledge is sent before update starts
      return true;
    } else {
      acknowledgeCommand(cmd.id, false, "OTA update failed");
      return false;
    }
  }

  Serial.printf("Unknown command type: %s\n", cmd.type);
  acknowledgeCommand(cmd.id, false, "Unknown command type");
  return false;
}

void acknowledgeCommand(const char* commandId, bool success, const char* errorMessage) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot acknowledge command");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + String(ACK_COMMAND_ENDPOINT);
  http.begin(client, url);

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));

  StaticJsonDocument<256> doc;
  doc["command_id_param"] = commandId;
  doc["success_param"] = success;
  if (errorMessage) {
    doc["error_message_param"] = errorMessage;
  }

  String payload;
  serializeJson(doc, payload);

  Serial.printf("Acknowledging command %s: success=%s\n", commandId, success ? "true" : "false");
  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("Command acknowledged successfully");
  } else {
    Serial.printf("Failed to acknowledge command: %d\n", httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
  }

  http.end();
}

bool updateWiFiCredentials(const char* newSsid, const char* newPassword) {
  Serial.println("\n--- WiFi Update Procedure ---");

  // Step 1: Backup current credentials
  Serial.println("Step 1: Backing up current WiFi credentials...");
  backupCurrentWiFi();

  // Step 2: Save new credentials
  Serial.println("Step 2: Saving new WiFi credentials...");
  strncpy(deviceConfig.wifi_ssid, newSsid, sizeof(deviceConfig.wifi_ssid) - 1);
  strncpy(deviceConfig.wifi_password, newPassword, sizeof(deviceConfig.wifi_password) - 1);
  saveConfig();

  // Step 3: Disconnect from current network
  Serial.println("Step 3: Disconnecting from current network...");
  WiFi.disconnect(true);
  delay(1000);

  // Step 4: Attempt connection to new network
  Serial.printf("Step 4: Connecting to new network: %s\n", newSsid);
  WiFi.begin(newSsid, newPassword);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startTime) < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    Serial.print(".");

    // Show progress
    int elapsed = (millis() - startTime) / 1000;
    if (elapsed % 5 == 0 && elapsed > 0) {
      Serial.printf(" (%ds/%ds)\n", elapsed, WIFI_CONNECT_TIMEOUT / 1000);
    }
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    // Success! New network works
    Serial.println("SUCCESS: Connected to new network!");
    Serial.print("New IP: ");
    Serial.println(WiFi.localIP());

    // Clear backup since we don't need it anymore
    // (Actually keep it in case user wants to revert later)
    return true;
  }

  // Step 5: Connection failed - restore backup
  Serial.println("\nFAILED: Could not connect to new network!");
  Serial.println("Step 5: Restoring backup WiFi credentials...");

  restoreBackupWiFi();

  // Step 6: Reconnect to original network
  Serial.printf("Step 6: Reconnecting to original network: %s\n", deviceConfig.wifi_ssid);
  WiFi.begin(deviceConfig.wifi_ssid, deviceConfig.wifi_password);

  startTime = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startTime) < WIFI_CONNECT_TIMEOUT) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Restored connection to original network");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("CRITICAL: Could not reconnect to original network!");
    Serial.println("Device will restart and try again...");
    delay(1000);
    ESP.restart();
  }

  return false;
}

bool performOTAUpdate(const char* firmwareUrl, const char* version) {
  Serial.println("\n--- OTA Firmware Update ---");
  Serial.printf("Firmware URL: %s\n", firmwareUrl);
  Serial.printf("Target version: %s\n", version);

  // Acknowledge before starting (in case update succeeds and device restarts)
  // Note: We'll need the command ID passed here - for now we can't acknowledge success
  // The firmware v3.2.0 will report its version on next heartbeat

  WiFiClient client;

  // Check if URL is HTTPS
  bool isHttps = String(firmwareUrl).startsWith("https://");

  Serial.println("Starting OTA update...");
  Serial.println("This may take several minutes. Do not power off the device.");

  t_httpUpdate_return ret;

  if (isHttps) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();  // Skip certificate validation for simplicity

    ESPhttpUpdate.setLedPin(LED_BUILTIN, LOW);

    // For HTTPS, use the secure client
    ret = ESPhttpUpdate.update(secureClient, firmwareUrl);
  } else {
    ESPhttpUpdate.setLedPin(LED_BUILTIN, LOW);
    ret = ESPhttpUpdate.update(client, firmwareUrl);
  }

  // If we reach here, update failed (success would restart device)
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      Serial.printf("OTA Update failed. Error (%d): %s\n",
        ESPhttpUpdate.getLastError(),
        ESPhttpUpdate.getLastErrorString().c_str());
      break;

    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("OTA Update: No updates available");
      break;

    case HTTP_UPDATE_OK:
      Serial.println("OTA Update successful!");
      // This shouldn't print as device restarts on success
      break;
  }

  return false;
}
