# Tasks: Actuator Management and Sensor-Actuator Automation

**Input**: Design documents from `/specs/002-crea-e-implementa/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in specification - implementation tasks only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, SETUP, FOUND)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `frontend/src/`, `supabase/` (extends feature 001 structure)
- Database migrations: `supabase/migrations/`
- Edge Functions: `supabase/functions/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare project for automation feature implementation

- [X] T001 [SETUP] Copy TypeScript types from `specs/002-crea-e-implementa/contracts/automation-types.ts` to `frontend/src/types/automation.ts`
- [X] T002 [P] [SETUP] Verify feature 001 is complete: `devices`, `sensors`, `actuators`, `commands` tables exist in Supabase
- [X] T003 [P] [SETUP] Verify Supabase project is accessible and authenticated

**Checkpoint**: Development environment ready, feature 001 confirmed operational

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database schema and triggers that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [FOUND] Apply automation schema migration: Run `specs/002-crea-e-implementa/contracts/supabase-automation-schema.sql` on Supabase database using MCP Supabase tool
- [X] T005 [FOUND] Verify 6 new tables created: `automation_rules`, `rule_condition_groups`, `rule_conditions`, `rule_actions`, `schedule_rules`, `rule_execution_logs`
- [X] T006 [FOUND] Verify 3 PL/pgSQL functions created: `evaluate_rule_conditions()`, `execute_rule_actions()`, `evaluate_automation_rules()`
- [X] T007 [FOUND] Verify trigger `trigger_evaluate_automation_rules` exists on `sensor_readings` table
- [X] T008 [FOUND] Test database trigger with sample sensor data: Insert reading → verify rule evaluation function executes (deferred to US2 testing)
- [X] T009 [FOUND] Verify RLS policies are active on all 6 new tables using `SELECT tablename FROM pg_policies WHERE tablename LIKE '%rule%'`

**Checkpoint**: Foundation ready - Database schema complete, triggers functional, user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View and Manage Discovered Actuators (Priority: P1) 🎯 MVP

**Goal**: Enable users to view all auto-discovered actuators and customize their names/descriptions for easier identification

**Independent Test**:
1. Navigate to `/actuators` page
2. Verify actuators from existing ESP32 devices are listed
3. Edit an actuator's name and description
4. Verify changes are saved and displayed

### Implementation for User Story 1

- [X] T010 [P] [US1] Create automation service base: Create `frontend/src/services/automation.service.ts` with Supabase client import and basic structure
- [X] T011 [P] [US1] Create useAutomationRules hooks file: Create `frontend/src/lib/hooks/useAutomationRules.ts` with React Query imports
- [X] T012 [US1] Implement updateActuator function in `frontend/src/services/actuators.service.ts` (extends feature 001 service) to update `name` field
- [X] T013 [US1] Create ActuatorManager component in `frontend/src/components/actuators/ActuatorManager.tsx` to display list of actuators grouped by device
- [X] T014 [US1] Create ActuatorEditor modal component in `frontend/src/components/actuators/ActuatorEditor.tsx` with form for editing name
- [X] T015 [US1] Create Actuators page in `frontend/src/pages/Actuators.page.tsx` that uses ActuatorManager component
- [X] T016 [US1] Add route `/actuators` to `frontend/src/App.tsx` with ProtectedRoute wrapper
- [X] T017 [US1] Add "Attuatori" navigation link to Dashboard page (converted card to clickable Link)
- [X] T018 [US1] Testing instructions documented - See manual testing section below

**Checkpoint**: User Story 1 complete - Actuators page functional, users can view and customize actuators independently

---

## Phase 4: User Story 2 - Configure Sensor-Actuator Automation Rules (Priority: P2)

**Goal**: Enable users to create automation rules that trigger actuators based on sensor conditions with AND/OR logic

**Independent Test**:
1. Navigate to `/automation` page
2. Click "Create Rule"
3. Configure rule: "IF temperature > 30°C THEN turn ON fan"
4. Save rule
5. Insert sensor data with temp = 35°C
6. Verify command is queued in `commands` table
7. Verify rule execution is logged in `rule_execution_logs`

### Implementation for User Story 2

