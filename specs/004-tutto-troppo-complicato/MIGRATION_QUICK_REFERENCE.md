# Migration Quick Reference

**Feature**: 004-tutto-troppo-complicato - Device ID Migration
**Status**: Ready to Implement
**Timeline**: 4 weeks (3 phases + 1 week deprecation)

---

## At a Glance

| Aspect | Old System (v2.1) | New System (v3.0) | Migration Period |
|--------|-------------------|-------------------|-----------------|
| Device ID Format | UUID (550e8400-...) | Composite (PROJ1-ESP5) | Both work in Phase 2-3 |
| Scope | Global user context | Per-project (multi-greenhouse) | Projects table created in Phase 1 |
| Authentication | Per-device API key | Project-scoped + device key | Both accepted during Phase 2-3 |
| Device Limit | Unlimited per user | 20 per project | Scale via multiple projects |
| Human-Readable | No | Yes | Hardcoded in firmware |
| Downtime Required | Never | 30 min in Phase 3 | Scheduled maintenance window |

---

## Four-Phase Timeline

```
WEEK 1: Phase 1 - Schema Expansion (ZERO DOWNTIME)
├─ Create projects table
├─ Add composite_device_id columns to devices
├─ Deploy: No business logic changes
└─ Test: Schema intact, applications still work

WEEK 2-3: Phase 2 - Dual-Write System (GRACEFUL TRANSITION)
├─ Create project management RPC functions
├─ Create device registration functions
├─ Deploy: Both UUID and composite IDs work
├─ New devices registered with project system
└─ Old devices continue with UUID system

WEEK 4: Phase 3 - Data Migration (30 MIN DOWNTIME)
├─ Maintenance window: 2:00-2:30 AM UTC
├─ Create legacy project for existing devices
├─ Generate composite IDs for all devices
├─ Make columns NOT NULL
└─ Verify: All devices have composite IDs

WEEK 5+: Phase 4 - Cleanup (OPTIONAL)
├─ Remove api_key columns (after 7 days)
├─ Remove legacy RPC functions
├─ Optimize indexes
└─ Archive migration logs

```

---

## Critical Decisions

### 1. Project ID Format: PROJN (e.g., PROJ1, PROJ2)

**Why**: Globally unique, sequential, prevents collisions

**Alternative Rejected**: User-configurable IDs (risk of duplicates)

**Constraint**: `project_id ~ '^PROJ[0-9]+$'`

### 2. Device Number: 1-20 per Project

**Why**: Limits complexity, realistic for greenhouses, hardcodeable in firmware

**Alternative Rejected**: Unlimited per project (coordination nightmare)

**Constraint**: `device_number >= 1 AND device_number <= 20`

### 3. Composite ID Format: PROJX-ESPY (e.g., PROJ1-ESP5)

**Why**: Human-readable, easy to remember, natural for WiFi portal input

**Structure**: `[PROJECT_ID]-ESP[DEVICE_NUMBER]`

**Examples**: PROJ1-ESP1, PROJ1-ESP20, PROJ2-ESP1

### 4. Project Names: Globally Unique

**Why**: Prevents user confusion, simplifies lookup

**Constraint**: `UNIQUE (name)`

**Trade-off**: Users can't have projects with same name

### 5. Maintenance Window: Single 30-Minute Window

**Why**: Minimizes downtime, devices offline during migration only

**Risk**: If migration fails, rollback takes 5 minutes

**Contingency**: Pre-tested rollback script ready to execute

---

## Key RPC Functions

### Projects

```sql
-- Create new project with auto-generated ID
create_project(name TEXT, description TEXT)
→ Returns: id, project_id, name, description, created_at

-- Get available device IDs for project (1-20)
get_available_device_ids(project_id UUID)
→ Returns: device_number, device_id, is_available

-- Generate next project ID
get_next_project_id()
→ Returns: 'PROJ1', 'PROJ2', etc.
```

### Devices

```sql
-- Register device in new system
register_device_with_project(name TEXT, project_id UUID, device_number INT)
→ Returns: id, name, composite_device_id, project_id, device_number

-- Handle heartbeat from new system
device_heartbeat_composite(composite_device_id TEXT, device_key TEXT)
→ Returns: success, device_id, status, timestamp

-- Handle heartbeat from old system (Phase 2-3 only)
device_heartbeat(device_id UUID, device_key TEXT)
→ Returns: success, device_id, status, timestamp
```

---

## Migration Phase Checklist

### Phase 1: Schema (Week 1)

