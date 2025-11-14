---
description: "Implementation tasks for QR Code Device Onboarding"
---

# Tasks: QR Code Device Onboarding

**Input**: Design documents from `/specs/003-qr-code-device/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested - implementation-focused tasks only

**Organization**: Tasks grouped by user story for independent implementation and testing

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Frontend: `frontend/src/`
- Firmware: Repository root `.ino` file
- Database: `supabase/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create base components needed for QR code feature

- [X] T001 Install `qrcode` npm package in frontend for QR code generation
- [X] T002 [P] Create QRCodeDisplay component scaffold in `frontend/src/components/devices/QRCodeDisplay.tsx`
- [X] T003 [P] Create AddDeviceModal component scaffold in `frontend/src/components/devices/AddDeviceModal.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema changes and RPC function updates that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create migration `[timestamp]_qr_device_onboarding.sql` adding `connection_failed` enum value to `connection_status`
- [X] T005 Add partial index on `connection_status` in migration for performance optimization
- [X] T006 Update `device_heartbeat` RPC function to handle all status transitions (offline → online, connection_failed → online)
- [X] T007 Create `cleanup_connection_status()` RPC function for timeout monitoring and connection failure detection
- [X] T008 Apply migration to Supabase database
- [X] T009 Verify migration with SQL query checking enum values and indexes

**Checkpoint**: Database schema ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Device Registration with QR Code (Priority: P1) 🎯 MVP

**Goal**: Users can register devices, scan QR codes to configure WiFi, and see devices come online

**Independent Test**: Register new device → Scan QR code → ESP8266 connects to WiFi → Device shows online in webapp

### Implementation for User Story 1

#### Backend/Database (US1)

- [X] T010 [US1] Update database types in `frontend/src/lib/database.types.ts` with new `connection_failed` status (run `npm run generate-types` or use Supabase type generator)

#### Frontend Services (US1)

- [X] T011 [P] [US1] Add `registerDevice()` method to `frontend/src/services/devices.service.ts` implementing device registration contract (generates API key, inserts device record)
- [X] T012 [P] [US1] Add `generateQRCode()` method to `frontend/src/services/devices.service.ts` implementing QR code generation contract (extracts SSID from hostname, generates WiFi QR string, returns data URL)

#### Frontend Components (US1)

- [X] T013 [US1] Implement AddDeviceModal component in `frontend/src/components/devices/AddDeviceModal.tsx` with registration form (name input, register button, displays device ID + API key on success)
- [X] T014 [US1] Implement QRCodeDisplay component in `frontend/src/components/devices/QRCodeDisplay.tsx` with QR code rendering (uses `useQuery` to fetch QR data, displays image with SSID, handles hostname not available error)
- [X] T015 [US1] Add "Add Device" button to Devices page in `frontend/src/pages/Devices.page.tsx` that opens AddDeviceModal
- [X] T016 [US1] Add "View QR Code" button to DeviceDetail page in `frontend/src/pages/DeviceDetail.page.tsx` that opens QRCodeDisplay modal (always visible, not conditional on status)
- [X] T017 [US1] Update device status polling in DeviceDetail page to refetch every 30 seconds using TanStack Query `refetchInterval: 30000`
- [X] T018 [US1] Add connection status indicator to device cards/list showing offline/online/connection_failed with color coding (red=failed, green=online, gray=offline)
- [X] T019 [US1] Conditionally enable "Settings" button on DeviceDetail page only when `connection_status === 'online'`

#### Firmware (US1)

- [X] T020 [US1] Add WiFi connection timeout logic to ESP8266 firmware in `ESP8266_Greenhouse_v2.0.ino` (30-second timeout, return to AP mode on failure)
- [X] T021 [US1] Implement LED error patterns in firmware: fast blink (10Hz) for WiFi failure, slow blink (1Hz) for connecting, solid ON for connected, OFF for AP mode
- [X] T022 [US1] Update heartbeat function in firmware to send hostname parameter in RPC call payload: `{"device_id_param":"...", "hostname_param":"http://serrasetup-XXXX.local"}`
- [X] T023 [US1] Add retry logic to heartbeat function with exponential backoff (3 attempts, 5-second delay)

**Checkpoint**: Complete end-to-end flow testable - register device → scan QR → WiFi config → device online

---

## Phase 4: User Story 2 - Display Device ID in Management Interface (Priority: P2)

**Goal**: Device ID (UUID) is prominently displayed in device management interface for troubleshooting

**Independent Test**: Open any device detail page → Verify device UUID is clearly shown in device information card

### Implementation for User Story 2

- [X] T024 [US2] Add device ID field to device information card in `frontend/src/pages/DeviceDetail.page.tsx` (display `device.id` as read-only text, labeled "Device ID")
- [X] T025 [US2] Style device ID with monospace font and copy-to-clipboard button for easy sharing/troubleshooting
- [X] T026 [US2] Add device ID column to devices list table in `frontend/src/pages/Devices.page.tsx` (optional, truncated UUID with tooltip showing full ID)

**Checkpoint**: Device IDs visible in all device management interfaces

---

## Phase 5: User Story 3 - Configure Device ID During Setup (Priority: P3)

**Goal**: Users can customize device ID via ESP8266 web interface, while webapp shows it as read-only

**Independent Test**: Access ESP8266 web interface → Edit device ID field → Save → Verify webapp shows updated ID as read-only

### Implementation for User Story 3

#### Frontend (US3)

- [X] T027 [US3] Make device ID field read-only on webapp device setup page in `frontend/src/components/devices/DeviceSetup.tsx` (add `disabled` or `readOnly` attribute, show tooltip explaining it's editable on ESP8266)

#### Firmware (US3)

- [X] T028 [US3] Add device ID edit field to ESP8266 web configuration page in `ESP8266_Greenhouse_v2.0.ino` (HTML form with input field showing current `device_id`, save button)
- [X] T029 [US3] Implement device ID save handler in firmware that persists device_id to EEPROM and includes updated name in next heartbeat
- [X] T030 [US3] Add label/help text to ESP8266 config page explaining device ID is a user-friendly label (duplicates allowed, UUID provides uniqueness)

**Checkpoint**: Device ID customization working via ESP8266, reflected in webapp

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [X] T031 [P] Add loading states to QRCodeDisplay component while QR code is generating
- [X] T032 [P] Add error boundary to AddDeviceModal for graceful registration failure handling
- [X] T033 Add success toast/notification when device registration completes
- [X] T034 Add warning toast when device enters `connection_failed` status suggesting retry steps
- [X] T035 Add helpful instruction text to QRCodeDisplay modal explaining scan-to-connect flow
- [X] T036 Add "Manual WiFi Setup" fallback instructions in QRCodeDisplay for devices without QR scanner
- [ ] T037 Test complete onboarding flow per `quickstart.md` Scenario 1 (happy path)
- [ ] T038 Test WiFi failure flow per `quickstart.md` Scenario 2 (wrong credentials → connection_failed → retry)
- [ ] T039 Test QR code re-access per `quickstart.md` Scenario 3 (close modal → reopen → QR regenerates)
- [X] T040 [P] Update project CLAUDE.md with QR code onboarding technologies if not already listed
- [X] T041 Code cleanup: Remove unused imports, add comments to complex QR generation logic

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) can start after Phase 2
  - User Story 2 (P2) can start after Phase 2 (independent of US1, but typically done after US1 for context)
  - User Story 3 (P3) can start after Phase 2 (independent but builds on US1/US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends only on Foundational (Phase 2) - Enhances US1 but independently testable
- **User Story 3 (P3)**: Depends only on Foundational (Phase 2) - Enhances US1/US2 but independently testable

### Within Each User Story

**User Story 1**:
- T010 (database types) must complete before T011-T012 (services use types)
- T011-T012 (services) can run in parallel, must complete before T013-T019 (components use services)
- T013-T014 (modal components) can run in parallel
- T015-T019 (page updates) can run in parallel after T013-T014
- T020-T023 (firmware) can run in parallel with frontend tasks

**User Story 2**:
- T024 must complete before T025 (styling builds on field)
- T026 can run in parallel with T024-T025 (different file)

**User Story 3**:
- T027 (frontend) and T028-T030 (firmware) can run in parallel
- T029 depends on T028 (save handler needs edit field)

### Parallel Opportunities

**Phase 1 (Setup)**: T002 and T003 can run in parallel (different component files)

**Phase 2 (Foundational)**: T005 can run in parallel with T004 (same migration file but independent sections), T006-T007 can run in parallel (different RPC functions)

**Phase 3 (User Story 1)**:
- T011 and T012 can run in parallel (different methods in same service file)
- T013 and T014 can run in parallel (different component files)
- T015, T016, T017, T018, T019 can run in parallel (different page files or independent sections)
- T020-T023 can run in parallel with all frontend tasks (firmware vs frontend)

**Phase 4 (User Story 2)**: T024 and T026 can run in parallel (different files)

**Phase 5 (User Story 3)**: T027 (frontend) can run in parallel with T028-T030 (firmware)

**Phase 6 (Polish)**: T031, T032, T037-T041 can run in parallel (different files/concerns)

---

## Parallel Example: User Story 1 Frontend Services

```bash
# Launch both service methods together (different methods):
Task T011: "Add registerDevice() method to devices.service.ts"
Task T012: "Add generateQRCode() method to devices.service.ts"

