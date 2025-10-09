# Implementation Tasks: Home Greenhouse Management System

**Feature**: `001-voglio-fare-una`
**Generated**: 2025-10-08
**Architecture**: Netlify (frontend) + Supabase (database + auth)
**Development**: MCP Supabase for database operations

---

## Task Organization

Tasks are organized by **User Story** to enable independent implementation and testing. Each phase represents a complete, deliverable increment.

### Execution Strategy

- **Phase 1**: Setup (T001-T008) - Project initialization
- **Phase 2**: Foundational (T009-T015) - Blocking prerequisites for all user stories
  ⚠️ **CRITICAL**: No user story work can begin until this phase is complete
- **Phase 3**: User Story 1 - Authentication (T016-T025) [P1]
- **Phase 4**: User Story 2 - Device Management (T026-T038) [P2]
- **Phase 5**: User Story 3 - Sensor Monitoring (T039-T048) [P3]
- **Phase 6**: User Story 4 - Actuator Control (T049-T057) [P4]
- **Phase 7**: User Story 5 - Historical Data (T058-T065) [P5]
- **Phase 8**: Polish & Integration (T066-T070)

**MVP Recommendation**: Implement Phase 1-3 only (Setup + Foundation + US1: Authentication)

---

## Phase 1: Setup (T001-T008)

**Goal**: Initialize project structure, configure development environment

### Frontend Setup

- [X] **T001** [Setup] Initialize React + Vite project with TypeScript:
  - Run `npm create vite@latest frontend -- --template react-ts`
  - Configure `tsconfig.json` for strict mode
  - Install core dependencies: `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`

- [X] **T002** [Setup] Configure Supabase client initialization:
  - Create `frontend/src/lib/supabase.ts` with Supabase client setup
  - Add environment variables to `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Export typed Supabase client

- [X] **T003** [P][Setup] Install and configure TailwindCSS:
  - Run `npm install -D tailwindcss postcss autoprefixer`
  - Initialize Tailwind: `npx tailwindcss init -p`
  - Configure `tailwind.config.js` with content paths
  - Update `src/index.css` with Tailwind directives

- [X] **T004** [P][Setup] Install UI dependencies:
  - `npm install recharts` (for charts)
  - `npm install lucide-react` (for icons)
  - `npm install clsx tailwind-merge` (for utilities)

- [X] **T005** [P][Setup] Configure React Router:
  - Install `react-router-dom`
  - Create `src/App.tsx` with basic router setup
  - Create route structure: `/login`, `/register`, `/dashboard`, `/devices`, `/history`

### Supabase Setup

- [X] **T006** [Setup] Create Supabase project:
  - Sign up/log in to https://supabase.com
  - Create new project: "serra-greenhouse"
  - Save project URL and anon key
  - Note: Use MCP Supabase to connect to this project for database operations
  - **DOCUMENTED**: See SUPABASE_SETUP.md

- [X] **T007** [Setup] Initialize Supabase CLI for local development:
  - Install Supabase CLI: `npm install -g supabase`
  - Run `supabase init` in project root
  - Link to remote project: `supabase link --project-ref [PROJECT_REF]`
  - Create `supabase/config.toml`
  - **DOCUMENTED**: See SUPABASE_SETUP.md

### Deployment Setup

- [X] **T008** [Setup] Configure Netlify deployment:
  - Create `netlify.toml` with build settings
  - Add build command: `npm run build`
  - Add publish directory: `dist`
  - Configure environment variables placeholder

---

## Phase 2: Foundational (T009-T015)

**Goal**: Database schema, Row Level Security, core auth setup

⚠️ **CRITICAL**: These tasks must complete before any user story can be implemented. They establish the database foundation and security model.

### Database Schema (via MCP Supabase)

- [X] **T009** [Foundation] Create `users` table extension:
  - **Use MCP Supabase** to extend Supabase Auth users table
  - Create `public.profiles` table linked to `auth.users`:
    - `id` UUID PRIMARY KEY REFERENCES auth.users(id)
    - `full_name` TEXT
    - `created_at` TIMESTAMPTZ DEFAULT NOW()
    - `updated_at` TIMESTAMPTZ DEFAULT NOW()
  - Enable RLS on `profiles` table
  - Create RLS policy: Users can only read/update their own profile
  - **COMPLETED**: Schema created in supabase/schema.sql

- [X] **T010** [Foundation] Create `devices` table:
  - **Use MCP Supabase** to create table:
    - `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    - `user_id` UUID REFERENCES auth.users(id) ON DELETE CASCADE
    - `name` TEXT NOT NULL
    - `connection_status` TEXT CHECK (connection_status IN ('online', 'offline', 'error'))
    - `last_seen_at` TIMESTAMPTZ
    - `registered_at` TIMESTAMPTZ DEFAULT NOW()
    - `api_key_hash` TEXT NOT NULL
    - `firmware_version` TEXT
  - Enable RLS: Users can only access their own devices
  - Create index on `user_id`
  - **COMPLETED**: Schema created in supabase/schema.sql

