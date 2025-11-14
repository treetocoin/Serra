#ifndef SENSORS_H
#define SENSORS_H

#include <DHT.h>
#include "config.h"

#define MAX_DHT_SENSORS 4

extern DHT* dhtSensors[MAX_DHT_SENSORS];

void initializeSensors();
void readAndSendSensorData();
bool sendSensorReadings();

#endif
