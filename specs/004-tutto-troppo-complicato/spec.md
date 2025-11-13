# Feature Specification: Simplified Device Onboarding with Project-Scoped Device IDs

**Feature Branch**: `004-tutto-troppo-complicato`
**Created**: 2025-11-12
**Updated**: 2025-11-12
**Status**: Draft
**Input**: User description: "tutto troppo complicato, studia la codebase e suggeriscimi il metodo più semplice ( anche se necessario fare hard coding dei codici nel firmware, per aggiungere i vari ESP" + "we have to build it ready for the next improvement which is to have, a greenhouse or more for every user, we should give the project an id and the final esp id will be a concat from the fixed and the project id"

## Clarifications

### Session 2025-11-12

- Q: Heartbeat frequency - how often should ESP devices send heartbeat messages? → A: Every 60 seconds (balanced approach: 2 heartbeats fit in 2-minute offline window, recovery detection within 1 minute)
- Q: Project ID uniqueness scope - are project IDs globally unique across all users or per-user unique? → A: Global - PROJ1 exists once across entire system (all users share same sequence, prevents any device ID collisions)
- Q: ESP portal project ID input method - dropdown or text input? → A: Text input field with automatic uppercase normalization (user types "proj1" and system converts to "PROJ1", case-insensitive for better UX)
- Q: Last project deletion behavior - block deletion or warn with confirmation? → A: Warn with confirmation - show warning "This is your last project. Deleting it will remove all devices. Continue?" with Yes/No, allow deletion if confirmed
- Q: Project name uniqueness - can multiple projects have the same name? → A: Globally unique - project names must be unique across entire system (only one "Main Greenhouse" exists globally), both name and ID are globally unique

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Project (Priority: P1)

A greenhouse owner wants to set up a new greenhouse location. They open the webapp, create a new project with a name (e.g., "Main Greenhouse"), and the system automatically generates a unique 5-character project ID (e.g., "PROJ1"). This project will serve as a container for all devices in that greenhouse.

**Why this priority**: Projects are the foundation of the multi-greenhouse architecture. Without projects, users cannot organize devices by location. This is the first step before adding any devices.

**Independent Test**: Can be fully tested by creating a project in the webapp and verifying it appears with a generated project ID, without needing to add any devices.

**Acceptance Scenarios**:

1. **Given** I am logged into the webapp, **When** I navigate to Projects section, **Then** I see an "Add Project" button
2. **Given** I click "Add Project", **When** I enter name "Main Greenhouse" and click Submit, **Then** a new project is created with auto-generated ID "PROJ1"
3. **Given** I have created project PROJ1 with name "Main Greenhouse", **When** I try to create another project with name "Main Greenhouse", **Then** system shows error "Project name already exists - please choose a different name"
4. **Given** I have created project PROJ1, **When** I create a second project "North Greenhouse", **Then** it gets ID "PROJ2" (sequential numbering)
5. **Given** I have multiple projects, **When** I view the projects list, **Then** I see all my projects with their IDs and names
6. **Given** I have created a project, **When** I navigate away and return, **Then** my projects are still listed with the same IDs

---

### User Story 2 - Register Device in Webapp (Priority: P1)

A greenhouse owner wants to add a new ESP device to one of their projects. They open the webapp, select a project (e.g., "PROJ1 - Main Greenhouse"), select an available device ID from a predefined list (ESP1-ESP20), and give it a friendly name. The system creates a device with combined ID "PROJ1-ESP5". The device is now waiting for the physical ESP to connect.

**Why this priority**: This is the core device registration flow. Without this, users cannot claim device IDs for their ESPs within their projects.

**Independent Test**: Can be fully tested by registering a device in the webapp and verifying it appears in the device list with "waiting for connection" status and correct combined ID format, without needing a physical ESP device.

**Acceptance Scenarios**:

