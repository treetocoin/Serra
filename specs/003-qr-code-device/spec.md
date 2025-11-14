# Feature Specification: QR Code Device Onboarding

**Feature Branch**: `003-qr-code-device`
**Created**: 2025-10-09
**Status**: Draft
**Input**: User description: "questo il flow utente per l'aggiunta del device: 1- dalla webapp aggiungo il device,2- mi genera un QR code che scannerizzo col telefono e mi collega all'AP per impostare il wifi. 3- una volta connessa , nel pannello di gestione dei device va online e si accende il bottone settings che mi porta alla pagina di setup dove l'ID è già impostato e io imposto sensori o attuatori"

## Clarifications

### Session 2025-10-09

- Q: What specific information should the QR code contain? → A: Only the WiFi AP SSID (standard WiFi QR format: "WIFI:S:serrasetup-a1b2;;") - user manually selects network
- Q: Should users be able to modify the device ID in the webapp's device setup page? → A: Read-only in webapp - ID is auto-generated and displayed only. Editable in ESP8266's web interface
- Q: How should the system handle duplicate device IDs within a user's account? → A: Allow duplicates - Multiple devices can have the same device ID (rely on UUID for uniqueness)
- Q: Can users access the QR code again after the initial registration? → A: Always accessible - QR code can be regenerated/viewed from device detail page anytime
- Q: When ESP8266 cannot connect to WiFi, how should the user be notified? → A: Multi-channel feedback - LED pattern + webapp status shows "connection failed" + ESP8266 returns to AP mode after timeout

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Device Registration with QR Code (Priority: P1)

A user needs to add a new ESP8266 device to their greenhouse system. They start from the web application, register the device, scan a QR code with their mobile phone to provide WiFi credentials to the device, and then configure sensors and actuators once the device is online.

**Why this priority**: This is the foundational user journey that enables all device management. Without this flow, users cannot add devices to the system. It represents the complete end-to-end onboarding experience.

**Independent Test**: Can be fully tested by registering a new device through the webapp, scanning the generated QR code with a mobile device, connecting the ESP8266 to WiFi via the AP, and verifying the device appears online in the device management panel with the ability to configure sensors/actuators.

**Acceptance Scenarios**:

1. **Given** a logged-in user on the devices page, **When** they click "Add Device" and provide a device name, **Then** a new device record is created with a unique ID and API key, and a QR code is displayed
2. **Given** a QR code displayed on screen, **When** the user scans it with their mobile phone, **Then** the phone connects to the ESP8266's WiFi access point
3. **Given** connected to the ESP8266 AP, **When** the user provides WiFi credentials through the captive portal, **Then** the ESP8266 connects to the home WiFi network and sends its first heartbeat
4. **Given** a device that has connected to WiFi, **When** the user views the device management panel, **Then** the device status shows as "online" and a "Settings" button becomes enabled
5. **Given** an online device, **When** the user clicks the "Settings" button, **Then** they are taken to the device setup page where the device ID is pre-filled and they can configure sensors and actuators
6. **Given** a registered device, **When** the user views the device detail page at any time, **Then** they can access and view the QR code again (it is not limited to one-time viewing)
7. **Given** incorrect WiFi credentials are provided, **When** the ESP8266 fails to connect, **Then** the device shows an LED error pattern, the webapp displays "connection failed" status, and the ESP8266 automatically returns to AP mode after timeout for retry

---

### User Story 2 - Display Device ID in Management Interface (Priority: P2)

A user managing multiple devices needs to see each device's unique identifier in the device management interface to match physical devices with their software records and troubleshoot connection issues.

**Why this priority**: This enhances device management by providing visibility into device identifiers, which is important for troubleshooting and matching physical devices to their records, but the core onboarding flow (P1) must work first.

**Independent Test**: Can be tested by viewing the device detail page and verifying the device ID is prominently displayed in the device information card.

**Acceptance Scenarios**:

1. **Given** a user viewing a device detail page, **When** the page loads, **Then** the device ID is displayed in the device information section
2. **Given** multiple devices registered, **When** the user views different device pages, **Then** each shows its unique device ID correctly

---

### User Story 3 - Configure Device ID During Setup (Priority: P3)

A user setting up a new ESP8266 device needs the ability to view and customize the device ID through the ESP8266's web interface during the initial setup process, allowing them to use meaningful identifiers for their devices. The webapp displays the device ID as read-only.

**Why this priority**: This is a quality-of-life improvement that allows users to customize device identifiers via the ESP8266 interface, but the system works perfectly well with auto-generated IDs (P1) and displaying those IDs (P2) comes first.

**Independent Test**: Can be tested by accessing the ESP8266's web configuration interface and verifying the device ID field is editable, while confirming the webapp shows the same ID as read-only.

**Acceptance Scenarios**:

1. **Given** a user accessing the ESP8266 web interface for the first time, **When** they view the setup page, **Then** the device ID field is visible, displays the assigned ID, and is editable
2. **Given** a user on the ESP8266 setup page, **When** they modify the device ID field and save, **Then** the new ID is persisted and used for all subsequent communications with the backend
3. **Given** a user who has customized the device ID on the ESP8266, **When** the device sends its heartbeat, **Then** the webapp displays the customized ID in the device management interface (read-only)
4. **Given** a user viewing the webapp device setup page, **When** they see the device ID field, **Then** it is displayed as read-only text and cannot be edited

