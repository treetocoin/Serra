#include "config.h"
#include <Arduino.h>

DeviceConfig deviceConfig;

uint32_t calculateCRC32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
    }
  }
  return crc ^ 0xFFFFFFFF;
}

void loadConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(EEPROM_OFFSET, deviceConfig);
  EEPROM.end();
}

void saveConfig() {
  deviceConfig.crc32 = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(EEPROM_OFFSET, deviceConfig);
  EEPROM.commit();
  EEPROM.end();
}

bool validateConfig() {
  uint32_t calculatedCRC = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  return calculatedCRC == deviceConfig.crc32 &&
         strlen(deviceConfig.composite_device_id) > 0 &&
         strlen(deviceConfig.wifi_ssid) > 0;
}

void clearConfig() {
  memset(&deviceConfig, 0, sizeof(DeviceConfig));
  saveConfig();
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
