# Research: Simplified Device Onboarding with Project-Scoped Device IDs

**Feature**: 004-tutto-troppo-complicato
**Date**: 2025-11-12
**Status**: Complete

## Overview

This document consolidates research findings for implementing a simplified device onboarding system that replaces the current QR code + API key approach with project-scoped device IDs (e.g., "PROJ1-ESP5").

## Research Areas

### 1. WiFiManager Custom Captive Portal for ESP8266

**Decision**: Use WiFiManager library with custom HTML injection for project ID text input and device ID dropdown

**Key Findings**:
- WiFiManager doesn't natively support dropdowns - requires hidden field + JavaScript pattern
- Text input normalization to uppercase achieved via HTML `onchange` attribute
- Mobile compatibility requires viewport meta tag via `setCustomHeadElement()`
- Memory constraints (80KB RAM) require PROGMEM for HTML strings and char arrays over String objects
- EEPROM storage pattern: struct-based config with CRC validation for power loss protection

**Implementation Pattern**:
```cpp
// Hidden field + JavaScript dropdown pattern
WiFiManagerParameter hidden_device_id("device_id", "Device ID", "1", 3);
WiFiManagerParameter custom_dropdown(R"(
<label for='device_select'>Device ID</label>
<select id='device_select' onchange="document.getElementById('device_id').value=this.value">
  <option value='1'>ESP-1</option>
  <!-- ... ESP-2 through ESP-20 ... -->
  <option value='20'>ESP-20</option>
</select>
<script>
  document.querySelector("[for='device_id']").hidden=1;
  document.getElementById('device_id').hidden=1;
</script>
)");

// Uppercase normalization for project ID
WiFiManagerParameter project_id("proj", "Project ID", "", 10,
  " onchange='this.value=this.value.toUpperCase()'");
```

**Alternatives Considered**:
- Full web server implementation - rejected due to memory constraints and complexity
- TouchScreen display - rejected due to cost and hardware requirements
- Bluetooth configuration - rejected due to additional dependencies and mobile app requirement

**Rationale**: WiFiManager is well-tested, memory-efficient, and works reliably on ESP8266. Custom HTML injection provides sufficient flexibility for our two-field form.

---

### 2. Sequential Project ID Generation in PostgreSQL/Supabase

**Decision**: Use PostgreSQL sequences with RPC function wrapper for format transformation

**Key Findings**:
- PostgreSQL sequences are atomic and thread-safe without explicit locking
- Sequence caching (50-100) provides 10-100x better concurrency than counter tables
- Generated columns not suitable - sequence must be called before INSERT
- Format transformation: 1→"PROJ1", 999→"PROJ999", 1000→"P1000", 9999→"P9999"
- Gaps in sequence are acceptable and don't impact functionality

**Implementation Pattern**:
```sql
-- Create sequence
CREATE SEQUENCE projects_seq START 1 INCREMENT 1 CACHE 50;

-- RPC function for ID generation
CREATE OR REPLACE FUNCTION generate_project_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  seq_value BIGINT;
BEGIN
  seq_value := nextval('public.projects_seq');

  IF seq_value > 9999 THEN
    RAISE EXCEPTION 'Project ID sequence overflow at %', seq_value;
  END IF;

  RETURN CASE
    WHEN seq_value <= 999 THEN 'PROJ' || seq_value
    ELSE 'P' || seq_value
  END;
END;
$$;
```

**Alternatives Considered**:
- Counter table with exclusive locks - rejected due to 90% throughput reduction
- UUID-based IDs - rejected due to lack of human readability
- Client-side generation - rejected due to race condition risks
- Gap-filling strategy - rejected due to added complexity with minimal benefit

**Rationale**: Sequences provide the best balance of simplicity, performance, and reliability. The format transformation is straightforward and gaps in the sequence are acceptable for project IDs.

---

### 3. Global Uniqueness Constraints for Multi-Tenant Data

**Decision**: Simple UNIQUE constraints on project_id and name columns at database level

**Key Findings**:
- PostgreSQL automatically serializes concurrent INSERTs with UNIQUE constraints
- No application-level locking required - database handles race conditions
- Error code 23505 (UNIQUE_VIOLATION) provides clear failure signal
- RLS and UNIQUE constraints work together without conflicts
- Performance impact negligible: <1ms SELECT, 2-3ms INSERT even at scale
- Three-layer validation: client (format), API (pre-check + error translation), database (enforcement)

