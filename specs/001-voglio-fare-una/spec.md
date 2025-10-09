# Feature Specification: Home Greenhouse Management System

**Feature Branch**: `001-voglio-fare-una`
**Created**: 2025-10-08
**Status**: Draft
**Input**: User description: "voglio fare una webapp per gestire una serra casalinga. ci deve essere autenticazione e si devono poter collegare una o più ESP32 per i sensori e gli attuatori"

## Clarifications

### Session 2025-10-08

- Q: Historical data retention period - how long should sensor data be stored? → A: Indefinitely (until user deletes)
- Q: ESP32 device pairing process - how should initial device registration work? → A: ESP32 broadcasts availability, user approves from discovered devices list in webapp
- Q: Sensor and actuator configuration - how should the system learn about connected sensors/actuators? → A: Auto-discovery: ESP32 firmware reports connected sensors/actuators automatically
- Q: ESP32 authentication security - how should ESP32 devices authenticate with the system backend? → A: API key/token generated during device registration, stored in ESP32 firmware
- Q: ESP32-backend communication protocol - what protocol should devices use to communicate? → A: HTTP/HTTPS REST API (request-response pattern, ESP32 polls or pushes periodically)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Greenhouse Owner Account Setup (Priority: P1)

A greenhouse owner needs to create an account and access the system securely to begin monitoring their greenhouse environment.

**Why this priority**: Without authentication and account management, no other features can be accessed. This is the foundational entry point for all users.

**Independent Test**: Can be fully tested by creating a new account, logging in, and accessing a basic dashboard. Delivers immediate value by securing greenhouse access.

**Acceptance Scenarios**:

1. **Given** I am a new user, **When** I register with valid credentials, **Then** my account is created and I can log in
2. **Given** I am a registered user, **When** I log in with correct credentials, **Then** I access my greenhouse dashboard
3. **Given** I am logged in, **When** my session expires, **Then** I am prompted to re-authenticate
4. **Given** I forgot my password, **When** I use password recovery, **Then** I can reset and regain access

---

### User Story 2 - ESP32 Device Registration and Connection (Priority: P2)

A greenhouse owner needs to connect their ESP32 devices to the system so sensors and actuators can communicate with the webapp.

**Why this priority**: Device connectivity is essential for data collection and control, but requires authentication to be in place first.

**Independent Test**: Can be tested by registering at least one ESP32 device, verifying the connection status, and confirming data can flow between device and webapp.

**Acceptance Scenarios**:

1. **Given** I am logged in and an ESP32 is broadcasting availability, **When** I view the device discovery list, **Then** I see the broadcasting ESP32 device
2. **Given** I see an available ESP32 in discovery list, **When** I approve/register it to my account, **Then** the device appears in my registered devices list with a system-generated UUID and the system displays a unique API key/token for me to store in the ESP32 firmware
3. **Given** I have registered an ESP32 with the API key configured, **When** the device connects to the system using its API key, **Then** its status shows as "online"
4. **Given** I have multiple ESP32 devices, **When** I view my devices list, **Then** I see all devices with their current connection status
5. **Given** an ESP32 device is offline, **When** I attempt to communicate with it, **Then** I receive a clear "device offline" notification
6. **Given** I want to remove a device, **When** I delete it from my account, **Then** its API key is revoked and it can no longer connect to my greenhouse system

---

### User Story 3 - Real-time Sensor Monitoring (Priority: P3)

A greenhouse owner needs to view real-time data from sensors connected to ESP32 devices to understand current greenhouse conditions.

**Why this priority**: Monitoring is valuable but requires both authentication and device connectivity to function.

**Independent Test**: Can be tested by connecting an ESP32 with at least one sensor, sending data to the system, and viewing it in the webapp interface.

**Acceptance Scenarios**:

1. **Given** I have a registered ESP32 with sensors connected, **When** the ESP32 reports its sensors, **Then** I see the auto-discovered sensors listed for that device
2. **Given** I have auto-discovered sensors, **When** sensors collect data, **Then** I see the readings update in the webapp within 30-60 seconds
3. **Given** I am viewing sensor data, **When** I navigate to a specific device, **Then** I see all sensors associated with that device
4. **Given** multiple sensors are reporting data, **When** I view my dashboard, **Then** I see a summary of all current sensor readings
5. **Given** a sensor reading exceeds normal ranges, **When** this occurs, **Then** I receive a visual indicator highlighting the anomaly

---

### User Story 4 - Actuator Control (Priority: P4)

A greenhouse owner needs to control actuators (irrigation, ventilation, lighting, etc.) connected to ESP32 devices to manage greenhouse conditions.

**Why this priority**: Control functionality builds on monitoring and allows active greenhouse management.

