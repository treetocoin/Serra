# Tasks: Standard Sensor Configuration and Dynamic Charting

**Input**: Design documents from `/specs/004-deve-funzionare-così/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Frontend**: `frontend/src/`
- **Backend**: `supabase/`
- **Tests**: `frontend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and TypeScript type definitions shared across all stories

- [X] **T001** [P] [Setup] Create TypeScript types file at `frontend/src/types/sensor-config.types.ts` with SensorType enum, SensorConfig interface, CreateSensorConfig interface, PORT_ID_REGEX constant, SENSOR_TYPE_LABELS mapping, and isValidPortId validation function
- [X] **T002** [P] [Setup] Verify existing Supabase client configuration in `frontend/src/lib/supabase.ts` or create if missing
- [X] **T003** [P] [Setup] Verify existing React Query setup in frontend app, ensure QueryClient provider wraps app

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] **T004** [Foundational] Create database migration file at `supabase/migrations/YYYYMMDD_sensor_configuration.sql` (use current date format) with content from `contracts/database-schema.sql` including:
  - CREATE TABLE device_sensor_configs with all columns and constraints
  - Unique index idx_device_sensor_configs_unique_active_port
  - RLS policies for SELECT, INSERT, UPDATE, DELETE
  - ALTER TABLE sensor_readings ADD COLUMN sensor_type and port_id
  - Indexes idx_sensor_readings_type and idx_sensor_readings_device_type
  - CREATE FUNCTION resolve_sensor_type
  - Comments for documentation

- [X] **T005** [Foundational] Apply database migration to Supabase using MCP tool

- [X] **T006** [Foundational] Verify migration applied successfully by checking tables and function exist

**Checkpoint**: Database schema ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure Standard Sensors on Device (Priority: P1) 🎯 MVP

**Goal**: Enable users to configure one sensor type to a device port via UI, and have readings from that port automatically appear in the correct chart

**Independent Test**: Add a device, configure DHT Sopra on GPIO4, send test reading from GPIO4, verify Temperature chart appears with ceiling line

### Implementation for User Story 1

#### Backend Services (Database interactions)

- [X] **T007** [P] [US1] Create Supabase service layer at `frontend/src/services/sensor-config.service.ts` with functions:
  - `getActiveConfigs(deviceId: string)` - Fetch active configs for device
  - `createConfig(config: CreateSensorConfig)` - Create new configuration with duplicate port check
  - `deactivateConfig(configId: string)` - Soft delete configuration (set is_active=false)
  - All functions use `supabase.from('device_sensor_configs')` with proper error handling

#### React Query Hooks

- [X] **T008** [P] [US1] Create React Query hooks at `frontend/src/hooks/useSensorConfig.ts` with:
  - `sensorConfigKeys` query key factory
  - `useSensorConfigs(deviceId)` hook - Queries active configs with 1-minute stale time
  - `useCreateSensorConfig()` mutation - Creates config with automatic query invalidation
  - `useDeactivateSensorConfig()` mutation - Deactivates config with automatic query invalidation

#### UI Components

- [X] **T009** [US1] Create sensor configuration form component at `frontend/src/components/devices/SensorConfigForm.tsx` with:
  - Dropdown for sensor type selection (using SENSOR_TYPE_LABELS)
  - Text input for port_id with validation (PORT_ID_REGEX)
  - Submit button that calls useCreateSensorConfig mutation
  - Error display for duplicate ports or validation failures
  - Success callback to reset form
  - Disabled state during mutation pending

- [X] **T010** [US1] Enhance device detail page at `frontend/src/pages/DeviceDetail.page.tsx` to:
  - Import and render SensorConfigForm component
  - Display list of existing sensor configurations using useSensorConfigs hook
  - Show sensor type label + port ID for each config
  - Add "Remove" button per config that calls useDeactivateSensorConfig
  - Add confirm dialog before removing configuration

#### Chart Dynamic Visibility

- [X] **T011** [P] [US1] Create or enhance Temperature chart component at `frontend/src/components/charts/TemperatureChart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type IN ('dht_sopra_temp', 'dht_sotto_temp')
  - Return null (hide chart) if no readings exist (FR-006, FR-007)
  - Use Recharts LineChart with two Line components (ceiling and ground)
  - Transform readings using pivot logic (group by timestamp, spread sensor_type as columns)
  - Color code: ceiling line = #ff7300, ground line = #387908
  - Add Legend showing "Ceiling" and "Ground" labels

- [X] **T012** [P] [US1] Create or enhance Humidity chart component at `frontend/src/components/charts/HumidityChart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type IN ('dht_sopra_humidity', 'dht_sotto_humidity')
  - Return null if no readings exist
  - Use Recharts LineChart with two Line components (ceiling and ground)
  - Transform readings using pivot logic
  - Color code and legend same pattern as Temperature chart