1. **Given** I have project PROJ1, **When** I click "Add Device" from the project page, **Then** I see a form with a dropdown showing available device IDs (ESP1-ESP20) for this project
2. **Given** I see the device registration form for PROJ1, **When** I select "ESP5" and enter name "Temperature Sensor" and click Submit, **Then** the device appears with ID "PROJ1-ESP5" and status "waiting for connection"
3. **Given** PROJ1-ESP5 is already registered, **When** I view the device ID dropdown for PROJ1, **Then** ESP5 is not shown in the available options for PROJ1
4. **Given** I have registered PROJ1-ESP5, **When** I try to register ESP5 in project PROJ2, **Then** ESP5 is available (device IDs are scoped per project)
5. **Given** I have registered a device, **When** I navigate to the devices page, **Then** I see the device listed with its full ID "PROJ1-ESP5" and friendly name

---

### User Story 3 - Configure ESP Device via WiFi Portal (Priority: P1)

A greenhouse owner powers on their new ESP device. The device creates a WiFi access point called "Serra-Setup". They connect their phone to this AP, which opens a configuration portal. In the portal, they see a text input field for project ID and a dropdown of device IDs (ESP1-ESP20). They enter the project ID that matches what they registered in the webapp (e.g., type "PROJ1" or "proj1" - automatically normalized to uppercase) and select the device ID (e.g., "ESP5"), enter their home WiFi credentials, and submit. The ESP saves the combined device ID "PROJ1-ESP5" along with WiFi configuration and restarts.

**Why this priority**: This is the critical step that links the physical ESP to the registered device in the webapp. Without this, the device cannot identify itself or connect to the user's network.

**Independent Test**: Can be tested by connecting to the ESP's access point, submitting the configuration form with project ID, device ID, and WiFi credentials, and verifying the ESP saves the combined ID configuration (can be checked by inspecting EEPROM or device restart behavior).

**Acceptance Scenarios**:

1. **Given** I power on a new ESP device, **When** I scan for WiFi networks on my phone, **Then** I see "Serra-Setup" access point
2. **Given** I connect to "Serra-Setup" AP, **When** the captive portal opens, **Then** I see a configuration form with project ID text input field, device ID dropdown (ESP1-ESP20), and WiFi credentials fields
3. **Given** I am on the configuration portal, **When** I enter "proj1" (lowercase) in project ID field, select "ESP5" from dropdown, enter WiFi SSID "MyWiFi" and password "MyPassword123", and click Submit, **Then** I see a success message and the system has normalized "proj1" to "PROJ1"
4. **Given** I have submitted valid configuration, **When** the ESP restarts, **Then** it attempts to connect to "MyWiFi" using the saved credentials and identifies itself as "PROJ1-ESP5"
5. **Given** I submit configuration with invalid WiFi credentials, **When** ESP fails to connect after 30 seconds, **Then** ESP recreates "Serra-Setup" AP for reconfiguration

---

### User Story 4 - Automatic Device Connection (Priority: P1)

After configuring the ESP device via the WiFi portal, the device connects to the user's home WiFi network and sends a heartbeat message to the backend, identifying itself with the configured combined device ID (e.g., "PROJ1-ESP5"). The backend matches this ID with the device registered in the webapp and updates the device status from "waiting for connection" to "online". The user sees their device go online in the webapp.

**Why this priority**: This completes the full onboarding cycle and allows users to start using the device. Without this automatic connection, users would have no feedback that their device setup was successful.

**Independent Test**: Can be tested by mocking a heartbeat from device ID "PROJ1-ESP5" and verifying the webapp updates the corresponding device status to "online" within a few seconds.

**Acceptance Scenarios**:

1. **Given** I have registered PROJ1-ESP5 in the webapp and configured the physical ESP with project "PROJ1" and device "ESP5" and valid WiFi, **When** the ESP connects to WiFi and sends heartbeat as "PROJ1-ESP5", **Then** I see PROJ1-ESP5 status change to "online" in the webapp within 10 seconds
2. **Given** PROJ1-ESP5 is online, **When** I click on PROJ1-ESP5 in the device list, **Then** I see the device details page with "Settings" button enabled
3. **Given** an ESP sends heartbeat with ID "PROJ1-ESP5" but no device with PROJ1-ESP5 is registered, **When** heartbeat is received, **Then** the heartbeat is rejected or ignored (device must be pre-registered)
4. **Given** PROJ1-ESP5 is registered to User A and PROJ2-ESP5 is registered to User B, **When** a physical ESP sends heartbeat as "PROJ1-ESP5", **Then** only User A sees PROJ1-ESP5 go online (project-scoped ownership)
5. **Given** PROJ1-ESP5 has been online, **When** PROJ1-ESP5 stops sending heartbeats for more than 2 minutes, **Then** PROJ1-ESP5 status changes to "offline"

