#ifndef CONFIG_H
#define CONFIG_H

#include <EEPROM.h>

#define EEPROM_SIZE 512
#define EEPROM_OFFSET 0
#define MAX_SENSORS 4  // Max number of sensors

// Sensor pin configuration
struct SensorPin {
  uint8_t pin;           // GPIO pin number (0 = not configured)
  uint8_t type;          // 0=none, 1=DHT22, 2=DHT11, 3=soil_moisture, 4=water_level
  char name[32];         // Custom sensor name
};

// Device configuration stored in EEPROM
struct DeviceConfig {
  char composite_device_id[15];  // "PROJ1-ESP5" + null (max 14 chars)
  char wifi_ssid[33];            // WiFi SSID (32 + null)
  char wifi_password[64];        // WiFi password (63 + null)
  char device_key[65];           // Device key (64 hex + null)
  SensorPin sensors[MAX_SENSORS]; // Sensor configurations
  uint32_t crc32;                // CRC32 checksum
};

extern DeviceConfig deviceConfig;

// Function prototypes
void loadConfig();
void saveConfig();
uint32_t calculateCRC32(const uint8_t* data, size_t length);
bool validateConfig();
void clearConfig();
void generateDeviceKey();

#endif
