# Tasks: Cycle Management System

**Input**: Design documents from `/specs/007-fai-che-d/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No test framework specified in project - tests not included in tasks

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `frontend/src/`, `supabase/migrations/`
- Using existing project structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and type definitions needed by all user stories

- [X] **T001** Create TypeScript types file at `frontend/src/types/cycle.ts` with Cycle, CycleStatus, CycleEvent, CycleEventType, CycleWithProgress, UpdateCycleInput interfaces as specified in data-model.md
- [X] **T002** [P] Update database types file at `frontend/src/types/database.ts` to add `cycles` and `cycle_events` table definitions to Database interface

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database tables and triggers that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] **T003** Create cycles table migration at `supabase/migrations/20251120_create_cycles_table.sql` with columns: id (UUID PK), user_id (FK to auth.users), duration_weeks (INT default 12, CHECK > 0), current_week (INT default 1, CHECK > 0 AND <= duration_weeks), status (TEXT CHECK IN 'active'|'completed'), started_at, completed_at, created_at, updated_at. Include unique index for one active cycle per user, RLS policies for SELECT/INSERT/UPDATE using auth.uid()
- [ ] **T004** Create cycle_events table migration at `supabase/migrations/20251120_create_cycle_events_table.sql` with columns: id (UUID PK), cycle_id (FK to cycles), user_id (FK to auth.users), event_type (TEXT CHECK IN created|duration_updated|week_updated|completed|sensor_reading_associated), metadata (JSONB), previous_state (JSONB), new_state (JSONB), created_at. Include indexes on (cycle_id, created_at DESC), event_type, user_id, and GIN index on metadata. Add RLS policies for SELECT/INSERT using auth.uid()
- [ ] **T005** Create auto-cycle trigger migration at `supabase/migrations/20251120_create_cycle_on_user_signup.sql` with: (1) function create_default_cycle() to INSERT into cycles with defaults on new user, (2) trigger on_user_created_create_cycle AFTER INSERT on auth.users, (3) function log_cycle_created() to INSERT into cycle_events with event_type='created', (4) trigger on_cycle_created AFTER INSERT on cycles, (5) function log_cycle_updated() to detect duration_updated/week_updated/completed events and INSERT into cycle_events, (6) trigger on_cycle_updated AFTER UPDATE on cycles
- [ ] **T006** Apply migrations to Supabase database using Supabase Dashboard SQL Editor or CLI (`supabase db push`) in order: T003, T004, T005

**Checkpoint**: Foundation ready - database schema complete, auto-creation triggers active, user story implementation can now begin

---

## Phase 3: User Story 1 - Creazione Automatica Ciclo (Priority: P1) 🎯 MVP

**Goal**: New users automatically get a cycle created on registration. Users can see their cycle data organized by the current cycle.

**Independent Test**: Register a new user account and verify in Supabase dashboard that a row exists in `cycles` table with user_id matching the new user, status='active', duration_weeks=12, current_week=1. Then login and verify dashboard loads without errors.

### Implementation for User Story 1

- [ ] **T007** [P] [US1] Create React Query hook at `frontend/src/hooks/useCycle.ts` with functions: (1) useCycle() - query for active cycle using `.from('cycles').select('*').eq('status','active').single()`, (2) useCycleWithProgress() - extends useCycle to add computed progress_percentage and is_complete fields, (3) useUpdateCycle() - mutation for updating duration/week with client-side validation (current_week <= duration, both > 0) and error mapping to Italian messages, (4) useCompleteCycle() - mutation to set status='completed' and completed_at, (5) useCreateCycle() - mutation to insert new active cycle (handle 23505 error for duplicate active cycle)
- [ ] **T008** [P] [US1] Create cycle events hook at `frontend/src/hooks/useCycleEvents.ts` with useCycleEvents(cycleId) function to query `cycle_events` table filtered by cycle_id ordered by created_at DESC
- [ ] **T009** [US1] Create legacy user migration script at `supabase/migrations/20251120_migrate_legacy_users_cycles.sql` that INSERT INTO cycles for each user in auth.users that doesn't have an active cycle (LEFT JOIN where cycles.id IS NULL)
- [ ] **T010** [US1] Apply legacy migration script (T009) via Supabase Dashboard SQL Editor to backfill cycles for existing users
- [ ] **T011** [US1] Verify migration by checking Supabase dashboard: all existing users should have exactly one row in cycles with status='active'

**Checkpoint**: At this point, all users (new and existing) have active cycles. Hooks are ready to fetch cycle data. Dashboard can display cycle info.

---

## Phase 4: User Story 2 - Configurazione Durata Ciclo (Priority: P2)

**Goal**: Users can configure cycle duration (weeks) and current week from settings page with validation and helpful error messages.

**Independent Test**: Open Settings page, change duration from 12 to 16 weeks and current week from 1 to 5, click save. Reload page and verify values persisted. Then try to set current week to 20 (exceeds duration) and verify error message appears: "La settimana corrente non può superare la durata. Imposta prima una durata maggiore."

### Implementation for User Story 2

- [ ] **T012** [US2] Create CycleSettings component at `frontend/src/components/settings/CycleSettings.tsx` with: form containing two number inputs (duration_weeks with min=1, current_week with min=1 max=duration), handleSubmit function calling useUpdateCycle mutation, local state for duration and currentWeek, error display div showing mutation errors in Italian, loading/disabled state during mutation. Component should use useCycle() hook to load initial values into form state.
- [ ] **T013** [US2] Update Settings page at `frontend/src/pages/Settings.tsx` to import and render `<CycleSettings />` component in appropriate section (add heading "Configurazione Ciclo")
- [ ] **T014** [US2] Test Settings page manually: (1) verify form loads with current cycle values, (2) update duration and week successfully, (3) attempt current_week > duration and verify error appears, (4) attempt duration=0 and verify error appears, (5) verify error messages are in Italian with helpful suggestions

**Checkpoint**: Settings page allows full cycle configuration with validation. Users can customize their cycle parameters.

---

## Phase 5: User Story 3 - Visualizzazione Progress Ciclo in Dashboard (Priority: P3)

**Goal**: Dashboard shows full-width banner at top displaying cycle progress (week X of Y, Z% complete) with visual progress bar. When 100% complete, show alert with button to start new cycle.

**Independent Test**: Set cycle to week 4 of 12 via Settings, then open Dashboard and verify banner shows "Settimana 4 di 12" with "33%" displayed and green progress bar at 33% width. Then set cycle to week 12 of 12 and verify "100% completato" message appears with alert box offering "Inizia Nuovo Ciclo" button.

### Implementation for User Story 3

- [ ] **T015** [US3] Create CycleProgressBanner component at `frontend/src/components/dashboard/CycleProgressBanner.tsx` with: (1) use useCycleWithProgress() hook, (2) loading state with skeleton/shimmer, (3) main div with full width (w-full) containing heading "Ciclo di Coltivazione", (4) display text "Settimana {current} di {duration}", (5) display percentage as large bold number with "% completato" label, (6) progress bar div using Tailwind (bg-gray-200 container with bg-green-500 inner div using style={{width: `${percentage}%`}}), (7) conditional rendering: when is_complete && status==='active', show yellow alert box with AlertCircle icon (from lucide-react), message "Ciclo Completato!" explaining cycle finished, and button "Inizia Nuovo Ciclo" that calls useCompleteCycle then useCreateCycle mutations with confirmation dialog
- [ ] **T016** [US3] Update Dashboard page at `frontend/src/pages/Dashboard.tsx` to import CycleProgressBanner and render it at the top of the main container (before existing dashboard content)
- [ ] **T017** [US3] Test Dashboard manually: (1) verify banner displays correct progress for various cycle states (25%, 50%, 75%, 100%), (2) verify visual progress bar animates smoothly, (3) set to 100% and verify completion alert appears, (4) click "Inizia Nuovo Ciclo" button and confirm it completes old cycle and creates new one with duration=12, current_week=1

**Checkpoint**: Dashboard provides clear visual feedback on cycle progress. All user stories 1-3 are complete and independently functional.

---

## Phase 6: Historical Data Migration

**Purpose**: Associate existing devices, sensors, actuators, and sensor readings with user cycles

- [ ] **T018** Create historical data migration at `supabase/migrations/20251120_update_devices_sensors_with_cycle.sql` with: (1) ALTER TABLE devices ADD COLUMN cycle_id UUID FK to cycles, (2) ALTER TABLE sensors ADD COLUMN cycle_id UUID FK to cycles, (3) ALTER TABLE actuators ADD COLUMN cycle_id UUID FK to cycles, (4) ALTER TABLE sensor_readings ADD COLUMN cycle_id UUID FK to cycles, (5) CREATE INDEX on each cycle_id column, (6) UPDATE devices SET cycle_id = (SELECT id FROM cycles WHERE user_id = devices.user_id AND status='active' LIMIT 1), (7) UPDATE sensors SET cycle_id = devices.cycle_id FROM devices WHERE sensors.device_id = devices.id, (8) UPDATE actuators with similar approach, (9) UPDATE sensor_readings SET cycle_id = sensors.cycle_id FROM sensors WHERE sensor_readings.sensor_id = sensors.id
- [ ] **T019** Apply historical data migration (T018) via Supabase Dashboard to backfill cycle_id on all existing data
- [ ] **T020** Verify migration in Supabase dashboard: check that devices, sensors, actuators, sensor_readings tables all have non-null cycle_id values for rows created before migration

---

## Phase 7: Terminology Replacement

**Purpose**: Replace all UI instances of "progetto" with "Ciclo" to meet SC-004 (100% replacement)

- [ ] **T021** Search frontend codebase for "progetto" (case-insensitive) using command: `cd frontend/src && grep -ri "progetto" .` and record all locations
- [ ] **T022** Replace "progetto" with "Ciclo" in all React component files (*.tsx, *.jsx) found in T021
- [ ] **T023** [P] Replace "progetto" with "Ciclo" in all TypeScript definition files (*.ts) found in T021
- [ ] **T024** [P] Replace "progetto" with "Ciclo" in all string literals, labels, placeholders found in T021
- [ ] **T025** Re-run grep search to verify 100% replacement: `cd frontend/src && grep -ri "progetto" .` should return 0 results
- [ ] **T026** Manual UI review: navigate through all pages (Dashboard, Settings, Devices, Sensors, etc.) and verify "Ciclo" terminology is used consistently everywhere

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [ ] **T027** [P] Code review: verify all TypeScript types are correctly defined and imported
- [ ] **T028** [P] Verify RLS policies working: create test user, attempt to query another user's cycles and verify access denied
- [ ] **T029** Performance check: measure dashboard load time with cycle banner and verify < 100ms (SC-003)
- [ ] **T030** Event tracking verification: perform various cycle operations (create, update duration, update week, complete) and verify events appear in cycle_events table with correct metadata
- [ ] **T031** Error message verification: trigger all validation errors and verify Italian messages with helpful suggestions appear (FR-005, FR-011)
- [ ] **T032** Run through quickstart.md manual testing checklist and verify all items pass
- [ ] **T033** [P] Update CLAUDE.md if any new patterns or conventions established during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion, can run parallel with US1 and US3
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) completion, can run parallel with US1 and US2
- **Historical Data Migration (Phase 6)**: Depends on Foundational (Phase 2) - can run parallel with user stories
- **Terminology Replacement (Phase 7)**: Should happen after all components created (Phases 3-5)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational Phase 2 complete → US1 can start (no dependency on other stories)
- **User Story 2 (P2)**: Foundational Phase 2 complete → US2 can start (no dependency on other stories, uses hooks from US1)
- **User Story 3 (P3)**: Foundational Phase 2 complete → US3 can start (no dependency on other stories, uses hooks from US1)

### Within Each Phase

**Phase 2 (Foundational)**:
- T003, T004, T005 must complete before T006
- T006 (apply migrations) blocks all subsequent phases

**Phase 3 (US1)**:
- T007, T008 can run in parallel [P]
- T009 must complete before T010
- T011 verifies T010

**Phase 4 (US2)**:
- T012 must complete before T013
- T014 tests depend on T013

**Phase 5 (US3)**:
- T015 must complete before T016
- T017 tests depend on T016

**Phase 6 (Historical Data)**:
- T018 must complete before T019
- T020 verifies T019

**Phase 7 (Terminology)**:
- T021 → T022, T023, T024 (sequential)
- T022, T023, T024 can partially overlap if different files
- T025 verifies all replacements
- T026 final manual check

### Parallel Opportunities

- Phase 1: T001 and T002 can run in parallel [P]
- Phase 2: T003, T004, T005 can be written in parallel but must all complete before T006
- After Phase 2 completes: Phases 3, 4, 5, 6 can all run in parallel (if team capacity allows)
- Phase 3: T007 and T008 can run in parallel [P]
- Phase 7: T023 and T024 can run in parallel [P] after T022
- Phase 8: T027, T028, T033 can run in parallel [P]

---

## Parallel Example: Multi-Story Development

### Scenario 1: Single Developer (Sequential)
```bash
Day 1: Phase 1 (Setup) + Phase 2 (Foundational)
Day 2: Phase 3 (US1 - MVP) → Deploy
Day 3: Phase 4 (US2) + Phase 6 (Historical Data)
Day 4: Phase 5 (US3) + Phase 7 (Terminology)
Day 5: Phase 8 (Polish) → Final Deploy
```

### Scenario 2: Team of 3 (Parallel)
```bash
Day 1 (All): Phase 1 + Phase 2 (Foundation)
Day 2-3:
  - Dev A: Phase 3 (US1)
  - Dev B: Phase 4 (US2)
  - Dev C: Phase 5 (US3) + Phase 6 (Historical Data)
