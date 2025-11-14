#ifndef HEARTBEAT_H
#define HEARTBEAT_H

#include <ESP8266WiFi.h>
#include "config.h"

struct HeartbeatResponse {
  bool success;
  int config_version;
};

HeartbeatResponse sendHeartbeat();
bool fetchAndApplyCloudConfig();

#endif
