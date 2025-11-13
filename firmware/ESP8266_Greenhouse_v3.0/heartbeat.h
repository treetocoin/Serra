#ifndef HEARTBEAT_H
#define HEARTBEAT_H

#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"

#define SUPABASE_URL "https://fmyomzywzjtxmabvvjcd.supabase.co"
#define HEARTBEAT_ENDPOINT "/functions/v1/device-heartbeat"

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping heartbeat");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure(); // For testing; use certificate validation in production

  HTTPClient http;

  String url = String(SUPABASE_URL) + String(HEARTBEAT_ENDPOINT);
  http.begin(client, url);

  // Headers - always send device key for authentication
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", deviceConfig.device_key);
  http.addHeader("x-composite-device-id", deviceConfig.composite_device_id);

  // Body
  StaticJsonDocument<256> doc;
  doc["rssi"] = WiFi.RSSI();
  doc["ip_address"] = WiFi.localIP().toString();
  doc["fw_version"] = "v3.0.0";
  doc["device_hostname"] = "http://" + WiFi.localIP().toString();

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("Heartbeat sent successfully");
    String response = http.getString();
    Serial.println(response);
    http.end();
    return true;
  } else {
    Serial.print("Heartbeat failed: ");
    Serial.println(httpCode);
    if (httpCode > 0) {
      Serial.println(http.getString());
    }
    http.end();
    return false;
  }
}

#endif
