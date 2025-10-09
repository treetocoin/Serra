# Greenhouse Management System - User Guide

Welcome to the Greenhouse Management System! This guide will help you get started with monitoring and controlling your greenhouse using ESP32 devices.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Managing Devices](#managing-devices)
3. [Monitoring Sensors](#monitoring-sensors)
4. [Controlling Actuators](#controlling-actuators)
5. [Viewing Historical Data](#viewing-historical-data)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Create an Account

1. Navigate to the application URL
2. Click **Register** on the login page
3. Enter your email and password
4. Click **Create Account**
5. You'll be automatically logged in

### Sign In

1. Enter your email and password
2. Click **Sign In**
3. You'll be redirected to the Dashboard

### Password Reset

If you forget your password:

1. Click **Forgot Password?** on the login page
2. Enter your email address
3. Click **Send Reset Link**
4. Check your email for the reset link
5. Click the link and enter your new password

---

## Managing Devices

### Register a New Device

1. Go to **Dashboard** and click on the **Devices** card
2. Click **Register New Device**
3. Enter a descriptive name (e.g., "Greenhouse ESP32 #1")
4. Click **Register Device**
5. **⚠️ Important**: Copy the API key immediately - you won't see it again!
6. Save the API key securely - you'll need it for your ESP32 firmware

### View Device Status

On the **Devices** page, you'll see all your registered devices with:

- **Device Name**: Your custom name
- **Status**:
  - 🟢 **Online**: Device is active (last seen < 90 seconds ago)
  - 🔴 **Offline**: Device hasn't sent data recently
- **Last Seen**: Timestamp of last communication
- **Registered**: When you added the device

### View Device Details

1. Click on any device card
2. You'll see:
   - Device information (status, firmware version, etc.)
   - All sensors connected to this device
   - All actuators connected to this device

### Delete a Device

1. On the **Devices** page, find the device you want to remove
2. Click the **Delete** button (trash icon)
3. Confirm deletion
4. ⚠️ This will also delete all associated sensors, actuators, and data!

---

## Monitoring Sensors

### Auto-Discovery

Sensors are automatically registered when your ESP32 sends data for the first time. You don't need to manually add sensors!

When your ESP32 sends sensor readings:
- The system automatically creates a sensor entry
- The sensor appears in the device detail page
- Data starts being recorded immediately

### View Sensor Readings

1. Navigate to **Devices** → Click on a device
2. Scroll to the **Sensors** section
3. You'll see cards for each sensor showing:
   - **Sensor Type**: Temperature, humidity, soil moisture, etc.
   - **Current Value**: Latest reading with unit
   - **Timestamp**: When the reading was taken
   - **Status**:
     - ⚠️ **Anomaly Warning**: Value is outside normal range (if configured)

### Sensor Types

The system supports various sensor types:

- 🌡️ **Temperature**: Displayed in °C or °F
- 💧 **Humidity**: Displayed in %
- 🌱 **Soil Moisture**: Displayed in %
- ☀️ **Light**: Displayed in lux
- 📊 **CO2**: Displayed in ppm
- 🌊 **pH**: Displayed in pH units

### Anomaly Detection

If you've configured min/max thresholds for sensors:
- Values outside the range will be highlighted in red
- An alert triangle icon will appear
- A warning message will be displayed

---

## Controlling Actuators

### Auto-Discovery

Similar to sensors, actuators are automatically registered when your ESP32 reports them.

### View Actuators

1. Navigate to **Devices** → Click on a device
2. Scroll to the **Actuators** section
3. You'll see cards for each actuator

### Turn Actuator ON/OFF

1. Find the actuator you want to control
2. Click the **Power** button (⚡ icon)
3. The button will:
   - Turn green when ON
   - Turn gray when OFF
4. The ESP32 will execute the command within 30-60 seconds

### Control PWM Actuators

For actuators that support PWM (variable speed/intensity):

1. Use the **slider** to set the desired level (0-100%)
2. The value updates in real-time
3. The ESP32 will apply the new PWM value when it next polls for commands

### Command Status

Under each actuator, you'll see:
- **Status**: Current ON/OFF state
- **Last Command**:
  - 🟡 **Pending**: Command queued, waiting for ESP32
  - 🟢 **Executed**: Command successfully applied
  - 🔴 **Failed**: Command failed to execute

### Actuator Types

- 🔌 **Relay**: Generic on/off relay
- 💧 **Water Pump**: Irrigation pump
- 💨 **Fan**: Ventilation fan
- 🔥 **Heater**: Greenhouse heater
- 💡 **Light**: Grow lights
- 🚰 **Valve**: Water valve

---

## Viewing Historical Data

### Access Historical Data

1. Go to **Dashboard** → Click **History** card
2. Or navigate to `/history` directly

### Select Data to View

1. **Select Device**: Choose the device from the dropdown
2. **Select Sensor**: Choose which sensor's data to view
3. **Choose Date Range**: Use presets or custom dates

### Date Range Presets

Quick options available:
- **Last 24 hours**: Hourly detail
- **Last 7 days**: Hourly averages
- **Last 30 days**: Daily averages
- **Last 90 days**: Daily averages

### Understanding the Chart

The chart displays:
- **Green Line**: Average value (or raw value for short ranges)
- **Blue Dashed Line**: Minimum value (for aggregated data)
- **Red Dashed Line**: Maximum value (for aggregated data)

### Export Data

1. Select your device, sensor, and date range
2. Click **Export CSV** button
3. A CSV file will download with all data points
4. File format: `sensor-{name}-{date}.csv`

The CSV contains:
- Timestamp (local time)
- Value

---

## Troubleshooting

### Device Shows Offline

**Possible causes:**
1. ESP32 is not powered on
2. WiFi connection lost
3. API key is incorrect
4. ESP32 firmware is not running

**Solutions:**
- Check ESP32 power supply
- Verify WiFi credentials in firmware
- Verify API key matches the one generated
- Check ESP32 Serial Monitor for error messages

### Sensors Not Appearing

**Possible causes:**
1. ESP32 hasn't sent sensor data yet
2. Sensor data format is incorrect
3. API authentication failed

**Solutions:**
- Wait 30-60 seconds for first sensor reading
- Check ESP32 Serial Monitor for HTTP response codes
- Verify sensor_id format in firmware
- Ensure ESP32 is sending data in correct JSON format

### Actuator Commands Not Executing

**Possible causes:**
1. ESP32 is not polling for commands
2. Command polling interval is too long
3. Actuator ID doesn't match firmware

**Solutions:**
- Verify ESP32 is calling `pollForCommands()` regularly
- Check ESP32 Serial Monitor for command reception logs
- Ensure actuator_id in firmware matches web UI
- Verify command execution code is implemented

### Historical Data Not Loading

**Possible causes:**
1. No data in selected date range
2. Sensor hasn't been active long enough
3. Database connection issue

**Solutions:**
- Try a different date range
- Wait for more data to accumulate
- Check browser console for errors
- Verify Supabase connection

### Charts Not Rendering

**Possible causes:**
1. No data points available
2. Invalid date range
3. Browser compatibility issue

**Solutions:**
- Ensure sensor has recorded data
- Select a valid date range
- Try a different browser (Chrome, Firefox, Safari)
- Clear browser cache

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the **ESP32 Integration Guide** for firmware issues
2. Review browser console for error messages
3. Check Supabase dashboard for API issues
4. Consult the project repository for updates

---

## Best Practices

### Device Management
- Use descriptive device names (e.g., "Greenhouse A - North Corner")
- Keep API keys secure and never commit them to version control
- Register devices before deploying ESP32 hardware

### Sensor Monitoring
- Configure min/max thresholds for critical sensors
- Regularly check sensor readings for anomalies
- Use meaningful sensor names in your firmware

### Actuator Control
- Test actuator commands before deploying to production
- Monitor command execution status
- Implement fail-safes in ESP32 firmware

### Historical Data
- Export data regularly for backups
- Use appropriate date ranges to avoid overwhelming the chart
- Monitor data trends to optimize greenhouse conditions

---

**Happy Monitoring! 🌱**
