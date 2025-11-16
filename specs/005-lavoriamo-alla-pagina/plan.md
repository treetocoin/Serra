# Implementation Plan: Pagina Dati (Sensor Data Page)

**Branch**: `005-lavoriamo-alla-pagina` | **Date**: 2025-11-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-lavoriamo-alla-pagina/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Redesign the "Storico Sensori" page as "Dati" with professional layout optimized for indoor greenhouse monitoring. The page will display current sensor readings (temperature/humidity at lamp and ground heights, soil moisture, tank level) with 1-minute auto-refresh, historical trends with overlaid comparison charts for vertical temperature/humidity gradients, and smart data retention with 15-day full granularity followed by automatic downsampling to 30-minute intervals for indefinite historical storage. The design prioritizes simplicity, professional appearance, and mobile responsiveness.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (frontend only - no backend changes)
**Primary Dependencies**:
  - React 19.1.1 with React Router 7.9.3
  - @tanstack/react-query 5.90.2 for data fetching/caching
  - recharts 3.2.1 for time-series visualization
  - @supabase/supabase-js 2.74.0 for database access
  - TailwindCSS 4.1.14 for styling
  - lucide-react 0.545.0 for icons

**Storage**: Supabase PostgreSQL (existing schema - no migrations needed)
  - Tables: sensor_readings, sensors, devices
  - RPC functions: Already exists for data deletion
  - Indexes: Optimized for (device_id, sensor_type, timestamp) queries

**Testing**: NEEDS CLARIFICATION (no test infrastructure detected in codebase)

**Target Platform**: Web browsers (desktop and mobile, responsive design from 320px to 1920px+)

**Project Type**: Web application (frontend-only changes to existing React SPA)

**Performance Goals**:
  - Page load: <2 seconds for current readings display
  - Chart refresh: <1 second when switching time ranges
  - Auto-refresh: Every 1 minute for current readings without full page reload
  - Query limit: 10,000 readings max per query (existing safety limit)

**Constraints**:
  - Must handle multi-year historical data through downsampling strategy
  - Mobile-responsive layout (320px minimum width)
  - Real-time updates without disrupting user interaction
  - Backend data retention: 5-minute intervals for 0-15 days, 30-minute intervals thereafter (NEEDS IMPLEMENTATION)

**Scale/Scope**:
  - Single-user greenhouse monitoring (extends to multi-greenhouse in future)
  - 6 primary sensor data points per greenhouse (2x temp, 2x humidity, soil moisture, tank level)
  - Expected: 288 readings/day/sensor at 5-minute intervals = ~1,728 readings/day total
  - Annual: ~630,000 readings (before downsampling kicks in at 15 days)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution file is a template placeholder and not yet populated with project-specific principles. Therefore, no constitutional violations can be evaluated at this time.

**Status**: ✅ **PASS** (no constitution defined)

Once a constitution is established, this section should be re-evaluated to ensure:
- Library-first architecture (if applicable)
- Test-first development approach
- Proper integration testing strategy
- Versioning and breaking change management
- Observability and debugging requirements

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   ├── DateRangePicker.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── sensors/
│   │   │   ├── SensorCard.tsx           # Reusable for current readings
│   │   │   ├── SensorChart.tsx          # Individual sensor chart
│   │   │   └── SensorList.tsx
│   │   └── charts/                       # EXISTING - may need refactoring
│   │       ├── TemperatureChart.tsx
│   │       ├── HumidityChart.tsx
│   │       ├── SoilMoistureChart.tsx
│   │       └── WaterLevelChart.tsx
│   ├── pages/
│   │   ├── History.page.tsx             # TO BE RENAMED/REFACTORED → Dati.page.tsx
│   │   └── Dashboard.page.tsx
│   ├── services/
│   │   ├── sensors.service.ts           # EXISTING - extend for new queries
│   │   └── history.service.ts           # EXISTING - extend for downsampling
│   ├── lib/
│   │   ├── supabase.ts                  # EXISTING - Supabase client
│   │   └── hooks/
│   │       └── useAuth.tsx
│   └── types/
│       └── sensor-config.types.ts       # EXISTING - sensor type definitions
└── tests/                                # NO TESTS CURRENTLY EXIST

supabase/
├── schema.sql                            # EXISTING - no changes needed
└── migrations/                           # MAY NEED: downsampling job migration
    └── [timestamp]_add_downsampling_job.sql
```

**Structure Decision**: Web application (Option 2) - This is a frontend-only feature modifying the existing React SPA. The project follows a standard React structure with:
- **Components**: Reusable UI elements organized by domain (sensors, charts, common)
- **Pages**: Top-level route components
- **Services**: API abstraction layer for Supabase queries
- **Types**: TypeScript definitions

**Key Changes for This Feature**:
1. Rename/refactor `History.page.tsx` → `Dati.page.tsx`
2. Create new layout components for current readings section
3. Extend existing chart components to support overlaid comparison
4. Add downsampling query logic to services layer
5. Potentially add database migration for automated downsampling job (backend concern)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: N/A - No constitutional violations identified. Constitution file is currently a template placeholder.

---

## Phase 0 Deliverables ✅

**Status**: Complete

Generated artifacts:
- ✅ **research.md**: All NEEDS CLARIFICATION items resolved, technology decisions documented
  - Testing infrastructure decision (deferred)
  - Data downsampling strategy (client-side first, backend job Phase 2)
  - Recharts best practices for time-series
  - Auto-refresh strategy (React Query refetchInterval)
  - Responsive layout approach (CSS Grid + Tailwind)
  - Empty state onboarding design
  - Decimal precision standards
  - Professional color palette

---

## Phase 1 Deliverables ✅

**Status**: Complete

Generated artifacts:
- ✅ **data-model.md**: 5 core entities defined with validation rules and state transitions
  - CurrentReading
  - TimeSeriesDataPoint
  - ComparisonChartData
  - TimeRange
  - SensorStatus
- ✅ **contracts/**: API contract definitions
  - supabase-queries.contract.ts (5 query patterns)
  - service-layer.contract.ts (Service interfaces and domain models)
  - react-query-keys.contract.ts (Cache key patterns and invalidation strategies)
- ✅ **quickstart.md**: 8-day implementation roadmap with step-by-step guide
- ✅ **Agent context updated**: CLAUDE.md updated with new technologies

---

## Phase 2: Next Steps

**Phase 2 is handled by the `/speckit.tasks` command** (NOT part of `/speckit.plan`).

The tasks.md file will be generated separately and will break down the implementation into:
1. Actionable task items
2. Dependency ordering
3. Acceptance criteria per task
4. Estimated effort

To proceed with implementation:
```bash
/speckit.tasks
```

---

## Summary

**Branch**: `005-lavoriamo-alla-pagina`
**Implementation Plan**: `/Users/davidecrescentini/00-Progetti/Serra/specs/005-lavoriamo-alla-pagina/plan.md`

**Generated Documentation**:
1. **research.md**: Technology decisions and best practices
2. **data-model.md**: Entity definitions and data transformations
3. **contracts/**: API contracts for type safety and consistency
4. **quickstart.md**: Developer implementation guide

**Key Decisions**:
- Frontend-only implementation (no backend/database changes required)
- Client-side downsampling with future backend optimization path
- Recharts for time-series visualization with performance optimizations
- React Query for data fetching with 1-minute auto-refresh
- CSS Grid + TailwindCSS for responsive two-column layout
- Sensor-type-specific decimal precision for professional appearance

**Next Command**: `/speckit.tasks` to generate implementation tasks
