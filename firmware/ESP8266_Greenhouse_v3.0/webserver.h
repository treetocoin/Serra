#ifndef WEBSERVER_H
#define WEBSERVER_H

#include <ESP8266WebServer.h>
#include "config.h"

extern ESP8266WebServer server;

void setupWebServer();
void handleRoot();
void handleConfig();
void handleSaveConfig();
void handleNotFound();

#endif
