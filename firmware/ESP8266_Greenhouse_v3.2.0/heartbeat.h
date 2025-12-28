#ifndef HEARTBEAT_H
#define HEARTBEAT_H

#include <ESP8266WiFi.h>
#include <ArduinoJson.h>
#include "config.h"
#include "commands.h"

struct HeartbeatResponse {
  bool success;
  int config_version;
  DeviceCommand command;  // Pending command from server
};

HeartbeatResponse sendHeartbeat();
bool fetchAndApplyCloudConfig();

#endif