**Independent Test**: Can be tested by connecting an ESP32 with at least one actuator, sending a control command from the webapp, and verifying the actuator responds.

**Acceptance Scenarios**:

1. **Given** I have a registered ESP32 with actuators connected, **When** the ESP32 reports its actuators, **Then** I see the auto-discovered actuators listed for that device
2. **Given** I have auto-discovered actuators, **When** I trigger an actuator command, **Then** the actuator responds and I receive confirmation
3. **Given** I want to control irrigation, **When** I activate the water pump, **Then** the pump turns on and I see its active status
4. **Given** I want to turn off an actuator, **When** I send the off command, **Then** the actuator stops and status updates to inactive
5. **Given** an ESP32 device is offline, **When** I attempt to control its actuators, **Then** I receive an error message and the command is not sent

---

### User Story 5 - Historical Data Review (Priority: P5)

A greenhouse owner wants to review historical sensor data to identify patterns and optimize greenhouse management over time.

**Why this priority**: Historical analysis is valuable but not critical for basic greenhouse operation.

**Independent Test**: Can be tested by collecting sensor data over time, then retrieving and displaying historical readings for a specified date range.

**Acceptance Scenarios**:

1. **Given** I have historical sensor data, **When** I select a date range, **Then** I see sensor readings for that period
2. **Given** I am viewing historical data, **When** I choose a specific sensor type, **Then** I see only data from that sensor
3. **Given** I want to understand trends, **When** I view historical data, **Then** readings are presented in a visual format (graphs/charts)

---

### Edge Cases

- What happens when an ESP32 loses network connectivity temporarily? (data buffering, reconnection handling)
- How does the system handle an ESP32 sending malformed or corrupted sensor data?
- What happens when a user tries to register a device that's already registered to another account?
- How does the system handle concurrent control commands sent to the same actuator?
- What happens when a user remains logged in across multiple devices simultaneously?
- How does the system behave if an ESP32 sends data at an extremely high frequency?
- What happens when sensor values exceed physically impossible ranges?
- What happens when an ESP32 attempts to connect with an invalid or revoked API key/token?
- How does the system handle API key/token regeneration if a user suspects their device has been compromised?
- What happens if a user loses the API key/token before configuring it in the ESP32 firmware?

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Security**

- **FR-001**: System MUST allow users to register accounts with email and password
- **FR-002**: System MUST validate email addresses during registration
- **FR-003**: System MUST enforce password strength requirements (minimum 8 characters, mix of letters and numbers)
- **FR-004**: System MUST provide secure login functionality with session management
- **FR-005**: System MUST offer password reset functionality via email
- **FR-006**: System MUST automatically expire inactive sessions after 24 hours
- **FR-007**: System MUST prevent unauthorized access to user greenhouses and devices

**Device Management**

- **FR-008**: System MUST allow users to register multiple ESP32 devices to their account
- **FR-009**: System MUST uniquely identify each ESP32 device using a system-generated unique device ID (UUID) created during initial device registration
- **FR-009a**: System MUST provide a device discovery interface showing ESP32 devices broadcasting availability
- **FR-009b**: System MUST allow users to approve/register discovered ESP32 devices from the discovery list
- **FR-009c**: System MUST assign a UUID to each ESP32 upon user approval during the registration process
- **FR-009d**: System MUST generate a unique API key/token for each ESP32 device during registration
- **FR-009e**: System MUST display the generated API key/token to the user once during registration for storage in ESP32 firmware
- **FR-009f**: System MUST require ESP32 devices to authenticate all backend communications using their assigned API key/token
- **FR-010**: System MUST display real-time connection status for each registered ESP32 device
- **FR-011**: System MUST allow users to assign custom names/labels to their ESP32 devices
- **FR-012**: System MUST allow users to remove/deregister ESP32 devices from their account
- **FR-012a**: System MUST revoke API keys/tokens when devices are removed from user accounts
- **FR-013**: System MUST prevent duplicate device registration across different user accounts
- **FR-013a**: System MUST reject communications from ESP32 devices with invalid or revoked API keys/tokens

**Sensor Data Collection**

- **FR-014**: System MUST receive and process sensor data from connected ESP32 devices via HTTP/HTTPS REST API
- **FR-014a**: System MUST automatically discover and register sensors reported by ESP32 firmware
- **FR-014b**: System MUST display auto-discovered sensors to the user showing sensor type, identifier, and associated device
- **FR-014c**: System MUST provide REST API endpoints for ESP32 devices to push sensor data using their API key/token authentication
- **FR-015**: System MUST support multiple sensor types per ESP32 device (temperature, humidity, soil moisture, light levels, etc.)
- **FR-016**: System MUST timestamp all incoming sensor readings
- **FR-017**: System MUST validate sensor data for reasonable value ranges
- **FR-018**: System MUST store sensor data indefinitely for historical analysis until explicitly deleted by the user
- **FR-018a**: System MUST provide users the ability to delete historical sensor data by date range or device
- **FR-019**: System MUST display current sensor readings to users in real-time

