# Tasks: Admin User Role with Multi-Project View

**Feature**: 006-fammi-un-tipo | **Branch**: `006-fammi-un-tipo` | **Created**: 2025-11-16

**Related Documentation**:
- [Specification](./spec.md) - Feature requirements and user stories
- [Implementation Plan](./plan.md) - Technical approach and architecture
- [Data Model](./data-model.md) - Database schema changes
- [Quickstart Guide](./quickstart.md) - Developer implementation guide
- [API Contracts](./contracts/README.md) - TypeScript contracts

---

## Task Execution Guide

### Task Notation
- **[P]** = Parallelizable (can run concurrently with other [P] tasks in same phase)
- **US1-US4** = User Story label (P1-P4 priorities from spec.md)
- **T001** = Unique task identifier
- **Blocking** = Tasks that must complete before next phase begins

### Checkpoint Criteria
After each phase, verify:
1. All tasks in phase marked complete
2. Manual testing scenarios passed
3. No regressions in existing functionality
4. Git commit created with descriptive message

### Testing Requirements
- **Unit tests**: Vitest (target 80%+ coverage)
- **Component tests**: React Testing Library + Vitest
- **RLS tests**: SQL-based policy verification
- **E2E tests**: Manual scenarios documented in each phase

---

## Phase 1: Setup (Project Initialization)

**Duration**: 1 day | **Blocking**: All subsequent phases

### T001 [P] - Verify Prerequisites and Environment

**Story**: Setup | **Type**: Infrastructure

**Description**: Verify all required tools, versions, and environment configurations are in place before beginning implementation.

**Prerequisites**: None

**Steps**:
1. Verify PostgreSQL 15+ (Supabase) is accessible
2. Verify Node.js 18+ installed
3. Verify TypeScript 5.9.3 in frontend/package.json
4. Verify React 19 in frontend/package.json
5. Verify @tanstack/react-query ^5.90 installed
6. Verify Supabase CLI installed (`supabase --version`)
7. Check database connection: `SELECT version();`
8. Verify admin user exists: `SELECT email FROM auth.users WHERE email = 'dadecresce@test.caz'`

**Acceptance Criteria**:
- All tools installed and accessible via command line
- Database connection successful
- Admin user `dadecresce@test.caz` exists in auth.users (if not, create via Supabase Auth UI)
- TypeScript compilation succeeds: `cd frontend && npm run type-check`

**Reference**: [quickstart.md](./quickstart.md) - Section 1 "Getting Started"

---

### T002 [P] - Create Feature Branch and Documentation Structure

**Story**: Setup | **Type**: Infrastructure

**Description**: Set up Git branch and ensure all specification files are in place.

**Prerequisites**: None

**Steps**:
1. Create feature branch if not exists: `git checkout -b 006-fammi-un-tipo`
2. Verify all spec files exist:
   - specs/006-fammi-un-tipo/spec.md
   - specs/006-fammi-un-tipo/plan.md
   - specs/006-fammi-un-tipo/data-model.md
   - specs/006-fammi-un-tipo/quickstart.md
   - specs/006-fammi-un-tipo/contracts/ (all 4 files)
3. Create empty test results file: `specs/006-fammi-un-tipo/test-results.md`

**Acceptance Criteria**:
- Feature branch checked out
- All documentation files exist and readable
- Test results file created
- Git status shows clean working tree

**Reference**: [plan.md](./plan.md) - Section "Project Structure"

---

### T003 - Backup Production Database

**Story**: Setup | **Type**: Infrastructure | **CRITICAL**

**Description**: Create full database backup before any schema migrations. This is a safety measure to enable rollback if migrations fail.

**Prerequisites**: T001 complete

**Steps**:
1. Use Supabase dashboard or CLI to create backup
2. Download backup locally: `supabase db dump > backup-pre-admin-feature.sql`
3. Verify backup file is non-empty and contains schema
4. Document backup location in test-results.md
5. Test restore on staging environment if available

**Acceptance Criteria**:
- Backup file created with timestamp
- Backup file size > 0 bytes
- Backup contains CREATE TABLE statements (verify with `grep "CREATE TABLE" backup-pre-admin-feature.sql`)
- Backup location documented

**Reference**: [plan.md](./plan.md) - Section "Migration Strategy" → "Pre-Migration Checklist"

**⚠️ CRITICAL**: Do NOT proceed to Phase 2 without completing this task.

---

## Phase 2: Foundational (Database Migrations & RLS Policies)

**Duration**: 2-3 days | **Blocking**: All user story phases (US1-US4)

**⚠️ WARNING**: All tasks in this phase modify database schema. Complete Phase 1 backup (T003) before proceeding.

### T004 - Create user_roles Table Migration

**Story**: Foundational | **Type**: Database Migration

**Description**: Create the user_roles table to store user role assignments separately from Supabase Auth for security.

**Prerequisites**: T001-T003 complete

**File**: `supabase/migrations/20251116_create_user_roles.sql`

**Steps**:
1. Create migration file with exact content from data-model.md "Step 1: Create user_roles Table"
2. Include:
   - Table creation with all fields (id, user_id, role, created_at, updated_at)
   - UNIQUE constraint on user_id
   - CHECK constraint for role IN ('user', 'admin')
   - CASCADE delete on foreign key
   - Two indexes (user_id, role)
   - Enable RLS
   - Policy "Users can view own role"
3. Execute migration: `supabase db push` or `psql $DATABASE_URL -f migrations/20251116_create_user_roles.sql`
4. Verify table created: `\d user_roles`
5. Verify indexes exist: `\di idx_user_roles_*`

**Acceptance Criteria**:
- Migration file created at specified path
- Table `user_roles` exists in database
- Two indexes created (idx_user_roles_user_id, idx_user_roles_role)
- RLS enabled on table
- One policy exists ("Users can view own role")
- Can insert test record: `INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'user');`

**Rollback**:
```sql
DROP TABLE IF EXISTS user_roles CASCADE;
```

**Reference**:
- [data-model.md](./data-model.md) - Section "Migration Strategy" → "Step 1"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 1"

---

### T005 - Create auth.user_role() Security Definer Function

**Story**: Foundational | **Type**: Database Migration

**Description**: Create a security definer function that efficiently retrieves the current user's role for use in RLS policies. This provides 99.99% performance improvement over direct queries.

**Prerequisites**: T004 complete

**File**: `supabase/migrations/20251116_create_user_role_function.sql`

**Steps**:
1. Create migration file with exact content from data-model.md "Step 2: Create Helper Function"
2. Include:
   - Function creation with SECURITY DEFINER and STABLE
   - COALESCE to return 'user' if no role record exists
   - GRANT EXECUTE to authenticated role
   - Policy "Admin can view all user roles" (depends on this function)
3. Execute migration
4. Test function: `SELECT auth.user_role();` (should return 'user')
5. Verify grants: `SELECT routine_name, grantee FROM information_schema.routine_privileges WHERE routine_name = 'user_role';`

**Acceptance Criteria**:
- Function `auth.user_role()` exists
- Function marked as SECURITY DEFINER and STABLE
- authenticated role has EXECUTE permission
- Function returns 'user' when called by non-admin
- Policy "Admin can view all user roles" created on user_roles table

**Rollback**:
```sql
DROP POLICY IF EXISTS "Admin can view all user roles" ON user_roles;
DROP FUNCTION IF EXISTS auth.user_role();
```

**Reference**:
- [data-model.md](./data-model.md) - Section "Helper Function (Security Definer)"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 2"

---

### T006 - Backfill Existing Users with Default Roles

**Story**: Foundational | **Type**: Database Migration

**Description**: Assign default 'user' role to all existing users, then promote dadecresce@test.caz to admin.

**Prerequisites**: T005 complete

**File**: `supabase/migrations/20251116_backfill_user_roles.sql`

**Steps**:
1. Create migration file with exact content from data-model.md "Step 3: Backfill Existing Users"
2. Include:
   - INSERT for all existing auth.users with role='user'
   - ON CONFLICT DO NOTHING to skip duplicates
   - UPDATE to set dadecresce@test.caz as admin
3. Execute migration
4. Verify all users have roles: `SELECT COUNT(*) FROM auth.users; SELECT COUNT(*) FROM user_roles;` (counts should match)
5. Verify admin user: `SELECT u.email, ur.role FROM auth.users u JOIN user_roles ur ON ur.user_id = u.id WHERE u.email = 'dadecresce@test.caz';`

**Acceptance Criteria**:
- All existing users have a role in user_roles table
- dadecresce@test.caz has role='admin'
- All other users have role='user'
- No duplicate user_id entries (UNIQUE constraint enforced)

**Rollback**:
```sql
DELETE FROM user_roles;
```

**Reference**:
- [data-model.md](./data-model.md) - Section "Admin User Initialization"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 3"

---

### T007 - Update RLS Policies for devices Table