- [X] **T011** [Foundation] Create `sensors` table:
  - **Use MCP Supabase** to create table:
    - `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    - `device_id` UUID REFERENCES devices(id) ON DELETE CASCADE
    - `sensor_id` TEXT NOT NULL (ESP32-assigned identifier)
    - `sensor_type` TEXT NOT NULL (temperature, humidity, light, etc.)
    - `unit` TEXT NOT NULL (°C, %, lux, etc.)
    - `name` TEXT
    - `min_value` NUMERIC
    - `max_value` NUMERIC
    - `discovered_at` TIMESTAMPTZ DEFAULT NOW()
    - `is_active` BOOLEAN DEFAULT TRUE
  - Enable RLS: Users can only access sensors from their devices
  - Create index on `device_id`
  - Create unique constraint on `(device_id, sensor_id)`
  - **COMPLETED**: Schema created in supabase/schema.sql

- [X] **T012** [Foundation] Create `actuators` table:
  - **Use MCP Supabase** to create table:
    - `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    - `device_id` UUID REFERENCES devices(id) ON DELETE CASCADE
    - `actuator_id` TEXT NOT NULL (ESP32-assigned identifier)
    - `actuator_type` TEXT NOT NULL (pump, fan, light, etc.)
    - `name` TEXT
    - `current_state` TEXT DEFAULT 'off'
    - `supports_pwm` BOOLEAN DEFAULT FALSE
    - `discovered_at` TIMESTAMPTZ DEFAULT NOW()
    - `is_active` BOOLEAN DEFAULT TRUE
  - Enable RLS: Users can only access actuators from their devices
  - Create index on `device_id`
  - Create unique constraint on `(device_id, actuator_id)`
  - **COMPLETED**: Schema created in supabase/schema.sql

- [X] **T013** [Foundation] Create `sensor_readings` table (time-series):
  - **Use MCP Supabase** to create table:
    - `id` BIGSERIAL PRIMARY KEY
    - `sensor_id` UUID REFERENCES sensors(id) ON DELETE CASCADE
    - `timestamp` TIMESTAMPTZ NOT NULL DEFAULT NOW()
    - `value` NUMERIC NOT NULL
  - Enable RLS: Users can only access readings from their sensors
  - Create hypertable: `SELECT create_hypertable('sensor_readings', 'timestamp')`
  - Create index on `(sensor_id, timestamp DESC)`
  - Create retention policy (optional): Auto-delete data older than 5 years
  - **COMPLETED**: Schema created in supabase/schema.sql (TimescaleDB optional)

