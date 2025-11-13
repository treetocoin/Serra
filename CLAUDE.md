# Serra Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-08

## Active Technologies
- Python 3.11+ (backend), TypeScript 5+ (frontend) + FastAPI 0.104+, React 18+, SQLAlchemy 2.0+, asyncpg, React Query, Vite (001-voglio-fare-una)
- TypeScript 5+ (frontend) + React 18+, Vite, @supabase/supabase-js, React Query, Recharts (extends feature 001 stack) (002-crea-e-implementa)
- Supabase (PostgreSQL + Row Level Security) - add tables for automation rules, conditions, and execution logs (002-crea-e-implementa)
- QR Code Device Onboarding: qrcode library (v1.5.4), Web Crypto API (SHA-256 hashing, random API key generation), WiFi QR code standard format (003-qr-code-device)
- TypeScript 5.9.3 (frontend), Arduino C++ (ESP8266 firmware), Deno (Edge Functions) + React 19.1.1, Vite 7.1.7, @supabase/supabase-js 2.74.0, React Query 5.90.2, WiFiManager (Arduino) (004-tutto-troppo-complicato)
- PostgreSQL via Supabase (with RLS), EEPROM (ESP8266) (004-tutto-troppo-complicato)

## Project Structure
```
backend/
frontend/
tests/
```

## Commands
cd src [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] pytest [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] ruff check .

## Code Style
Python 3.11+ (backend), TypeScript 5+ (frontend): Follow standard conventions

## Recent Changes
- 004-tutto-troppo-complicato: Added TypeScript 5.9.3 (frontend), Arduino C++ (ESP8266 firmware), Deno (Edge Functions) + React 19.1.1, Vite 7.1.7, @supabase/supabase-js 2.74.0, React Query 5.90.2, WiFiManager (Arduino)
- 003-qr-code-device: Added QR code device onboarding with qrcode library, Web Crypto API for secure API key generation and hashing, WiFi QR code standard format for ESP device configuration
- 002-crea-e-implementa: Added TypeScript 5+ (frontend) + React 18+, Vite, @supabase/supabase-js, React Query, Recharts (extends feature 001 stack)

<!-- MANUAL ADDITIONS START -->

## Feature 004 Implementation (2025-11-12)

### Project-Scoped Device Management
Implemented simplified device onboarding replacing QR code system with project-based organization:
- **Composite Device IDs**: Format `{project_id}-ESP{device_number}` (e.g., "PROJ1-ESP5")
- **Sequential Project IDs**: PROJ1-PROJ999, then P1000-P9999 (PostgreSQL sequence)
- **Device Limits**: 1-20 devices per project (ESP1-ESP20)
- **Device States**: "waiting" → "online" (heartbeat) → "offline" (2min timeout)

### Database Schema (7 Migrations Applied)
1. **projects** table with sequence-based ID generation
2. **devices** extended with `composite_device_id`, `project_id`, `device_number`
3. **device_heartbeats** table for telemetry tracking
4. **RPC Functions**: `create_project()`, `get_available_device_ids()`, `register_device_with_project()`, `delete_project()`, `delete_device()`, `generate_project_id()`
5. RLS policies for user-scoped data access

### Edge Functions (Deployed to Production)
- **device-heartbeat v2.0**: Dual header support (legacy UUID + composite ID), SHA-256 auth, 60s interval
- **detect-offline-devices**: Scheduled function marking stale devices offline (120s threshold)
  - **Cron Schedule**: Runs every minute via `pg_cron` (configured 2025-11-12)

### Frontend Architecture
- **Services**: `projects.service.ts`, `devices.service.ts` (rewritten for project scope)
- **React Query Hooks**: `useProjects()`, `useProjectDevices()` with 30s polling
- **Components**: ProjectCard, CreateProjectModal, RegisterDeviceModal, DeviceCard (updated)
- **Pages**: ProjectsPage, ProjectDetailPage
- **Routes**: `/projects`, `/projects/:projectId`

### Legacy Compatibility
- Backward-compatible device service stubs for gradual migration
- Dual lookup support in heartbeat function (UUID + composite ID)
- Legacy components (DeviceList, DeviceRegister, DeviceSetup) pending updates

### Completed P2 Features (2025-11-12)
- **Delete Device (Phase 7)**: Added delete button to DeviceDetail page with confirmation
- **Delete Project (Phase 8)**: Added delete button to ProjectDetail page with last-project warning

### Production Ready
- ✅ **Offline Detection Cron**: Automated via `pg_cron` + `pg_net` (runs every minute)
- ✅ **Database Migrations**: All 8 migrations applied successfully
- ✅ **Edge Functions**: Both functions deployed and operational
- ✅ **Frontend**: Complete UI with projects, devices, delete features

### Deferred Work
- **Manual Testing**: Project creation, device registration, connection flows (T021, T028, T037, T042-T043, T045, T047)
- **Legacy Component Migration**: 6 Feature 003 components need updates to use new project-scoped API

### Key Files Modified
- `frontend/src/services/devices.service.ts` (complete rewrite)
- `frontend/src/App.tsx` (added project routes)
- `frontend/src/pages/Dashboard.page.tsx` (added projects card)
- `frontend/src/pages/DeviceDetail.page.tsx` (added delete device button)
- `frontend/src/pages/ProjectDetail.page.tsx` (added delete project button)
- `supabase/functions/device-heartbeat/index.ts` (v2.0 upgrade)
- `firmware/ESP8266_Greenhouse_v3.0/` (complete firmware implementation)

<!-- MANUAL ADDITIONS END -->