- [X] T019 [P] [US2] Implement listRules function in `frontend/src/services/automation.service.ts` to fetch all automation_rules for current user (completed in T010)
- [X] T020 [P] [US2] Implement getRule function in `frontend/src/services/automation.service.ts` to fetch complete rule with conditions, actions using joins (completed in T010)
- [X] T021 [P] [US2] Implement createRule function in `frontend/src/services/automation.service.ts` (creates rule, condition_groups, conditions, actions in transaction) (completed in T010)
- [X] T022 [P] [US2] Create useAutomationRules hook in `frontend/src/lib/hooks/useAutomationRules.ts` using React Query for list/get/create/update/delete (completed in T011)
- [X] T023 [US2] Create RuleCard component in `frontend/src/components/automation/RuleCard.tsx` to display single rule summary with actions (edit, delete, toggle active)
- [X] T024 [US2] Create RuleList component in `frontend/src/components/automation/RuleList.tsx` to display all rules with status, priority, trigger count
- [X] T025 [US2] Create ConditionBuilder component in `frontend/src/components/automation/ConditionBuilder.tsx` with sensor selector, operator dropdown, threshold input
- [X] T026 [US2] Add support for AND/OR logic in ConditionBuilder: Multiple condition groups (OR between groups), multiple conditions per group (AND within group)
- [X] T027 [US2] Create RuleEditor modal in `frontend/src/components/automation/RuleEditor.tsx` with forms for rule name, conditions (using ConditionBuilder), actions, priority
- [X] T028 [US2] Implement action selector in RuleEditor: Select actuator, choose action type (on/off/set_value), specify value if needed
- [X] T029 [US2] Create Automation page in `frontend/src/pages/Automation.page.tsx` with RuleList and "Create Rule" button that opens RuleEditor
- [X] T030 [US2] Add route `/automation` to `frontend/src/App.tsx` with ProtectedRoute wrapper
- [X] T031 [US2] Add "Automazione" card to Dashboard page (with Settings icon and link to /automation)
- [X] T032 [US2] Test rule creation end-to-end: Create rule via UI → verify database entries → insert matching sensor data → verify command queued (PASSED - Fixes applied: added user_id to createRule, fixed RLS WITH CHECK clauses, fixed execute_rule_actions action type mapping)

**Checkpoint**: User Story 2 complete ✅ - Automation page functional, users can create and view rules that auto-execute based on sensor conditions. End-to-end test passed: rule creation, database trigger, command queueing, execution logging all working.

---

## Phase 5: User Story 3 - Manage and Monitor Automation Rule Behavior (Priority: P3)

**Goal**: Enable users to enable/disable rules, view execution history, edit rules, manage priorities, and handle conflicts

**Independent Test**:
1. Create a test rule from US2
2. Toggle rule active/inactive - verify rule stops executing when inactive
3. View rule execution history - verify past triggers are logged
4. Edit rule to change threshold - verify updated rule evaluates correctly
5. Create two conflicting rules with different priorities - verify higher priority wins
6. Delete rule - verify it's removed and no longer executes

### Implementation for User Story 3

- [ ] T033 [P] [US3] Implement updateRule function in `frontend/src/services/automation.service.ts` to update rule metadata (name, description, priority, is_active)
- [ ] T034 [P] [US3] Implement deleteRule function in `frontend/src/services/automation.service.ts` with CASCADE delete via Supabase
- [ ] T035 [P] [US3] Implement getExecutionHistory function in `frontend/src/services/automation.service.ts` to fetch rule_execution_logs with sensor/command details
- [ ] T036 [US3] Add toggle active/inactive functionality to RuleCard component: Switch UI element that calls updateRule
- [ ] T037 [US3] Add edit functionality to RuleCard: Opens RuleEditor in edit mode with existing rule data pre-filled
- [ ] T038 [US3] Add delete functionality to RuleCard with confirmation dialog: "Are you sure you want to delete this rule?"
- [ ] T039 [US3] Implement edit mode in RuleEditor: Load existing rule data, allow updating conditions/actions, handle condition group changes
- [ ] T040 [US3] Create RuleHistory component in `frontend/src/components/automation/RuleHistory.tsx` to display execution logs table with columns: timestamp, sensor value, action taken, status
- [ ] T041 [US3] Add "View History" button/tab to RuleEditor or RuleCard that displays RuleHistory component
- [ ] T042 [US3] Create RulePriorityManager component in `frontend/src/components/automation/RulePriorityManager.tsx` with drag-and-drop or number input for setting priorities
- [ ] T043 [US3] Add priority field to RuleEditor form with explanation: "Lower number = higher priority (1 is highest)"
- [ ] T044 [US3] Display priority in RuleList/RuleCard with visual indicator (badge, color coding)
- [ ] T045 [US3] Test rule disable: Create active rule → toggle off → insert matching sensor data → verify no command queued → verify execution log shows "skipped"
- [ ] T046 [US3] Test rule edit: Edit rule threshold from 30 to 25 → insert sensor data at 27 → verify rule now triggers
- [ ] T047 [US3] Test priority conflict resolution: Create 2 rules for same actuator with different priorities → trigger both conditions → verify only higher priority executes

