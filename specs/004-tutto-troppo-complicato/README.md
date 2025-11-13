# Feature 004: Simplified Device Onboarding with Project-Scoped Device IDs

**Branch**: `004-tutto-troppo-complicato`
**Status**: Migration Plan Complete
**Priority**: High (architecture refactoring)

---

## What's Being Changed

### Current System (v2.1)
```
Device Registration:
  └─ Single user context (no projects)
  └─ Device ID: UUID (550e8400-...)
  └─ Authentication: Per-device API key
  └─ Maximum devices: Unlimited (but no organization)

Problem:
  - UUIDs are long and hard to remember
  - Can't organize devices by location (greenhouse, room, etc.)
  - ESP configuration requires copying entire UUID
  - No namespace separation (confusing with multiple devices)
```

### New System (v3.0)
```
Device Registration:
  ├─ Projects (greenhouses, locations)
  │  └─ Project ID: PROJ1, PROJ2, etc. (auto-generated, globally unique)
  │  └─ Project Name: "Main Greenhouse" (globally unique)
  │
  └─ Devices within Projects
     └─ Device ID: PROJ1-ESP5 (composite: project + device number)
     └─ Device Number: 1-20 per project (hardcodeable in firmware)
     └─ Authentication: Device key (per-device, unchanged)

Benefits:
  + Easy to remember and type
  + Natural organization by greenhouse/location
  + Firmware can hardcode project+device IDs
  + Simple to scale (multiple projects = multiple greenhouses)
  + QR codes now contain full device ID
```

---

## Architecture Overview

### New Database Schema

```sql
projects:
  id UUID (PK)
  user_id UUID (FK auth.users)
  name TEXT (UNIQUE globally) -- "Main Greenhouse"
  project_id TEXT (UNIQUE globally) -- "PROJ1", "PROJ2"
  description TEXT
  created_at, updated_at

devices (modified):
  id UUID (PK) -- Kept for backward compatibility
  user_id UUID (FK auth.users)
  project_id UUID (FK projects) -- NEW
  composite_device_id TEXT (UNIQUE) -- NEW: "PROJ1-ESP5"
  device_number INTEGER (1-20) -- NEW

  (existing columns unchanged):
  name, connection_status, last_seen_at, registered_at
  device_key_hash (used for authentication)
  api_key_hash (being deprecated in Phase 4)
```

### New RPC Functions

```sql
-- Project Management
create_project(name TEXT, description TEXT)
  → Auto-generates project_id (PROJ1, PROJ2, etc.)

get_next_project_id()
  → Returns next sequential project ID

get_available_device_ids(project_id UUID)
  → Returns list of available device numbers (1-20)

-- Device Registration
register_device_with_project(name TEXT, project_id UUID, device_number INT)
  → Creates device with composite ID (e.g., PROJ1-ESP5)

-- Device Heartbeat (both systems)
device_heartbeat_composite(composite_device_id TEXT, device_key TEXT)
  → NEW: Heartbeat using composite ID

device_heartbeat(device_id UUID, device_key TEXT)
  → OLD: Heartbeat using UUID (deprecated in Phase 4)
```

### Data Migration Strategy

**Phase 1**: Add new schema (zero-downtime)
**Phase 2**: Add functions and services (dual-write system)
**Phase 3**: Migrate existing devices to PROJ0 project (30 min downtime)
**Phase 4**: Remove old API key columns (cleanup)

---

## Implementation Documents

### 1. MIGRATION_STRATEGY.md
**For**: Understanding the complete migration approach

**Contains**:
- Executive summary of breaking changes
- Current system analysis
- Four-phase migration plan with details
- Data migration patterns and best practices
- Backward compatibility strategies
- Testing strategies
- User communication timeline
- Monitoring and metrics
- Rollback decision tree
- Risk assessment

**Read this first** to understand WHY and HOW

---

### 2. MIGRATION_SCRIPTS.md
**For**: Database engineers executing the migration

**Contains**:
- Ready-to-execute SQL scripts for each phase
- Pre-migration verification checks
- Migration verification queries
- Rollback scripts for each phase
- Testing & validation scripts
- Quick reference for expected output
- Emergency commands
- Complete rollback procedure

**Read this before running ANY SQL** - copy/paste scripts from here

---

### 3. FRONTEND_MIGRATION_GUIDE.md
**For**: Frontend developers implementing UI changes

**Contains**:
- Type definition updates
- New services (projectsService)
- Updated device service
- React components for:
  - Projects list and creation
  - Device registration in projects
  - Project-scoped device display
  - ESP configuration form
- Backward compatibility utilities
- Testing checklist
- Deployment steps
- Common patterns and troubleshooting

**Read this to implement frontend changes**

---

### 4. MIGRATION_QUICK_REFERENCE.md
**For**: Quick lookup during implementation and migration

**Contains**:
- At-a-glance comparison (old vs. new)
- Timeline summary
- Critical decisions and rationale
- Key RPC functions
- Phase checklists
- Rollback decision tree
- Database impact analysis
- Query performance analysis
- RLS policy considerations
- Firmware implications
- Monitoring queries
- Communication templates
- Common mistakes and prevention
- Success criteria
- Final pre-go-live checklist