**Story**: Foundational | **Type**: Database Migration

**Description**: Update RLS policies on devices table to allow admin bypass while maintaining user isolation.

**Prerequisites**: T006 complete

**File**: `supabase/migrations/20251116_update_rls_policies.sql` (part 1 of 4)

**Steps**:
1. Create migration file (this will contain policies for all tables, complete in T007-T010)
2. Add devices table policies:
   - DROP old "Users can view own devices" policy
   - CREATE new "Users can view own or admin sees all devices" (SELECT)
   - DROP old "Users can update own devices" policy
   - CREATE new "Users can update own or admin updates all devices" (UPDATE)
   - DO NOT modify DELETE policy (FR-012: admin cannot delete)
3. Execute migration
4. Test as admin (verify can SELECT/UPDATE all devices)
5. Test as regular user (verify can only SELECT/UPDATE own devices)

**Acceptance Criteria**:
- Old policies dropped
- New policies created with `auth.user_role() = 'admin'` condition
- Admin can SELECT all devices across all users
- Admin can UPDATE any device
- Regular user can only SELECT/UPDATE own devices
- DELETE policy unchanged (admin cannot delete)

**Test SQL**:
```sql
-- Test as admin
SET LOCAL request.jwt.claims.sub = '<admin-user-id>';
SELECT COUNT(*) FROM devices; -- Should return all devices

-- Test as regular user
SET LOCAL request.jwt.claims.sub = '<regular-user-id>';
SELECT COUNT(*) FROM devices; -- Should return only own devices
```

**Reference**:
- [data-model.md](./data-model.md) - Section "Updated Policies for devices Table"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 4"

---

### T008 - Update RLS Policies for sensors Table

**Story**: Foundational | **Type**: Database Migration

**Description**: Update RLS policies on sensors table to allow admin bypass.

**Prerequisites**: T007 complete

**File**: `supabase/migrations/20251116_update_rls_policies.sql` (part 2 of 4)

**Steps**:
1. Add to migration file from T007
2. Add sensors table policies:
   - DROP old "Users can view sensors for their devices"
   - CREATE new "Users or admin can view sensors" (SELECT)
   - DROP old "Users can update sensors for their devices"
   - CREATE new "Users or admin can update sensors" (UPDATE)
   - Use EXISTS subquery to check device ownership OR admin role
3. Execute migration (if not already executed in T007)
4. Test as admin (verify can SELECT/UPDATE all sensors)
5. Test as regular user (verify can only SELECT/UPDATE sensors on own devices)

**Acceptance Criteria**:
- Old policies dropped
- New policies use EXISTS with device ownership check + admin bypass
- Admin can SELECT all sensors across all devices
- Admin can UPDATE any sensor
- Regular user can only SELECT/UPDATE sensors on own devices

**Test SQL**:
```sql
-- Test as admin
SELECT COUNT(*) FROM sensors; -- Should return all sensors

-- Test as regular user (should only see own)
SELECT COUNT(*) FROM sensors; -- Should return only sensors on own devices
```

**Reference**:
- [data-model.md](./data-model.md) - Section "Updated Policies for sensors Table"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 4"

---

### T009 - Update RLS Policies for actuators Table

**Story**: Foundational | **Type**: Database Migration

**Description**: Update RLS policies on actuators table to allow admin bypass.

**Prerequisites**: T008 complete

**File**: `supabase/migrations/20251116_update_rls_policies.sql` (part 3 of 4)

**Steps**:
1. Add to migration file from T007-T008
2. Add actuators table policies (same pattern as sensors):
   - DROP old policies
   - CREATE new "Users or admin can view actuators" (SELECT)
   - CREATE new "Users or admin can update actuators" (UPDATE)
   - Use EXISTS subquery with device ownership check
3. Execute migration (if not already executed)
4. Test as admin (verify can SELECT/UPDATE all actuators)
5. Test as regular user (verify can only SELECT/UPDATE actuators on own devices)

**Acceptance Criteria**:
- Old policies dropped
- New policies mirror sensors pattern
- Admin can SELECT all actuators
- Admin can UPDATE any actuator
- Regular user can only SELECT/UPDATE actuators on own devices

**Reference**:
- [data-model.md](./data-model.md) - Section "Updated Policies for actuators Table"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 4"

---

### T010 - Update RLS Policies for sensor_readings Table

**Story**: Foundational | **Type**: Database Migration

**Description**: Update RLS policies on sensor_readings table to allow admin to view all readings for troubleshooting.

**Prerequisites**: T009 complete

**File**: `supabase/migrations/20251116_update_rls_policies.sql` (part 4 of 4)

**Steps**:
1. Add to migration file from T007-T009
2. Add sensor_readings table policies:
   - DROP old "Users can view readings for their devices"
   - CREATE new "Users or admin can view sensor readings" (SELECT)
   - Use EXISTS with sensors JOIN devices to check ownership
3. Execute migration (if not already executed)
4. Test as admin (verify can SELECT all readings)
5. Test as regular user (verify can only SELECT readings from own sensors)

**Acceptance Criteria**:
- Old policy dropped
- New policy includes admin bypass
- Admin can SELECT all sensor readings
- Regular user can only SELECT readings from own sensors
- No UPDATE/DELETE policies (readings are immutable)

**Test SQL**:
```sql
-- Test as admin
SELECT COUNT(*) FROM sensor_readings; -- Should return all readings

-- Test as regular user
SELECT COUNT(*) FROM sensor_readings; -- Should return only readings from own sensors
```

**Reference**:
- [data-model.md](./data-model.md) - Section "Updated Policies for sensor_readings Table"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 4"

---

### T011 - Create admin_users_overview View

**Story**: Foundational | **Type**: Database Migration

**Description**: Create a database view that pre-aggregates user statistics for the admin dashboard.

**Prerequisites**: T010 complete

**File**: `supabase/migrations/20251116_create_admin_views.sql`

**Steps**:
1. Create migration file with exact content from data-model.md "Views for Admin Dashboard"
2. Include:
   - CREATE OR REPLACE VIEW admin_users_overview
   - LEFT JOINs for user_roles, devices, sensors, actuators, sensor_readings
   - GROUP BY user id, email, role
   - Aggregations: COUNT devices, sensors, actuators; MAX last_activity
   - RLS policy "Admin can view users overview"
3. Execute migration
4. Test view as admin: `SELECT * FROM admin_users_overview LIMIT 5;`
5. Test view as regular user (should return empty or error)

**Acceptance Criteria**:
- View `admin_users_overview` exists
- View returns correct fields: user_id, email, role, device_count, sensor_count, actuator_count, last_activity
- Counts match reality (verify with direct COUNT queries)
- RLS policy restricts access to admins only
- View performs well (< 500ms for 1000+ users)

**Test SQL**:
```sql
-- As admin
SELECT * FROM admin_users_overview ORDER BY device_count DESC LIMIT 10;

-- Verify counts for one user
SELECT
  (SELECT COUNT(*) FROM devices WHERE user_id = '<user-id>') as devices,
  (SELECT COUNT(*) FROM sensors s JOIN devices d ON d.id = s.device_id WHERE d.user_id = '<user-id>') as sensors;
-- Compare with admin_users_overview for same user
```

**Reference**:
- [data-model.md](./data-model.md) - Section "View: admin_users_overview"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Step 5"

---

### T012 - Verify Database Migration Integrity

**Story**: Foundational | **Type**: Testing

**Description**: Comprehensive verification that all database migrations completed successfully and RLS policies work correctly.

**Prerequisites**: T004-T011 complete

**Steps**:
1. Run verification SQL from plan.md "Post-Migration Verification"
2. Check admin user role assignment
3. Check all existing users have default role
4. Test admin bypass on all tables (devices, sensors, actuators, sensor_readings)
5. Test regular user isolation on all tables
6. Run EXPLAIN ANALYZE on admin_users_overview
7. Document results in test-results.md

**Acceptance Criteria**:
- All 5 migration files executed successfully
- admin user has role='admin'
- All other users have role='user'
- Admin can SELECT from all tables (returns all rows)
- Regular user can only SELECT own data
- admin_users_overview query completes in < 500ms
- No SQL errors or warnings

**Test SQL Template**: See [plan.md](./plan.md) - Section "Post-Migration Verification"

**Reference**:
- [plan.md](./plan.md) - Section "Migration Strategy" → "Post-Migration Verification"
- [quickstart.md](./quickstart.md) - Section 2 "Database Setup" → "Migration Checklist"

---

### T013 - Write RLS Policy Unit Tests

**Story**: Foundational | **Type**: Testing

**Description**: Create SQL-based unit tests for all RLS policies to ensure admin bypass and user isolation work correctly.

**Prerequisites**: T012 complete

**File**: `supabase/tests/rls_policies_admin.test.sql`