---

### Edge Cases

- What happens when the user scans the QR code but the ESP8266 AP is not reachable?
- When WiFi credentials are incorrect or the ESP8266 cannot connect: Device shows LED error pattern, webapp displays "connection failed" status, and ESP8266 automatically returns to AP mode after timeout to allow retry
- If the user closes the QR code modal before scanning it, they can access it again anytime from the device detail page
- What happens when multiple devices are being set up simultaneously?
- What happens if the device ID is changed after sensors and actuators are already configured?
- What happens when a device goes offline during the setup process?
- Multiple devices can have the same custom device ID - the system relies on the auto-generated UUID for uniqueness

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated users to register new devices through the web application
- **FR-002**: System MUST generate a unique device ID and API key for each newly registered device
- **FR-003**: System MUST generate a QR code containing the WiFi AP connection information for each new device
- **FR-004**: QR code MUST encode only the ESP8266's WiFi AP SSID using standard WiFi QR format (e.g., "WIFI:S:serrasetup-a1b2;;") to enable user to manually select and connect to the network
- **FR-005**: System MUST display the generated QR code in a modal or dedicated view after device registration
- **FR-006**: System MUST allow users to view/regenerate the QR code at any time from the device detail page, even after initial registration
- **FR-007**: ESP8266 devices MUST create a WiFi access point when not connected to a network
- **FR-008**: ESP8266 devices MUST provide a captive portal web interface for WiFi configuration
- **FR-009**: ESP8266 devices MUST accept and store WiFi credentials (SSID and password) provided through the captive portal
- **FR-010**: ESP8266 devices MUST attempt to connect to the configured WiFi network after credentials are provided
- **FR-011**: ESP8266 devices MUST send a heartbeat to the backend once connected to WiFi
- **FR-012**: If WiFi connection fails, ESP8266 MUST indicate failure through LED error pattern, wait for timeout period, then automatically return to AP mode to allow user to retry
- **FR-013**: System MUST update device status to "online" when a heartbeat is received
- **FR-014**: System MUST display "connection failed" status in webapp when device does not send heartbeat within expected timeout period
- **FR-015**: Web application MUST display device connection status in real-time or near real-time (within 30 seconds)
- **FR-016**: Web application MUST enable the "Settings" button only when a device is online
- **FR-017**: Clicking the "Settings" button MUST navigate to the device setup page
- **FR-018**: Webapp device setup page MUST display the device ID in a read-only field (not editable)
- **FR-019**: Device setup page MUST allow configuration of sensors associated with the device
- **FR-020**: Device setup page MUST allow configuration of actuators associated with the device
- **FR-021**: System MUST persist device ID changes if the user modifies it via the ESP8266 web interface
- **FR-022**: System MUST display the device ID in the device management interface for all registered devices
- **FR-023**: ESP8266 web interface MUST display the assigned device ID on the setup page in an editable field, allowing users to customize the identifier
- **FR-024**: System MUST allow multiple devices to have the same device ID, relying on the auto-generated UUID for unique identification and data association

### Key Entities

- **Device Registration**: Represents a device being added to the system, includes device name, unique ID, API key, registration timestamp, and current connection status
- **QR Code Data**: Contains only the ESP8266's WiFi AP SSID encoded in standard WiFi QR format (e.g., "WIFI:S:serrasetup-a1b2;;"), enabling users to manually connect their phone to the device's access point
- **WiFi Configuration**: The SSID and password for the home network, provided by the user through the ESP8266's captive portal
- **Device Heartbeat**: A periodic signal sent by the ESP8266 to indicate it is online and connected, includes device ID and optional hostname
- **Device Setup Configuration**: The sensors and actuators associated with a device, configured through the web interface after the device is online

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the entire device onboarding process (registration, QR scan, WiFi setup, device online) in under 5 minutes
- **SC-002**: QR code successfully encodes connection information and is scannable by standard mobile QR readers
- **SC-003**: Device status updates from "offline" to "online" within 30 seconds of successful WiFi connection
- **SC-004**: 95% of users successfully connect their device to WiFi on the first attempt with correct credentials
- **SC-005**: Settings button becomes enabled immediately when device status changes to online
- **SC-006**: Device ID is prominently displayed in both the web application and ESP8266 web interface
- **SC-007**: Users can configure at least one sensor or actuator within 2 minutes of device coming online

## Assumptions

- Users have access to a mobile device with a camera and QR code scanning capability
- Users know their WiFi network credentials (SSID and password)
- The ESP8266 device is powered on and within range of the user during setup
- The ESP8266 firmware supports WiFi access point mode and captive portal functionality
- Users will typically be setting up devices one at a time rather than bulk provisioning
- Device IDs (customizable labels) can be duplicated within a user's account - the auto-generated UUID provides true uniqueness for system operations
- The web application has real-time or polling-based status updates to show device connection changes
- Mobile devices can connect to WiFi networks without internet access (for connecting to ESP8266 AP)

## Dependencies

- Existing user authentication system must be in place
- Device heartbeat RPC function must exist and accept device ID
- ESP8266 firmware must support WiFiManager or similar captive portal library
- Device detail page and device management infrastructure must exist
- Sensor and actuator configuration interfaces must be available