Day 4:
  - Dev A: Phase 7 (Terminology)
  - Dev B: Phase 8 (Polish)
  - Dev C: Testing & validation
```

### Parallel Task Execution Example (Phase 3)
```bash
# Launch both hooks in parallel (different files):
Task T007: Create useCycle.ts hook
Task T008: Create useCycleEvents.ts hook

# Then sequential:
Task T009: Write migration script
Task T010: Apply migration
Task T011: Verify migration
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Goal**: Deploy minimal working feature as fast as possible

1. Complete Phase 1: Setup (T001-T002) → ~30 min
2. Complete Phase 2: Foundational (T003-T006) → ~1-2 hours
3. Complete Phase 3: User Story 1 (T007-T011) → ~2 hours
4. **STOP and VALIDATE**: Test auto-cycle creation independently
5. Deploy/demo if ready → **MVP DEPLOYED**

**Deliverable**: New users get cycles automatically. Existing users have cycles backfilled. System is functional.

**Time Estimate**: 4-5 hours total

### Incremental Delivery (All User Stories)

**Goal**: Add value incrementally without breaking existing functionality

1. **Foundation**: Phase 1 + Phase 2 → Database ready
2. **Increment 1 (MVP)**: + Phase 3 (US1) → Auto-creation working
   - Test independently: Register new user → cycle exists
   - Deploy/Demo
