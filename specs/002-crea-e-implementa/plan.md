# Implementation Plan: Actuator Management and Sensor-Actuator Automation

**Branch**: `002-crea-e-implementa` | **Date**: 2025-10-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-crea-e-implementa/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build actuator management and automation rules pages for the greenhouse management system. Users can view/customize auto-discovered actuators from ESP32 devices and create sensor-to-actuator automation rules with priority-based conflict resolution. Extends existing Supabase + React architecture from feature 001 with new database tables (automation_rules, rule_conditions, rule_executions), frontend pages (Actuators.page, Automation.page), and real-time rule evaluation engine.

## Technical Context

**Language/Version**: TypeScript 5+ (frontend)
**Primary Dependencies**: React 18+, Vite, @supabase/supabase-js, React Query, Recharts (extends feature 001 stack)
**Storage**: Supabase (PostgreSQL + Row Level Security) - add tables for automation rules, conditions, and execution logs
**Authentication**: Supabase Auth (existing from feature 001)
**Deployment**: Netlify (frontend), Supabase (database + API + Edge Functions for rule evaluation)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web application (serverless architecture)
**Project Type**: web (JAMstack - frontend only with Supabase backend)

**Performance Goals**:
- Actuator list page load <1s (similar to sensors page)
- Automation rule creation <3 minutes (user story SC-002)
- Rule evaluation and execution within 10 seconds of sensor conditions met (SC-003)
- Support 50+ active rules per user without degradation (SC-004)
- UI interactions (toggle rules, edit thresholds) <200ms response

**Constraints**:
- Builds on existing feature 001 infrastructure (same Supabase project, same authentication)
- Actuators already exist in database from feature 001 (table: actuators)
- Rule evaluation must work within ESP32 polling cycle (30-60s latency acceptable)
- Priority-based conflict resolution required (user assigns priority numbers)
- No real-time rule execution (polling-based is acceptable per feature assumptions)
- Must maintain RLS policies for multi-tenant data isolation

**Scale/Scope**:
- Users: 100-1000 greenhouse owners (same as feature 001)
- Rules per user: 10-50 automation rules
- Rule conditions: 1-5 conditions per rule (AND/OR logic)
- Rule evaluation frequency: Every sensor data ingestion (30-60s intervals)
- Execution logs: Store last 1000 executions per rule or 90 days (whichever comes first)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ⚠️ CONSTITUTION FILE IS TEMPLATE ONLY - No project-specific principles defined

The constitution file at `.specify/memory/constitution.md` contains only placeholder template content. No specific architectural principles, constraints, or gates have been established for this project.

**Proceeding with**: Default "start simple" approach with no formal gates. Standard best practices apply:
- Extend existing feature 001 architecture (no new projects or services)
- Reuse Supabase + React + Netlify stack
- Add minimal new complexity: 6 new database tables, 2 new pages, database triggers
- Test coverage for automation rule logic (critical business logic)
- RLS policies for new automation tables

## Project Structure

### Documentation (this feature)

