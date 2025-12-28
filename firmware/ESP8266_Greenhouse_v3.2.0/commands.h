#ifndef COMMANDS_H
#define COMMANDS_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"

// Command types (matching database enum)
#define CMD_RESET "reset"
#define CMD_WIFI_UPDATE "wifi_update"
#define CMD_FIRMWARE_UPDATE "firmware_update"

// Command structure
struct DeviceCommand {
  char id[37];       // UUID
  char type[20];     // Command type
  char ssid[33];     // For wifi_update
  char password[64]; // For wifi_update
  char url[256];     // For firmware_update
  char version[16];  // For firmware_update
  bool valid;
};

// Parse command from heartbeat response JSON
DeviceCommand parseCommand(const JsonObject& cmdJson);

// Execute command (returns true if restart needed)
bool executeCommand(const DeviceCommand& cmd);

// Acknowledge command execution to server
void acknowledgeCommand(const char* commandId, bool success, const char* errorMessage = nullptr);

// WiFi update with fallback
bool updateWiFiCredentials(const char* newSsid, const char* newPassword);

// OTA firmware update
bool performOTAUpdate(const char* firmwareUrl, const char* version);

#endif