**Use this during implementation** as a reference

---

## Implementation Timeline

### Week 1: Phase 1 (Schema Expansion)
- Deploy 4 SQL migrations (zero-downtime)
- Verify schema integrity
- No business logic changes
- Monitor for 24 hours

### Week 2-3: Phase 2 (Dual-Write System)
- Deploy RPC functions
- Deploy frontend services and components
- Test project creation and device registration
- Monitor both old and new systems
- No forced cutover yet

### Week 4: Phase 3 (Data Migration)
- Schedule 30-minute maintenance window
- Migrate all existing devices to PROJ0 project
- Generate composite IDs
- Test heartbeats with new format
- Deploy updated Edge Function

### Week 5+: Phase 4 (Cleanup - OPTIONAL)
- Remove api_key columns
- Archive migration logs
- Optimize indexes
- Update type definitions

---

## Key Decision Points

### 1. Project ID Format: PROJN
```
Why PROJ1, PROJ2?
✓ Globally unique (no collisions)
✓ Sequential (prevents coordination issues)
✓ Easy to remember (only project number)
✓ Constraint: project_id ~ '^PROJ[0-9]+$'

Not PROJ1, USER1-GREENHOUSE1, or user-defined IDs:
✗ Would require additional uniqueness checks
✗ Would allow duplicates across users
✗ Would be more complex to generate
```

### 2. Device Numbers: 1-20 per Project
```
Why 1-20?
✓ Reasonable limit for typical greenhouse
✓ Hardcodeable in firmware (no complexity)
✓ Natural numbering (ESP1, ESP2, etc.)
✓ Prevents scaling issues (use multiple projects)

Why per-project scoping?
✓ Allows different projects to have ESP1, ESP2, etc.
✓ No global device number collision risk
✓ Matches real-world organization (different greenhouses)
```

### 3. Composite ID Format: PROJX-ESPY
```
Why PROJ1-ESP5?
✓ Human-readable (natural language)
✓ Hierarchical (project-device relationship clear)
✓ Self-documenting (no lookup needed)
✓ Easy to type and remember

Not PROJ1_ESP5, PROJ1.ESP5, or PROJECT1-DEVICE5:
✗ Less clear hierarchy
✗ Harder to type
✗ Not as natural in English
```

### 4. Single 30-Minute Maintenance Window
```
Why not rolling migration?
✗ Would require dual writes for weeks
✗ Complex state management
✗ Hard to ensure consistency

Why 30 minutes?
✓ Quick enough for most users (no harm to unattended greenhouses)
✓ Plenty of time to run migration and verify
✓ Easy to schedule across time zones
```

### 5. Keep UUID Column for Backward Compatibility
```
Why not rename or drop id column?
✓ Keeps old queries working during Phase 2-3
✓ Allows queries to work with either format
✓ Simplifies rollback (no schema changes needed)
✓ Only deprecated in Phase 4 (1+ week later)

When to drop?
→ Phase 4, after verifying zero code uses api_key_hash
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Migration corrupts device data | Data loss, manual recovery needed | Phase 3.0 verification before migration, automated integrity checks, backups |
| Devices can't send heartbeats post-migration | All devices offline, system unusable | Edge Function accepts both formats during Phase 2-3, extensive testing |
| RLS policies break | Users see wrong devices, security issue | Test RLS with both UUID and composite ID queries, mock user context |
| Rollback takes >30 min | Extended downtime during rollback | Pre-test rollback on staging, have script ready, <5 min expected rollback time |
| Old firmware breaks | Devices can't authenticate anymore | Edge Function backward compatible, firmware updates not required for Phase 3 |

---

## Testing Strategy

### Unit Testing
```typescript
// Test DeviceIdentifier utility
- isCompositeId('PROJ1-ESP5') → true
- isUUID('550e8400-...') → true
- parseCompositeId('PROJ1-ESP5') → { projectId: 'PROJ1', deviceNumber: 5 }
```

### Integration Testing
```sql
-- Test RPC functions
SELECT create_project('Test', 'Test greenhouse')
SELECT get_available_device_ids(project_id)
SELECT register_device_with_project('Device', project_id, 5)
SELECT device_heartbeat_composite('PROJ1-ESP5', 'key')
```

### User Acceptance Testing
```
Scenario 1: Create project
  ✓ User can create project with auto-generated ID
  ✓ Project appears in list with correct name and ID
  ✓ Project name uniqueness enforced

Scenario 2: Register device
  ✓ User can register device in project
  ✓ Device gets composite ID (PROJ1-ESP5)
  ✓ Device numbers properly scoped per project
  ✓ Cannot register same device number twice in same project

Scenario 3: Device comes online
  ✓ ESP sends heartbeat with composite ID
  ✓ Device status updates to "online"
  ✓ Device visible in webapp with new ID