---

### User Story 5 - Delete and Re-register Device (Priority: P2)

A greenhouse owner wants to remove an old ESP device (PROJ1-ESP7) from their system and either replace it with a new ESP using the same ID, or free up that ID for future use within the same project. They delete PROJ1-ESP7 from the webapp, which makes "ESP7" available again in the device ID dropdown for project PROJ1.

**Why this priority**: This provides flexibility to manage the device lifecycle, but is not critical for initial onboarding. Users can delete and re-add devices as needed.

**Independent Test**: Can be tested by registering a device, deleting it from the webapp, and verifying the device ID becomes available in the dropdown for that project again.

**Acceptance Scenarios**:

1. **Given** I have registered PROJ1-ESP7, **When** I click "Delete" on PROJ1-ESP7 device card and confirm deletion, **Then** PROJ1-ESP7 is removed from my device list
2. **Given** I have deleted PROJ1-ESP7, **When** I click "Add Device" for project PROJ1, **Then** ESP7 appears in the available device ID dropdown for PROJ1
3. **Given** I have deleted PROJ1-ESP7 while it was online, **When** the physical ESP sends another heartbeat as "PROJ1-ESP7", **Then** the heartbeat is rejected (device no longer registered)
4. **Given** I delete PROJ1-ESP7 and immediately re-register PROJ1-ESP7, **When** I configure a new physical ESP with project "PROJ1" and device "ESP7", **Then** the new ESP connects successfully and shows as PROJ1-ESP7 online

---

### User Story 6 - Delete Project (Priority: P2)

A greenhouse owner wants to remove an entire project (e.g., "PROJ1 - Main Greenhouse") that is no longer in use. They delete the project from the webapp, which also deletes all devices associated with that project and makes the device IDs available for re-registration in other projects.

**Why this priority**: This provides organizational flexibility but is not critical for initial use. Users may need to reorganize their greenhouses over time.

**Independent Test**: Can be tested by creating a project with devices, deleting the project, and verifying all associated devices are also deleted.

**Acceptance Scenarios**:

1. **Given** I have project PROJ1 with devices PROJ1-ESP1 and PROJ1-ESP2, **When** I click "Delete Project" on PROJ1 and confirm, **Then** PROJ1 and all its devices are removed from my account
2. **Given** I have deleted PROJ1, **When** I create a new project, **Then** it gets a new sequential ID (e.g., PROJ3 if PROJ2 already exists)
3. **Given** I delete PROJ1 with online devices, **When** those devices send heartbeats, **Then** the heartbeats are rejected (project no longer exists)
4. **Given** I have only one project PROJ1, **When** I click "Delete Project" on PROJ1, **Then** system shows warning "This is your last project. Deleting it will remove all devices. Continue?" with Yes/No buttons
5. **Given** I see the last project deletion warning, **When** I click "Yes" to confirm, **Then** PROJ1 is deleted and I have zero projects

---

### Edge Cases

