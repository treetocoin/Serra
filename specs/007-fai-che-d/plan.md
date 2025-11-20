# Implementation Plan: Cycle Management System

**Branch**: `007-fai-che-d` | **Date**: 2025-11-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-fai-che-d/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Rename "progetto" to "Ciclo" throughout the UI and introduce cycle lifecycle management. Auto-create cycles on user registration, allow users to configure cycle duration and current week from settings, display progress indicator on dashboard, track all cycle events for future AI/ML training, and migrate legacy users with historical data association.

**Technical Approach**: Frontend-only changes (no backend needed - using Supabase) + database migrations for new `cycles` table and `cycle_events` audit log table. React components for settings UI and dashboard banner. Supabase trigger for auto-cycle creation + migration script for legacy users.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (frontend only)
**Primary Dependencies**: React 19, @supabase/supabase-js ^2.74, @tanstack/react-query ^5.90, tailwindcss ^4.1, lucide-react (icons)
**Storage**: Supabase PostgreSQL with Row Level Security (RLS) policies
**Testing**: (not specified in existing project - to be determined)
**Target Platform**: Web browser (modern browsers, desktop + mobile responsive)
**Project Type**: Web application (frontend + Supabase backend)
**Performance Goals**:
- Auto-create cycle within 1 second of registration (SC-001)
- Dashboard indicator loads in <100ms (SC-003)
- Settings update in <30 seconds (SC-002)

**Constraints**:
- Frontend-only implementation (no custom backend server)
- Must maintain existing Supabase RLS security model
- 100% UI terminology replacement required (SC-004)
- Must track 100% of cycle events for AI training (SC-007)

**Scale/Scope**:
- Single active cycle per user
- Support for historical data (existing sensor readings, devices, actuators)
- Full-width dashboard banner component
- Settings page section for cycle configuration
- Event audit trail for analytics

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (No constitution file with specific requirements found - using template placeholders)

The project constitution template contains only placeholder content. No specific architectural principles or constraints are defined yet. This feature will establish baseline patterns for:
- Database schema design (cycles table)
- Event tracking patterns (cycle_events audit log)
- React component structure (dashboard banner, settings)
- Supabase migration workflows

**Post-Phase 1 Re-check**: Will validate that introduced patterns align with project evolution.

## Project Structure

### Documentation (this feature)

```
specs/007-fai-che-d/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already created)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── cycles-api.md    # Supabase RPC functions and table access patterns
│   └── cycle-events-api.md  # Event tracking interface
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
frontend/
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── CycleProgressBanner.tsx  # NEW: Full-width progress indicator
│   │   └── settings/
│   │       └── CycleSettings.tsx        # NEW: Cycle configuration UI
│   ├── pages/
│   │   ├── Dashboard.tsx                # MODIFY: Add CycleProgressBanner
│   │   └── Settings.tsx                 # MODIFY: Add CycleSettings section
│   ├── hooks/
│   │   ├── useCycle.ts                  # NEW: React Query hook for cycle data
│   │   └── useCycleEvents.ts            # NEW: Event tracking hook
│   ├── lib/
│   │   └── supabase.ts                  # EXISTING: Supabase client
│   └── types/
│       ├── database.ts                  # MODIFY: Add Cycle and CycleEvent types
│       └── cycle.ts                     # NEW: Cycle domain types
└── tests/
    └── (to be determined)

supabase/
└── migrations/
    ├── 20251120_create_cycles_table.sql           # NEW: Cycles table + RLS
    ├── 20251120_create_cycle_events_table.sql     # NEW: Event audit log
    ├── 20251120_create_cycle_on_user_signup.sql   # NEW: Trigger for auto-creation
    ├── 20251120_migrate_legacy_users_cycles.sql   # NEW: Backfill script
    └── 20251120_update_devices_sensors_with_cycle.sql  # NEW: Add cycle_id foreign keys
```

**Structure Decision**: Web application structure (frontend + Supabase). Using existing `/frontend` directory with React 19 + TypeScript. All backend logic implemented via Supabase migrations (SQL triggers, RLS policies, RPC functions). No custom API server needed.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations - constitution is currently template-only with no enforced constraints.
