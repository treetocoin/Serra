# Feature Specification: Standard Sensor Configuration and Dynamic Charting

**Feature Branch**: `004-deve-funzionare-così`
**Created**: 2025-11-13
**Status**: Draft
**Input**: User description: "deve funzionare così: ogni progetto accetta dati standard: DHT Sopra ( mi da Tsopra e Hsopra all'altezza del soffitto) , DHT Sotto ( mi da gli stessi valori, ma a livello del terreno; Soil Moisture che mi da l'umidità del terreno ( prevedi di aggiungerne fino a 5) e water level. quando aggiungo un device, dalla pagina del device sulla webapp voglio indicare che sensori sono attaccati a quel device e in quali porte. da quel momento le letture di quei sensori vanno nei grafici appropriati i grafici appaiono solo se ci sono dati"

## User Scenarios & Testing

### User Story 1 - Configure Standard Sensors on Device (Priority: P1)

A user adds a physical device to their greenhouse and needs to tell the system which standard sensors are connected and where they're plugged in (which port). Once configured, the system automatically displays sensor data in the appropriate charts.

**Why this priority**: This is the foundational capability - without it, no sensor data can be properly categorized and displayed. It's the minimum viable feature that delivers immediate value.

**Independent Test**: Can be fully tested by adding a device, configuring one sensor with its port, sending test readings, and verifying the correct chart appears with the data.

**Acceptance Scenarios**:

1. **Given** I am viewing a device detail page, **When** I click "Configure Sensors", **Then** I see a form with available standard sensor types (DHT Sopra, DHT Sotto, Soil Moisture 1-5, Water Level) and port input fields
2. **Given** I select "DHT Sopra" and enter port "GPIO4", **When** I save the configuration, **Then** the device configuration shows DHT Sopra mapped to GPIO4
3. **Given** my device sends temperature and humidity readings from port GPIO4, **When** the system receives these readings, **Then** they appear as the ceiling-level line in the Temperature chart and the ceiling-level line in the Humidity chart
4. **Given** no readings have been received for a configured sensor, **When** I view the dashboard, **Then** that sensor's chart is not displayed (only shows when data exists)

---

### User Story 2 - Configure Multiple Soil Moisture Sensors (Priority: P2)

A user with multiple soil moisture sensors (up to 5) needs to assign each sensor to a specific port and identify which area of the greenhouse it monitors. The system displays separate charts for each soil moisture sensor.

**Why this priority**: Extends P1 functionality for a critical use case where multiple sensors of the same type monitor different zones. Essential for meaningful soil monitoring but depends on P1's configuration mechanism.

**Independent Test**: Can be tested by configuring 3 different soil moisture sensors on different ports, sending readings from each, and verifying 3 distinct soil moisture charts appear.

**Acceptance Scenarios**:

1. **Given** I am configuring sensors on a device, **When** I select "Soil Moisture 1" on GPIO14 and "Soil Moisture 2" on GPIO12, **Then** both configurations are saved independently
2. **Given** my device sends soil moisture readings from GPIO14 and GPIO12, **When** the system receives these readings, **Then** two separate "Soil Moisture" charts appear, labeled "Soil Moisture 1" and "Soil Moisture 2"
3. **Given** I have configured 5 soil moisture sensors, **When** I attempt to add a 6th, **Then** the system prevents the addition and shows "Maximum 5 soil moisture sensors allowed per device"

---

### User Story 3 - Update Sensor Configuration (Priority: P3)

A user needs to change which sensor is connected to a port (e.g., moved DHT sensor from GPIO4 to GPIO5, or replaced DHT Sopra with DHT Sotto). Historical data should remain associated with the original configuration.

**Why this priority**: Enables operational flexibility but is not required for initial deployment. Users can work around by removing and re-adding devices, though less convenient.

**Independent Test**: Can be tested by configuring a sensor, collecting some readings, changing the port assignment, and verifying old data remains visible while new readings go to the updated configuration.

**Acceptance Scenarios**:

1. **Given** a device has "DHT Sopra" configured on GPIO4 with historical data, **When** I change the port to GPIO5, **Then** new readings from GPIO5 appear as the ceiling line in the Temperature and Humidity charts
2. **Given** a device has "DHT Sopra" configured, **When** I change it to "DHT Sotto" on the same port, **Then** new readings appear as the ground line instead of the ceiling line in the Temperature and Humidity charts
3. **Given** a sensor configuration change is made, **When** I view historical data, **Then** historical readings remain permanently associated with their original sensor type (e.g., data collected as "DHT Sopra" always appears as DHT Sopra regardless of subsequent pin reassignments)

---

### Edge Cases

