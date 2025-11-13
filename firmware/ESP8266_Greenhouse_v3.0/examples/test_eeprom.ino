/**
 * EEPROM Test Sketch for ESP8266 Greenhouse v3.0
 *
 * This sketch tests the EEPROM read/write/validate functions
 * used for storing device configuration.
 *
 * Usage:
 * 1. Upload this sketch to ESP8266
 * 2. Open Serial Monitor (115200 baud)
 * 3. Verify output shows config saved and loaded correctly
 */

#include <EEPROM.h>

#define EEPROM_SIZE 512
#define EEPROM_OFFSET 0

// Device configuration struct (must match config.h)
struct DeviceConfig {
  char composite_device_id[15];
  char wifi_ssid[33];
  char wifi_password[64];
  char device_key[65];
  uint32_t crc32;
};

DeviceConfig deviceConfig;

// CRC32 calculation
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

void saveConfig() {
  deviceConfig.crc32 = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(EEPROM_OFFSET, deviceConfig);
  EEPROM.commit();
  EEPROM.end();
}

void loadConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(EEPROM_OFFSET, deviceConfig);
  EEPROM.end();
}

bool validateConfig() {
  uint32_t calculatedCRC = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  return calculatedCRC == deviceConfig.crc32 &&
         strlen(deviceConfig.composite_device_id) > 0 &&
         strlen(deviceConfig.wifi_ssid) > 0;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=================================");
  Serial.println("EEPROM Test Sketch for ESP8266 Greenhouse v3.0");
  Serial.println("=================================\n");

  // Test 1: Write configuration
  Serial.println("TEST 1: Writing configuration to EEPROM");
  Serial.println("---------------------------------------");

  strcpy(deviceConfig.composite_device_id, "PROJ1-ESP5");
  strcpy(deviceConfig.wifi_ssid, "TestNetwork");
  strcpy(deviceConfig.wifi_password, "TestPassword123");
  strcpy(deviceConfig.device_key, "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd");

  Serial.print("  Composite Device ID: ");
  Serial.println(deviceConfig.composite_device_id);
  Serial.print("  WiFi SSID: ");
  Serial.println(deviceConfig.wifi_ssid);
  Serial.print("  WiFi Password: ");
  Serial.println(deviceConfig.wifi_password);
  Serial.print("  Device Key: ");
  Serial.println(deviceConfig.device_key);

  saveConfig();
  Serial.println("  ✓ Configuration saved to EEPROM\n");

  // Test 2: Read configuration
  Serial.println("TEST 2: Reading configuration from EEPROM");
  Serial.println("------------------------------------------");

  // Clear memory to verify we're reading from EEPROM
  memset(&deviceConfig, 0, sizeof(DeviceConfig));
  Serial.println("  Memory cleared...");

  loadConfig();
  Serial.println("  ✓ Configuration loaded from EEPROM\n");

  // Test 3: Verify data integrity
  Serial.println("TEST 3: Verifying data integrity");
  Serial.println("----------------------------------");

  Serial.print("  Composite Device ID: ");
  Serial.println(deviceConfig.composite_device_id);
  Serial.print("  WiFi SSID: ");
  Serial.println(deviceConfig.wifi_ssid);
  Serial.print("  WiFi Password: ");
  Serial.println(deviceConfig.wifi_password);
  Serial.print("  Device Key: ");
  Serial.println(deviceConfig.device_key);

  bool isValid = validateConfig();
  Serial.print("  Config Valid: ");
  Serial.println(isValid ? "✓ YES" : "✗ NO");

  if (isValid) {
    Serial.println("\n=================================");
    Serial.println("✓ ALL TESTS PASSED");
    Serial.println("=================================");
  } else {
    Serial.println("\n=================================");
    Serial.println("✗ TESTS FAILED - CRC Mismatch");
    Serial.println("=================================");
  }

  // Test 4: Additional validation checks
  Serial.println("\nTEST 4: Additional validation checks");
  Serial.println("-------------------------------------");

  bool idMatch = strcmp(deviceConfig.composite_device_id, "PROJ1-ESP5") == 0;
  bool ssidMatch = strcmp(deviceConfig.wifi_ssid, "TestNetwork") == 0;
  bool passMatch = strcmp(deviceConfig.wifi_password, "TestPassword123") == 0;

  Serial.print("  ID matches expected: ");
  Serial.println(idMatch ? "✓ YES" : "✗ NO");
  Serial.print("  SSID matches expected: ");
  Serial.println(ssidMatch ? "✓ YES" : "✗ NO");
  Serial.print("  Password matches expected: ");
  Serial.println(passMatch ? "✓ YES" : "✗ NO");

  // Test 5: CRC validation
  Serial.println("\nTEST 5: CRC32 checksum validation");
  Serial.println("-----------------------------------");

  uint32_t calculatedCRC = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  Serial.print("  Stored CRC32: 0x");
  Serial.println(deviceConfig.crc32, HEX);
  Serial.print("  Calculated CRC32: 0x");
  Serial.println(calculatedCRC, HEX);
  Serial.print("  CRC Match: ");
  Serial.println(calculatedCRC == deviceConfig.crc32 ? "✓ YES" : "✗ NO");

  Serial.println("\n=================================");
  Serial.println("Test Complete");
  Serial.println("=================================\n");
  Serial.println("You can now upload the main firmware (ESP8266_Greenhouse_v3.0.ino)");
}

void loop() {
  // Nothing to do in loop
}