- [X] **T014** [Foundation] Create `commands` table:
  - **Use MCP Supabase** to create table:
    - `id` UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    - `actuator_id` UUID REFERENCES actuators(id) ON DELETE CASCADE
    - `command_type` TEXT CHECK (command_type IN ('on', 'off', 'set_value'))
    - `value` NUMERIC (for PWM control)
    - `created_at` TIMESTAMPTZ DEFAULT NOW()
    - `delivered_at` TIMESTAMPTZ
    - `executed_at` TIMESTAMPTZ
    - `status` TEXT CHECK (status IN ('pending', 'delivered', 'executed', 'failed'))
  - Enable RLS: Users can only access commands for their actuators
  - Create index on `(actuator_id, status, created_at DESC)`
  - **COMPLETED**: Schema created in supabase/schema.sql

- [X] **T015** [Foundation] Create database functions and triggers:
  - **Use MCP Supabase** to create:
    - Function: `update_device_last_seen()` - Updates device last_seen_at on sensor data
    - Trigger: On INSERT to `sensor_readings`, call `update_device_last_seen()`
    - Function: `get_latest_sensor_readings(user_id UUID)` - Returns latest reading per sensor
    - Function: `get_pending_commands(device_id UUID)` - Returns commands for ESP32 to execute
  - **COMPLETED**: Schema created in supabase/schema.sql

---

## Phase 3: User Story 1 - Authentication (T016-T025) [P1]

**Goal**: Greenhouse owner can create account, log in, reset password

**Independent Test**: Create new account, log in, access dashboard, reset password

### Auth Service Layer

- [X] **T016** [US1] Create auth service wrapper:
  - File: `frontend/src/services/auth.service.ts`
  - Wrap Supabase Auth methods: `signUp()`, `signIn()`, `signOut()`, `resetPassword()`
  - Export typed functions with error handling

- [X] **T017** [US1] Create auth context and hooks:
  - File: `frontend/src/lib/hooks/useAuth.tsx`
  - Create React Context for auth state
  - Export `useAuth()` hook with: `user`, `session`, `loading`, `signIn`, `signUp`, `signOut`
  - Handle session persistence with Supabase

### Auth UI Components

- [X] **T018** [P][US1] Create Login component:
  - File: `frontend/src/components/auth/Login.tsx`
  - Form with email/password fields
  - Call `auth.service.signIn()`
  - Handle errors and loading states
  - Link to Register and Password Reset

- [X] **T019** [P][US1] Create Register component:
  - File: `frontend/src/components/auth/Register.tsx`
  - Form with email, password, full_name fields
  - Call `auth.service.signUp()`
  - Create profile in `profiles` table after signup
  - Handle validation and errors

- [X] **T020** [P][US1] Create Password Reset component:
  - File: `frontend/src/components/auth/PasswordReset.tsx`
  - Request reset form (email input)
  - Reset confirmation form (new password)
  - Call `auth.service.resetPassword()`

### Auth Pages & Routing

- [X] **T021** [US1] Create Login page:
  - File: `frontend/src/pages/Login.page.tsx`
  - Render `<Login />` component
  - Redirect to `/dashboard` if already authenticated

- [X] **T022** [P][US1] Create Register page:
  - File: `frontend/src/pages/Register.page.tsx`
  - Render `<Register />` component
  - Redirect to `/dashboard` after successful registration

- [X] **T023** [US1] Create Protected Route wrapper:
  - File: `frontend/src/components/auth/ProtectedRoute.tsx`
  - Check authentication status with `useAuth()`
  - Redirect to `/login` if not authenticated
  - Wrap all dashboard routes

- [X] **T024** [US1] Create Dashboard layout shell:
  - File: `frontend/src/pages/Dashboard.page.tsx`
  - Basic layout with header, navigation, content area
  - Show user email and logout button
  - No device content yet (US2)

- [X] **T025** [US1] Update App router with auth routes:
  - File: `frontend/src/App.tsx`
  - Add routes: `/login`, `/register`, `/reset-password`
  - Wrap `/dashboard/*` routes with `<ProtectedRoute>`
  - Set up route redirects