- [X] **T013** [P] [US1] Create Water Level chart component at `frontend/src/components/charts/WaterLevelChart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type = 'water_level'
  - Return null if no readings exist
  - Use Recharts LineChart with single Line component
  - Simple time-series display (no multi-line complexity)

#### Reading Ingestion Logic

- [ ] **T014** [US1] Create or enhance sensor reading ingestion endpoint (Edge Function or API route) to:
  - Accept payload with device_id, port_id, value, unit, timestamp
  - Call Supabase RPC function `resolve_sensor_type(device_id, port_id)` to get sensor_type
  - Insert into sensor_readings with resolved sensor_type and port_id
  - Handle 'unconfigured' sensor_type (log warning but store reading)
  - Return 201 with inserted reading or 500 on error

**Checkpoint**: At this point, User Story 1 should be fully functional - users can configure one sensor, send readings, and see charts dynamically appear

---

## Phase 4: User Story 2 - Configure Multiple Soil Moisture Sensors (Priority: P2)

**Goal**: Enable users to configure up to 5 soil moisture sensors on different ports and see separate charts for each

**Independent Test**: Configure Soil Moisture 1 on GPIO14, Soil Moisture 2 on GPIO12, Soil Moisture 3 on A0, send readings from each, verify 3 separate soil moisture charts appear

### Implementation for User Story 2

- [X] **T015** [P] [US2] Create Soil Moisture 1 chart component at `frontend/src/components/charts/SoilMoisture1Chart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type = 'soil_moisture_1'
  - Return null if no readings exist
  - Use Recharts LineChart with single Line component
  - Label: "Soil Moisture 1"

- [X] **T016** [P] [US2] Create Soil Moisture 2 chart component at `frontend/src/components/charts/SoilMoisture2Chart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type = 'soil_moisture_2'
  - Return null if no readings exist
  - Use Recharts LineChart with single Line component
  - Label: "Soil Moisture 2"

- [X] **T017** [P] [US2] Create Soil Moisture 3 chart component at `frontend/src/components/charts/SoilMoisture3Chart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type = 'soil_moisture_3'
  - Return null if no readings exist
  - Use Recharts LineChart with single Line component
  - Label: "Soil Moisture 3"