**Implementation Pattern**:
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL UNIQUE,  -- Global unique
  name TEXT NOT NULL UNIQUE,        -- Global unique
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_projects_project_id ON projects(project_id);
CREATE UNIQUE INDEX idx_projects_name ON projects(name);

-- Error handling in RPC function
CREATE OR REPLACE FUNCTION create_project(p_name TEXT, p_user_id UUID)
RETURNS TABLE(project_id TEXT, id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO projects (project_id, name, user_id)
  VALUES (generate_project_id(), p_name, p_user_id)
  RETURNING projects.project_id, projects.id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Project name "%" already exists', p_name;
END;
$$;
```

**Alternatives Considered**:
- Advisory locks for ID generation - rejected as unnecessary (sequences handle this)
- Optimistic locking with version columns - rejected as over-engineered for use case
- Distributed locks (Redis) - rejected due to added infrastructure complexity
- Pre-check before insert - rejected as vulnerable to race conditions (still need constraint)

**Rationale**: Database-level UNIQUE constraints are the simplest, most reliable solution. PostgreSQL's built-in handling of concurrent inserts with unique constraints is battle-tested and performant.

---

### 4. Heartbeat-Based Offline Detection for IoT Devices

**Decision**: Hybrid approach - client-side polling for UI, server-side Edge Function for enforcement

**Key Findings**:
- Current system: 60s heartbeat interval, 2-minute offline threshold
- Optimal for 10-100 devices per user at current scale
- Client-side polling (30s) provides immediate UI feedback
- Server-side scheduled job (1-minute interval) enforces offline status in database
- Database triggers on heartbeat INSERT enable automatic recovery logging
- Timestamp-based comparison using PostgreSQL intervals avoids clock drift issues

**Implementation Pattern**:
```typescript
// Edge Function: detect-offline-devices (runs every 1 minute via external cron)
const OFFLINE_THRESHOLD_SECONDS = 120; // 2 minutes

const { data: offlineDevices } = await supabase
  .from("devices")
  .select("id, last_seen_at, status")
  .eq("status", "online")
  .lt("last_seen_at", new Date(Date.now() - OFFLINE_THRESHOLD_SECONDS * 1000).toISOString());

if (offlineDevices.length > 0) {
  await supabase
    .from("devices")
    .update({ status: "offline" })
    .in("id", offlineDevices.map(d => d.id));
}

// Trigger for automatic recovery
CREATE OR REPLACE FUNCTION on_device_heartbeat_received()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE devices
  SET status = 'online', last_seen_at = NEW.ts
  WHERE id = NEW.device_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Architecture**:
```
ESP8266 (60s heartbeat)
    ↓
Edge Function: device-heartbeat
    ↓
Database Trigger: on_device_heartbeat_received()
    ↓
Device status = 'online' + last_seen_at updated

External Cron (1 min)
    ↓
Edge Function: detect-offline-devices
    ↓
Mark devices offline if last_seen_at > 2 minutes ago
```

**Alternatives Considered**:
- Pure client-side detection - rejected due to no backend enforcement
- pg_cron extension - rejected due to cost (not free tier on Supabase)
- WebSocket/real-time subscriptions - rejected due to added complexity for current scale
- Polling every 5-10 seconds - rejected due to unnecessary database load

**Rationale**: Hybrid approach balances immediate user feedback (client polling) with reliable backend state (scheduled job). At current scale (10-100 devices per user), this provides excellent responsiveness without over-engineering.

---

### 5. Zero-Downtime Migration Strategy

**Decision**: Four-phase migration with backward compatibility during transition

**Key Findings**:
- Phase 1 (Week 1): Add new schema (projects table, composite ID columns) - zero risk, fully reversible
- Phase 2 (Weeks 2-3): Dual-write system - both UUID and composite IDs work simultaneously
- Phase 3 (Week 4): Scheduled 30-minute migration window - migrate existing devices to PROJ0 default project
- Phase 4 (Week 5+): Optional cleanup - remove deprecated api_key columns
- Critical: Edge Function must accept both `x-device-uuid` and `x-composite-device-id` headers during Phase 2
- RLS policies remain unchanged until Phase 3 - zero security risk
- Full rollback procedures tested at each phase

**Migration Phases**:

**Phase 1: Schema Expansion** (1 hour deployment, zero downtime)
```sql
-- Add projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE,  -- Nullable during Phase 1
  name TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add composite ID columns to devices (nullable during Phase 1)
ALTER TABLE devices
ADD COLUMN composite_device_id TEXT,
ADD COLUMN project_id TEXT,
ADD COLUMN device_number INTEGER;

-- Create migration audit table
CREATE TABLE device_migration_log (...);
```

**Phase 2: Dual-Write System** (2-3 weeks, parallel operation)
- Deploy new RPC functions: `create_project()`, `register_device_with_project()`
- Update Edge Function to accept both UUID and composite ID formats
- Deploy frontend with new project management UI
- Old devices continue using UUID, new devices use composite IDs

**Phase 3: Data Migration** (30-minute maintenance window)
```sql
-- Create default project for existing devices
INSERT INTO projects (project_id, name, user_id)
SELECT 'PROJ0', 'Legacy Devices', DISTINCT user_id FROM devices WHERE project_id IS NULL;

-- Generate composite IDs for existing devices
UPDATE devices
SET
  composite_device_id = 'PROJ0-ESP' || row_number,
  project_id = 'PROJ0',
  device_number = row_number
WHERE composite_device_id IS NULL;

-- Make columns NOT NULL
ALTER TABLE devices
ALTER COLUMN composite_device_id SET NOT NULL,
ALTER COLUMN project_id SET NOT NULL,
ALTER COLUMN device_number SET NOT NULL;
```

**Phase 4: Cleanup** (optional, 1+ week after Phase 3)
```sql
-- Remove deprecated columns
ALTER TABLE devices
DROP COLUMN api_key,
DROP COLUMN api_key_hash;

-- Archive migration logs
-- Update documentation
```

**Alternatives Considered**:
- Big-bang migration - rejected due to high risk and downtime
- Blue-green deployment - rejected due to database state synchronization complexity
- Feature flags only - rejected due to schema changes requiring actual migration
-永久dual-write - rejected due to maintenance burden and technical debt

**Rationale**: Four-phase approach minimizes risk at each step while maintaining backward compatibility. Phase 1-2 have zero downtime, Phase 3 is short and fully tested, Phase 4 is optional cleanup. Each phase is independently reversible.

---

## Summary of Decisions

| Research Area | Decision | Key Benefit | Main Trade-off |
|---------------|----------|-------------|----------------|
| ESP Firmware Portal | WiFiManager with custom HTML | Memory efficient, mobile compatible | Requires JavaScript for dropdown |
| Project ID Generation | PostgreSQL sequence + RPC | Atomic, performant, simple | Natural gaps in sequence |
| Global Uniqueness | Database UNIQUE constraints | Reliable, no app-level locking | Cannot customize error messages at DB level |
| Offline Detection | Hybrid client + server | Immediate UI + reliable backend | Requires external cron for scheduled job |
| Migration Strategy | Four-phase with dual-write | Zero downtime Phases 1-2 | Extended transition period (4+ weeks) |

## Implementation Risks & Mitigations

### High Priority Risks

**Risk**: Migration Phase 3 takes longer than 30-minute window
- **Mitigation**: Pre-test on staging with 10x data volume, implement batch processing with progress tracking
- **Rollback**: Full database backup + tested rollback script (<5 minutes)

**Risk**: ESP8266 memory exhaustion with captive portal HTML
- **Mitigation**: Use PROGMEM for all HTML strings, monitor heap with ESP.getFreeHeap()
- **Fallback**: Simplified portal with minimal styling if needed

**Risk**: Concurrent project creation causes duplicate project IDs
- **Mitigation**: PostgreSQL sequence guarantees atomicity, UNIQUE constraint prevents duplicates
- **Testing**: Load test with 100 concurrent project creations

### Medium Priority Risks

**Risk**: Device goes offline during firmware configuration
- **Mitigation**: Factory reset button clears EEPROM and recreates AP
- **User guidance**: Clear documentation on reset procedure

**Risk**: User confusion during migration (some devices show UUID, some show composite ID)
- **Mitigation**: Clear UI indicators showing "Legacy Device" vs "New Device"
- **Timeline**: Short Phase 2 period (2-3 weeks max)

### Low Priority Risks

**Risk**: Project sequence reaches 9999 limit
- **Mitigation**: Raise exception and contact support (unlikely at current scale)
- **Monitoring**: Alert when sequence reaches 9000

---

## Next Steps

1. **Phase 1 Design**: Generate data-model.md with complete schema definitions
2. **Phase 1 Contracts**: Create API contracts for new RPC functions and Edge Function v2
3. **Phase 1 Implementation**: Generate tasks.md with actionable implementation steps

All research findings have resolved the "NEEDS CLARIFICATION" items from Technical Context. System is ready for design phase.