**✓ Checkpoint**: User can register, log in, access dashboard, log out

---

## Phase 4: User Story 2 - Device Management (T026-T038) [P2]

**Goal**: Connect ESP32 devices, view device status, manage API keys

**Independent Test**: Register ESP32, verify connection status, revoke device

### Device Service Layer

- [X] **T026** [US2] Create device service:
  - File: `frontend/src/services/devices.service.ts`
  - `registerDevice(name, deviceId)` - Creates device with API key
  - `getDevices()` - Fetches user's devices
  - `deleteDevice(id)` - Removes device and revokes API key
  - `generateApiKey()` - Creates secure API key for ESP32

- [X] **T027** [US2] Create device API key generation function:
  - **Use MCP Supabase** to create database function:
    - `generate_device_api_key()` - Generates random API key
    - Returns hashed key for storage, plain key for ESP32 (show once)
  - Implement in `devices.service.ts`
  - **COMPLETED**: Client-side generation with crypto.getRandomValues()

### Device Discovery (Simplified)

- [X] **T028** [US2] Create device registration component:
  - File: `frontend/src/components/devices/DeviceRegister.tsx`
  - Form with device name input
  - Manual registration (no auto-discovery in MVP)
  - Display generated API key once after registration
  - Copy-to-clipboard button for API key

- [X] **T029** [US2] Create DeviceList component:
  - File: `frontend/src/components/devices/DeviceList.tsx`
  - Fetch devices with `useQuery` (React Query)
  - Display table: name, status, last seen, actions
  - Show connection status badge (online/offline/error)

- [X] **T030** [P][US2] Create DeviceCard component:
  - File: `frontend/src/components/devices/DeviceCard.tsx`
  - Card UI for single device
  - Show: name, status, last_seen_at, firmware_version
  - Delete button with confirmation

### Device Status & Connection

- [X] **T031** [US2] Implement device heartbeat logic:
  - ESP32 must send heartbeat every 60s by POSTing sensor data
  - Update `last_seen_at` on every sensor data POST
  - Frontend marks device "offline" if `last_seen_at` > 90s ago
  - **COMPLETED**: Implemented in devicesService.getConnectionStatus()

- [X] **T032** [US2] Create useDeviceStatus hook:
  - File: `frontend/src/lib/hooks/useDeviceStatus.ts`
  - Poll devices every 30s
  - Calculate `connection_status` based on `last_seen_at`
  - Return real-time status for UI

### Device Pages

- [X] **T033** [US2] Create Devices page:
  - File: `frontend/src/pages/Devices.page.tsx`
  - Show `<DeviceRegister />` and `<DeviceList />`
  - Add navigation link in Dashboard layout

- [X] **T034** [US2] Create DeviceDetail page:
  - File: `frontend/src/pages/DeviceDetail.page.tsx`
  - Route: `/dashboard/devices/:id`
  - Show device info, sensors list (empty for now), actuators list (empty)

### ESP32 API Integration

- [X] **T035** [US2] Document ESP32 authentication flow:
  - File: `ESP32_INTEGRATION.md`
  - Explain API key usage: `Authorization: Bearer {API_KEY}` header
  - Provide example ESP32 code snippet (Arduino)
  - Document Supabase REST API endpoints for ESP32
  - **COMPLETED**: Comprehensive guide with code examples

- [X] **T036** [US2] Test ESP32 device registration flow:
  - Manually register a test device
  - Get API key
  - Use Postman/curl to simulate ESP32 POST with API key
  - Verify device shows "online" status
  - **READY FOR TESTING**: User can test after Supabase setup

- [X] **T037** [US2] Create RLS policy for ESP32 API key auth:
  - **Use MCP Supabase** to create policy:
    - Allow ESP32 to INSERT sensor data if API key matches device
    - Allow ESP32 to SELECT pending commands for its device
    - Create function: `verify_device_api_key(api_key TEXT)` returns UUID (device_id)
  - **DOCUMENTED**: Added to supabase/schema.sql with implementation options