3. **Increment 2**: + Phase 4 (US2) → Settings configuration
   - Test independently: Change duration/week → persists
   - Deploy/Demo
4. **Increment 3**: + Phase 5 (US3) → Dashboard visualization
   - Test independently: Open dashboard → banner shows progress
   - Deploy/Demo
5. **Increment 4**: + Phase 6 + Phase 7 → Historical data + terminology
   - Test: All "progetto" replaced, historical data has cycle_id
   - Deploy/Demo
6. **Final**: + Phase 8 → Polish
   - Full validation, performance check
   - Final Deploy

**Time Estimate**: 6-9 hours total (1-2 days)

### Parallel Team Strategy

**Goal**: Maximum speed with multiple developers

**Prerequisites** (Everyone Together):
- Phase 1: Setup (30 min)
- Phase 2: Foundational (1-2 hours)

**Then Parallelize**:
- **Developer A**: Phase 3 (US1) → Focuses on auto-creation and hooks
- **Developer B**: Phase 4 (US2) → Focuses on settings UI
- **Developer C**: Phase 5 (US3) + Phase 6 → Dashboard banner + historical migration

**Convergence**:
- **Developer A**: Phase 7 (Terminology) → Search and replace across codebase
- **All**: Phase 8 (Polish) → Final review and testing