**Steps**:
1. Create test file with test scenarios from quickstart.md "5.1 Database Testing"
2. Include tests for:
   - Admin can view all devices
   - Admin can update any device
   - Admin cannot delete devices (FR-012)
   - Regular user can only view own devices
   - Regular user cannot update other users' devices
   - Same patterns for sensors, actuators, sensor_readings
   - admin_users_overview access control
3. Execute tests using Supabase test runner or pgTAP
4. Document test results in test-results.md

**Acceptance Criteria**:
- Test file created with all scenarios
- All tests pass (100% success rate)
- Tests cover all 4 tables (devices, sensors, actuators, sensor_readings)
- Tests cover both admin and regular user contexts
- Test results documented

**Test Examples**: See [quickstart.md](./quickstart.md) - Section 5.1 "Database Testing"

**Reference**:
- [quickstart.md](./quickstart.md) - Section 5 "Testing Guide" → 5.1
- [plan.md](./plan.md) - Section "Testing Strategy" → "Integration Tests"

---

**CHECKPOINT: Phase 2 Complete**

Before proceeding to Phase 3, verify:
- [ ] All migrations (T004-T011) executed successfully
- [ ] Migration integrity verification (T012) passed
- [ ] RLS policy tests (T013) passed
- [ ] Database backup exists (from T003)
- [ ] Rollback plan tested on staging (optional but recommended)
- [ ] Git commit created: "feat(database): add admin role schema and RLS policies"

---

## Phase 3: User Story 1 (P1) - Admin Views All Projects (MVP)

**Duration**: 3-5 days | **Depends on**: Phase 2 complete

**Goal**: Admin can log in and see a list of all users with their project counts. This is the MVP that delivers immediate value.

### T014 [P] - Copy Type Definitions to Frontend

**Story**: US1 (P1) | **Type**: Frontend Setup

**Description**: Copy TypeScript type definitions from contracts to frontend source.

**Prerequisites**: Phase 2 complete (T004-T013)

**Steps**:
1. Copy `specs/006-fammi-un-tipo/contracts/admin.types.ts` to `frontend/src/types/admin.types.ts`
2. Verify no TypeScript errors: `cd frontend && npm run type-check`
3. Update imports in tsconfig.json if needed
4. Commit file

**Acceptance Criteria**:
- File copied to frontend/src/types/
- TypeScript compilation succeeds
- No import errors
- File committed to Git

**Reference**:
- [contracts/admin.types.ts](./contracts/admin.types.ts)
- [quickstart.md](./quickstart.md) - Section 3 "Implementation Steps" → Phase 1, Task 1

---

### T015 [P] - Create Admin API Service (getUserRole)

**Story**: US1 (P1) | **Type**: Frontend API

**Description**: Create admin API service with role checking functions.

**Prerequisites**: T014 complete

**File**: `frontend/src/services/admin.service.ts`

**Steps**:
1. Create new file admin.service.ts
2. Implement `getUserRole()` function from contracts/admin-api.contract.ts
3. Implement `isAdmin()` helper function
4. Add error handling for RLS policy violations
5. Add TypeScript types from admin.types.ts
6. Test manually with Supabase client

**Acceptance Criteria**:
- Function `getUserRole()` returns 'admin' for dadecresce@test.caz
- Function `getUserRole()` returns 'user' for regular users
- Function `isAdmin()` returns boolean
- Error handling catches RLS policy errors
- TypeScript types match contracts
- No console errors when calling functions

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.2 "Admin Dashboard Component"

**Reference**:
- [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts)
- [quickstart.md](./quickstart.md) - Section 3 → Phase 1, Task 2

---

### T016 [P] - Create Admin API Service (getAllUsersWithProjects)

**Story**: US1 (P1) | **Type**: Frontend API

**Description**: Implement function to fetch all users with aggregated project statistics from admin_users_overview view.

**Prerequisites**: T015 complete

**File**: `frontend/src/services/admin.service.ts` (add to existing)

**Steps**:
1. Add `getAllUsersWithProjects()` function from contracts
2. Query admin_users_overview view
3. Transform database results to AdminUsersOverview type
4. Add error handling for non-admin access
5. Test with admin and regular user accounts

**Acceptance Criteria**:
- Function queries admin_users_overview view
- Returns array of AdminUsersOverview objects
- Transforms Date fields correctly (strings → Date objects)
- Throws error when called by non-admin
- Returns all users when called by admin
- Performance < 5 seconds (SC-001)

**Test**: Call function as admin → should return all users. Call as regular user → should throw error or return empty.

**Reference**:
- [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts)
- [data-model.md](./data-model.md) - "View: admin_users_overview"

---

### T017 - Create React Query Hooks (useUserRole)

**Story**: US1 (P1) | **Type**: Frontend Hooks

**Description**: Create React Query hook for checking current user's role with caching.

**Prerequisites**: T016 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts`

**Steps**:
1. Create new hooks file
2. Implement `useUserRole()` hook from contracts/admin-hooks.contract.ts
3. Configure React Query caching (1 hour staleTime)
4. Add loading and error states
5. Export hook and related types
6. Create `useIsAdmin()` convenience hook

**Acceptance Criteria**:
- Hook returns UseQueryResult<UserRole, Error>
- Caches result for 1 hour (staleTime: 3600000)
- Loading state handled correctly
- Error state handled correctly
- Can be called multiple times without re-fetching (cache hit)
- TypeScript types correct

**Code Template**: See [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)

**Reference**:
- [quickstart.md](./quickstart.md) - Section 3 → Phase 1, Task 3
- [plan.md](./plan.md) - "Frontend Tasks"

---

### T018 - Create React Query Hooks (useAdminUsersOverview)

**Story**: US1 (P1) | **Type**: Frontend Hooks

**Description**: Create React Query hook for fetching admin dashboard data.

**Prerequisites**: T017 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts` (add to existing)

**Steps**:
1. Add `useAdminUsersOverview()` hook from contracts
2. Configure React Query caching (5 minutes staleTime)
3. Set refetchInterval for auto-refresh (optional)
4. Handle loading/error states
5. Add TypeScript types

**Acceptance Criteria**:
- Hook returns UseQueryResult<AdminUsersOverview[], Error>
- Caches result for 5 minutes
- Refetches on window focus
- Returns all users when called by admin
- Throws error when called by non-admin
- TypeScript types match AdminUsersOverview[]

**Reference**:
- [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)
- [quickstart.md](./quickstart.md) - Section 3 → Phase 1, Task 3

---

### T019 - Create Admin Dashboard Page Component

**Story**: US1 (P1) | **Type**: Frontend UI

**Description**: Build the main admin dashboard page that displays all users and their project statistics.

**Prerequisites**: T018 complete

**File**: `frontend/src/pages/Admin.page.tsx`

**Steps**:
1. Create new page component
2. Use `useUserRole()` to verify admin access
3. Use `useAdminUsersOverview()` to fetch users
4. Render table with columns: Email, Role, Devices, Sensors, Actuators, Last Activity
5. Add loading spinner during data fetch
6. Add error message for non-admin access
7. Style with Tailwind CSS matching existing pages (Dashboard.page.tsx)
8. Add header with "Admin Dashboard" title and back link

**Acceptance Criteria**:
- Page renders without errors
- Shows loading state while fetching data
- Shows access denied message for non-admin
- Shows table of all users for admin
- Table includes all required columns (FR-005)
- Styling matches existing dashboard pages
- Responsive design works on mobile
- Performance: page loads in < 5 seconds (SC-001)

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.2 "Admin Dashboard Component"

**Reference**:
- [spec.md](./spec.md) - User Story 1 acceptance scenarios
- [quickstart.md](./quickstart.md) - Section 4.2

---

### T020 - Create UserRow Component

**Story**: US1 (P1) | **Type**: Frontend UI

**Description**: Create reusable table row component for displaying individual user statistics.

**Prerequisites**: T019 in progress

**File**: `frontend/src/components/admin/UserRow.tsx`

**Steps**:
1. Create new component in components/admin/ directory
2. Accept AdminUsersOverview as prop
3. Display user email, role badge (if admin), device/sensor/actuator counts
4. Format last_activity as relative time ("2h ago", "3d ago")
5. Add hover effect for table row
6. Add "View Details" button (placeholder for US4)
7. Style with Tailwind CSS

**Acceptance Criteria**:
- Component accepts AdminUsersOverview prop
- Displays all user statistics correctly
- Admin badge shown for admin users
- Last activity formatted as relative time
- Hover effect works
- TypeScript types correct
- Component reusable and testable

**Reference**: [quickstart.md](./quickstart.md) - Section 4.2 "UserRow function"

---

### T021 - Add Admin Route to App Router

**Story**: US1 (P1) | **Type**: Frontend Routing

**Description**: Add /admin route to React Router with role-based protection.

**Prerequisites**: T019, T020 complete

**File**: `frontend/src/App.tsx`

