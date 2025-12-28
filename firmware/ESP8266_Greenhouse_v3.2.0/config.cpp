#include "config.h"
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <WiFiManager.h>

DeviceConfig deviceConfig;
extern WiFiManagerParameter* param_composite_id;

uint32_t calculateCRC32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return ~crc;
}

void loadConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(EEPROM_OFFSET, deviceConfig);
  EEPROM.end();

  Serial.println("Config loaded from EEPROM");
  Serial.print("Device ID: ");
  Serial.println(deviceConfig.composite_device_id);
  Serial.print("WiFi SSID: ");
  Serial.println(deviceConfig.wifi_ssid);
  Serial.printf("Config version: %d\n", deviceConfig.config_version);
  Serial.printf("WiFi backup valid: %s\n", deviceConfig.wifi_backup.valid ? "yes" : "no");

  // Validate config_version is reasonable (detect corrupted EEPROM)
  if (deviceConfig.config_version < 0 || deviceConfig.config_version > 10000) {
    Serial.printf("Warning: Invalid config_version detected: %d\n", deviceConfig.config_version);
    Serial.println("Resetting config_version to 0 to force cloud sync");
    deviceConfig.config_version = 0;
    saveConfig();
  }
}

bool validateConfig() {
  // Calculate CRC32 of config (excluding CRC field itself)
  uint32_t calculatedCRC = calculateCRC32(
    (uint8_t*)&deviceConfig,
    sizeof(DeviceConfig) - sizeof(uint32_t)
  );

  if (calculatedCRC != deviceConfig.crc32) {
    Serial.println("CRC32 mismatch - invalid config");
    return false;
  }

  // Check if composite_device_id is set
  if (strlen(deviceConfig.composite_device_id) == 0) {
    Serial.println("No device ID - invalid config");
    return false;
  }

  // Check if WiFi credentials are set
  if (strlen(deviceConfig.wifi_ssid) == 0) {
    Serial.println("No WiFi SSID - invalid config");
    return false;
  }

  Serial.println("Config validation: OK");
  return true;
}

void saveConfig() {
  // Calculate CRC32
  deviceConfig.crc32 = calculateCRC32(
    (uint8_t*)&deviceConfig,
    sizeof(DeviceConfig) - sizeof(uint32_t)
  );

  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(EEPROM_OFFSET, deviceConfig);
  EEPROM.commit();
  EEPROM.end();

  Serial.println("Config saved to EEPROM");
}

void clearConfig() {
  memset(&deviceConfig, 0, sizeof(DeviceConfig));
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(EEPROM_OFFSET, deviceConfig);
  EEPROM.commit();
  EEPROM.end();
  Serial.println("Config erased from EEPROM");
}

void generateDeviceKey() {
  // Generate 64-character hex string (32 random bytes)
  const char hexChars[] = "0123456789abcdef";
  for (int i = 0; i < 64; i++) {
    deviceConfig.device_key[i] = hexChars[random(16)];
  }
  deviceConfig.device_key[64] = '\0';

  Serial.print("Generated device key: ");
  Serial.println(deviceConfig.device_key);
}

void saveConfigCallback() {
  Serial.println("Should save config callback");

  // Get composite device ID from portal parameter
  String compositeId = param_composite_id->getValue();
  compositeId.trim();
  compositeId.toUpperCase();

  if (compositeId.length() > 0) {
    strncpy(deviceConfig.composite_device_id, compositeId.c_str(), sizeof(deviceConfig.composite_device_id) - 1);
    deviceConfig.composite_device_id[sizeof(deviceConfig.composite_device_id) - 1] = '\0';

    Serial.print("Composite Device ID set to: ");
    Serial.println(deviceConfig.composite_device_id);
  }

  // WiFi credentials are automatically saved by WiFiManager
  strncpy(deviceConfig.wifi_ssid, WiFi.SSID().c_str(), sizeof(deviceConfig.wifi_ssid) - 1);
  strncpy(deviceConfig.wifi_password, WiFi.psk().c_str(), sizeof(deviceConfig.wifi_password) - 1);

  // Generate device key if not exists
  if (strlen(deviceConfig.device_key) == 0) {
    generateDeviceKey();
  }

  // Initialize config_version to 0 for new devices
  deviceConfig.config_version = 0;

  // Invalidate backup (new setup)
  deviceConfig.wifi_backup.valid = false;

  // Save to EEPROM
  saveConfig();
}

// ============================================
// WiFi Backup Functions (for remote update)
// ============================================

void backupCurrentWiFi() {
  strncpy(deviceConfig.wifi_backup.ssid, deviceConfig.wifi_ssid, sizeof(deviceConfig.wifi_backup.ssid) - 1);
  strncpy(deviceConfig.wifi_backup.password, deviceConfig.wifi_password, sizeof(deviceConfig.wifi_backup.password) - 1);
  deviceConfig.wifi_backup.valid = true;
  saveConfig();

  Serial.println("Current WiFi credentials backed up");
  Serial.print("Backup SSID: ");
  Serial.println(deviceConfig.wifi_backup.ssid);
}

void restoreBackupWiFi() {
  if (!deviceConfig.wifi_backup.valid) {
    Serial.println("No valid WiFi backup to restore");
    return;
  }

  strncpy(deviceConfig.wifi_ssid, deviceConfig.wifi_backup.ssid, sizeof(deviceConfig.wifi_ssid) - 1);
  strncpy(deviceConfig.wifi_password, deviceConfig.wifi_backup.password, sizeof(deviceConfig.wifi_password) - 1);
  saveConfig();

  Serial.println("WiFi credentials restored from backup");
  Serial.print("Restored SSID: ");
  Serial.println(deviceConfig.wifi_ssid);
}

bool hasValidWiFiBackup() {
  return deviceConfig.wifi_backup.valid && strlen(deviceConfig.wifi_backup.ssid) > 0;
}