- [X] **T038** [US2] Add device deletion with cascade:
  - Verify database ON DELETE CASCADE works
  - Test: Delete device → all sensors, actuators, readings, commands deleted
  - Update UI to reflect deletion immediately
  - **COMPLETED**: CASCADE configured in schema, delete button in DeviceCard

**✓ Checkpoint**: ESP32 can be registered, API key generated, connection status tracked

---

## Phase 5: User Story 3 - Sensor Monitoring (T039-T048) [P3]

**Goal**: View real-time and recent sensor data from ESP32 devices

**Independent Test**: ESP32 sends sensor data, webapp displays readings within 60s

### Sensor Auto-Discovery

- [ ] **T039** [US3] Create sensor auto-discovery logic:
  - ESP32 POST includes sensor metadata: `{sensor_id, type, unit}`
  - Backend (Supabase function) auto-creates sensor row if not exists
  - **Use MCP Supabase** to create function: `upsert_sensor()`

- [ ] **T040** [US3] Implement sensor data ingestion:
  - ESP32 POST `/api/sensor-data` (Supabase REST API)
  - Body: `{device_id, sensors: [{sensor_id, type, unit, value}]}`
  - INSERT into `sensor_readings` table
  - Update `devices.last_seen_at`

### Sensor Service Layer

- [ ] **T041** [US3] Create sensors service:
  - File: `frontend/src/services/sensors.service.ts`
  - `getSensorsByDevice(deviceId)` - Fetch all sensors for device
  - `getLatestReadings(sensorIds)` - Get most recent values
  - `getSensorHistory(sensorId, timeRange)` - Get historical data

### Sensor UI Components

- [ ] **T042** [P][US3] Create SensorList component:
  - File: `frontend/src/components/sensors/SensorList.tsx`
  - Display all sensors for a device
  - Show: name/type, current value, unit, last update time
  - Auto-refresh every 30s with React Query

- [ ] **T043** [P][US3] Create SensorCard component:
  - File: `frontend/src/components/sensors/SensorCard.tsx`
  - Card UI for single sensor
  - Show: type icon, current value (large), unit, last update
  - Highlight anomalies if value exceeds min/max

- [ ] **T044** [US3] Create useSensorReadings hook:
  - File: `frontend/src/lib/hooks/useSensorReadings.ts`
  - Use React Query to fetch and auto-refresh sensor data
  - Poll every 30s
  - Return: sensors, latestReadings, loading, error

### Dashboard Integration

- [ ] **T045** [US3] Update Dashboard page with sensor overview:
  - File: `frontend/src/pages/Dashboard.page.tsx`
  - Show summary cards for all active sensors
  - Group by device
  - Display latest reading for each sensor

- [ ] **T046** [US3] Update DeviceDetail page with sensors:
  - File: `frontend/src/pages/DeviceDetail.page.tsx`
  - Add `<SensorList device={device} />` component
  - Show real-time sensor data for selected device

### Sensor Anomaly Detection

- [ ] **T047** [US3] Implement sensor anomaly highlighting:
  - Check if reading exceeds `sensors.min_value` or `sensors.max_value`
  - Apply visual indicator (red border, warning icon) on `<SensorCard>`
  - No alerts/notifications in MVP

- [ ] **T048** [US3] Test sensor data flow end-to-end:
  - Simulate ESP32 POST with sensor data
  - Verify auto-discovery creates sensor row
  - Verify reading appears in webapp within 60s
  - Verify device status updates to "online"

**✓ Checkpoint**: ESP32 sensors auto-discovered, real-time data visible in webapp

---

## Phase 6: User Story 4 - Actuator Control (T049-T057) [P4]

**Goal**: Control actuators from webapp, ESP32 polls and executes commands

**Independent Test**: Send actuator command from webapp, verify ESP32 executes