**Steps**:
1. Import AdminPage component
2. Create ProtectedAdminRoute wrapper component
3. Add /admin route with protection
4. Add /unauthorized route for access denied
5. Test route protection (admin can access, regular user redirected)

**Acceptance Criteria**:
- /admin route added to router
- Route protected by ProtectedAdminRoute wrapper
- Admin users can access /admin
- Regular users redirected to /unauthorized
- Unauthenticated users redirected to /login
- Loading state handled during role check

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.1 "Admin Route Setup"

**Reference**:
- [quickstart.md](./quickstart.md) - Section 4.1
- [spec.md](./spec.md) - FR-006, FR-007

---

### T022 - Add Admin Navigation Link

**Story**: US1 (P1) | **Type**: Frontend UI

**Description**: Add "Admin Panel" link to navigation that only shows for admin users.

**Prerequisites**: T021 complete

**File**: Update existing navigation component (varies by project structure)

**Steps**:
1. Find main navigation component (likely in Dashboard.page.tsx or layout component)
2. Import useUserRole hook
3. Add conditional rendering for admin link
4. Style admin link differently (purple background)
5. Test visibility for admin vs regular users

**Acceptance Criteria**:
- Admin link only visible to admin users (FR-008)
- Link navigates to /admin
- Link styled distinctly (purple/admin theme)
- Loading state handled (link hidden until role loaded)
- No flickering during role check

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.5 "Role-Based Navigation"

**Reference**:
- [spec.md](./spec.md) - FR-008
- [quickstart.md](./quickstart.md) - Section 4.5

---

### T023 - Write Unit Tests for Admin API Service

**Story**: US1 (P1) | **Type**: Testing

**Description**: Create unit tests for admin.service.ts functions using Vitest.

**Prerequisites**: T016 complete

**File**: `frontend/src/services/admin.service.test.ts`

**Steps**:
1. Create test file
2. Test `getUserRole()` returns 'admin' for admin user
3. Test `getUserRole()` returns 'user' for regular user
4. Test `getAllUsersWithProjects()` returns array for admin
5. Test `getAllUsersWithProjects()` throws error for non-admin
6. Test error handling for network failures
7. Run tests: `npm run test`

**Acceptance Criteria**:
- All tests pass
- Coverage > 80% for admin.service.ts
- Tests cover success and error cases
- Tests use Supabase test client (mock or staging)
- Test results documented in test-results.md

**Test Template**: See [quickstart.md](./quickstart.md) - Section 5.2 "API Testing"

**Reference**:
- [quickstart.md](./quickstart.md) - Section 5.2
- [plan.md](./plan.md) - "Testing Strategy" → "Unit Tests"

---

### T024 - Write Component Tests for Admin Dashboard

**Story**: US1 (P1) | **Type**: Testing

**Description**: Create component tests for AdminPage using React Testing Library.

**Prerequisites**: T019, T020 complete

**File**: `frontend/src/pages/Admin.page.test.tsx`

**Steps**:
1. Create test file
2. Mock useUserRole to return 'admin'
3. Mock useAdminUsersOverview to return test data
4. Test dashboard renders with users table
5. Test loading state displays spinner
6. Test error state displays access denied
7. Test non-admin sees access denied
8. Run tests: `npm run test`

**Acceptance Criteria**:
- All tests pass
- Tests cover authenticated admin, non-admin, and loading states
- Uses React Testing Library best practices
- Mocks Supabase client correctly
- Test coverage > 80% for AdminPage component

**Test Template**: See [quickstart.md](./quickstart.md) - Section 5.3 "Component Testing"

**Reference**:
- [quickstart.md](./quickstart.md) - Section 5.3
- [plan.md](./plan.md) - "Testing Strategy" → "Component Tests"

---

### T025 - Manual E2E Testing for User Story 1

**Story**: US1 (P1) | **Type**: Testing

**Description**: Execute comprehensive manual testing of admin dashboard functionality.

**Prerequisites**: T021, T022 complete

**Steps**:
1. Execute "Test Scenario 1: Admin Access" from quickstart.md
2. Execute "Test Scenario 2: Regular User Cannot Access Admin" from quickstart.md
3. Test all 4 acceptance scenarios from spec.md User Story 1
4. Verify FR-003, FR-004, FR-005, FR-006, FR-008 requirements met
5. Document results in test-results.md with screenshots
6. Note any bugs or issues discovered

**Acceptance Criteria**:
- Admin can view list of all users with project statistics (Scenario 1)
- Admin can see device/sensor/actuator counts for each user (Scenario 2)
- Regular user cannot access admin dashboard (Scenario 3)
- Unauthenticated user redirected to login (Scenario 4)
- Dashboard loads in < 5 seconds (SC-001)
- All test results documented with pass/fail status

**Test Scenarios**: See [quickstart.md](./quickstart.md) - Section 5.4 "E2E Testing"

**Reference**:
- [spec.md](./spec.md) - User Story 1 acceptance scenarios
- [quickstart.md](./quickstart.md) - Section 5.4
- [plan.md](./plan.md) - "Success Criteria" SC-001, SC-002

---

### T026 - Deploy Phase 3 to Staging

**Story**: US1 (P1) | **Type**: Deployment

**Description**: Deploy admin dashboard MVP to staging environment for stakeholder review.

**Prerequisites**: T023, T024, T025 complete

**Steps**:
1. Run production build: `npm run build`
2. Verify no TypeScript errors
3. Verify all tests pass
4. Deploy frontend to staging environment
5. Verify admin user can access /admin in staging
6. Share staging URL with stakeholder for feedback
7. Document deployment in test-results.md

**Acceptance Criteria**:
- Build succeeds without errors
- All tests pass
- Staging deployment successful
- Admin dashboard accessible in staging
- No console errors in browser
- Performance meets SC-001 (<5s load time)
- Stakeholder feedback collected

**Reference**: [plan.md](./plan.md) - "Implementation Phases Summary" → Phase 1 deliverables

---

**CHECKPOINT: Phase 3 Complete (User Story 1 - P1)**

Before proceeding to Phase 4, verify:
- [ ] Admin can view all users with project counts (T019-T022)
- [ ] Role checking works correctly (T017)
- [ ] Navigation shows/hides admin link correctly (T022)
- [ ] All unit tests pass (T023, T024)
- [ ] Manual E2E tests pass (T025)
- [ ] Deployed to staging (T026)
- [ ] Git commit created: "feat(admin): implement admin dashboard MVP (US1)"

**Deliverable**: Admin user (dadecresce@test.caz) can log in and see list of all users with project statistics.

---

## Phase 4: User Story 2 (P2) - Search and Filtering

**Duration**: 2-3 days | **Depends on**: Phase 3 complete

**Goal**: Admin can quickly find specific users using search and filters.

### T027 [P] - Implement Client-Side Search Filtering

**Story**: US2 (P2) | **Type**: Frontend API

**Description**: Add client-side filtering logic for search by email (temporary solution, move to SQL later for scalability).

**Prerequisites**: Phase 3 complete (T014-T026)

**File**: `frontend/src/services/admin.service.ts` (add to existing)

**Steps**:
1. Add `filterUsers()` utility function
2. Implement email search (case-insensitive substring match)
3. Implement activity filter (last 1, 7, 30 days)
4. Implement device count sorting
5. Add TypeScript types for filters (AdminSearchFilters)
6. Test filtering logic with sample data

**Acceptance Criteria**:
- Function filters by email (case-insensitive)
- Function filters by last_activity (within N days)
- Function sorts by device_count
- Returns filtered array of AdminUsersOverview
- Performance acceptable for < 100 users (note: optimize later for more)
- TypeScript types correct

**Note**: This is a temporary client-side solution. For production with 1000+ users, implement server-side filtering (searchUsers() function from contracts).

**Reference**:
- [contracts/admin.types.ts](./contracts/admin.types.ts) - AdminSearchFilters
- [spec.md](./spec.md) - User Story 2 acceptance scenarios

---

### T028 - Create Search Input Component

**Story**: US2 (P2) | **Type**: Frontend UI

**Description**: Add search input with debouncing to admin dashboard.

**Prerequisites**: T027 complete

**File**: `frontend/src/pages/Admin.page.tsx` (modify existing)

**Steps**:
1. Add useState for searchTerm
2. Add search input with Search icon (lucide-react)
3. Implement debouncing (300ms delay)
4. Call filterUsers() on search term change
5. Update table to show filtered results
6. Add "X" button to clear search
7. Show "No users found" when results empty

**Acceptance Criteria**:
- Search input renders above users table
- Debouncing prevents excessive filtering (300ms delay)
- Filtering updates table in real-time
- Clear button resets search
- Loading state during debounce (optional)
- Placeholder text: "Search by email..."

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.3 "User List with Search/Filter"

**Reference**:
- [spec.md](./spec.md) - User Story 2 scenario 1
- [quickstart.md](./quickstart.md) - Section 4.3