- [ ] Deploy: 20251112000000_enable_extensions.sql
- [ ] Deploy: 20251112000001_add_projects_table.sql
- [ ] Deploy: 20251112000002_add_project_columns_to_devices.sql
- [ ] Deploy: 20251112000003_add_device_migration_log.sql
- [ ] Verify: SELECT COUNT(*) FROM projects; -- Should be 0
- [ ] Verify: SELECT COUNT(*) FROM information_schema.columns WHERE table_name='devices' AND column_name='composite_device_id'; -- Should be 1
- [ ] Monitor: 24+ hours (watch for any errors)
- [ ] Document: Baseline metrics (device count, users with devices)

### Phase 2: Functions (Week 2-3)

- [ ] Deploy: 20251112000010_create_project_functions.sql
- [ ] Deploy: 20251112000011_create_device_functions.sql
- [ ] Deploy: 20251112000012_create_heartbeat_function.sql
- [ ] Deploy: Updated Edge Function (device-heartbeat) supporting both formats
- [ ] Deploy: Frontend services (projectsService, updated devicesService)
- [ ] Deploy: Frontend components (ProjectsList, DeviceRegisterWithProject)
- [ ] Test: Create project → verify project_id auto-generated
- [ ] Test: Register device in project → verify composite_device_id set
- [ ] Test: New device sends heartbeat → verify using composite_device_id
- [ ] Test: Old device sends heartbeat → verify still works with UUID
- [ ] Monitor: 48+ hours (watch both old and new systems)
- [ ] Document: Any issues encountered, solutions applied

### Phase 3: Migration (Week 4)

**PRE-MIGRATION (24 hours before)**:
- [ ] Notify users: "Maintenance window [DATE] 2-2:30 AM UTC"
- [ ] Create backup: `pg_dump -d serra > pre_migration_backup.sql`
- [ ] Test rollback: Run Phase 3.2 rollback script on staging database
- [ ] Deploy: Phase 3.0 pre-migration verification script
- [ ] Execute: Verify all checks pass (schema, functions, baseline metrics)

**MIGRATION WINDOW (30 minutes)**:
- [ ] Pause CI/CD deployments
- [ ] Announce: "Maintenance started - devices temporarily offline"
- [ ] Execute: 20251112000020_pre_migration_verification.sql
- [ ] Execute: 20251112000021_migrate_devices_to_composite.sql
- [ ] Execute: 20251112000021 post-migration verification
- [ ] Deploy: Updated frontend (composite ID support)
- [ ] Deploy: Enable heartbeat Edge Function
- [ ] Monitor: Heartbeat rate (should see devices coming online)
- [ ] Watch: Error logs for any issues

**POST-MIGRATION (30 min after completion)**:
- [ ] Announce: "Maintenance complete - all devices back online"
- [ ] Verify: SELECT COUNT(*) FROM devices WHERE composite_device_id IS NULL; -- Should be 0
- [ ] Check: Heartbeat telemetry (compare pre vs. post rates)
- [ ] Enable: CI/CD deployments
- [ ] Document: Migration completion time, any issues encountered

### Phase 4: Cleanup (Week 5+, OPTIONAL)

- [ ] Monitor: API key usage in logs (should be zero)
- [ ] Wait: 7 days after Phase 3 completion
- [ ] Deploy: 20251112000030_remove_api_key_columns.sql (if no api_key usage)
- [ ] Verify: Type definitions updated (remove api_key fields)
- [ ] Document: Cleanup completion

---

## Rollback Decision Tree

```
Phase 1 Issues?
├─ YES: DROP TABLE projects; ALTER TABLE devices DROP COLUMN...
└─ NO: Continue

Phase 2 Issues?
├─ YES: DROP FUNCTION create_project(...); (no data modified yet)
└─ NO: Continue

Phase 3 Migration Started?
├─ NO: Execute pre-migration cleanup (undo Phase 3.0)
│
└─ YES: Started but not committed?
    ├─ Transaction still running: ROLLBACK;
    │
    └─ Transaction committed but errors detected?
        ├─ Minor issues (5-10% devices unmigrated):
        │   └─ Manual cleanup: UPDATE devices SET composite_device_id = ...
        │
        └─ Major issues (data corruption, RLS broken):
            └─ Execute Phase 3.2 full rollback script
            └─ Restore from backup: psql -d serra < pre_migration_backup.sql
            └─ Re-test RLS policies before retry
```

---

## Database Impact Analysis

### Storage Impact

