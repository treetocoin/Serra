# Implementation Plan: Home Greenhouse Management System

**Branch**: `001-voglio-fare-una` | **Date**: 2025-10-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-voglio-fare-una/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a web application for managing home greenhouses with user authentication, ESP32 device connectivity via HTTP/HTTPS REST API, real-time sensor monitoring (30-60s refresh), actuator control, and historical data visualization. System uses Supabase for database and authentication, deployed on Netlify, with MCP Supabase for database operations.

## Technical Context

**Language/Version**: TypeScript 5+ (frontend)
**Primary Dependencies**: React 18+, Vite, @supabase/supabase-js, React Query, Recharts/ApexCharts
**Storage**: Supabase (PostgreSQL + Row Level Security + Realtime)
**Authentication**: Supabase Auth (email/password, magic links)
**Deployment**: Netlify (frontend), Supabase (database + API)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web application (serverless architecture)
**Project Type**: web (JAMstack - frontend only)
**Development Tools**: MCP Supabase for database operations

**Performance Goals**:
- Page load <2s (Netlify CDN)
- API latency <200ms (Supabase auto-scaling)
- Support 10 ESP32 devices × 30-60s polling = ~10-20 requests/min per user
- Historical data queries <1s for 1-year timespan
- Concurrent user capacity: Unlimited (Supabase handles scaling)

**Constraints**:
- ESP32 devices use HTTP/HTTPS REST API (via Supabase REST API)
- Sensor data latency: 30-60 seconds acceptable
- Actuator command delivery: within 60 seconds (next poll)
- API key authentication for ESP32 devices (Supabase service role or custom API keys)
- HTTPS/TLS provided by Supabase and Netlify
- Row Level Security (RLS) policies for data isolation

**Scale/Scope**:
- Expected users: 100-1000 greenhouse owners
- Devices per user: 1-10 ESP32 devices
- Sensors per device: 5-10 sensors
- Actuators per device: 3-8 actuators
- Data retention: indefinite (Supabase storage)
- Historical data: potentially years of sensor readings per device

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ⚠️ CONSTITUTION FILE IS TEMPLATE ONLY - No project-specific principles defined

The constitution file at `.specify/memory/constitution.md` contains only placeholder template content. No specific architectural principles, constraints, or gates have been established for this project.

**Recommendation**: Either:
1. Accept default "start simple" approach with no formal gates, OR
2. Pause to define project constitution before proceeding

**Proceeding with**: Default approach - no formal gates enforced. Standard best practices apply:
- Serverless architecture (Netlify + Supabase)
- Test coverage for critical paths
- Row Level Security for data isolation
- Clear database schema and API contracts

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
│   │   ├── auth/              # Login, Register, PasswordReset components
│   │   ├── dashboard/         # Main dashboard, device overview
│   │   ├── devices/           # DeviceList, DeviceDiscovery, DeviceDetail
│   │   ├── sensors/           # SensorReadings, SensorChart (historical viz)
│   │   ├── actuators/         # ActuatorControls, ActuatorStatus
│   │   └── common/            # Shared UI components
│   ├── pages/
│   │   ├── Dashboard.page
│   │   ├── Devices.page
│   │   ├── DeviceDetail.page
│   │   ├── History.page
│   │   └── Auth.page
│   ├── lib/
│   │   ├── supabase.ts        # Supabase client initialization
│   │   └── hooks/             # React hooks for Supabase queries
│   ├── services/
│   │   ├── auth.service.ts    # Auth wrapper around Supabase Auth
│   │   ├── devices.service.ts # Device management
│   │   ├── sensors.service.ts # Sensor data queries
│   │   └── actuators.service.ts # Actuator control
│   └── utils/                 # Formatters, validators, constants
├── netlify.toml              # Netlify deployment config
├── supabase/
│   ├── migrations/           # Database migrations
│   ├── seed.sql              # Seed data
│   └── config.toml           # Supabase local config
└── tests/
    ├── component/            # Component tests
    └── integration/          # Integration tests with Supabase

docs/
└── api/                      # Supabase API documentation
```

**Structure Decision**: JAMstack serverless architecture. Frontend deployed on Netlify as static site. All backend logic handled by Supabase (database, auth, storage, realtime, edge functions if needed). MCP Supabase used during development for database operations. This structure eliminates backend server management, reduces infrastructure costs, and provides auto-scaling.

**Architecture Benefits**:
- **Zero backend maintenance**: Supabase handles database, auth, APIs
- **Auto-scaling**: Both Netlify and Supabase scale automatically
- **Cost-effective**: Generous free tiers, pay-as-you-grow
- **MCP Integration**: Direct database operations via MCP Supabase during development
- **Row Level Security**: Database-level access control
- **Real-time capabilities**: Supabase Realtime for live sensor updates (future enhancement)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

No constitution violations - proceeding with standard "start simple" serverless approach.

---

## Phase 0 & 1: Completed Artifacts

### ✅ Phase 0: Research (Completed)

- **research.md**: Technology stack decisions with rationale
  - Frontend: React 18+ with TypeScript, Vite
  - Backend: Supabase (PostgreSQL + Auth + Storage + Realtime)
  - Deployment: Netlify (frontend), Supabase (database/API)
  - Testing: Vitest + React Testing Library
  - Development: MCP Supabase for database operations
  - Visualization: Recharts or ApexCharts

### ✅ Phase 1: Design & Contracts (Completed)

- **data-model.md**: Complete database schema with:
  - 7 tables (users, devices, sensors, actuators, sensor_readings, commands, device_logs)
  - Row Level Security (RLS) policies for multi-tenant isolation
  - Indexes for performance optimization
  - Triggers for auto-discovery and logging
  - PostgreSQL functions for data aggregation

- **contracts/supabase-schema.sql**: Complete database schema with:
  - Table definitions with RLS policies
  - Foreign key relationships
  - Indexes for efficient queries
  - Database functions for business logic
  - Triggers for automation

- **quickstart.md**: Developer setup guide with:
  - Supabase project setup
  - Local Supabase CLI installation
  - MCP Supabase configuration
  - Netlify CLI setup
  - React + Vite frontend initialization
  - Environment variables configuration
  - Development workflow

- **CLAUDE.md**: Updated agent context with tech stack and MCP Supabase usage

---

## Next Steps

### Phase 2: Task Generation (`/speckit.tasks`)

Break down implementation into ordered, testable tasks:
1. Supabase project setup and database migrations
2. Row Level Security policies configuration
3. Authentication integration (Supabase Auth)
4. Device management (registration, API keys)
5. Sensor data ingestion and queries
6. Actuator control system
7. Historical data visualization
8. Frontend components and pages
9. Netlify deployment configuration
10. Integration testing

### Phase 3: Implementation (`/speckit.implement`)

Execute tasks in dependency order with:
- MCP Supabase for database operations
- Test-first approach for critical features
- Incremental deployment to Netlify
- RLS testing for security

---

## References

- **Feature Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Database Schema**: [contracts/supabase-schema.sql](./contracts/supabase-schema.sql)
- **Quick Start**: [quickstart.md](./quickstart.md)