**Time Estimate**: 2-3 hours total (with 3 developers)

---

## Notes

- **[P] markers**: Tasks in different files with no dependencies can run in parallel
- **[Story] labels**: Each task labeled with which user story it belongs to (US1, US2, US3)
- **Independent testing**: Each user story has explicit test criteria that work without other stories
- **Commit strategy**: Commit after each task or logical group (e.g., after T006, after T011, after T014, etc.)
- **Checkpoints**: Stop at any checkpoint to validate the story independently before proceeding
- **No tests in tasks**: Project has no test framework specified - manual testing only via quickstart.md checklist
- **Migration safety**: Always test migrations on development environment first, use transactions where possible
- **RLS verification**: Critical to test RLS policies work correctly (T028) to prevent security issues
- **Performance validation**: SC-003 requires <100ms dashboard load - verify with browser DevTools
- **Event tracking validation**: SC-007 requires 100% event tracking - verify in cycle_events table

---

## Task Count Summary

- **Total Tasks**: 33
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 4 tasks
- **Phase 3 (User Story 1)**: 5 tasks
- **Phase 4 (User Story 2)**: 3 tasks
- **Phase 5 (User Story 3)**: 3 tasks
- **Phase 6 (Historical Data)**: 3 tasks
- **Phase 7 (Terminology)**: 6 tasks
- **Phase 8 (Polish)**: 7 tasks

**Parallel Opportunities**: 8 tasks can run in parallel (marked with [P])

**MVP Scope (Recommended)**: Phases 1-3 only (11 tasks, ~4-5 hours)