# Launch page updates together (different files):
Task T015: "Add 'Add Device' button to Devices.page.tsx"
Task T016: "Add 'View QR Code' button to DeviceDetail.page.tsx"
Task T017: "Update device status polling in DeviceDetail.page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install dependencies, create component scaffolds)
2. Complete Phase 2: Foundational (database migration, RPC functions) - **CRITICAL**
3. Complete Phase 3: User Story 1 (complete end-to-end QR code onboarding flow)
4. **STOP and VALIDATE**: Test per quickstart.md Scenario 1 (happy path) and Scenario 2 (WiFi failure)
5. Deploy/demo MVP if ready

### Incremental Delivery

1. Setup + Foundational → Database ready for QR feature
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: QR code onboarding works!)
3. Add User Story 2 → Test independently → Deploy/Demo (Enhanced: Device ID visibility)
4. Add User Story 3 → Test independently → Deploy/Demo (Enhanced: Device ID customization)
5. Polish → Final validation → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (blocking prerequisites)
2. Once Phase 2 done:
   - Developer A: User Story 1 frontend (T010-T019)
   - Developer B: User Story 1 firmware (T020-T023)
   - Developer C: User Story 2 + User Story 3 (can start after US1 context but independently testable)
3. Stories complete and integrate independently

---

## Notes