- What happens when a user tries to create a project with a name that already exists globally? System rejects the request and shows error "Project name already exists - please choose a different name".
- What happens when two users simultaneously try to create a project with the same name? Only the first request succeeds; the second gets error "Project name already exists - please choose a different name".
- What happens when a user tries to register all 20 device IDs (ESP1-ESP20) in a single project? The dropdown should show "No available IDs" for that project and prevent further registrations until a device is deleted from that project.
- What happens when two users simultaneously try to create a new project with different names? Both should succeed and get sequential project IDs from the global sequence (e.g., User A gets PROJ5, User B gets PROJ6).
- What happens when the system reaches the maximum project ID limit (P9999)? System should prevent new project creation and display error message "Maximum project limit reached - contact support".
- What happens when a user has deleted all their projects (zero projects)? User can still create new projects, devices page shows empty state "No projects yet - create your first project to get started".
- What happens when a user tries to register the same device ID (e.g., ESP5) in the same project twice? The second registration should fail with an error message "ESP5 is already registered in this project".
- What happens when a user tries to register ESP5 in PROJ1 while they already have ESP5 in PROJ2? The registration should succeed because device IDs are scoped per project (PROJ1-ESP5 and PROJ2-ESP5 are different devices).
- What happens when an ESP device sends a heartbeat with an invalid ID format (e.g., "PROJ1-ESP99" or "ABC-ESP5")? The heartbeat should be rejected with a validation error.
- What happens when a user configures the ESP portal with a project ID and device ID combination they didn't register in the webapp (e.g., PROJ1-ESP5 not registered)? The ESP connects to WiFi and sends heartbeat, but the heartbeat is rejected because PROJ1-ESP5 is not registered.
- What happens when a user enters a non-existent project ID in the ESP portal (e.g., "PROJ99")? The ESP accepts the configuration, connects to WiFi, and sends heartbeat, but the heartbeat is rejected because the project doesn't exist.
- What happens when WiFi credentials are incorrect? ESP fails to connect after 30 seconds, recreates "Serra-Setup" AP, and user can try again with correct credentials.
- What happens when a user deletes a project while devices in that project are actively sending heartbeats? All device statuses change to "deleted" and subsequent heartbeats are rejected.
- What happens when a user deletes a device while it's actively sending heartbeats? The device status changes to "deleted" and subsequent heartbeats are rejected.
- What happens when a user accidentally enters the wrong project ID or device ID in the ESP portal? They can factory reset the ESP (via reset button) which clears the EEPROM, and the ESP recreates "Serra-Setup" AP for reconfiguration.
- What happens when a user reaches a very high project count (e.g., PROJ999)? The system continues sequential numbering (PROJ1000, PROJ1001, etc.) up to the 5-character limit (PROJ9 to P9999).
- What happens when multiple projects are deleted, creating gaps in the sequence (e.g., PROJ1, PROJ3, PROJ5)? New projects continue from the highest number (PROJ6, PROJ7, etc.), gaps are not filled.

## Requirements *(mandatory)*

### Functional Requirements

**Project Management:**

- **FR-001**: System MUST allow users to create projects with a user-provided name
- **FR-002**: System MUST enforce global uniqueness of project names across the entire system (only one "Main Greenhouse" can exist globally)
- **FR-003**: System MUST reject project creation if the provided name already exists and display error message "Project name already exists - please choose a different name"
- **FR-004**: System MUST automatically generate a unique 5-character project ID when a project is created (format: PROJ1, PROJ2, ..., P9999)
- **FR-005**: System MUST use sequential numbering for project IDs globally across all users (PROJ1, PROJ2, PROJ3, etc.)
- **FR-006**: System MUST enforce global uniqueness of project IDs across the entire system (only one user can own PROJ1 at any time)
- **FR-007**: System MUST allow users to view all their projects with their IDs and names
- **FR-008**: System MUST allow users to delete projects, which also deletes all devices associated with that project
- **FR-009**: System MUST show a confirmation warning when users attempt to delete their last remaining project ("This is your last project. Deleting it will remove all devices. Continue?") and allow deletion if confirmed

**Device Registration:**

- **FR-010**: System MUST provide a predefined list of exactly 20 device IDs labeled ESP1 through ESP20 for each project
- **FR-011**: System MUST allow users to register a device by selecting a project, selecting an available device ID (ESP1-ESP20) for that project, and providing a friendly name
- **FR-012**: System MUST combine project ID and device ID to create unique device identifier (format: "PROJ1-ESP5")
- **FR-013**: System MUST enforce uniqueness of device IDs within a project (same user cannot have two PROJ1-ESP5 devices)
- **FR-014**: System MUST allow the same device ID (e.g., ESP5) to be used in different projects (PROJ1-ESP5 and PROJ2-ESP5 are different devices)
- **FR-015**: System MUST track device registration status as either "waiting for connection", "online", or "offline"
- **FR-016**: System MUST only show unregistered device IDs in the device ID dropdown during registration for each specific project
- **FR-017**: System MUST prevent registration when all 20 device IDs are already registered within a specific project

**ESP Firmware Configuration:**