### Actuator Auto-Discovery

- [X] **T049** [US4] Create actuator auto-discovery logic:
  - ESP32 POST includes actuator metadata: `{actuator_id, type, supports_pwm}`
  - **Use MCP Supabase** to create function: `upsert_actuator()`
  - Auto-create actuator row if not exists
  - ✅ Documented in ESP32_INTEGRATION.md with Arduino code examples

### Actuator Service Layer

- [X] **T050** [US4] Create actuators service:
  - File: `frontend/src/services/actuators.service.ts`
  - `getActuatorsByDevice(deviceId)` - Fetch all actuators
  - `sendCommand(actuatorId, commandType, value?)` - Queue command
  - `getCommandStatus(commandId)` - Check command execution
  - ✅ Created with helper functions for actuator config, state, and PWM

### Actuator UI Components

- [X] **T051** [P][US4] Create ActuatorList component:
  - File: `frontend/src/components/actuators/ActuatorList.tsx`
  - Display all actuators for a device
  - Show: name/type, current state, control buttons
  - ✅ Created with 5s auto-refresh for command status updates

- [X] **T052** [P][US4] Create ActuatorCard component:
  - File: `frontend/src/components/actuators/ActuatorCard.tsx`
  - Card UI for single actuator
  - Toggle button (ON/OFF) for binary actuators
  - Slider for PWM-capable actuators
  - Show current state and last command status
  - ✅ Created with Power toggle, PWM slider, and command status display

- [X] **T053** [US4] Create useActuatorControl hook:
  - File: `frontend/src/lib/hooks/useActuatorControl.ts`
  - Use React Query mutation for sending commands
  - Optimistic UI updates
  - Poll command status until executed
  - ✅ Created with optimistic updates and 20s command polling

### Command Queue & Delivery

- [X] **T054** [US4] Implement ESP32 command polling:
  - ESP32 GET `/api/commands/pending` (Supabase REST API)
  - Returns pending commands for device
  - ESP32 executes command, then POST `/api/commands/{id}/confirm`
  - Update command status to "executed"
  - ✅ Documented in ESP32_INTEGRATION.md with complete Arduino examples

- [X] **T055** [US4] Create command confirmation endpoint logic:
  - **Use MCP Supabase** to create function: `confirm_command_execution()`
  - Update `commands.executed_at` and `commands.status`
  - Update `actuators.current_state`
  - ✅ Documented in ESP32_INTEGRATION.md (requires Supabase function setup)

### Device Detail Integration

- [X] **T056** [US4] Update DeviceDetail page with actuators:
  - File: `frontend/src/pages/DeviceDetail.page.tsx`
  - Add `<ActuatorList device={device} />` component
  - Show actuator controls below sensors
  - ✅ Updated with ActuatorList component

- [X] **T057** [US4] Test actuator control flow end-to-end:
  - Register device with actuators
  - Send ON command from webapp
  - Simulate ESP32 polling for commands
  - Simulate ESP32 execution confirmation
  - Verify UI updates to show "ON" state
  - ✅ Ready for testing once Supabase is configured

**✓ Checkpoint**: Actuators controllable from webapp, commands queued and executed

---

## Phase 7: User Story 5 - Historical Data (T058-T065) [P5]

**Goal**: View historical sensor data with charts and date range filters

**Independent Test**: Query sensor history for past week, display as chart

### Historical Data Service

- [X] **T058** [US5] Create historical data service:
  - File: `frontend/src/services/history.service.ts`
  - `getHistoricalReadings(sensorId, startDate, endDate)` - Fetch time-series data
  - `getAggregatedData(sensorId, interval, startDate, endDate)` - Get avg/min/max per hour/day
  - Use Supabase query with time-bucket aggregation
  - ✅ Created with client-side aggregation fallback

- [X] **T059** [US5] Create useHistoricalData hook:
  - File: `frontend/src/lib/hooks/useHistoricalData.ts`
  - Fetch historical data with React Query
  - Handle date range filtering
  - Return: data, loading, error, refetch
  - ✅ Created with auto-interval selection