---

### T029 - Create Activity Filter Dropdown

**Story**: US2 (P2) | **Type**: Frontend UI

**Description**: Add dropdown filter for user activity (active last 1, 7, 30 days).

**Prerequisites**: T028 complete

**File**: `frontend/src/pages/Admin.page.tsx` (modify existing)

**Steps**:
1. Add useState for activityFilter
2. Add <select> dropdown with options: All, Last 1 day, Last 7 days, Last 30 days
3. Call filterUsers() when filter changes
4. Combine with existing search filter
5. Update table to show filtered results
6. Add Filter icon (lucide-react)

**Acceptance Criteria**:
- Dropdown renders next to search input
- Options: "All Activity", "Active today", "Active last 7 days", "Active last 30 days"
- Filtering works correctly (checks last_activity timestamp)
- Combines with search filter (AND logic)
- Default: "All Activity"

**Reference**:
- [spec.md](./spec.md) - User Story 2 scenario 2
- [quickstart.md](./quickstart.md) - Section 4.3

---

### T030 [P] - Add Device Count Sorting

**Story**: US2 (P2) | **Type**: Frontend UI

**Description**: Add clickable column headers to sort users by device count.

**Prerequisites**: T029 complete

**File**: `frontend/src/pages/Admin.page.tsx` (modify existing)

**Steps**:
1. Add useState for sortColumn and sortDirection
2. Make "Devices" column header clickable
3. Add sort icon (up/down arrow)
4. Implement sort logic in filterUsers()
5. Update table to show sorted results
6. Support ascending/descending toggle

**Acceptance Criteria**:
- "Devices" column header clickable
- Clicking toggles sort direction (asc/desc)
- Sort icon shows current direction
- Sorting preserves search/filter results
- Default sort: device_count descending

**Reference**: [spec.md](./spec.md) - User Story 2 scenario 3

---

### T031 - Add Pagination Controls

**Story**: US2 (P2) | **Type**: Frontend UI

**Description**: Add basic pagination for user list (client-side, move to cursor-based later).

**Prerequisites**: T030 complete

**File**: `frontend/src/pages/Admin.page.tsx` (modify existing)

**Steps**:
1. Add useState for currentPage and pageSize (default: 20)
2. Implement pagination logic (slice filtered results)
3. Add "Previous" and "Next" buttons
4. Add page number display ("Page 1 of 5")
5. Add "Load More" button as alternative (append to list)
6. Disable buttons at boundaries

**Acceptance Criteria**:
- Pagination controls render below table
- Page size: 20 users per page
- Previous/Next buttons work correctly
- Buttons disabled when at first/last page
- Page number displays correctly
- "Load More" option available (infinite scroll alternative)

**Note**: For production with 1000+ users, implement cursor-based pagination using searchUsers() API.

**Reference**:
- [plan.md](./plan.md) - "Scalability Targets"
- [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts) - searchUsers()

---

### T032 - Create React Query Hook for Search (useAdminUsersList)

**Story**: US2 (P2) | **Type**: Frontend Hooks

**Description**: Create React Query hook for server-side search (future optimization).

**Prerequisites**: T031 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts` (add to existing)

**Steps**:
1. Add `useAdminUsersList()` hook from contracts
2. Accept AdminSearchFilters parameter
3. Configure keepPreviousData for smooth transitions
4. Configure pagination with cursor
5. Add debouncing for search term
6. Note: Not used yet, kept for future migration

**Acceptance Criteria**:
- Hook signature matches contract
- Returns UseQueryResult<AdminUserListResponse, Error>
- keepPreviousData enabled
- Query key includes filters
- Ready for future use (when migrating to server-side search)

**Reference**:
- [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)
- [quickstart.md](./quickstart.md) - Section 4.3

---

### T033 - Write Tests for Search/Filter Functionality

**Story**: US2 (P2) | **Type**: Testing

**Description**: Create tests for search and filter logic.

**Prerequisites**: T032 complete

**File**: `frontend/src/services/admin.service.test.ts` (add to existing)

**Steps**:
1. Test filterUsers() with email search
2. Test filterUsers() with activity filter
3. Test filterUsers() with combined filters
4. Test sorting by device count
5. Test pagination logic
6. Run tests: `npm run test`

**Acceptance Criteria**:
- All filter tests pass
- Tests cover edge cases (empty results, no filters)
- Coverage > 80% for filter functions
- Test results documented

**Reference**: [plan.md](./plan.md) - "Testing Strategy" → "Unit Tests"

---

### T034 - Manual E2E Testing for User Story 2

**Story**: US2 (P2) | **Type**: Testing

**Description**: Execute comprehensive manual testing of search and filter functionality.

**Prerequisites**: T033 complete

**Steps**:
1. Execute "Test Scenario 3: Search and Filter" from quickstart.md
2. Test all 3 acceptance scenarios from spec.md User Story 2
3. Verify search returns results in < 2 seconds (SC-003)
4. Verify filters combine correctly (search + activity + sort)
5. Document results in test-results.md

**Acceptance Criteria**:
- Search by email works correctly (scenario 1)
- Activity filter works correctly (scenario 2)
- Device count filter/sort works correctly (scenario 3)
- Search results return in < 10 seconds for 100+ users (SC-003)
- All test results documented

**Reference**:
- [spec.md](./spec.md) - User Story 2 acceptance scenarios
- [quickstart.md](./quickstart.md) - Section 5.4

---

**CHECKPOINT: Phase 4 Complete (User Story 2 - P2)**

Before proceeding to Phase 5, verify:
- [ ] Search by email works (T028)
- [ ] Activity filter works (T029)
- [ ] Device count sorting works (T030)
- [ ] Pagination works (T031)
- [ ] All tests pass (T033, T034)
- [ ] Search performance < 10 seconds (SC-003)
- [ ] Git commit created: "feat(admin): add search and filtering (US2)"

**Deliverable**: Admin can quickly find specific users using search, filters, and sorting.

---

## Phase 5: User Story 3 (P3) - Admin Edit Capabilities

**Duration**: 3-4 days | **Depends on**: Phase 4 complete

**Goal**: Admin can modify device/sensor/actuator configurations on behalf of users.

### T035 [P] - Implement Update Device API Function

**Story**: US3 (P3) | **Type**: Frontend API

**Description**: Add function to update device properties via admin RLS policies.

**Prerequisites**: Phase 4 complete (T027-T034)

**File**: `frontend/src/services/admin.service.ts` (add to existing)

**Steps**:
1. Add `updateDevice()` function from contracts/admin-api.contract.ts
2. Accept device_id and updates object
3. Use Supabase .update() with RLS enforcement
4. Return AdminActionResult with success/error
5. Add validation for FR-012 (cannot delete)
6. Test with admin and regular user accounts

**Acceptance Criteria**:
- Function updates device record in database
- Admin can update any device (RLS bypass)
- Regular user cannot update other users' devices (RLS blocks)
- Cannot delete devices (FR-012)
- Returns success result with updated device
- Returns error result on failure

**Reference**:
- [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts)
- [spec.md](./spec.md) - FR-011, FR-012

---

### T036 [P] - Implement Update Sensor/Actuator API Functions

**Story**: US3 (P3) | **Type**: Frontend API

**Description**: Add functions to update sensor and actuator properties.

**Prerequisites**: T035 complete

**File**: `frontend/src/services/admin.service.ts` (add to existing)

**Steps**:
1. Add `updateSensor()` function from contracts
2. Add `updateActuator()` function from contracts
3. Same pattern as updateDevice() (RLS enforcement)
4. Add validation rules
5. Test with admin and regular user accounts

**Acceptance Criteria**:
- Both functions work correctly
- Admin can update any sensor/actuator
- Regular user cannot update others' sensors/actuators
- Returns AdminActionResult
- Error handling works

**Reference**: [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts)

---

### T037 - Create Update Device Mutation Hook

**Story**: US3 (P3) | **Type**: Frontend Hooks

**Description**: Create React Query mutation hook for updating devices with optimistic updates.

**Prerequisites**: T035 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts` (add to existing)

**Steps**:
1. Add `useUpdateDevice()` hook from contracts/admin-hooks.contract.ts
2. Configure optimistic updates (update cache before server response)
3. Configure cache invalidation on success
4. Add error rollback on failure
5. Return UseMutationResult

**Acceptance Criteria**:
- Hook returns UseMutationResult
- Optimistic updates work (UI updates immediately)
- Cache invalidates on success (refetches latest data)
- Rollback on error (reverts optimistic update)
- Loading state during mutation

**Reference**:
- [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)
- [quickstart.md](./quickstart.md) - Section 4.4

---

### T038 - Create Update Sensor/Actuator Mutation Hooks

**Story**: US3 (P3) | **Type**: Frontend Hooks

