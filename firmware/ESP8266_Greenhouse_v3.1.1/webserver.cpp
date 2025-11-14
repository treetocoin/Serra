#include "webserver.h"
#include "sensors.h"
#include <Arduino.h>

ESP8266WebServer server(80);

void setupWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/config", HTTP_GET, handleConfig);
  // POST handler removed - config is now managed from webapp
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.println("✓ Web server started on port 80");
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Serra ESP8266</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;max-width:800px;margin:50px auto;padding:20px;background:#f5f5f5}";
  html += "h1{color:#2c3e50}table{width:100%;border-collapse:collapse;background:white}";
  html += "td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}";
  html += "th{background:#3498db;color:white}.btn{display:inline-block;padding:10px 20px;";
  html += "background:#3498db;color:white;text-decoration:none;border-radius:5px;margin:10px 5px}";
  html += ".btn:hover{background:#2980b9}</style></head><body>";

  html += "<h1>🌱 Serra ESP8266 v3.0</h1>";
  html += "<table>";
  html += "<tr><th>Parametro</th><th>Valore</th></tr>";
  html += "<tr><td><b>Device ID</b></td><td>" + String(deviceConfig.composite_device_id) + "</td></tr>";
  html += "<tr><td><b>Firmware</b></td><td>v3.0.0</td></tr>";
  html += "<tr><td><b>WiFi SSID</b></td><td>" + WiFi.SSID() + "</td></tr>";
  html += "<tr><td><b>IP Address</b></td><td>" + WiFi.localIP().toString() + "</td></tr>";
  html += "<tr><td><b>RSSI</b></td><td>" + String(WiFi.RSSI()) + " dBm</td></tr>";
  html += "<tr><td><b>Uptime</b></td><td>" + String(millis() / 1000) + " sec</td></tr>";
  html += "</table>";

  html += "<br><a href='/config' class='btn'>⚙️ Configura Sensori</a>";
  html += "</body></html>";

  server.send(200, "text/html", html);
}

void handleConfig() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<title>Configurazione Sensori</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;max-width:800px;margin:50px auto;padding:20px;background:#f5f5f5}";
  html += "h1{color:#2c3e50}.sensor{background:white;padding:20px;margin:15px 0;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}";
  html += "label{display:block;margin:10px 0 5px;font-weight:bold;color:#34495e}";
  html += "input,select{width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box}";
  html += "button{background:#27ae60;color:white;padding:12px 30px;border:none;border-radius:5px;cursor:pointer;font-size:16px;margin-top:20px}";
  html += "button:hover{background:#229954}.info{background:#e8f5e9;padding:15px;border-left:4px solid #27ae60;margin:20px 0}</style></head><body>";

  html += "<h1>⚙️ Configurazione Sensori (Read-Only)</h1>";
  html += "<p>Device ID: <strong>" + String(deviceConfig.composite_device_id) + "</strong></p>";

  html += "<div class='info' style='background:#fff3cd;border-left-color:#ffc107'>";
  html += "ℹ️ <strong>Configurazione Cloud Attiva</strong><br>";
  html += "I sensori sono ora configurati dalla webapp. Qualsiasi modifica deve essere fatta dalla dashboard web.";
  html += "</div>";

  html += "<div class='info'>📡 <strong>Config Version:</strong> " + String(deviceConfig.config_version) + "</div>";

  for (int i = 0; i < MAX_SENSORS; i++) {
    if (deviceConfig.sensors[i].type == 0) continue; // Skip unconfigured

    html += "<div class='sensor'>";
    html += "<h3>Sensore " + String(i + 1) + "</h3>";
    html += "<table style='width:100%;background:transparent'>";
    html += "<tr><td><strong>Pin GPIO:</strong></td><td>" + String(deviceConfig.sensors[i].pin) + "</td></tr>";

    String typeName = "Sconosciuto";
    switch (deviceConfig.sensors[i].type) {
      case 1: typeName = "DHT22"; break;
      case 2: typeName = "DHT11"; break;
      case 3: typeName = "Soil Moisture"; break;
      case 4: typeName = "Water Level"; break;
    }
    html += "<tr><td><strong>Tipo:</strong></td><td>" + typeName + "</td></tr>";
    html += "<tr><td><strong>Nome:</strong></td><td>" + String(deviceConfig.sensors[i].name) + "</td></tr>";
    html += "</table>";
    html += "</div>";
  }

  if (deviceConfig.sensors[0].type == 0 && deviceConfig.sensors[1].type == 0 &&
      deviceConfig.sensors[2].type == 0 && deviceConfig.sensors[3].type == 0) {
    html += "<div class='sensor' style='text-align:center;color:#999'>";
    html += "<p>Nessun sensore configurato</p>";
    html += "<p>Configura i sensori dalla dashboard web</p>";
    html += "</div>";
  }
  html += "</body></html>";

  server.send(200, "text/html", html);
}

// Removed: Configuration is now managed from webapp
// The device fetches config from cloud during heartbeat

void handleNotFound() {
  server.send(404, "text/plain", "404 - Not Found");
}