```
Old System:
  - devices.id (UUID, 16 bytes)
  - devices.api_key_hash (TEXT, ~64 bytes)
  - devices.device_key_hash (TEXT, ~64 bytes)
  → Per device: ~144 bytes

New System (Phase 3):
  + projects table:
      - projects.id (UUID, 16 bytes)
      - projects.project_id (TEXT, ~10 bytes) → Indexed
      - projects.name (TEXT, ~50 bytes average)
      → ~76 bytes per project
  + devices.project_id (UUID, 16 bytes) → Indexed
  + devices.composite_device_id (TEXT, ~15 bytes) → Indexed
  + devices.device_number (INTEGER, 4 bytes)
  → Additional per device: ~35 bytes
  → Total per device: ~179 bytes

Impact per 1000 devices:
  - If average 5 projects: 5 × 76 = 380 bytes (projects)
  - Additional 1000 × 35 = 35,000 bytes (new columns)
  - Total new: ~35.4 KB (negligible)

Phase 4 (if api_key removed):
  - Saves ~128 bytes per device
  - Net benefit after cleanup
```

### Query Performance Impact

**Indexes Created**:
```sql
idx_projects_user_id → O(log N) user lookup
idx_devices_project_id → O(log N) devices in project
idx_devices_composite_id → O(1) lookup by composite ID (UNIQUE)
idx_devices_project_number → O(log N) device enumeration per project
```

**Query Plans**:
```
OLD: SELECT * FROM devices WHERE id = $1
     → Index Scan using pkey (1-2ms)

NEW (Phase 3):
  Option A: SELECT * FROM devices WHERE id = $1
           → Index Scan using pkey (1-2ms, backward compat)

  Option B: SELECT * FROM devices WHERE composite_device_id = $1
           → Index Scan using idx_devices_composite_id (1-2ms)

  Option C: SELECT * FROM devices WHERE project_id = $1
           → Index Scan using idx_devices_project_id (1-2ms)
```

**Worst Case**: Backfill 10,000 devices during Phase 3
- Time: 10-30 seconds depending on index size
- Lock: EXCLUSIVE on devices table (app must stop writes during migration)
- Rollback: <5 seconds

---

## RLS Policy Considerations

### Current Policies

```sql
-- All based on user_id
CREATE POLICY "Users can view their own devices"
  ON devices FOR SELECT
  USING (auth.uid() = user_id);
```

### New Policies (Phase 2)

```sql
-- Add project ownership check
CREATE POLICY "Users can view devices in their projects"
  ON devices FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

### Testing Required

```sql
-- Verify user can see own devices (after migration)
SET ROLE authenticated;
SET auth.uid() = 'user-123';

SELECT COUNT(*) FROM devices;
-- Should only show devices where user_id='user-123'
--   OR project owned by 'user-123'

-- Verify service_role can see all
SET ROLE service_role;
SELECT COUNT(*) FROM devices;
-- Should show all devices in system
```

---

## Firmware Implications

### Old Firmware (v2.1)

```c
// Sends heartbeat with UUID
POST /device-heartbeat
Headers:
  x-device-uuid: 550e8400-e29b-41d4-a716-446655440000
  x-device-key: [32-byte-hex-key]
```

**Compatibility**: Works through Phase 3 (Edge Function accepts both)

### New Firmware (v3.0)

```c
// Sends heartbeat with composite ID
POST /device-heartbeat
Headers:
  x-composite-device-id: PROJ1-ESP5
  x-device-key: [32-byte-hex-key]

// OR

// Configuration sets this via ESP's /configure endpoint
http://192.168.4.1/configure?project_id=PROJ1&device_number=5
```

**Compatibility**: Works immediately after Phase 2

**Note**: Firmware update NOT required during Phase 3 migration window (Edge Function accepts both formats)

---

## Monitoring Queries

### Pre-Migration Baseline

```sql
-- Capture before Phase 3
SELECT
  COUNT(*) as total_devices,
  COUNT(CASE WHEN connection_status = 'online' THEN 1 END) as online_count,
  COUNT(CASE WHEN last_seen_at > NOW() - INTERVAL '5 min' THEN 1 END) as active_5min,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_seen_at))) as avg_offline_seconds,
  MAX(last_seen_at) as latest_heartbeat,
  MIN(last_seen_at) as oldest_heartbeat
FROM devices;
```

### Post-Migration Verification

```sql
-- Should match baseline in first 5 minutes
SELECT
  COUNT(*) as total_devices,
  COUNT(CASE WHEN connection_status = 'online' THEN 1 END) as online_count,
  COUNT(CASE WHEN composite_device_id IS NULL THEN 1 END) as unmigrated,
  COUNT(CASE WHEN project_id IS NULL THEN 1 END) as unprojects
FROM devices;