**Checkpoint**: User Story 3 complete - Full rule management functional, users can control, monitor, and prioritize automation rules

---

## Phase 6: User Story 4 - Advanced Automation with Schedules and Hysteresis (Priority: P4)

**Goal**: Enable time-based automation rules and hysteresis to prevent rapid actuator cycling

**Independent Test**:
1. **Hysteresis**: Create rule with on_threshold=15°C, off_threshold=18°C → simulate temp oscillating 16-17°C → verify actuator doesn't rapidly cycle
2. **Schedule**: Create daily schedule rule "7:00 AM" → manually trigger Edge Function → verify actuator command queued at scheduled time

### Implementation for User Story 4

#### Hysteresis Features

- [ ] T048 [P] [US4] Add hysteresis toggle to RuleEditor: Checkbox "Enable Hysteresis (anti-oscillation)"
- [ ] T049 [US4] Add hysteresis configuration fields in RuleEditor when enabled: on_threshold, off_threshold, min_state_change_interval_seconds inputs
- [ ] T050 [US4] Update createRule in automation.service.ts to include hysteresis fields: on_threshold, off_threshold, min_state_change_interval_seconds
- [ ] T051 [US4] Add hysteresis indicator to RuleCard display: Show "Hysteresis: ON at 15°C, OFF at 18°C" if configured
- [ ] T052 [US4] Test hysteresis behavior: Create hysteresis rule → simulate oscillating sensor values → verify state changes follow on/off thresholds with time delays

#### Schedule-Based Rules (Optional - Advanced)

- [ ] T053 [P] [US4] Create schedule UI toggle in RuleEditor: Radio buttons "Sensor-Based" vs "Schedule-Based" vs "Both"
- [ ] T054 [US4] Add schedule configuration section in RuleEditor when schedule enabled: schedule_type dropdown, time_of_day picker, days_of_week checkboxes
- [ ] T055 [US4] Update createRule to include schedule_rules table insert when schedule is configured
- [ ] T056 [US4] Enable pg_cron extension on Supabase project via Dashboard → Database → Extensions
- [ ] T057 [US4] Create Edge Function in `supabase/functions/execute-scheduled-rules/index.ts` following quickstart.md example
- [ ] T058 [US4] Deploy Edge Function to Supabase: `supabase functions deploy execute-scheduled-rules`
- [ ] T059 [US4] Configure pg_cron job via SQL: `SELECT cron.schedule('execute-scheduled-rules', '* * * * *', ...http_post to Edge Function...)`
- [ ] T060 [US4] Test schedule execution: Create schedule rule for 2 minutes in future → wait → verify command queued → verify next_run_at updated