- **FR-018**: ESP firmware MUST create a WiFi access point named "Serra-Setup" on first boot or when no configuration exists
- **FR-019**: ESP firmware MUST provide a captive portal configuration interface when connected to "Serra-Setup" AP
- **FR-020**: Captive portal MUST display a text input field for project ID (with automatic uppercase normalization) and a dropdown with device IDs ESP1 through ESP20 for user selection
- **FR-021**: Captive portal MUST accept WiFi SSID and password credentials
- **FR-022**: ESP firmware MUST normalize project ID input to uppercase before combining with device ID (e.g., "proj1" becomes "PROJ1")
- **FR-023**: ESP firmware MUST combine normalized project ID and device ID to create the full device identifier before saving to persistent storage
- **FR-024**: ESP firmware MUST save combined device ID (e.g., "PROJ1-ESP5") and WiFi credentials to persistent storage (EEPROM)
- **FR-025**: ESP firmware MUST attempt to connect to the configured WiFi network using saved credentials
- **FR-026**: ESP firmware MUST recreate "Serra-Setup" AP if WiFi connection fails after 30 seconds
- **FR-027**: ESP firmware MUST provide a factory reset mechanism (button press) that clears saved configuration and recreates "Serra-Setup" AP

**Device Connection & Heartbeat:**

- **FR-028**: ESP firmware MUST send heartbeat messages every 60 seconds to the backend identifying itself with the configured combined device ID (e.g., "PROJ1-ESP5")
- **FR-029**: System MUST match incoming heartbeats with registered devices by combined device ID
- **FR-030**: System MUST update device status to "online" when a matching heartbeat is received (automatic recovery from offline state)
- **FR-031**: System MUST update device status to "offline" when heartbeats stop for more than 2 minutes
- **FR-032**: System MUST reject heartbeats from device IDs that are not registered in the database
- **FR-033**: System MUST validate device ID format matches "PROJECTID-ESPID" pattern (e.g., "PROJ1-ESP5") before accepting heartbeat
- **FR-034**: System MUST enforce device ownership - only the user who registered a device can see its status and data

**Device Lifecycle:**

- **FR-035**: System MUST allow users to delete registered devices, which makes the device ID available for re-registration within that project
- **FR-036**: System MUST reject heartbeats from deleted devices
- **FR-037**: System MUST cascade delete all devices when a project is deleted

### Key Entities

- **Project**: Represents a greenhouse or location grouping. Key attributes include auto-generated 5-character project ID (PROJ1, PROJ2, etc. - globally unique), user-provided project name (globally unique across all users), owner user ID, creation timestamp, and relationship to multiple devices.
- **Device**: Represents an ESP device registered in the system. Key attributes include combined device ID (format: "PROJ1-ESP5"), base device ID (ESP1-ESP20), friendly name assigned by user, registration status (waiting/online/offline), owner user ID, timestamp of last heartbeat, and relationship to parent project.
- **Device Configuration**: Represents the configuration stored on the ESP device in EEPROM. Key attributes include combined device ID (e.g., "PROJ1-ESP5"), WiFi SSID, and WiFi password.
- **Heartbeat**: Represents a periodic message sent from ESP device to backend. Key attributes include combined device ID (e.g., "PROJ1-ESP5") and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a project in under 30 seconds
- **SC-002**: Users can register a device in the webapp and complete ESP configuration via WiFi portal in under 3 minutes
- **SC-003**: Device status updates from "waiting for connection" to "online" within 10 seconds of the ESP connecting to WiFi
- **SC-004**: System supports multiple projects per user with up to 20 simultaneous online devices per project without performance degradation
- **SC-005**: 95% of users successfully complete device onboarding (project creation + device registration + ESP configuration) on their first attempt without support
- **SC-006**: Zero instances of device ID conflicts within a project (enforced uniqueness per project)
- **SC-007**: Device offline detection occurs within 2 minutes of the last heartbeat
- **SC-008**: WiFi portal configuration form is accessible and usable on mobile devices (phones and tablets)
- **SC-009**: Users can successfully use the same device ID (e.g., ESP5) across different projects (PROJ1-ESP5, PROJ2-ESP5)
- **SC-010**: Code complexity is reduced by at least 60% compared to the previous QR code + API key approach (measured by lines of code in device onboarding components)
- **SC-011**: Project creation and deletion operations complete in under 2 seconds