- [X] **T018** [P] [US2] Create Soil Moisture 4 chart component at `frontend/src/components/charts/SoilMoisture4Chart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type = 'soil_moisture_4'
  - Return null if no readings exist
  - Use Recharts LineChart with single Line component
  - Label: "Soil Moisture 4"

- [X] **T019** [P] [US2] Create Soil Moisture 5 chart component at `frontend/src/components/charts/SoilMoisture5Chart.tsx`:
  - Query sensor_readings filtered by device_id and sensor_type = 'soil_moisture_5'
  - Return null if no readings exist
  - Use Recharts LineChart with single Line component
  - Label: "Soil Moisture 5"

- [X] **T020** [US2] Add validation to SensorConfigForm component to enforce maximum 5 soil moisture sensors per device:
  - Query existing configs before allowing soil_moisture_N selection
  - Count how many soil_moisture_* configs already exist for device
  - If count >= 5, disable soil moisture options and show error message "Maximum 5 soil moisture sensors allowed per device"
  - Update createConfig function in sensor-config.service.ts to validate on server side as well

- [X] **T021** [US2] Update Dashboard or Device Detail page to render all 5 soil moisture chart components conditionally based on data availability

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can configure multiple soil moisture sensors and see separate charts

---

## Phase 5: User Story 3 - Update Sensor Configuration (Priority: P3)

**Goal**: Enable users to change sensor configuration (port or type) while preserving historical data association

**Independent Test**: Configure DHT Sopra on GPIO4, collect readings, change to GPIO5, verify old readings still show as ceiling temp and new readings use new port

### Implementation for User Story 3

- [X] **T022** [US3] Add updateConfig function to `frontend/src/services/sensor-config.service.ts`:
  - Accept oldConfigId and newConfig parameters
  - Call deactivateConfig(oldConfigId) to set is_active=false
  - Call createConfig(newConfig) to insert new active config
  - Wrap in try-catch to handle errors (rollback on failure)
  - Return new config on success

- [X] **T023** [US3] Create useUpdateSensorConfig mutation hook in `frontend/src/hooks/useSensorConfig.ts`:
  - Calls updateConfig from service layer
  - Invalidates device sensor config queries on success
  - Returns mutation object with isPending, error, mutateAsync

- [ ] **T024** [US3] Enhance SensorConfigForm or create separate edit mode:
  - Add "Edit" button next to each config in device detail page
  - When clicked, populate form with current sensor_type and port_id
  - Change submit button to "Update" mode
  - Call useUpdateSensorConfig instead of useCreateSensorConfig
  - On success, exit edit mode and refresh list

- [ ] **T025** [US3] Add UI indicator to show when config has been modified:
  - Query device_sensor_configs with is_active=false for device to get historical configs
  - Display badge or icon next to current config if historical versions exist
  - Optional: Add expandable history section showing past configurations with timestamps

- [ ] **T026** [US3] Verify snapshot approach in reading ingestion:
  - Confirm resolve_sensor_type always returns current active config
  - Confirm sensor_readings stores sensor_type permanently (no FK, just denormalized value)
  - Test: Configure sensor, send reading, change config, send another reading, query both readings - verify sensor_type matches what was active at write time

- [ ] **T027** [US3] Add historical data integrity test:
  - Create test reading with sensor_type='dht_sopra_temp', port_id='GPIO4'
  - Update config to change GPIO4 to 'dht_sotto_temp'
  - Create new reading from GPIO4 with sensor_type='dht_sotto_temp'
  - Query Temperature chart - verify ceiling line shows first reading, ground line shows second reading
  - Verify old reading still tagged 'dht_sopra_temp' in database

**Checkpoint**: All user stories should now be independently functional - users can create, read, update configurations with full historical data integrity

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final quality checks

- [ ] **T028** [P] [Polish] Add loading skeletons to all chart components while data is being fetched
- [ ] **T029** [P] [Polish] Add empty state messages to device detail page when no sensors configured ("No sensors configured yet. Click 'Add Sensor' to get started")
- [ ] **T030** [P] [Polish] Add toast notifications for successful config create/update/delete operations
- [ ] **T031** [P] [Polish] Add error boundaries around chart components to prevent full page crash if chart fails
- [ ] **T032** [P] [Polish] Optimize chart queries to use time range filter (last 24 hours default) to limit data fetch
- [ ] **T033** [P] [Polish] Add TypeScript strict mode checks, fix any type errors in sensor config components
- [ ] **T034** [P] [Polish] Add accessibility attributes (ARIA labels) to form inputs and buttons
- [ ] **T035** [P] [Polish] Test responsive layout of sensor config form on mobile devices
- [ ] **T036** [P] [Polish] Add confirmation dialog when removing sensor with historical data ("This sensor has X readings. Remove configuration? Historical data will be preserved.")
- [ ] **T037** [Polish] Run through quickstart.md manual test flow (steps 1-9) to validate end-to-end functionality
- [ ] **T038** [Polish] Update user documentation with sensor configuration instructions
- [ ] **T039** [Polish] Add inline help tooltips explaining sensor types (DHT Sopra = ceiling, DHT Sotto = ground, etc.)
- [ ] **T040** [Polish] Performance test with 1000+ sensor readings per chart to verify render time <5 seconds (SC-003)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories CAN proceed in parallel (if staffed) after Foundational
  - Or sequentially in priority order: US1 (P1) → US2 (P2) → US3 (P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 form but is independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 service layer but is independently testable

### Within Each User Story

- Backend services before hooks (T007 → T008)
- Hooks before UI components (T008 → T009, T010)
- UI components can be built in parallel with charts (T009/T010 || T011/T012/T013)
- Reading ingestion can be built in parallel with UI (T014 || T009-T013)
- Charts within a story can all be built in parallel (T011 || T012 || T013 for US1, T015-T019 all parallel for US2)

### Parallel Opportunities

- **Phase 1**: All 3 tasks can run in parallel (T001 || T002 || T003)
- **Phase 2**: Tasks T004-T006 are sequential (migration → apply → verify)
- **User Story 1**:
  - T007 || T008 (service and hooks in parallel)
  - T009 || T010 (two UI components in parallel)
  - T011 || T012 || T013 (all charts in parallel)
  - T014 can start anytime after T007
- **User Story 2**: T015-T019 can all run in parallel (5 chart components)
- **User Story 3**: T024 || T025 can run in parallel (edit UI and history indicator)
- **Polish**: Most polish tasks (T028-T036, T038-T040) can run in parallel

---

## Parallel Example: User Story 1

```bash
# After T007 and T008 complete, launch these in parallel:

Task: "[US1] Create sensor configuration form component at frontend/src/components/devices/SensorConfigForm.tsx"
Task: "[US1] Enhance device detail page at frontend/src/pages/DeviceDetail.page.tsx"
Task: "[US1] Create Temperature chart component at frontend/src/components/charts/TemperatureChart.tsx"
Task: "[US1] Create Humidity chart component at frontend/src/components/charts/HumidityChart.tsx"
Task: "[US1] Create Water Level chart component at frontend/src/components/charts/WaterLevelChart.tsx"
Task: "[US1] Create sensor reading ingestion endpoint"

# All 6 tasks work on different files with no conflicts
```

## Parallel Example: User Story 2

```bash
# All soil moisture charts can be built simultaneously:

Task: "[US2] Create Soil Moisture 1 chart at frontend/src/components/charts/SoilMoisture1Chart.tsx"
Task: "[US2] Create Soil Moisture 2 chart at frontend/src/components/charts/SoilMoisture2Chart.tsx"
Task: "[US2] Create Soil Moisture 3 chart at frontend/src/components/charts/SoilMoisture3Chart.tsx"
Task: "[US2] Create Soil Moisture 4 chart at frontend/src/components/charts/SoilMoisture4Chart.tsx"
Task: "[US2] Create Soil Moisture 5 chart at frontend/src/components/charts/SoilMoisture5Chart.tsx"

# 5 parallel tasks, different files
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003) - ~30 minutes
2. Complete Phase 2: Foundational (T004-T006) - ~1 hour (includes migration testing)
3. Complete Phase 3: User Story 1 (T007-T014) - ~4-6 hours
4. **STOP and VALIDATE**:
   - Manually test configuration form
   - Send test readings via Supabase SQL editor
   - Verify Temperature chart appears
   - Verify dynamic chart visibility works
5. Deploy to staging and demo

**Total MVP Time**: ~6-8 hours for single developer

### Incremental Delivery

1. **Sprint 1**: Setup + Foundational + US1 → Deploy MVP (core sensor config + basic charts)
2. **Sprint 2**: Add US2 → Deploy (multi-sensor support for soil moisture)
3. **Sprint 3**: Add US3 → Deploy (configuration editing with historical data integrity)
4. **Sprint 4**: Polish → Final production release

Each sprint delivers working, testable functionality.

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

1. **Developer A**: User Story 1 (T007-T014) - Focus on DHT sensors and core config
2. **Developer B**: User Story 2 (T015-T021) - Focus on soil moisture multi-sensor
3. **Developer C**: User Story 3 (T022-T027) - Focus on config updates

All stories can be developed independently and tested in isolation.

---

## Task Count Summary

- **Total Tasks**: 40
- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundational)**: 3 tasks
- **Phase 3 (User Story 1 - P1)**: 8 tasks
- **Phase 4 (User Story 2 - P2)**: 7 tasks
- **Phase 5 (User Story 3 - P3)**: 6 tasks
- **Phase 6 (Polish)**: 13 tasks

**Parallelizable Tasks**: 26 out of 40 tasks marked [P] (65% can run in parallel)

**Critical Path** (minimum time if executed sequentially):
1. Setup (3 tasks)
2. Foundational (3 tasks)
3. US1 backend (2 sequential: T007→T008)
4. US1 UI (can parallelize T009-T013)
5. US1 ingestion (T014)
6. Polish (subset)

**Estimated Time**:
- MVP (US1 only): 6-8 hours single developer
- Full feature (US1+US2+US3): 16-20 hours single developer
- Full feature (3 developers parallel): 8-10 hours

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label (US1, US2, US3) maps task to specific user story for traceability
- Each user story should be independently completable and testable
- No explicit test tasks included (testing not requested in spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently before proceeding
- Avoid: same file conflicts, cross-story dependencies that break independence

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1 only) = Core sensor configuration with dynamic charting (~8 hours)