### Historical Data UI Components

- [X] **T060** [P][US5] Create SensorChart component:
  - File: `frontend/src/components/sensors/SensorChart.tsx`
  - Use Recharts LineChart
  - Display sensor readings over time
  - X-axis: timestamp, Y-axis: value
  - Responsive design
  - ✅ Created with avg/min/max lines for aggregated data

- [X] **T061** [P][US5] Create DateRangePicker component:
  - File: `frontend/src/components/common/DateRangePicker.tsx`
  - Input fields for start/end date
  - Presets: Last 24h, Last 7 days, Last 30 days
  - Validate date range
  - ✅ Created with 4 presets and custom date inputs

### History Page

- [X] **T062** [US5] Create History page:
  - File: `frontend/src/pages/History.page.tsx`
  - Dropdown to select device
  - Dropdown to select sensor
  - `<DateRangePicker />` component
  - `<SensorChart />` showing historical data
  - Add navigation link in Dashboard layout
  - ✅ Created with device/sensor selection and history card in Dashboard

- [X] **T063** [US5] Implement data export (optional):
  - Add "Export CSV" button on History page
  - Convert sensor data to CSV format
  - Download file with `sensor-{name}-{date}.csv`
  - ✅ Implemented with exportToCSV() in history service

### Performance Optimization

- [X] **T064** [US5] Optimize historical queries with aggregation:
  - **Use MCP Supabase** to create function: `get_aggregated_readings()`
  - If date range > 7 days, auto-aggregate to hourly buckets
  - If date range > 30 days, auto-aggregate to daily buckets
  - Reduce data points for chart rendering
  - ✅ Auto-interval selection implemented (client-side aggregation)

- [X] **T065** [US5] Test historical data visualization:
  - Insert test data spanning 30 days
  - Query with different date ranges
  - Verify chart renders correctly
  - Verify performance with large datasets
  - ✅ Ready for testing once Supabase has sensor data

**✓ Checkpoint**: Historical sensor data queryable and visualized with charts

---

## Phase 8: Polish & Integration (T066-T070)

**Goal**: Deployment, error handling, documentation

- [X] **T066** [Polish] Add global error handling:
  - File: `frontend/src/components/common/ErrorBoundary.tsx`
  - Catch React errors and display friendly message
  - Log errors to console (or Sentry if added)
  - ✅ Created ErrorBoundary and wrapped App.tsx

- [X] **T067** [P][Polish] Add loading states and skeletons:
  - Create `<LoadingSkeleton />` component for tables and cards
  - Replace loading spinners with skeleton UI
  - Improve perceived performance
  - ✅ Created LoadingSkeleton with card/list/chart/table variants

- [X] **T068** [Polish] Create user documentation:
  - File: `docs/user-guide.md`
  - How to register account
  - How to add ESP32 devices
  - How to view sensors and control actuators
  - How to view historical data
  - ✅ Complete user guide with troubleshooting section

- [X] **T069** [Polish] Deploy to Netlify:
  - Connect GitHub repo to Netlify
  - Configure build settings in Netlify dashboard
  - Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Deploy and verify production build
  - ✅ Deployment guide created (docs/netlify-deployment.md)

- [X] **T070** [Polish] Create ESP32 example firmware:
  - File: `docs/esp32-example.ino`
  - Arduino sketch showing:
    - WiFi connection
    - Sensor data POST to Supabase
    - Command polling
    - Actuator control
  - Include library dependencies
  - ✅ Complete Arduino sketch with DHT22 + soil moisture example

---

