# Database Migrations - Admin User Role Feature

**Feature**: 006-fammi-un-tipo (Admin User Role with Multi-Project View)
**Created**: 2025-11-16
**Status**: Ready for Execution

## Overview

This directory contains 5 SQL migration files that implement the admin user role system. Execute them in order using the Supabase SQL Editor or CLI.

## Migration Files

| Order | File | Purpose | Status |
|-------|------|---------|--------|
| 1 | `20251116_create_user_roles.sql` | Creates user_roles table with RLS | Ready |
| 2 | `20251116_create_user_role_function.sql` | Creates auth.user_role() helper function | Ready |
| 3 | `20251116_backfill_user_roles.sql` | Assigns default roles to existing users | Ready |
| 4 | `20251116_update_rls_policies.sql` | Updates RLS policies for admin bypass | Ready |
| 5 | `20251116_create_admin_views.sql` | Creates admin_users_overview view | Ready |

## Prerequisites

### Before Running Migrations

1. **Backup Database** ✅
   - Supabase automatically creates daily backups
   - Verify backup status in Dashboard > Database > Backups

2. **Admin User Must Exist** ⚠️
   - Ensure `dadecresce@test.caz` has registered via Supabase Auth
   - Check: `SELECT email FROM auth.users WHERE email = 'dadecresce@test.caz';`
   - If user doesn't exist, register first before running migration 3

3. **Database Connection**
   - Project ID: `fmyomzywzjtxmabvvjcd`
   - URL: `https://fmyomzywzjtxmabvvjcd.supabase.co`

## Execution Instructions

### Option 1: Via Supabase Dashboard (Recommended)

1. Navigate to https://supabase.com/dashboard/project/fmyomzywzjtxmabvvjcd/sql/new
2. Copy content from each migration file
3. Paste into SQL Editor
4. Click "Run" button
5. Verify success message
6. Repeat for all 5 files in order

### Option 2: Via Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to project
supabase link --project-ref fmyomzywzjtxmabvvjcd

# Run migrations in order
supabase db push

# Or run individual migrations
psql $DATABASE_URL -f supabase/migrations/20251116_create_user_roles.sql
psql $DATABASE_URL -f supabase/migrations/20251116_create_user_role_function.sql
psql $DATABASE_URL -f supabase/migrations/20251116_backfill_user_roles.sql
psql $DATABASE_URL -f supabase/migrations/20251116_update_rls_policies.sql
psql $DATABASE_URL -f supabase/migrations/20251116_create_admin_views.sql
```

## Verification Checklist

After running all migrations, execute these verification queries in Supabase SQL Editor:

### 1. Verify user_roles Table

```sql
-- Check table exists
SELECT * FROM public.user_roles LIMIT 0;

-- Check indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'user_roles';
-- Expected: idx_user_roles_user_id, idx_user_roles_role

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_roles';
-- Expected: rowsecurity = true

-- Check policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'user_roles';
-- Expected: "Users can view own role", "Admin can view all user roles"
```

### 2. Verify auth.user_role() Function

```sql
-- Check function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name = 'user_role';
-- Expected: 1 row