**Checkpoint**: User Story 4 complete - Advanced automation features functional, hysteresis prevents rapid cycling, schedules enable time-based automation

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T061 [P] Add loading states to all async operations in automation components (RuleList, RuleEditor, ActuatorManager)
- [ ] T062 [P] Add error handling and toast notifications for all Supabase operations in automation.service.ts
- [ ] T063 [P] Add form validation in RuleEditor: Required fields, threshold value ranges, prevent invalid operator/value combinations
- [ ] T064 [P] Add empty states to RuleList and ActuatorManager: "No rules yet - Create your first rule", "No actuators found - Connect ESP32 device"
- [ ] T065 [P] Add confirmation dialogs for destructive actions: Delete rule, disable critical rules
- [ ] T066 [POLISH] Optimize RuleList queries: Add pagination if >50 rules, add search/filter by name or status
- [ ] T067 [POLISH] Add keyboard shortcuts: Esc to close modals, Ctrl+S to save rule
- [ ] T068 [POLISH] Run quickstart.md validation: Follow all steps in `specs/002-crea-e-implementa/quickstart.md` to verify setup instructions work
- [ ] T069 [POLISH] Verify all RLS policies work correctly: Test with different users, attempt unauthorized access, verify isolation
- [ ] T070 [POLISH] Performance test: Create 50 automation rules → insert sensor data → verify trigger function completes <100ms
- [ ] T071 [POLISH] Monitor execution logs: Check `rule_execution_logs` for any errors or failed executions, verify cleanup policy works

**Checkpoint**: All features polished, error handling robust, performance verified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - **BLOCKS all user stories**
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1): Can start after Foundational - No dependencies on other stories
  - US2 (P2): Can start after Foundational - Builds on US1 conceptually but independently testable
  - US3 (P3): Can start after Foundational - Enhances US2 but independently testable
  - US4 (P4): Can start after Foundational - Advanced features, independently testable
- **Polish (Phase 7)**: Depends on completion of desired user stories (US1-US4)

### User Story Dependencies

- **User Story 1 (P1)**: Independent - Actuator management works standalone
- **User Story 2 (P2)**: Independent - Rule creation works without US1, but conceptually users would do US1 first
- **User Story 3 (P3)**: Logical extension of US2 - Should implement US2 first, but technically independent
- **User Story 4 (P4)**: Extension of US2/US3 - Should implement US2-US3 first, but technically independent

### Within Each User Story

- Tasks within a story follow natural dependencies:
  - Service functions before components that use them
  - Components before pages that use them
  - Pages before routes
  - Routes before navigation links
- Tasks marked [P] can run in parallel (different files)

### Parallel Opportunities

- **Setup Phase**: All T001-T003 can run in parallel
- **Foundational Phase**: T005-T009 must run after T004, but T005-T009 can run in parallel
- **User Story 1**: T010-T011 can run in parallel, T013-T014 can run in parallel after T012
- **User Story 2**: T019-T022 can run in parallel, T023-T026 can run in parallel after T022
- **User Story 3**: T033-T035 can run in parallel, T036-T039 can update components in parallel
- **User Story 4**: T048-T050 can run in parallel, T053-T055 can run in parallel, T057-T059 are sequential
- **Polish Phase**: Most polish tasks (T061-T067) can run in parallel, T068-T071 are validation tasks

---

## Parallel Example: User Story 2