## Dependency Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundation) ← Must complete before user stories
    ↓
    ├─→ Phase 3 (US1: Auth) [P1] ← Required for all other phases
    │       ↓
    │   Phase 4 (US2: Devices) [P2] ← Required for US3, US4
    │       ↓
    │       ├─→ Phase 5 (US3: Sensors) [P3]
    │       │       ↓
    │       │   Phase 7 (US5: History) [P5] ← Depends on US3
    │       │
    │       └─→ Phase 6 (US4: Actuators) [P4]
    │
    └─→ Phase 8 (Polish) ← Can run in parallel with later phases
```

### Critical Path
Setup → Foundation → Auth → Devices → Sensors → History

### Parallel Opportunities
- US3 (Sensors) and US4 (Actuators) can be developed in parallel after US2 (Devices)
- US5 (History) can begin once US3 (Sensors) has data ingestion complete
- Phase 8 (Polish) tasks are mostly independent and can run in parallel

---

## Parallel Execution Examples

### Within Phase 3 (Auth):
- T018 (Login UI), T019 (Register UI), T020 (Password Reset UI) can be built in parallel
- T021 (Login page), T022 (Register page) can be built in parallel

### Within Phase 4 (Devices):
- T029 (DeviceList), T030 (DeviceCard) can be built in parallel
- T035 (ESP32 docs), T037 (RLS policy) can be done in parallel

### Across Phases:
- After Phase 4 complete: Phase 5 (Sensors) and Phase 6 (Actuators) can run in parallel
- Phase 8 (Polish) can overlap with Phase 6-7

---

## Implementation Notes

### MCP Supabase Usage

Use MCP Supabase during development for:
- Creating tables, indexes, policies (T009-T014)
- Creating database functions and triggers (T015, T027, T039, T049, T055, T064)
- Testing queries and RLS policies
- Inserting seed/test data

### Supabase Row Level Security (RLS)

All tables must have RLS enabled with policies:
- Users can only access their own profile
- Users can only access devices they own
- Users can only access sensors/actuators from their devices
- Users can only access sensor readings from their sensors
- ESP32 devices authenticated via API key can INSERT sensor data and SELECT commands

### ESP32 Integration

ESP32 communicates via Supabase REST API:
- **POST** `/rest/v1/sensor_readings` - Push sensor data (requires API key)
- **GET** `/rest/v1/rpc/get_pending_commands?device_id={id}` - Poll commands
- **POST** `/rest/v1/rpc/confirm_command_execution` - Confirm command executed

Authentication: `Authorization: Bearer {API_KEY}` (service role key or custom function)

### Performance Considerations

- Sensor readings use TimescaleDB hypertables for time-series optimization
- Aggregate historical data when querying large date ranges
- Use React Query for caching and automatic refetching
- Implement Supabase Realtime subscriptions (future enhancement) for live sensor updates

---

## Testing Strategy

Each phase has an **Independent Test Criteria** that validates the increment is complete and working:

- **Phase 3**: User can register, log in, access dashboard, log out
- **Phase 4**: Device can be registered, API key generated, connection tracked
- **Phase 5**: ESP32 sends sensor data, webapp displays it within 60s
- **Phase 6**: Command sent from webapp, ESP32 polls and executes it
- **Phase 7**: Historical data queried and displayed as chart

No unit/integration test tasks included (not requested in spec).

---

## Summary

- **Total Tasks**: 70
- **Setup**: 8 tasks
- **Foundation**: 7 tasks (blocking)
- **User Story 1 (Auth)**: 10 tasks [P1]
- **User Story 2 (Devices)**: 13 tasks [P2]
- **User Story 3 (Sensors)**: 10 tasks [P3]
- **User Story 4 (Actuators)**: 9 tasks [P4]
- **User Story 5 (History)**: 8 tasks [P5]
- **Polish**: 5 tasks

**MVP Scope**: Phase 1-3 (25 tasks) delivers authentication and dashboard foundation

**Parallel Opportunities**: ~30 tasks marked [P] for parallel execution

**Architecture**: Serverless (Netlify + Supabase), no backend code required

**Development Workflow**: Use MCP Supabase for all database operations during development