**Actuator Control**

- **FR-020**: System MUST allow users to send control commands to actuators connected to ESP32 devices
- **FR-020a**: System MUST automatically discover and register actuators reported by ESP32 firmware
- **FR-020b**: System MUST display auto-discovered actuators to the user showing actuator type, identifier, current state, and associated device
- **FR-020c**: System MUST queue actuator commands when users trigger them, making them available via REST API for ESP32 devices to poll
- **FR-020d**: System MUST provide REST API endpoints for ESP32 devices to retrieve pending actuator commands using their API key/token authentication
- **FR-020e**: System MUST allow ESP32 devices to confirm command execution via REST API callback
- **FR-021**: System MUST provide feedback when actuator commands are successfully queued for delivery
- **FR-022**: System MUST prevent actuator control when the target ESP32 device is offline
- **FR-023**: System MUST support common actuator types (pumps, fans, lights, valves, etc.)
- **FR-024**: System MUST log all actuator control commands with timestamps and user identification

**Data Presentation**

- **FR-025**: System MUST provide a dashboard view showing all devices and their status
- **FR-026**: System MUST display sensor readings grouped by device
- **FR-027**: System MUST allow users to view historical sensor data for specified date ranges
- **FR-028**: System MUST present historical data in visual format (graphs/charts)

### Key Entities

- **User Account**: Represents a greenhouse owner with authentication credentials, email, account creation date, and associations to owned ESP32 devices
- **ESP32 Device**: Represents a physical microcontroller with unique identifier (UUID), API key/token for authentication, custom name/label, connection status, registration timestamp, and association to owner account
- **Sensor**: Represents a data collection point with sensor type (temperature, humidity, etc.), current reading, measurement unit, associated ESP32 device, and configuration parameters
- **Actuator**: Represents a controllable device with actuator type (pump, fan, light, etc.), current state (on/off), associated ESP32 device, and control capabilities
- **Sensor Reading**: Represents a data point with timestamp, sensor identifier, measured value, and validation status
- **Control Command**: Represents an actuator action with timestamp, user who issued command, target actuator, command type (on/off/set value), and execution status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete account registration and first login in under 3 minutes
- **SC-002**: Users can register a new ESP32 device in under 2 minutes
- **SC-003**: Sensor data appears in the webapp within 60 seconds of being sent by the ESP32
- **SC-004**: Actuator control commands are delivered to ESP32 devices within 60 seconds (on next polling cycle)
- **SC-005**: System maintains stable communication with at least 10 ESP32 devices per user account simultaneously
- **SC-006**: Users can retrieve and view historical data for any date range without performance degradation
- **SC-007**: 95% of users successfully connect their first ESP32 device without support assistance
- **SC-008**: System handles continuous sensor data streams from all connected devices without data loss

## Assumptions *(optional)*

- Users have basic technical knowledge to configure ESP32 devices with network connectivity
- ESP32 devices have stable internet connectivity (WiFi or Ethernet)
- Users own or have access to appropriate sensors and actuators compatible with ESP32
- Greenhouse environment allows for wireless connectivity throughout
- Users access the webapp from modern web browsers (Chrome, Firefox, Safari, Edge - latest versions)
- Each ESP32 device is configured with the necessary firmware to communicate with the webapp
- Users operate home greenhouses of reasonable scale (not industrial operations)
- Sensor data frequency is reasonable (not exceeding one reading per second per sensor)

## Dependencies *(optional)*

- ESP32 devices must have compatible firmware/software to communicate with the webapp backend via HTTP/HTTPS REST API
- ESP32 firmware must support periodic polling (30-60 second intervals) for sensor data push and actuator command retrieval
- Email service provider for sending registration confirmations and password reset emails
- Network infrastructure (internet connection) for both user access and ESP32 device connectivity
- Compatible sensors and actuators available for ESP32 integration
- HTTPS/TLS support for secure ESP32-backend communication

## Out of Scope *(optional)*

- Mobile native applications (iOS/Android) - webapp only in this phase
- Automated greenhouse control algorithms or AI-based recommendations
- Multi-user collaborative greenhouse management (sharing access with others)
- Integration with third-party smart home systems (Alexa, Google Home, etc.)
- Hardware sales or device provisioning services
- Professional/commercial greenhouse operations with advanced requirements
- Video streaming or camera integration for visual greenhouse monitoring
- Marketplace or community features for sharing greenhouse configurations