Scenario 4: Old devices still work
  ✓ Existing devices (with UUID) can still send heartbeats
  ✓ Status updates work
  ✓ No new code required for old devices
```

---

## Deployment Checklist

### Before Phase 1
- [ ] Read entire MIGRATION_STRATEGY.md
- [ ] Review SQL scripts (no surprises)
- [ ] Backup production database
- [ ] Test schema on staging (run Phase 1 scripts)
- [ ] Prepare rollback procedures

### Before Phase 2
- [ ] Phase 1 fully deployed and stable (24+ hours)
- [ ] No errors in logs
- [ ] Baseline metrics captured
- [ ] Frontend code reviewed
- [ ] Components tested on staging

### Before Phase 3
- [ ] Phase 2 fully deployed and stable (48+ hours)
- [ ] Both old (UUID) and new (composite) systems working
- [ ] User notification prepared
- [ ] Rollback tested on staging
- [ ] Maintenance window scheduled
- [ ] Team briefed

### After Phase 3
- [ ] All devices have composite_device_id
- [ ] Zero devices with NULL composite_device_id
- [ ] Devices coming online normally
- [ ] Error logs reviewed
- [ ] Success metrics verified

### Before Phase 4 (Optional, 7+ days later)
- [ ] Confirm zero code using api_key columns
- [ ] No recent heartbeats with api_key
- [ ] Updated type definitions ready
- [ ] Team agreement to proceed

---

## Troubleshooting Guide

### "Device not found" when registering
```
Cause: User trying to register in project they don't own
Solution: Verify project ID belongs to current user
Check: SELECT * FROM projects WHERE id = $1 AND user_id = auth.uid();
```

### Heartbeat not updating device status
```
Cause: Device using old format, Edge Function not configured
Solution: Verify Edge Function accepts both x-device-uuid and x-composite-device-id
Check: Test both headers in Edge Function
```

### Composite IDs not generated during Phase 3
```
Cause: Migration script didn't complete or rolled back
Solution: Re-run Phase 3.1 migration script
Check: SELECT COUNT(*) FROM devices WHERE composite_device_id IS NULL;
```

### Users can see other users' devices
```
Cause: RLS policy not updated properly
Solution: Review RLS policies, re-create if needed
Check: Test with simulated user context
```

---

## FAQ

**Q: Do I need to update my ESP firmware?**
A: No - Phase 2-3 is backward compatible. Old firmware continues working. Update firmware when you're ready (Phase 4+).

**Q: Will my devices go offline during migration?**
A: Yes - for 30 minutes during the scheduled Phase 3 maintenance window. Recommend scheduling when devices aren't actively monitoring.

**Q: Can I keep my old UUID-based devices?**
A: Yes - they're migrated to PROJ0 project automatically. Can access them via composite ID or UUID (both work during Phase 2-3).

**Q: What if something goes wrong during Phase 3?**
A: We have a full rollback script ready. If migration fails, we restore from backup. Your data is protected.

**Q: How many devices can I have?**
A: 20 per project. Create multiple projects if you need more (one per greenhouse/location).

**Q: Do I need to change my API keys?**
A: No - device_key_hash is unchanged. API authentication works the same way.

---

## Related Documents in This Spec

```
004-tutto-troppo-complicato/
├─ README.md (this file)
├─ MIGRATION_STRATEGY.md (detailed plan)
├─ MIGRATION_SCRIPTS.md (SQL scripts)
├─ FRONTEND_MIGRATION_GUIDE.md (UI implementation)
├─ MIGRATION_QUICK_REFERENCE.md (cheat sheet)
├─ spec.md (feature requirements)
└─ plan.md (implementation plan)
```

---

## Getting Started

1. **Understand the migration**:
   - Read MIGRATION_STRATEGY.md (30 min)
   - Read MIGRATION_QUICK_REFERENCE.md (10 min)

2. **Prepare infrastructure**:
   - Create staging database copy
   - Test Phase 1 SQL scripts
   - Test Phase 3 rollback procedure

3. **Implement Phase 1** (Week 1):
   - Deploy 4 SQL migrations
   - Verify schema

4. **Implement Phase 2** (Week 2-3):
   - Deploy RPC functions
   - Deploy frontend changes
   - Test both systems

5. **Execute Phase 3** (Week 4):
   - Schedule maintenance window
   - Run migration script
   - Deploy final Edge Function

6. **Verify Phase 4** (Week 5+):
   - Clean up deprecated columns
   - Archive migration logs

---

## Support

For questions about:
- **Strategy & Architecture**: See MIGRATION_STRATEGY.md
- **SQL & Database**: See MIGRATION_SCRIPTS.md
- **Frontend & UI**: See FRONTEND_MIGRATION_GUIDE.md
- **Quick Lookup**: See MIGRATION_QUICK_REFERENCE.md

For implementation help:
- Test on staging database first
- Use provided rollback procedures
- Keep team briefed on progress
- Monitor metrics closely

---

**Last Updated**: 2025-11-12
**Status**: Ready for Phase 1 Deployment
**Next Step**: Review MIGRATION_STRATEGY.md