- What happens when a device sends readings from a port that hasn't been configured in the webapp? (Should system ignore, log warning, or auto-create generic sensor?)
- What happens when a user removes a sensor configuration that has historical data? (Should data be deleted, archived, or remain visible with "deleted sensor" label?)
- What happens when two sensors are accidentally assigned to the same port? (Should system prevent this, or allow with warning?)
- What happens when a device sends malformed sensor readings? (Should system skip the reading, log error, or alert user?)
- How should the system handle rapid configuration changes (e.g., user changing settings while device is actively sending data)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a predefined list of standard sensor types: DHT Sopra (Temperature + Humidity at ceiling), DHT Sotto (Temperature + Humidity at ground), Soil Moisture (5 instances), and Water Level
- **FR-002**: System MUST allow users to assign each standard sensor type to a specific port identifier (e.g., GPIO4, A0) on a device
- **FR-003**: System MUST store the mapping between device, sensor type, and port identifier
- **FR-004**: System MUST route incoming sensor readings to the appropriate chart based on the device-sensor-port configuration
- **FR-005**: System MUST support configuring up to 5 independent Soil Moisture sensors per device
- **FR-006**: System MUST only display charts for sensors that have received at least one reading
- **FR-007**: System MUST hide charts for sensors with no data (dynamic chart visibility)
- **FR-008**: System MUST prevent duplicate port assignments on the same device
- **FR-009**: Users MUST be able to access sensor configuration from the device detail page
- **FR-010**: System MUST persist sensor configuration independently of sensor readings
- **FR-011**: System MUST generate separate charts for each soil moisture sensor instance (Soil Moisture 1 through 5)
- **FR-012**: System MUST display temperature and humidity data in two combined charts with visual differentiation (one Temperature chart showing both ceiling and ground lines, one Humidity chart showing both ceiling and ground lines, using color coding and legend for distinction)
- **FR-013**: Users MUST be able to modify sensor configurations after initial setup
- **FR-014**: System MUST validate that port identifiers match expected format (alphanumeric, no special characters except dash/underscore)
- **FR-015**: System MUST permanently associate sensor readings with the sensor type active at the time of data collection (configuration changes do not retroactively relabel historical data)

### Key Entities

- **Device Sensor Configuration**: Represents the physical connection between a sensor type and a device port. Contains device ID, sensor type (from predefined list), port identifier, and configuration timestamp. Each configuration is unique per device-port combination.

- **Standard Sensor Type**: A predefined sensor category with specific measurement semantics. Includes: DHT Sopra (produces ceiling-level temperature and humidity), DHT Sotto (produces ground-level temperature and humidity), Soil Moisture 1-5 (individual soil moisture measurements), Water Level (water reservoir level). Each type determines which chart category receives the data.

- **Sensor Reading**: A data point from a configured sensor, containing device ID, port identifier, measurement value(s), and timestamp. Linked to Device Sensor Configuration via device ID + port to determine which chart receives the data.

- **Dynamic Chart**: A visualization component that appears only when data exists. Can display data from multiple sensor types with visual differentiation (e.g., Temperature chart displays both DHT Sopra and DHT Sotto readings as separate lines with color coding).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can configure all sensors for a device in under 3 minutes
- **SC-002**: System correctly routes 100% of sensor readings to appropriate charts based on configuration
- **SC-003**: Charts appear within 5 seconds of receiving first sensor reading
- **SC-004**: Users can identify which sensor is connected to which port by viewing device configuration without external documentation
- **SC-005**: System prevents configuration errors (duplicate ports, invalid formats) before data collection begins
- **SC-006**: Dashboard shows only relevant charts, reducing visual clutter by hiding empty data categories

## Assumptions

- Port identifiers are device-specific and assigned by the user (system doesn't auto-detect physical ports)
- Each port can only have one sensor type assigned at a time
- DHT sensors inherently provide both temperature and humidity in a single reading
- Soil moisture sensors provide a single numeric value (percentage or raw reading)
- Water level sensor provides a single numeric value (depth, percentage, or volume)
- Default chart display format (line charts over time) is acceptable for all sensor types
- Users understand their device's port naming convention (e.g., GPIO pin numbers)
- Configuration is manual - no auto-discovery of connected sensors
- Charts should show readings from the last 24 hours by default (or configurable time range from existing features)

## Dependencies

- Existing device management system (device registration and detail pages)
- Existing charting infrastructure (from feature 002-crea-e-implementa with Recharts)
- Existing sensor reading ingestion pipeline (API endpoints that receive sensor data from devices)

## Out of Scope

- Auto-detection of physically connected sensors
- Custom sensor type creation (only predefined types supported)
- Sensor calibration or data transformation (readings displayed as received)
- Multi-device aggregation (e.g., averaging soil moisture across multiple devices)
- Alerting or automation rules based on sensor thresholds
- Sensor health monitoring or connectivity status
- Historical configuration audit trail (when configuration was changed)
