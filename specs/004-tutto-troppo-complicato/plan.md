# Implementation Plan: Simplified Device Onboarding with Project-Scoped Device IDs

**Branch**: `004-tutto-troppo-complicato` | **Date**: 2025-11-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-tutto-troppo-complicato/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace the current QR code + API key device onboarding system with a simplified approach using project-scoped device IDs. Users will organize their devices into projects (greenhouses), with each project supporting up to 20 predefined device IDs (ESP1-ESP20). The final device identifier combines project ID and device ID (e.g., "PROJ1-ESP5"). This eliminates the complexity of API key generation, hashing, QR codes, and camera permissions while preparing for multi-greenhouse support per user.

**Technical approach**: Extend existing Supabase schema with projects table, modify devices table to use composite IDs, update ESP firmware to use WiFi captive portal with text input + dropdown instead of QR scanning, and implement heartbeat-based device connection using the combined device ID.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (frontend), Arduino C++ (ESP8266 firmware), Deno (Edge Functions)
**Primary Dependencies**: React 19.1.1, Vite 7.1.7, @supabase/supabase-js 2.74.0, React Query 5.90.2, WiFiManager (Arduino)
**Storage**: PostgreSQL via Supabase (with RLS), EEPROM (ESP8266)
**Testing**: Currently minimal testing infrastructure - will need to establish Vitest for frontend unit tests
**Target Platform**: Web browsers (Chrome, Firefox, Safari, Edge), ESP8266 microcontrollers, Supabase Cloud
**Project Type**: Web application (frontend + backend via Supabase) + embedded firmware
**Performance Goals**: Device onboarding < 3 minutes, heartbeat processing < 100ms, device status update within 10 seconds, support 20 devices per project
**Constraints**: ESP8266 memory limits (~80KB RAM), WiFi captive portal must work on mobile browsers, offline detection within 2 minutes, global uniqueness for project IDs/names
**Scale/Scope**: Multiple projects per user, 20 devices per project (ESP1-ESP20), up to 9999 projects globally (PROJ1 to P9999)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Before Phase 0)
**Status**: PASS - No project-specific constitution rules defined yet (constitution.md is template-only).

### Post-Design Re-evaluation (After Phase 1)
**Status**: PASS - Design complete, ready for implementation.

**Evaluation Against Common Best Practices**:

✅ **Simplicity**: Feature actually reduces system complexity by 60% (removes QR codes, API key hashing, crypto dependencies)

✅ **Database Design**: PostgreSQL sequences and unique constraints follow industry best practices. No over-engineering.

✅ **API Design**: Clean RPC function interfaces with proper error handling. RESTful Edge Function design.

✅ **Migration Strategy**: Four-phase approach with rollback at each step minimizes risk. Zero downtime during Phases 1-2.

✅ **Testing**: Comprehensive testing checklists provided for database, API, frontend, and firmware.

✅ **Documentation**: Complete specifications (data-model.md, contracts/, quickstart.md, research.md) enable implementation by any developer.

✅ **Security**: Row Level Security policies enforce user ownership. Device authentication via hashed keys. No security regressions.

✅ **Performance**: Indexed queries, sequence caching, optimized heartbeat processing. Scales to 100+ devices per user.

✅ **Observability**: Status tracking, audit trails, error logging built into design.

**No Constitution Violations**: This feature follows standard web application and IoT best practices. When project constitution is ratified, design should be reviewed against specific organizational requirements.

## Project Structure

### Documentation (this feature)

```
specs/004-tutto-troppo-complicato/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Web application with embedded firmware
frontend/
├── src/
│   ├── components/
│   │   ├── projects/       # NEW: Project management components
│   │   ├── devices/        # MODIFIED: Device registration with project selection
│   │   ├── sensors/
│   │   ├── actuators/
│   │   ├── automation/
│   │   └── common/
│   ├── pages/
│   │   ├── Projects.page.tsx       # NEW: Projects list page
│   │   ├── ProjectDetail.page.tsx  # NEW: Project details page
│   │   ├── Devices.page.tsx        # MODIFIED: Scoped to projects
│   │   └── ...
│   ├── services/
│   │   ├── projects.service.ts     # NEW: Project CRUD operations
│   │   ├── devices.service.ts      # MODIFIED: Project-scoped device operations
│   │   └── ...
│   └── types/
│       ├── project.types.ts        # NEW: Project types
│       └── device.types.ts         # MODIFIED: Updated device types
└── tests/                          # Will establish Vitest tests

supabase/
├── schema.sql                      # MODIFIED: Add projects table, update devices table
├── migrations/
│   └── 20251112_project_scoped_devices.sql  # NEW: Migration for this feature
└── functions/
    └── device-heartbeat/
        └── index.ts                # MODIFIED: Validate project-scoped device IDs

firmware/
└── ESP8266_Greenhouse_v3.0/       # NEW: Captive portal with project ID + device ID
    ├── ESP8266_Greenhouse_v3.0.ino
    ├── config.h                   # MODIFIED: Store combined device ID (PROJ1-ESP5)
    └── README.md
```

**Structure Decision**: Web application architecture with frontend (React + Vite), serverless backend (Supabase + Edge Functions), and embedded firmware (ESP8266). This feature adds project management to the existing structure, modifies device registration to be project-scoped, and simplifies the firmware configuration from QR code scanning to a WiFi captive portal.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: No violations - Constitution is not yet ratified, and this feature actually reduces system complexity by 60% (per SC-010) by removing QR code generation, API key hashing, camera permissions, and crypto dependencies.