**Description**: Create mutation hooks for sensors and actuators.

**Prerequisites**: T037 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts` (add to existing)

**Steps**:
1. Add `useUpdateSensor()` hook from contracts
2. Add `useUpdateActuator()` hook from contracts
3. Same pattern as useUpdateDevice()
4. Configure cache invalidation

**Acceptance Criteria**:
- Both hooks work correctly
- Optimistic updates enabled
- Cache invalidation configured
- Error handling works

**Reference**: [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)

---

### T039 - Create Inline Edit Component for Device Names

**Story**: US3 (P3) | **Type**: Frontend UI

**Description**: Create inline edit component for device names with save/cancel buttons.

**Prerequisites**: T037 complete

**File**: `frontend/src/components/admin/DeviceInlineEdit.tsx`

**Steps**:
1. Create new component
2. Add edit mode toggle (Edit icon → Save/Cancel)
3. Use useUpdateDevice() mutation hook
4. Add input field with current device name
5. Add Save (checkmark) and Cancel (X) buttons
6. Handle loading state during mutation
7. Show success/error messages

**Acceptance Criteria**:
- Component toggles between view and edit mode
- Edit icon shows in view mode
- Input field shows in edit mode
- Save button calls mutation
- Cancel button reverts changes
- Loading spinner during mutation
- Success message on save
- Error message on failure

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.4 "Device Header with Inline Edit"

**Reference**:
- [spec.md](./spec.md) - User Story 3 scenario 1
- [quickstart.md](./quickstart.md) - Section 4.4

---

### T040 - Add "Editing as Admin" Badge

**Story**: US3 (P3) | **Type**: Frontend UI

**Description**: Add visual indicator when admin is viewing/editing another user's project.

**Prerequisites**: T039 in progress

**File**: `frontend/src/pages/AdminUserDetail.page.tsx` (create new) or modify existing detail view

**Steps**:
1. Add header badge: "Editing as Admin"
2. Use yellow/warning color (bg-yellow-100 text-yellow-800)
3. Show badge on all admin edit pages
4. Position in header next to page title
5. Add icon (Shield or Edit)

**Acceptance Criteria**:
- Badge visible when admin views user project
- Badge styled with yellow theme (FR-013)
- Badge shows icon + text
- Badge positioned prominently in header
- Badge not visible to project owner (when they view own project)

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.4 "Admin Edit Badge"

**Reference**:
- [spec.md](./spec.md) - FR-013
- [quickstart.md](./quickstart.md) - Section 4.4

---

### T041 - Disable Delete Operations for Admin

**Story**: US3 (P3) | **Type**: Frontend UI

**Description**: Prevent admin from deleting devices, sensors, actuators, or entire projects.

**Prerequisites**: T039, T040 complete

**File**: Update all admin edit components

**Steps**:
1. Remove delete buttons from admin UI
2. Add tooltip: "Admins cannot delete projects" (FR-012)
3. Hide delete options in dropdowns/menus
4. Add validation to prevent accidental deletes
5. Show read-only message if delete attempted

**Acceptance Criteria**:
- No delete buttons visible in admin UI
- Delete operations blocked in code (double-check)
- Tooltip explains restriction
- Admin can edit but not delete
- Project owners can still delete own projects

**Reference**:
- [spec.md](./spec.md) - FR-012, User Story 3 scenario 3
- [plan.md](./plan.md) - "Security Considerations"

---

### T042 - Implement Real-Time Sync for Admin Edits

**Story**: US3 (P3) | **Type**: Frontend Real-time

**Description**: Ensure changes made by admin are visible to project owner in real-time using Supabase Realtime.

**Prerequisites**: T041 complete

**Steps**:
1. Enable Supabase Realtime on devices, sensors, actuators tables
2. Subscribe to changes in project owner's dashboard
3. Configure React Query to refetch on window focus
4. Test: Admin edits device → Owner sees change without page refresh
5. Add visual indicator when data updates (toast notification)

**Acceptance Criteria**:
- Supabase Realtime enabled on relevant tables
- Project owner's dashboard subscribes to changes
- Changes appear in real-time (< 500ms latency)
- React Query refetches on window focus
- Visual feedback when data updates (FR-014)

**Test**: Open two browsers - admin and owner. Admin edits device name. Owner should see change immediately.

**Reference**:
- [spec.md](./spec.md) - FR-014, User Story 3 scenario 4
- [plan.md](./plan.md) - "Performance Benchmarks" → "Real-time Sync Latency"

---

### T043 - Write Tests for Update Mutations

**Story**: US3 (P3) | **Type**: Testing

**Description**: Create tests for update mutation hooks and API functions.

**Prerequisites**: T038 complete

**File**: `frontend/src/services/admin.service.test.ts` (add to existing)

**Steps**:
1. Test updateDevice() as admin (should succeed)
2. Test updateDevice() as regular user on other's device (should fail)
3. Test updateSensor() and updateActuator() similarly
4. Test optimistic updates in hooks
5. Test cache invalidation
6. Test error rollback
7. Run tests: `npm run test`

**Acceptance Criteria**:
- All mutation tests pass
- Tests cover success and error cases
- Tests verify RLS enforcement
- Coverage > 80% for update functions
- Test results documented

**Reference**: [plan.md](./plan.md) - "Testing Strategy" → "Unit Tests"

---

### T044 - Manual E2E Testing for User Story 3

**Story**: US3 (P3) | **Type**: Testing

**Description**: Execute comprehensive manual testing of admin edit functionality.

**Prerequisites**: T042, T043 complete

**Steps**:
1. Execute "Test Scenario 4: Admin Edits Device" from quickstart.md
2. Test all 4 acceptance scenarios from spec.md User Story 3
3. Verify changes visible to project owner (FR-014)
4. Verify admin cannot delete projects (FR-012)
5. Verify real-time sync works (< 500ms latency)
6. Document results in test-results.md

**Acceptance Criteria**:
- Admin can edit device configurations (scenario 1)
- Changes immediately visible to owner (scenario 2)
- Admin cannot delete projects (scenario 3)
- Real-time sync works correctly (scenario 4)
- All test results documented

**Reference**:
- [spec.md](./spec.md) - User Story 3 acceptance scenarios
- [quickstart.md](./quickstart.md) - Section 5.4

---

**CHECKPOINT: Phase 5 Complete (User Story 3 - P3)**

Before proceeding to Phase 6, verify:
- [ ] Admin can edit device/sensor/actuator configurations (T035-T036, T039)
- [ ] "Editing as Admin" badge shows (T040)
- [ ] Delete operations disabled for admin (T041)
- [ ] Real-time sync works (T042)
- [ ] All tests pass (T043, T044)
- [ ] Git commit created: "feat(admin): add edit capabilities with real-time sync (US3)"

**Deliverable**: Admin can modify project configurations on behalf of users with changes visible in real-time.

---

## Phase 6: User Story 4 (P4) - Detailed Project View

**Duration**: 2-3 days | **Depends on**: Phase 5 complete

**Goal**: Admin can view comprehensive project details including recent sensor readings.

### T045 [P] - Implement Get User Detail API Function

**Story**: US4 (P4) | **Type**: Frontend API

**Description**: Add function to fetch detailed user information including all devices with sensors/actuators.

**Prerequisites**: Phase 5 complete (T035-T044)

**File**: `frontend/src/services/admin.service.ts` (add to existing)

**Steps**:
1. Add `getUserDetail()` function from contracts/admin-api.contract.ts
2. Query devices with .select() including nested sensors and actuators
3. Include latest sensor readings for each sensor
4. Transform to AdminUserDetail type
5. Add error handling
6. Test with admin account

**Acceptance Criteria**:
- Function returns AdminUserDetail object
- Includes all user devices
- Each device includes sensors with latest readings
- Each device includes actuators
- Admin can fetch any user's details
- Regular user cannot fetch other users' details

**Reference**:
- [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts)
- [contracts/admin.types.ts](./contracts/admin.types.ts) - AdminUserDetail

---

### T046 [P] - Implement Get Project Details API Function

**Story**: US4 (P4) | **Type**: Frontend API

**Description**: Add function to fetch comprehensive project/device details with recent readings and activity summary.

**Prerequisites**: T045 complete

**File**: `frontend/src/services/admin.service.ts` (add to existing)

**Steps**:
1. Add `getProjectDetails()` function from contracts
2. Fetch device with all sensors/actuators
3. Fetch recent sensor readings (last 24 hours)
4. Calculate activity summary (total readings, is_active)
5. Include owner information
6. Transform to AdminProjectDetail type

**Acceptance Criteria**:
- Function returns AdminProjectDetail object
- Includes device metadata and connection status
- Includes all sensors/actuators
- Includes recent readings (last 24 hours)
- Includes activity summary
- Includes owner info (email, role)

**Reference**:
- [contracts/admin-api.contract.ts](./contracts/admin-api.contract.ts)
- [contracts/admin.types.ts](./contracts/admin.types.ts) - AdminProjectDetail

---

### T047 - Create useAdminUserDetail Hook

**Story**: US4 (P4) | **Type**: Frontend Hooks

**Description**: Create React Query hook for fetching user detail data.

**Prerequisites**: T045 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts` (add to existing)

