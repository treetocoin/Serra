# Implementation Plan: Standard Sensor Configuration and Dynamic Charting

**Branch**: `004-deve-funzionare-così` | **Date**: 2025-11-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-deve-funzionare-così/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature enables users to configure standard sensor types (DHT Sopra/Sotto, Soil Moisture 1-5, Water Level) on devices with port mappings, automatically routing sensor readings to appropriate charts that appear only when data exists. The system maintains a permanent association between readings and sensor types using a snapshot approach, ensuring historical data integrity across configuration changes.

**Technical Approach**: Extend existing Supabase schema with a sensor configuration table storing device-sensor-port mappings. Frontend will provide a configuration UI on device detail pages, and the chart components will dynamically render based on available data, differentiating DHT Sopra/Sotto readings with visual indicators on combined Temperature/Humidity charts.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend), PostgreSQL 15+ (Supabase)
**Primary Dependencies**: React 19, @supabase/supabase-js ^2.74, @tanstack/react-query ^5.90, recharts ^3.2, tailwindcss ^4.1
**Storage**: Supabase PostgreSQL with Row Level Security (RLS) policies
**Testing**: Vitest (to be confirmed from existing setup) or Jest for React components, Supabase migrations tested via CLI
**Target Platform**: Web (Vite development server, production static build via Netlify)
**Project Type**: Web application (frontend + Supabase backend)
**Performance Goals**: <5 second chart render after first reading (SC-003), 100% correct data routing (SC-002), <3 minute sensor configuration (SC-001)
**Constraints**: Must maintain backward compatibility with existing sensor_readings table, RLS policies must prevent cross-user data access, frontend must work with existing Recharts infrastructure
**Scale/Scope**: Support up to 5 soil moisture sensors per device, handle dynamic chart visibility for 8+ sensor types (DHT Sopra T/H, DHT Sotto T/H, Water Level, Soil 1-5)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Check (Before Phase 0)**: ✅ PASSED

**Constitution Status**: No constitution file found (template structure only). Proceeding with standard practices:

- ✅ **Simplicity**: Extends existing schema minimally, reuses existing charting components
- ✅ **Testing**: Will include frontend component tests for configuration UI, integration tests for data routing
- ✅ **Security**: RLS policies will extend existing device-based access control
- ✅ **Backward Compatibility**: Existing sensor_readings table remains unchanged, new configuration table added alongside

**Post-Design Check (After Phase 1)**: ✅ PASSED

Design artifacts reviewed:
- **research.md**: 7 technical decisions documented with alternatives considered
- **data-model.md**: Schema extends existing tables minimally, maintains RLS consistency
- **contracts/**: API follows REST conventions, database uses standard PostgreSQL patterns
- **quickstart.md**: Implementation path reuses existing infrastructure (React Query, Recharts)

**No violations detected.** No complexity justification required. Ready for Phase 2 (tasks generation via `/speckit.tasks`).

## Project Structure

### Documentation (this feature)

```
specs/004-deve-funzionare-così/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (COMPLETED)
├── data-model.md        # Phase 1 output (COMPLETED)
├── quickstart.md        # Phase 1 output (COMPLETED)
├── contracts/           # Phase 1 output (COMPLETED)
│   ├── api-endpoints.yaml
│   └── database-schema.sql
├── checklists/
│   └── requirements.md  # Specification quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application structure (frontend + Supabase backend)

frontend/
├── src/
│   ├── components/
│   │   ├── devices/          # Existing device components
│   │   │   ├── DeviceCard.tsx
│   │   │   ├── DeviceDetail.tsx (to be enhanced)
│   │   │   └── SensorConfigForm.tsx (NEW - Phase 1)
│   │   └── charts/           # Existing chart components
│   │       ├── TemperatureChart.tsx (to be enhanced)
│   │       ├── HumidityChart.tsx (to be enhanced)
│   │       └── SoilMoistureChart.tsx (to be enhanced)
│   ├── pages/
│   │   └── DeviceDetail.page.tsx (to be enhanced)
│   ├── services/
│   │   ├── devices.service.ts (existing)
│   │   └── sensor-config.service.ts (NEW - Phase 1)
│   ├── types/
│   │   └── sensor-config.types.ts (NEW - Phase 1)
│   └── hooks/
│       └── useSensorConfig.ts (NEW - Phase 1)
└── tests/
    ├── components/
    │   └── SensorConfigForm.test.tsx (NEW)
    └── integration/
        └── sensor-routing.test.tsx (NEW)

supabase/
├── migrations/
│   └── YYYYMMDD_sensor_configuration.sql (NEW - Phase 1)
└── schema.sql (to be documented, not modified directly)

```

**Structure Decision**: Web application structure selected based on existing codebase detection (frontend/ directory with React/TypeScript, supabase/ directory with PostgreSQL). This feature extends the existing architecture without introducing new projects or services.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. This section is not applicable.