- **[P] tasks** = different files or independent sections, no dependencies
- **[Story] label** maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Database types (T010) generated using Supabase CLI: `npx supabase gen types typescript --project-id fmyomzywzjtxmabvvjcd > frontend/src/lib/database.types.ts`
- QR code library (`qrcode`) documented in research.md with rationale
- Connection status transitions documented in data-model.md
- All API contracts detailed in contracts/ directory
- Complete testing scenarios in quickstart.md
- Commit after each task or logical group for easy rollback
- Stop at any checkpoint to validate story independently

---

## Task Count Summary

- **Total Tasks**: 41
- **Setup**: 3 tasks
- **Foundational**: 6 tasks (BLOCKING)
- **User Story 1**: 14 tasks (MVP)
- **User Story 2**: 3 tasks
- **User Story 3**: 4 tasks
- **Polish**: 11 tasks
- **Parallel Opportunities**: ~18 tasks can run in parallel across phases

---

## Independent Test Criteria

### User Story 1 (P1)
- Can register new device via webapp
- QR code is generated and scannable
- ESP8266 connects to WiFi after QR scan
- Device status changes to "online" within 30 seconds
- Settings button becomes enabled
- WiFi failure shows "connection_failed" status

### User Story 2 (P2)
- Device UUID is visible on device detail page
- Device ID can be copied for troubleshooting
- Multiple devices each show their unique ID

### User Story 3 (P3)
- ESP8266 web interface shows editable device ID field
- Changes made on ESP8266 persist after save
- Webapp reflects updated device ID as read-only
- System allows duplicate device IDs (UUID provides uniqueness)

---

## Suggested MVP Scope

**Minimum Viable Product**: User Story 1 only (14 tasks after Setup + Foundational)

This delivers:
- Complete QR code onboarding flow
- WiFi configuration via captive portal
- Device online status tracking
- Connection failure handling with auto-retry
- Settings access when device is online

**Total MVP tasks**: 3 (Setup) + 6 (Foundational) + 14 (US1) = **23 tasks**

**Enhancement Scope**: Add User Story 2 (3 tasks) for device ID visibility, then User Story 3 (4 tasks) for device ID customization

**Production Ready**: Include all Polish tasks (11 tasks) for error handling, UX improvements, and validation