-- Should show: total_devices = online_count, unmigrated = 0, unprojects = 0
```

### Migration Audit Trail

```sql
-- Check migration log
SELECT
  migration_status,
  COUNT(*) as count,
  MAX(completed_at) as latest_completion
FROM device_migration_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY migration_status;

-- Expected: completed = total_devices, all others = 0
```

---

## Communication Templates

### Pre-Migration Notification (T-7 Days)

```
Subject: ⏰ Device System Maintenance Scheduled

We're upgrading our device management system for improved usability.
No action is required from you.

📅 When: [DATE] 2:00-2:30 AM UTC
⏱️ Duration: 30 minutes
📍 What: Device system maintenance

What's changing:
• Device IDs become easier to remember (PROJ1-ESP5 instead of long UUIDs)
• Support for multiple greenhouses with project organization
• Simpler ESP device configuration

What you'll notice:
• Your devices will be temporarily offline during maintenance
• All devices will return to their previous status after maintenance
• No data is lost

Questions? Contact support@serra.ai
```

### Completion Notification (T+0:30)

```
Subject: ✅ Device System Maintenance Complete

The maintenance has been completed successfully.

✓ All devices back online
✓ No data lost
✓ Backward compatible with existing devices

What's new:
• Try creating a new project for your devices (Projects → New Project)
• Register devices with simple IDs (PROJ1-ESP1, PROJ1-ESP2, etc.)
• Configure ESP devices using easy-to-remember IDs

Detailed guide: [Link to docs]
```

---

## Common Mistakes to Avoid

| Mistake | Impact | Prevention |
|---------|--------|-----------|
| Running Phase 3 without testing Phase 2 | Device downtime during rollback | Test new RPC functions and Edge Function with both formats |
| Not creating pre-migration backup | Data loss if rollback needed | `pg_dump -d serra > backup.sql` before Phase 3 |
| Forgetting to update Edge Function | Heartbeats rejected in Phase 3+ | Update function to accept both x-device-uuid and x-composite-device-id headers |
| Making columns NOT NULL before backfill | Migration fails at constraint check | Always make columns NOT NULL AFTER all data is populated |
| Not updating RLS policies | Users see wrong devices | Test RLS with both UUID and composite ID queries |
| Deploying without notifying users | User confusion and support tickets | Send notifications at T-7, T-1, T+0, T+30 min milestones |
| Skipping Phase 1 verification | Schema corruption | Run verification queries before moving to Phase 2 |

---

## Success Criteria (Phase 3)

Migration is considered **SUCCESSFUL** when:

- [x] All devices have `composite_device_id` populated
- [x] All devices have `project_id` assigned
- [x] Zero devices with NULL in either column
- [x] No duplicate composite device IDs exist
- [x] Devices come online within 5 minutes of migration end
- [x] >95% of devices have recent heartbeats
- [x] No RLS policy violations detected
- [x] Composite ID queries execute in <50ms
- [x] Rollback tested and confirmed working
- [x] Zero data corruption detected

**Migration is FAILED if**:
- Any device has NULL composite_device_id
- Any duplicate composite_device_ids exist
- <90% of devices come online within 5 minutes
- Any RLS policy violation detected
- Data corruption found in integrity checks

---

## Reference Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| MIGRATION_STRATEGY.md | Detailed explanation of all phases | Product team, engineers |
| MIGRATION_SCRIPTS.md | Ready-to-execute SQL scripts | Database engineers |
| FRONTEND_MIGRATION_GUIDE.md | UI/UX implementation guide | Frontend developers |
| MIGRATION_QUICK_REFERENCE.md | This document - quick lookup | Everyone |

---

## Final Checklist Before Go-Live

**One Week Before**:
- [ ] All SQL scripts reviewed and tested on staging
- [ ] Frontend changes code reviewed and merged
- [ ] User communication drafted and approved
- [ ] Rollback procedures tested on staging
- [ ] Monitoring dashboards prepared
- [ ] Support team briefed on changes

**24 Hours Before**:
- [ ] Final backup created
- [ ] Maintenance window confirmed with team
- [ ] Communication sent (T-1 day)
- [ ] Monitoring active (baseline metrics captured)

**During Maintenance**:
- [ ] Team on standby (Slack channel, on-call)
- [ ] Real-time monitoring active
- [ ] Migration script ready to execute
- [ ] Rollback script at hand (copy-pasted in Supabase)

**Immediately After**:
- [ ] Verification queries run
- [ ] Sample devices checked for connectivity
- [ ] Monitoring shows normal heartbeat rate
- [ ] Error logs reviewed (zero critical errors)
- [ ] Communication sent (completion notice)