```
specs/002-crea-e-implementa/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Extends existing structure from feature 001:

```
frontend/
├── src/
│   ├── components/
│   │   ├── actuators/         # [EXISTING from 001] ActuatorCard, ActuatorList
│   │   │   ├── ActuatorManager.tsx     # [NEW] Actuator management page content
│   │   │   └── ActuatorEditor.tsx      # [NEW] Edit actuator name/description modal
│   │   ├── automation/                  # [NEW] Automation rules components
│   │   │   ├── RuleList.tsx            # [NEW] Display list of automation rules
│   │   │   ├── RuleCard.tsx            # [NEW] Display single rule with status
│   │   │   ├── RuleEditor.tsx          # [NEW] Create/edit rule modal
│   │   │   ├── ConditionBuilder.tsx    # [NEW] Build sensor conditions (sensor, operator, threshold)
│   │   │   ├── RuleHistory.tsx         # [NEW] Display rule execution history
│   │   │   └── RulePriorityManager.tsx # [NEW] Manage rule priorities
│   │   └── ... [existing from 001]
│   ├── pages/
│   │   ├── Actuators.page.tsx          # [NEW] Actuator management page
│   │   ├── Automation.page.tsx         # [NEW] Automation rules page
│   │   └── ... [existing from 001]
│   ├── services/
│   │   ├── automation.service.ts       # [NEW] CRUD operations for rules
│   │   └── ... [existing from 001]
│   ├── lib/hooks/
│   │   ├── useAutomationRules.ts       # [NEW] React Query hooks for rules
│   │   └── ... [existing from 001]
│   └── ... [existing structure]
├── supabase/
│   ├── migrations/
│   │   └── [timestamp]_add_automation_tables.sql  # [NEW] Automation schema
│   └── functions/
│       └── execute-scheduled-rules/    # [NEW] Edge function for scheduled rules
│           └── index.ts
└── ... [existing files]
```

**Structure Decision**: Extend existing JAMstack serverless architecture from feature 001. No backend needed - all logic in Supabase (database + triggers + edge functions). Add 2 new frontend pages, 1 new component directory (automation/), 1 new service, 1 optional edge function for scheduled rules, and database migrations for 6 new tables.

**Architecture Benefits**:
- **Minimal added complexity**: Builds on proven feature 001 architecture
- **No new infrastructure**: Same Supabase + Netlify deployment
- **Leverages existing**: Authentication, device/sensor/actuator data, RLS policies
- **Database triggers for real-time**: Postgres triggers on sensor_readings table invoke rule evaluation
- **Optional Edge Functions**: Only for scheduled rules (advanced feature)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitution violations - extending existing serverless approach with minimal new components.

---

## Phase 0: Research ✅ COMPLETED

**Output**: [research.md](./research.md)

**Key Decisions**:

1. **Rule Evaluation Architecture**: PostgreSQL Triggers + Stored Procedures
   - Rationale: Zero latency (<1ms), data locality, ACID guarantees, cost efficient
   - Implementation: Trigger on sensor_readings calls PL/pgSQL evaluation function

2. **Rule Condition Data Model**: Relational Tables (rule_condition_groups + rule_conditions)
   - Rationale: Query performance, type safety, RLS compatibility, UI mapping
   - Structure: Groups (OR logic) contain Conditions (AND logic)

3. **Hysteresis Implementation**: State stored in automation_rules table
   - Rationale: Simplicity, performance, serverless friendly
   - Columns: on_threshold, off_threshold, current_actuator_state, last_state_change_at

4. **Schedule-Based Rules**: Supabase Edge Functions + pg_cron
   - Rationale: Native Supabase solution, reliable, no external dependencies
   - Implementation: pg_cron triggers Edge Function every minute to check due schedules

5. **Rule Execution Logs**: Simple table with 90-day retention
   - Rationale: Sufficient for debugging, easy to query, no TimescaleDB needed
   - Cleanup: pg_cron job deletes old logs daily

---

## Phase 1: Design & Contracts ✅ COMPLETED

**Outputs**:
- [data-model.md](./data-model.md) - Complete database schema with 6 new tables
- [contracts/supabase-automation-schema.sql](./contracts/supabase-automation-schema.sql) - Full migration script
- [contracts/automation-types.ts](./contracts/automation-types.ts) - TypeScript type definitions
- [quickstart.md](./quickstart.md) - Developer setup and integration guide

**Database Schema Summary**:
- **automation_rules**: Main rule table with priority, hysteresis support (15 columns)
- **rule_condition_groups**: AND/OR logic grouping (4 columns)
- **rule_conditions**: Individual sensor conditions (8 columns)
- **rule_actions**: Actuator actions to execute (7 columns)
- **schedule_rules**: Time-based triggers (11 columns)
- **rule_execution_logs**: Execution history (8 columns)

**Functions Created**:
- `evaluate_rule_conditions()`: AND/OR logic evaluation
- `execute_rule_actions()`: Queue commands for actuators
- `evaluate_automation_rules()`: Main trigger function

**Trigger Created**:
- `trigger_evaluate_automation_rules` on `sensor_readings` table

**TypeScript Contracts**:
- Database table interfaces
- API request/response types
- Validation helpers
- Formatting utilities

**Integration Guide**:
- Database migration steps
- Frontend service layer example
- React Query hooks example
- Testing procedures

---

## Next Steps

### Phase 2: Task Generation (`/speckit.tasks`)

Ready to generate implementation tasks based on completed design artifacts.

Expected task breakdown:
1. **Database Setup** (Priority: P1)
   - Apply supabase-automation-schema.sql migration
   - Verify tables, functions, triggers created
   - Enable pg_cron extension
   - Test sample rule creation

2. **Frontend Services** (Priority: P2)
   - Copy TypeScript types to frontend
   - Create automation.service.ts
   - Create useAutomationRules hooks
   - Test service layer with sample data

3. **Actuators Page** (Priority: P3)
   - Build ActuatorManager component
   - Build ActuatorEditor modal
   - Integrate with existing actuator data
   - Add navigation link

4. **Automation Rules Page** (Priority: P3)
   - Build RuleList component
   - Build RuleCard component
   - Build RuleEditor modal
   - Build ConditionBuilder component
   - Add route to App.tsx

5. **Advanced Features** (Priority: P4)
   - Implement RuleHistory component
   - Add hysteresis UI
   - Build schedule rule editor
   - Add priority management

6. **Edge Function for Schedules** (Priority: P4)
   - Deploy execute-scheduled-rules Edge Function
   - Configure pg_cron job
   - Test scheduled rule execution

7. **Testing & Validation** (Priority: P5)
   - Unit tests for automation service
   - Integration tests for rule evaluation
   - End-to-end test: create rule → trigger → verify command
   - Performance test: 50+ rules evaluation

### Phase 3: Implementation (`/speckit.implement`)

Execute tasks in dependency order with:
- Database-first approach (schema before frontend)
- Test-driven development for critical rule logic
- Incremental feature delivery (actuators → simple rules → advanced rules → schedules)

---

## References

- **Feature Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Database Schema**: [contracts/supabase-automation-schema.sql](./contracts/supabase-automation-schema.sql)
- **TypeScript Types**: [contracts/automation-types.ts](./contracts/automation-types.ts)
- **Quick Start**: [quickstart.md](./quickstart.md)
- **Feature 001 Plan**: [../001-voglio-fare-una/plan.md](../001-voglio-fare-una/plan.md)
