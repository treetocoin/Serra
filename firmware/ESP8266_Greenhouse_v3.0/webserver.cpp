#include "webserver.h"
#include <Arduino.h>

ESP8266WebServer server(80);

const char* sensorTypeNames[] = {
  "None",
  "DHT22",
  "DHT11",
  "Soil Moisture",
  "Water Level"
};

void setupWebServer() {
  server.on("/", handleRoot);
  server.on("/config", HTTP_GET, handleConfig);
  server.on("/config", HTTP_POST, handleSaveConfig);
  server.onNotFound(handleNotFound);
  server.begin();
  Serial.println("Web server started");
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Serra - " + String(deviceConfig.composite_device_id) + "</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:20px;background:#f0f0f0}";
  html += ".container{max-width:600px;margin:0 auto;background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}";
  html += "h1{color:#2e7d32;margin-top:0}";
  html += ".info{background:#e8f5e9;padding:15px;border-radius:4px;margin:15px 0}";
  html += ".info-label{font-weight:bold;color:#555}";
  html += ".btn{display:inline-block;padding:12px 24px;background:#2e7d32;color:white;text-decoration:none;border-radius:4px;margin-top:15px}";
  html += ".btn:hover{background:#1b5e20}";
  html += "</style></head><body>";

  html += "<div class='container'>";
  html += "<h1>🌱 Serra ESP</h1>";
  html += "<div class='info'>";
  html += "<div><span class='info-label'>Device ID:</span> " + String(deviceConfig.composite_device_id) + "</div>";
  html += "<div><span class='info-label'>IP:</span> " + WiFi.localIP().toString() + "</div>";
  html += "<div><span class='info-label'>WiFi:</span> " + String(deviceConfig.wifi_ssid) + "</div>";
  html += "<div><span class='info-label'>RSSI:</span> " + String(WiFi.RSSI()) + " dBm</div>";
  html += "</div>";
  html += "<a href='/config' class='btn'>⚙️ Configura Sensori</a>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);
}

void handleConfig() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Configura Sensori</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:20px;background:#f0f0f0}";
  html += ".container{max-width:600px;margin:0 auto;background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}";
  html += "h1{color:#2e7d32;margin-top:0}";
  html += ".sensor{background:#f5f5f5;padding:15px;margin:15px 0;border-radius:4px;border-left:4px solid #2e7d32}";
  html += "label{display:block;margin:8px 0 4px;font-weight:bold;color:#555}";
  html += "input,select{width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;box-sizing:border-box}";
  html += ".btn{display:inline-block;padding:12px 24px;background:#2e7d32;color:white;border:none;border-radius:4px;cursor:pointer;width:100%;margin-top:10px}";
  html += ".btn:hover{background:#1b5e20}";
  html += ".back{background:#666;margin-bottom:10px}";
  html += ".back:hover{background:#444}";
  html += ".info{background:#fff3cd;padding:10px;border-radius:4px;margin-bottom:15px;font-size:14px}";
  html += "</style></head><body>";

  html += "<div class='container'>";
  html += "<h1>⚙️ Configura Sensori</h1>";

  html += "<div class='info'>💡 <strong>Pin disponibili:</strong> GPIO 4 (D2), 5 (D1), 12 (D6), 13 (D7), 14 (D5)</div>";

  html += "<form method='POST' action='/config'>";

  for (int i = 0; i < MAX_SENSORS; i++) {
    html += "<div class='sensor'>";
    html += "<h3>Sensore " + String(i + 1) + "</h3>";

    html += "<label>Pin GPIO</label>";
    html += "<input type='number' name='pin" + String(i) + "' value='" + String(deviceConfig.sensors[i].pin) + "' min='0' max='16'>";

    html += "<label>Tipo</label>";
    html += "<select name='type" + String(i) + "'>";
    for (int t = 0; t < 5; t++) {
      html += "<option value='" + String(t) + "'";
      if (deviceConfig.sensors[i].type == t) html += " selected";
      html += ">" + String(sensorTypeNames[t]) + "</option>";
    }
    html += "</select>";

    html += "<label>Nome (opzionale)</label>";
    html += "<input type='text' name='name" + String(i) + "' value='" + String(deviceConfig.sensors[i].name) + "' maxlength='31' placeholder='Es: Temperatura Aria'>";

    html += "</div>";
  }

  html += "<button type='submit' class='btn'>💾 Salva Configurazione</button>";
  html += "</form>";
  html += "<a href='/' class='btn back'>← Torna Indietro</a>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);
}

void handleSaveConfig() {
  Serial.println("Saving sensor configuration...");

  for (int i = 0; i < MAX_SENSORS; i++) {
    String pinArg = "pin" + String(i);
    String typeArg = "type" + String(i);
    String nameArg = "name" + String(i);

    if (server.hasArg(pinArg)) {
      deviceConfig.sensors[i].pin = server.arg(pinArg).toInt();
      deviceConfig.sensors[i].type = server.arg(typeArg).toInt();

      String name = server.arg(nameArg);
      name.trim();
      strncpy(deviceConfig.sensors[i].name, name.c_str(), 31);
      deviceConfig.sensors[i].name[31] = '\0';

      Serial.printf("Sensor %d: Pin=%d, Type=%d, Name=%s\n",
        i, deviceConfig.sensors[i].pin, deviceConfig.sensors[i].type, deviceConfig.sensors[i].name);
    }
  }

  saveConfig();

  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta http-equiv='refresh' content='3;url=/'>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>Salvato</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:20px;background:#f0f0f0;text-align:center;padding-top:50px}";
  html += ".success{background:#4caf50;color:white;padding:20px;border-radius:8px;max-width:400px;margin:0 auto}";
  html += "</style></head><body>";
  html += "<div class='success'>";
  html += "<h2>✅ Configurazione Salvata!</h2>";
  html += "<p>Reindirizzamento in corso...</p>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);
}

void handleNotFound() {
  server.send(404, "text/plain", "404: Not Found");
}