**Steps**:
1. Add `useAdminUserDetail()` hook from contracts/admin-hooks.contract.ts
2. Accept userId parameter
3. Configure caching (5 minutes staleTime)
4. Add loading/error states
5. Return UseQueryResult<AdminUserDetail, Error>

**Acceptance Criteria**:
- Hook fetches user detail when userId provided
- Caches result for 5 minutes
- Refetches on window focus
- Loading state handled
- Error state handled

**Reference**: [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)

---

### T048 - Create useAdminProjectDetail Hook

**Story**: US4 (P4) | **Type**: Frontend Hooks

**Description**: Create React Query hook for fetching project detail data.

**Prerequisites**: T046 complete

**File**: `frontend/src/lib/hooks/useAdmin.ts` (add to existing)

**Steps**:
1. Add `useAdminProjectDetail()` hook from contracts
2. Accept deviceId parameter
3. Configure caching (5 minutes)
4. Add loading/error states

**Acceptance Criteria**:
- Hook fetches project detail when deviceId provided
- Caches result for 5 minutes
- Returns comprehensive project data

**Reference**: [contracts/admin-hooks.contract.ts](./contracts/admin-hooks.contract.ts)

---

### T049 - Create Admin User Detail Page

**Story**: US4 (P4) | **Type**: Frontend UI

**Description**: Build comprehensive user detail page showing all devices, sensors, actuators, and recent readings.

**Prerequisites**: T047, T048 complete

**File**: `frontend/src/pages/AdminUserDetail.page.tsx`

**Steps**:
1. Create new page component
2. Use useParams() to get userId from URL
3. Use useAdminUserDetail() hook to fetch data
4. Display user stats (device/sensor/actuator counts)
5. List all devices with expand/collapse
6. Show sensors with latest readings
7. Show actuators with current state
8. Add breadcrumbs navigation
9. Add "Back to Admin Dashboard" link
10. Style with Tailwind CSS

**Acceptance Criteria**:
- Page renders without errors
- Shows user email and statistics
- Lists all devices owned by user
- Each device shows sensors with latest readings
- Each device shows actuators with current state
- Breadcrumb navigation works
- Loading state during fetch
- Error state for failed fetch

**Code Template**: See [quickstart.md](./quickstart.md) - Section 4.4 "AdminUserDetailPage"

**Reference**:
- [spec.md](./spec.md) - User Story 4 scenario 1
- [quickstart.md](./quickstart.md) - Section 4.4

---

### T050 - Create User Detail Card Component

**Story**: US4 (P4) | **Type**: Frontend UI

**Description**: Create reusable card component for displaying user statistics.

**Prerequisites**: T049 in progress

**File**: `frontend/src/components/admin/UserDetailCard.tsx`

**Steps**:
1. Create new component
2. Accept AdminUserDetail as prop
3. Display user email, role badge
4. Display registration date
5. Display device/sensor/actuator counts
6. Display last activity timestamp
7. Style as card with grid layout

**Acceptance Criteria**:
- Component displays all user stats
- Grid layout with 4 columns
- Responsive on mobile (2 columns)
- Styled consistently with other cards

**Reference**: [quickstart.md](./quickstart.md) - "StatCard function"

---

### T051 - Create Project Detail Card Component

**Story**: US4 (P4) | **Type**: Frontend UI

**Description**: Create component for displaying device/project details with sensor readings.

**Prerequisites**: T049 in progress

**File**: `frontend/src/components/admin/ProjectDetailCard.tsx`

**Steps**:
1. Create new component
2. Accept AdminDeviceInfo as prop
3. Display device name, connection status, firmware version
4. List sensors with latest readings and timestamps
5. List actuators with current states
6. Add expand/collapse for sensor readings chart (optional)
7. Style with collapsible sections

**Acceptance Criteria**:
- Component displays device metadata
- Shows all sensors with latest values
- Shows all actuators with states
- Expand/collapse works for detailed views
- Responsive layout

**Reference**: [quickstart.md](./quickstart.md) - Section 4.4 "Device Info"

---

### T052 - Add "View Details" Navigation

**Story**: US4 (P4) | **Type**: Frontend UI

**Description**: Add clickable "View Details" buttons to user rows in admin dashboard.

**Prerequisites**: T049-T051 complete

**File**: `frontend/src/components/admin/UserRow.tsx` (modify existing from T020)

**Steps**:
1. Update UserRow component from T020
2. Add "View Details" button (already placeholder)
3. Link to `/admin/users/:userId` route
4. Add route to App.tsx for AdminUserDetail page
5. Test navigation flow

**Acceptance Criteria**:
- "View Details" button links to user detail page
- Route parameter passed correctly
- Navigation preserves search/filter state (optional: use URL query params)
- Breadcrumbs show navigation path

**Reference**: [spec.md](./spec.md) - User Story 4 scenario 3

---

### T053 - Add Breadcrumb Navigation

**Story**: US4 (P4) | **Type**: Frontend UI

**Description**: Add breadcrumb navigation to admin pages for easy navigation.

**Prerequisites**: T052 complete

**File**: `frontend/src/components/admin/Breadcrumbs.tsx`

**Steps**:
1. Create breadcrumb component
2. Use react-router useLocation() to determine path
3. Display: "Admin Dashboard > User: email@example.com"
4. Make each breadcrumb clickable (navigate back)
5. Add to AdminUserDetail page header

**Acceptance Criteria**:
- Breadcrumbs show navigation hierarchy
- Each crumb is clickable
- Current page not clickable
- Separator between crumbs (/ or >)
- Styled consistently

**Reference**: [spec.md](./spec.md) - User Story 4 scenario 3

---

### T054 - Write Tests for Detail View Components

**Story**: US4 (P4) | **Type**: Testing

**Description**: Create component tests for user detail and project detail pages.

**Prerequisites**: T053 complete

**File**: `frontend/src/pages/AdminUserDetail.page.test.tsx`

**Steps**:
1. Create test file
2. Mock useAdminUserDetail() hook
3. Test page renders with user data
4. Test loading state
5. Test error state
6. Test navigation (breadcrumbs, back button)
7. Run tests: `npm run test`

**Acceptance Criteria**:
- All tests pass
- Tests cover data display, loading, error states
- Tests verify breadcrumb navigation
- Coverage > 80% for detail pages

**Reference**: [plan.md](./plan.md) - "Testing Strategy" → "Component Tests"

---

### T055 - Manual E2E Testing for User Story 4

**Story**: US4 (P4) | **Type**: Testing

**Description**: Execute comprehensive manual testing of detail view functionality.

**Prerequisites**: T054 complete

**Steps**:
1. Test all 3 acceptance scenarios from spec.md User Story 4
2. Verify admin can view full project details (scenario 1)
3. Verify admin sees same data as project owner (scenario 2)
4. Verify navigation preserves filters (scenario 3)
5. Verify detail page loads in < 3 seconds
6. Document results in test-results.md

**Acceptance Criteria**:
- Admin can view full project details (scenario 1)
- Data matches project owner's view (scenario 2)
- Navigation preserves search/filter state (scenario 3)
- Detail page loads in < 3 seconds
- All test results documented

**Reference**:
- [spec.md](./spec.md) - User Story 4 acceptance scenarios
- [plan.md](./plan.md) - "Performance Benchmarks"

---

**CHECKPOINT: Phase 6 Complete (User Story 4 - P4)**

Before proceeding to Phase 7, verify:
- [ ] Admin can view detailed user information (T049-T051)
- [ ] Navigation to detail view works (T052-T053)
- [ ] All tests pass (T054, T055)
- [ ] Detail page loads in < 3 seconds
- [ ] Git commit created: "feat(admin): add detailed project view (US4)"

**Deliverable**: Admin can view comprehensive project details including real-time sensor data.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Duration**: 2-3 days | **Depends on**: Phases 3-6 complete

**Goal**: Finalize documentation, optimize performance, and prepare for production.

### T056 [P] - Add JSDoc Comments to All Admin Code

**Story**: Polish | **Type**: Documentation

**Description**: Add comprehensive JSDoc comments to all admin TypeScript files for maintainability.

**Prerequisites**: Phases 3-6 complete (T014-T055)

**Steps**:
1. Add JSDoc to all functions in admin.service.ts
2. Add JSDoc to all hooks in useAdmin.ts
3. Add JSDoc to all components (AdminPage, UserRow, etc.)
4. Include @param, @returns, @throws, @example tags
5. Document RLS policy behavior
6. Run TypeScript to verify no errors

