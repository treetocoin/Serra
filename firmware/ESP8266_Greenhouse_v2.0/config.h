/**
 * ================================================================================
 * Greenhouse Management System - ESP8266 Configuration File
 * Firmware v2.0 - User Configuration
 * ================================================================================
 *
 * IMPORTANT: Update these values before uploading firmware!
 *
 * This file contains all user-configurable settings for the ESP8266 greenhouse
 * management system. Edit the values below to match your setup.
 *
 * ================================================================================
 */

#ifndef CONFIG_H
#define CONFIG_H

// ========================================
// SUPABASE CONFIGURATION
// ========================================

// Your Supabase project URL
// Example: https://your-project.supabase.co
const char* SUPABASE_URL = "https://fmyomzywzjtxmabvvjcd.supabase.co";

// Your Supabase anonymous (anon) key
// Find this in: Supabase Dashboard → Settings → API → Project API keys
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteW9tenl3emp0eG1hYnZ2amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MTU1ODksImV4cCI6MjA3NTQ5MTU4OX0.XNaYzevjhVxRBC6hIMjSHBMe6iNoARz78XvB4iziuCE";

// Your device UUID
// Get this from the webapp after registering a new device
// Example: "0f24ada1-b6f6-45a2-aa0e-0e417daae659"
const char* DEVICE_UUID = "0f24ada1-b6f6-45a2-aa0e-0e417daae659";

// ========================================
// WIFI AP CONFIGURATION
// ========================================

// Access Point name when in configuration mode
// Users will see this SSID when the ESP8266 starts for the first time
const char* WIFI_AP_NAME = "Serra-Setup";

// Access Point password (leave empty for open network)
// Set a password for security, or leave "" for no password
const char* WIFI_AP_PASSWORD = "";

// ========================================
// mDNS CONFIGURATION
// ========================================

// Base hostname for mDNS
// Final hostname will be: {MDNS_HOSTNAME_BASE}-XXXX.local
// where XXXX is derived from the device's MAC address
// Example: serrasetup-a1b2.local
const char* MDNS_HOSTNAME_BASE = "serrasetup";

// ========================================
// OTA UPDATE CONFIGURATION
// ========================================

// Password for Over-The-Air updates
// Change this to a secure password!
const char* OTA_PASSWORD = "serra2025";

// OTA port (default: 8266)
const int OTA_PORT = 8266;

// ========================================
// TIMING CONFIGURATION (milliseconds)
// ========================================

// How often to send heartbeat to server (default: 30 seconds)
const unsigned long HEARTBEAT_INTERVAL = 30000;

// How often to read and send sensor data (default: 30 seconds)
const unsigned long SENSOR_INTERVAL = 30000;

// How often to check for pending commands (default: 30 seconds)
const unsigned long COMMAND_INTERVAL = 30000;

// WiFi connection timeout (default: 30 seconds)
const unsigned long WIFI_CONNECT_TIMEOUT = 30000;

// WiFi configuration portal timeout (default: 5 minutes)
const unsigned long WIFI_PORTAL_TIMEOUT = 300;

// ========================================
// RESET BUTTON CONFIGURATION
// ========================================

// GPIO pin for reset button (default: D3 = GPIO0 = FLASH button)
#define WIFI_RESET_BUTTON D3

// Duration to trigger WiFi reset (default: 3 seconds)
const unsigned long WIFI_RESET_DURATION = 3000;

// Duration to trigger full reset (default: 10 seconds)
const unsigned long FULL_RESET_DURATION = 10000;

// ========================================
// LED CONFIGURATION
// ========================================

// GPIO pin for status LED (default: LED_BUILTIN = GPIO2)
#define STATUS_LED_PIN LED_BUILTIN

// LED status indicators:
// - OFF: AP mode (waiting for WiFi configuration)
// - SLOW BLINK: Connecting to WiFi (1Hz)
// - FAST BLINK: Error / WiFi connection failed (10Hz)
// - SOLID ON: Connected and online

// ========================================
// HARDWARE LIMITS
// ========================================

// Maximum number of sensors (DHT22, soil moisture, etc.)
#define MAX_SENSORS 8

// Maximum number of actuators (relays, PWM outputs, etc.)
#define MAX_ACTUATORS 4

// Maximum number of DHT22 sensors (each DHT22 provides temp + humidity)
#define MAX_DHT_SENSORS 4

// EEPROM size for configuration storage
#define EEPROM_SIZE 512

// ========================================
// SAFE GPIO PINS (NodeMCU)
// ========================================

// These pins are safe to use for sensors and actuators:
// D1 = GPIO5  (Safe for digital I/O)
// D2 = GPIO4  (Safe for digital I/O)
// D5 = GPIO14 (Safe for digital I/O, PWM)
// D6 = GPIO12 (Safe for digital I/O, PWM)
// D7 = GPIO13 (Safe for digital I/O, PWM)
// A0 = ADC    (Safe for analog input 0-1V)

// AVOID these pins (special boot functions):
// D0 = GPIO16 (No PWM, no interrupts)
// D3 = GPIO0  (Boot mode - must be HIGH at boot)
// D4 = GPIO2  (Boot mode - must be HIGH at boot, built-in LED)
// D8 = GPIO15 (Boot mode - must be LOW at boot)

// ========================================
// GITHUB REPOSITORY
// ========================================

// GitHub repository for firmware updates
// Format: username/repository
const char* GITHUB_REPO = "treetocoin/Serra";

// ========================================
// ADVANCED CONFIGURATION
// ========================================

// Heartbeat retry attempts (NEW in v2.0)
#define HEARTBEAT_RETRY_ATTEMPTS 3

// Delay between heartbeat retry attempts (default: 5 seconds)
const unsigned long HEARTBEAT_RETRY_DELAY = 5000;

// Minimum WiFi signal quality (0-100%, default: 20%)
const int MIN_WIFI_SIGNAL_QUALITY = 20;

// Enable debug output to Serial Monitor (true/false)
const bool ENABLE_DEBUG_OUTPUT = true;

#endif // CONFIG_H