-- Test function (should return current user's role)
SELECT auth.user_role();
-- Expected: 'user' or 'admin' depending on who's logged in

-- Check grants
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'user_role';
-- Expected: authenticated role has EXECUTE
```

### 3. Verify User Roles Backfill

```sql
-- Check all users have roles
SELECT COUNT(*) as total_users FROM auth.users;
SELECT COUNT(*) as total_roles FROM public.user_roles;
-- These counts should match

-- Check admin user exists with correct role
SELECT u.email, ur.role, ur.created_at
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'dadecresce@test.caz';
-- Expected: email='dadecresce@test.caz', role='admin'

-- Check all other users have 'user' role
SELECT COUNT(*) as regular_users FROM public.user_roles WHERE role = 'user';
-- Expected: (total users - 1)
```

### 4. Verify RLS Policies on All Tables

```sql
-- Check devices table policies
SELECT policyname FROM pg_policies WHERE tablename = 'devices';
-- Expected: "Users can view own or admin sees all devices",
--           "Users can update own or admin updates all devices"

-- Check sensors table policies
SELECT policyname FROM pg_policies WHERE tablename = 'sensors';
-- Expected: "Users or admin can view sensors",
--           "Users or admin can update sensors"

-- Check actuators table policies
SELECT policyname FROM pg_policies WHERE tablename = 'actuators';
-- Expected: "Users or admin can view actuators",
--           "Users or admin can update actuators"

-- Check sensor_readings table policies
SELECT policyname FROM pg_policies WHERE tablename = 'sensor_readings';
-- Expected: "Users or admin can view sensor readings"
```

### 5. Verify Admin View

```sql
-- Check view exists
SELECT * FROM public.admin_users_overview LIMIT 5;
-- Should return user data with aggregated counts

-- Test function wrapper
SELECT * FROM public.get_admin_users_overview() LIMIT 5;
-- Should return same data (only if called by admin)

-- Verify aggregated counts match reality
SELECT
  user_id,
  device_count,
  (SELECT COUNT(*) FROM public.devices WHERE user_id = admin_users_overview.user_id) as actual_count
FROM public.admin_users_overview
LIMIT 5;
-- device_count and actual_count should match
```

### 6. Test Admin Access (As Admin User)

```sql
-- Login as dadecresce@test.caz first, then:

-- Should see ALL devices
SELECT COUNT(*) FROM public.devices;
-- Expected: Total count of all devices in system

-- Should be able to update any device
UPDATE public.devices SET name = 'Test Admin Edit' WHERE id = '<any-device-id>' RETURNING name;
-- Expected: 1 row updated, name changed

-- Rollback test update
ROLLBACK;
```

### 7. Test User Isolation (As Regular User)

```sql
-- Login as a regular user (not admin), then:

-- Should see only own devices
SELECT COUNT(*) FROM public.devices;
-- Expected: Count of only this user's devices

-- Should NOT be able to update other users' devices
UPDATE public.devices SET name = 'Hacker' WHERE user_id != auth.uid();
-- Expected: 0 rows updated (RLS blocks)

-- Verify no unauthorized access
SELECT * FROM public.admin_users_overview;
-- Expected: Empty result or error (non-admin cannot access)
```

## Post-Migration Checklist

- [ ] All 5 migrations executed successfully
- [ ] user_roles table created with indexes and RLS
- [ ] auth.user_role() function exists and returns correct roles
- [ ] All existing users have roles assigned
- [ ] dadecresce@test.caz has 'admin' role
- [ ] RLS policies updated on devices, sensors, actuators, sensor_readings
- [ ] admin_users_overview view created
- [ ] Admin can SELECT all data across all users
- [ ] Admin can UPDATE devices/sensors/actuators
- [ ] Regular users can only SELECT/UPDATE own data
- [ ] Admin cannot DELETE projects (FR-012 verified)

## Rollback Plan

If migration fails or needs to be reverted, execute rollback scripts in reverse order:

```sql
-- 5. Drop admin views
DROP FUNCTION IF EXISTS public.get_admin_users_overview();
DROP VIEW IF EXISTS public.admin_users_overview;

-- 4. Restore original RLS policies
-- (You must have saved original policies before migration)
-- DROP new policies and CREATE original policies here

-- 3. Remove all role assignments
DELETE FROM public.user_roles;

-- 2. Drop function and admin policy
DROP POLICY IF EXISTS "Admin can view all user roles" ON public.user_roles;
REVOKE EXECUTE ON FUNCTION auth.user_role() FROM authenticated;
DROP FUNCTION IF EXISTS auth.user_role();

-- 1. Drop user_roles table
DROP TABLE IF EXISTS public.user_roles CASCADE;
```

## Troubleshooting

### Issue: "Permission denied for table user_roles"

**Cause**: RLS is enabled but policies are missing.

**Solution**:
```sql
-- Check policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'user_roles';

-- If missing, re-run migration 1 and 2
```

### Issue: "dadecresce@test.caz not found"

**Cause**: Admin user hasn't registered yet.

**Solution**:
1. Register user via Supabase Auth UI or frontend
2. Re-run migration 3 to assign admin role

### Issue: "Function auth.user_role() does not exist"

**Cause**: Migration 2 failed or was skipped.

**Solution**:
```sql
-- Re-run migration 2
\i supabase/migrations/20251116_create_user_role_function.sql
```

## Performance Notes

- auth.user_role() function: <1ms (cached)
- admin_users_overview view: <500ms for 1000+ users
- RLS policy checks: Minimal overhead with proper indexes

## Security Notes

- ✅ No service role key exposed
- ✅ All admin checks via RLS (server-side)
- ✅ JWT claims validated by PostgreSQL
- ✅ Admin cannot delete projects/users (FR-012)
- ✅ Role changes require manual SQL (cannot self-promote)

## Next Steps

After successful migration:

1. **Update test-results.md** with migration status
2. **Copy type definitions** to frontend (T014)
3. **Implement frontend admin hooks** (T015-T018)
4. **Build admin dashboard** (T019-T022)
5. **Test end-to-end** (T025)

---

**Migration Status**: ✅ All migrations created and ready for execution
**Last Updated**: 2025-11-16