**Acceptance Criteria**:
- All public functions have JSDoc
- All components have JSDoc
- @param and @returns documented
- Examples provided for complex functions
- TypeScript compilation succeeds

**Reference**: [plan.md](./plan.md) - "Documentation Updates Required"

---

### T057 [P] - Update README with Admin Setup Instructions

**Story**: Polish | **Type**: Documentation

**Description**: Update project README with instructions for admin feature setup.

**Prerequisites**: T056 complete

**File**: `README.md` (root)

**Steps**:
1. Add "Admin User Role" section to README
2. Document how to create admin user
3. Document database migration steps
4. Document testing procedures
5. Add screenshots of admin dashboard
6. Link to quickstart.md for detailed guide

**Acceptance Criteria**:
- README includes admin setup section
- Instructions clear for new developers
- Screenshots included
- Links to detailed documentation
- Markdown formatting correct

**Reference**: [plan.md](./plan.md) - "Documentation Updates Required"

---

### T058 - Run Performance Optimization Pass

**Story**: Polish | **Type**: Performance

**Description**: Optimize performance bottlenecks identified during testing.

**Prerequisites**: T055 complete

**Steps**:
1. Run performance profiling on admin dashboard
2. Check React Query DevTools for unnecessary refetches
3. Optimize SQL queries (add missing indexes if needed)
4. Implement cursor-based pagination if user count > 100
5. Optimize bundle size (code splitting for admin routes)
6. Verify all performance targets met (SC-001, SC-003)
7. Document optimizations in test-results.md

**Acceptance Criteria**:
- Admin dashboard loads in < 5 seconds (SC-001)
- Search returns in < 10 seconds (SC-003)
- Detail page loads in < 3 seconds
- React Query cache configured optimally
- No unnecessary network requests
- Bundle size optimized (admin code lazy-loaded)

**Reference**:
- [plan.md](./plan.md) - "Performance Benchmarks"
- [spec.md](./spec.md) - Success Criteria

---

### T059 - Run Security Audit

**Story**: Polish | **Type**: Security

**Description**: Perform security audit to ensure no vulnerabilities introduced.

**Prerequisites**: T058 complete

**Steps**:
1. Verify no service role key exposed in frontend
2. Verify all RLS policies enforce correctly
3. Test role escalation attempts (user tries to become admin)
4. Test unauthorized access attempts (direct URL navigation)
5. Check for XSS vulnerabilities in admin inputs
6. Run `npm audit` for dependency vulnerabilities
7. Document findings in test-results.md

**Acceptance Criteria**:
- No service role key in frontend code
- RLS policies block unauthorized access (SC-004)
- No role escalation possible
- No XSS vulnerabilities
- npm audit shows no high/critical issues
- All security findings addressed or documented

**Reference**:
- [plan.md](./plan.md) - "Security Considerations"
- [spec.md](./spec.md) - SC-004

---

### T060 - Create Admin User Guide

**Story**: Polish | **Type**: Documentation

**Description**: Write user-facing documentation for admin users explaining how to use the admin panel.

**Prerequisites**: T059 complete

**File**: `docs/admin-user-guide.md`

**Steps**:
1. Create new documentation file
2. Explain how to access admin panel
3. Document how to search/filter users
4. Document how to view user details
5. Document how to edit configurations
6. Add screenshots for each feature
7. Include troubleshooting section

**Acceptance Criteria**:
- User guide created with all features documented
- Screenshots included for clarity
- Step-by-step instructions provided
- Troubleshooting section addresses common issues
- Markdown formatting correct

**Reference**: [plan.md](./plan.md) - "Documentation Updates Required" → "User Documentation"

---

### T061 - Write Integration Tests for Full User Stories

**Story**: Polish | **Type**: Testing

**Description**: Create comprehensive integration tests covering complete user story flows.

**Prerequisites**: T060 complete

**File**: `frontend/src/tests/integration/admin.integration.test.ts`

**Steps**:
1. Create integration test file
2. Test complete US1 flow (login → view dashboard → see all users)
3. Test complete US2 flow (search → filter → verify results)
4. Test complete US3 flow (edit device → verify change → check owner sees it)
5. Test complete US4 flow (view details → navigate back)
6. Mock Supabase client with test data
7. Run tests: `npm run test:integration`

**Acceptance Criteria**:
- All user story flows covered
- Tests use realistic test data
- Tests cover happy path and error cases
- All integration tests pass
- Test coverage documented

**Reference**: [plan.md](./plan.md) - "Testing Strategy" → "Integration Tests"

---

### T062 - Final E2E Manual Testing

**Story**: Polish | **Type**: Testing

**Description**: Execute comprehensive final testing of all features together.

**Prerequisites**: T061 complete

**Steps**:
1. Test all 4 user stories in sequence
2. Test cross-browser compatibility (Chrome, Firefox, Safari)
3. Test mobile responsiveness
4. Test with 100+ users in database (performance)
5. Test error scenarios (network failure, database down)
6. Verify all functional requirements (FR-001 to FR-014)
7. Verify all success criteria (SC-001 to SC-004)
8. Document all test results in test-results.md

**Acceptance Criteria**:
- All user stories tested successfully
- All functional requirements verified
- All success criteria met
- Cross-browser compatibility confirmed
- Mobile responsiveness confirmed
- Performance targets met
- All test results documented with pass/fail status

**Reference**:
- [spec.md](./spec.md) - All functional requirements and success criteria
- [plan.md](./plan.md) - Testing Strategy

---

### T063 - Deploy to Production

**Story**: Polish | **Type**: Deployment

**Description**: Deploy admin feature to production environment.

**Prerequisites**: T062 complete

**Steps**:
1. Run final production build: `npm run build`
2. Verify all tests pass: `npm run test`
3. Verify TypeScript compilation: `npm run type-check`
4. Deploy database migrations to production
5. Verify admin user role in production database
6. Deploy frontend to production
7. Smoke test in production (login as admin, view dashboard)
8. Monitor for errors (check logs, Sentry, etc.)
9. Document deployment in test-results.md

**Acceptance Criteria**:
- Build succeeds without errors
- All tests pass
- Migrations applied successfully in production
- Admin user has correct role in production
- Frontend deployed successfully
- Smoke tests pass
- No errors in production logs
- Deployment documented

**Reference**: [plan.md](./plan.md) - "Next Steps"

---

### T064 - Create Feature Summary Report

**Story**: Polish | **Type**: Documentation

**Description**: Create summary report documenting the completed feature.

**Prerequisites**: T063 complete

**File**: `specs/006-fammi-un-tipo/feature-summary.md`

**Steps**:
1. Create summary document
2. List all user stories implemented (US1-US4)
3. List all functional requirements met (FR-001 to FR-014)
4. List all success criteria achieved (SC-001 to SC-004)
5. Document known limitations or future enhancements
6. Include performance benchmarks
7. Include test coverage statistics
8. Add screenshots of final UI

**Acceptance Criteria**:
- Summary document created
- All completed work documented
- Performance metrics included
- Test coverage statistics included
- Screenshots of final UI included
- Known limitations documented
- Future enhancements listed

**Reference**: [plan.md](./plan.md) - Implementation Phases Summary

---

**CHECKPOINT: Phase 7 Complete (Final)**

Before closing feature, verify:
- [ ] All documentation complete (T056, T057, T060, T064)
- [ ] Performance optimized (T058)
- [ ] Security audit passed (T059)
- [ ] All tests pass (T061, T062)
- [ ] Deployed to production (T063)
- [ ] Feature summary created (T064)
- [ ] Git commit created: "feat(admin): finalize admin role feature with documentation"

---

## Summary

**Total Tasks**: 64 tasks across 7 phases
**Estimated Duration**: 14-20 days
**Dependencies**: Sequential by phase, some parallelizable within phases

**Key Milestones**:
1. Phase 1: Setup complete (T001-T003) - 1 day
2. Phase 2: Database migrations complete (T004-T013) - 2-3 days - **BLOCKS all user stories**
3. Phase 3: MVP deployed (T014-T026) - 3-5 days - **Delivers US1 (P1)**
4. Phase 4: Search deployed (T027-T034) - 2-3 days - **Delivers US2 (P2)**
5. Phase 5: Edit capabilities deployed (T035-T044) - 3-4 days - **Delivers US3 (P3)**
6. Phase 6: Detail view deployed (T045-T055) - 2-3 days - **Delivers US4 (P4)**
7. Phase 7: Production ready (T056-T064) - 2-3 days - **Final polish**

**Deliverables**:
- Admin user (dadecresce@test.caz) can view all users and their projects ✅
- Admin can search and filter users quickly ✅
- Admin can edit device/sensor/actuator configurations ✅
- Admin can view detailed project information ✅
- All functional requirements met (FR-001 to FR-014) ✅
- All success criteria achieved (SC-001 to SC-004) ✅

---

**END OF TASKS**