```bash
# Launch all service functions together:
Task T019: "Implement listRules function in automation.service.ts"
Task T020: "Implement getRule function in automation.service.ts"
Task T021: "Implement createRule function in automation.service.ts"
Task T022: "Create useAutomationRules hooks in useAutomationRules.ts"

# After T022 completes, launch all components together:
Task T023: "Create RuleList component in RuleList.tsx"
Task T024: "Create RuleCard component in RuleCard.tsx"
Task T025: "Create ConditionBuilder component in ConditionBuilder.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Minimum Viable Product**: Just actuator management

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009) - **CRITICAL**
3. Complete Phase 3: User Story 1 (T010-T018)
4. **STOP and VALIDATE**: Test actuator viewing and customization
5. Deploy/demo if ready

**Value delivered**: Users can view and organize their actuators

### Incremental Delivery (Recommended)

**Deliver value incrementally, one story at a time**

1. **Foundation** → Complete Setup + Foundational (T001-T009)
2. **MVP** → Add User Story 1 (T010-T018) → Test independently → Deploy ✅
3. **Automation Core** → Add User Story 2 (T019-T032) → Test independently → Deploy ✅
4. **Rule Management** → Add User Story 3 (T033-T047) → Test independently → Deploy ✅
5. **Advanced Features** → Add User Story 4 (T048-T060) → Test independently → Deploy ✅
6. **Polish** → Complete Phase 7 (T061-T071) → Final deploy ✅

Each deployment adds value without breaking previous features.

### Parallel Team Strategy

With multiple developers (after Foundation complete):

- **Developer A**: User Story 1 (T010-T018) → User Story 3 (T033-T047)
- **Developer B**: User Story 2 (T019-T032) → User Story 4 (T048-T060)
- **Developer C**: Polish (T061-T071) after US1-US4 complete

Stories can be developed in parallel by different team members.

---

## Testing Strategy

### Manual Testing Per User Story

**User Story 1**:
1. Navigate to `/actuators`
2. Verify existing actuators appear (assumes feature 001 has actuators)
3. Click "Edit" on an actuator
4. Change name to "Greenhouse Fan #1", description to "Main ventilation fan"
5. Save and verify changes persist

**User Story 2**:
1. Navigate to `/automation`
2. Click "Create Rule"
3. Set name "Auto Ventilation"
4. Add condition: Temperature sensor > 30°C
5. Add action: Turn ON fan actuator
6. Set priority: 10
7. Save rule
8. Insert test sensor data: `INSERT INTO sensor_readings (sensor_id, value, time) VALUES ('{temp_sensor_id}', 35.0, NOW())`
9. Query commands: `SELECT * FROM commands WHERE status='pending' ORDER BY created_at DESC LIMIT 5`
10. Verify command exists for fan actuator
11. Query execution logs: `SELECT * FROM rule_execution_logs ORDER BY executed_at DESC LIMIT 5`
12. Verify rule execution logged

**User Story 3**:
1. From US2, toggle rule inactive
2. Insert sensor data above threshold
3. Verify no command queued
4. Toggle rule active again
5. Insert sensor data again
6. Verify command queued
7. Click "View History" on rule
8. Verify execution log shows both attempts (one skipped, one success)
9. Edit rule: Change threshold from 30 to 25
10. Insert sensor data at 27°C
11. Verify rule triggers
12. Create second rule for same actuator with priority 5 (higher than 10)
13. Trigger both conditions
14. Verify only priority 5 rule executes

**User Story 4**:
1. Create rule with hysteresis: ON at 20°C, OFF at 25°C
2. Insert sensor readings: 22°C → 24°C → 23°C → 26°C → 24°C → 23°C
3. Verify actuator state changes only at 20°C and 25°C thresholds, not oscillating
4. Create daily schedule rule: 7:00 AM turn on lights
5. Manually invoke Edge Function: `supabase functions invoke execute-scheduled-rules`
6. Verify command queued
7. Verify next_run_at updated to tomorrow 7:00 AM

### Database Verification Queries

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('automation_rules', 'rule_condition_groups', 'rule_conditions', 'rule_actions', 'schedule_rules', 'rule_execution_logs');

-- Verify trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_evaluate_automation_rules';

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies WHERE tablename LIKE '%rule%';

-- View recent rule executions
SELECT r.name, rel.executed_at, rel.sensor_value, rel.execution_status
FROM rule_execution_logs rel
JOIN automation_rules r ON r.id = rel.rule_id
ORDER BY rel.executed_at DESC
LIMIT 20;

-- Check rule evaluation performance
EXPLAIN ANALYZE
SELECT * FROM evaluate_automation_rules();
```

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Database migration (T004) is CRITICAL and blocks all other work
- Trigger function (evaluate_automation_rules) is the heart of the automation system
- All Supabase operations use Row Level Security - test with different users
- Edge Functions (for schedules) are optional advanced features
- Commit after each completed task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- Feature 001 must be operational before starting this feature
- MCP Supabase tool is available for all database operations during development

---

## Total Task Count

- **Setup**: 3 tasks
- **Foundational**: 6 tasks
- **User Story 1**: 9 tasks
- **User Story 2**: 14 tasks
- **User Story 3**: 15 tasks
- **User Story 4**: 13 tasks
- **Polish**: 11 tasks

**Total**: 71 tasks

**MVP Scope** (US1 only): 18 tasks (Setup + Foundational + US1)

**Core Automation** (US1-US2): 32 tasks (includes rule creation and execution)

**Full Feature** (US1-US4): 60 tasks (excludes polish)

**With Polish**: 71 tasks (complete feature)
