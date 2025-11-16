# Data Model: Admin User Role with Multi-Project View

**Feature**: 006-fammi-un-tipo
**Created**: 2025-11-16
**Based on**: [spec.md](./spec.md), [research.md](./research.md)

## Overview

This document defines the data model changes required to support admin user roles with multi-project viewing and editing capabilities. The model extends the existing Supabase schema to add role-based access control while maintaining backward compatibility.

## Database Schema Changes

### New Table: user_roles

Stores user role assignments separate from Supabase Auth for security.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
```

**Fields**:
- `id`: Unique identifier for role record
- `user_id`: References auth.users - the user this role applies to
- `role`: User's role ('user' or 'admin'), defaults to 'user'
- `created_at`: When role was assigned
- `updated_at`: Last role modification timestamp

**Constraints**:
- One role per user (UNIQUE constraint on user_id)
- Role must be either 'user' or 'admin' (CHECK constraint)
- Cascades delete when auth user is deleted

**Validation Rules**:
- Role cannot be empty
- Only 'user' or 'admin' values allowed
- user_id must exist in auth.users

### Modified: Row Level Security Policies

Update existing RLS policies to support admin access bypass.

#### Helper Function (Security Definer)

```sql
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT role
    FROM user_roles
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION auth.user_role() TO authenticated;
```

**Purpose**: Efficiently retrieve current user's role for RLS policies (99.99% performance improvement vs direct queries).

#### Updated Policies for devices Table

```sql
-- SELECT: Users see own devices, admins see all
DROP POLICY IF EXISTS "Users can view own devices" ON devices;
CREATE POLICY "Users can view own or admin sees all devices" ON devices
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    auth.user_role() = 'admin'
  );

-- UPDATE: Users update own devices, admins update all
DROP POLICY IF EXISTS "Users can update own devices" ON devices;
CREATE POLICY "Users can update own or admin updates all devices" ON devices
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR
    auth.user_role() = 'admin'
  );

-- Admin cannot DELETE devices (as per FR-012)
-- Keep existing delete policy unchanged
```

#### Updated Policies for sensors Table

```sql
-- SELECT: Users see own sensors, admins see all
DROP POLICY IF EXISTS "Users can view sensors for their devices" ON sensors;
CREATE POLICY "Users or admin can view sensors" ON sensors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = sensors.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

-- UPDATE: Users update own sensors, admins update all
DROP POLICY IF EXISTS "Users can update sensors for their devices" ON sensors;
CREATE POLICY "Users or admin can update sensors" ON sensors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = sensors.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );
```

#### Updated Policies for actuators Table

```sql
-- Same pattern as sensors
DROP POLICY IF EXISTS "Users can view actuators for their devices" ON actuators;
CREATE POLICY "Users or admin can view actuators" ON actuators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = actuators.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can update actuators for their devices" ON actuators;
CREATE POLICY "Users or admin can update actuators" ON actuators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM devices d
      WHERE d.id = actuators.device_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );
```

#### Updated Policies for sensor_readings Table

```sql
-- Admin can view all readings (needed for admin dashboard)
DROP POLICY IF EXISTS "Users can view readings for their devices" ON sensor_readings;
CREATE POLICY "Users or admin can view sensor readings" ON sensor_readings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sensors s
      JOIN devices d ON d.id = s.device_id
      WHERE s.id = sensor_readings.sensor_id
      AND (d.user_id = auth.uid() OR auth.user_role() = 'admin')
    )
  );
```

## Entity Relationships

```
auth.users (Supabase Auth)
    |
    | 1:1
    |
user_roles
    | role: 'user' | 'admin'
    |
    | 1:N (for regular users)
    | 1:* (admin can view all)
    |
devices
    |
    | 1:N
    |
    +-- sensors
    |     |
    |     | 1:N
    |     |
    |     +-- sensor_readings
    |
    +-- actuators
```

## State Transitions

### User Role Lifecycle

```
[New User Registered]
        |
        v
   role = 'user' (default)
        |
        |--[Manual Admin Assignment]-->  role = 'admin'
        |
        |--[Account Deletion]-->  [Role Record Deleted (CASCADE)]
```

**Transitions**:
1. **Registration**: New user automatically gets 'user' role via trigger
2. **Admin Assignment**: Manual SQL or migration script sets role to 'admin' for dadecresce@test.caz
3. **Deletion**: When auth.users record is deleted, user_roles record is automatically removed (CASCADE)

**Constraints on Transitions**:
- Cannot transition from 'admin' back to 'user' programmatically (requires manual SQL for safety)
- No automatic admin assignment (must be explicit)
- Deletion is one-way (no soft deletes)

## Admin User Initialization

### Migration Script for dadecresce@test.caz

```sql
-- Ensure admin user exists in auth.users
-- (Assumes user has already registered via Supabase Auth)

-- Assign admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'dadecresce@test.caz'
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin', updated_at = now();
```

**Execution**: Run this migration after user dadecresce@test.caz has registered in the system.

## Views for Admin Dashboard

### View: admin_users_overview

Aggregates user statistics for admin dashboard.

```sql
CREATE OR REPLACE VIEW admin_users_overview AS
SELECT
  u.id as user_id,
  u.email,
  ur.role,
  u.created_at as user_created_at,
  COUNT(DISTINCT d.id) as device_count,
  COUNT(DISTINCT s.id) as sensor_count,
  COUNT(DISTINCT a.id) as actuator_count,
  MAX(sr.timestamp) as last_activity
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN devices d ON d.user_id = u.id
LEFT JOIN sensors s ON s.device_id = d.id
LEFT JOIN actuators a ON a.device_id = d.id
LEFT JOIN sensor_readings sr ON sr.sensor_id = s.id
GROUP BY u.id, u.email, ur.role, u.created_at;

-- Grant SELECT to authenticated users with RLS
ALTER VIEW admin_users_overview OWNER TO authenticated;

-- RLS policy for view
CREATE POLICY "Admin can view users overview" ON admin_users_overview
  FOR SELECT
  USING (auth.user_role() = 'admin');
```

**Purpose**: Provides aggregated data for admin dashboard (User Story 1 - P1).

**Fields**:
- `user_id`: User UUID
- `email`: User email address
- `role`: User's current role
- `user_created_at`: When user registered
- `device_count`: Total devices owned by user
- `sensor_count`: Total sensors across all user's devices
- `actuator_count`: Total actuators across all user's devices
- `last_activity`: Most recent sensor reading timestamp

## Validation Rules Summary

| Entity | Field | Rule | Error Message |
|--------|-------|------|---------------|
| user_roles | role | Must be 'user' or 'admin' | "Invalid role. Must be 'user' or 'admin'" |
| user_roles | user_id | Must exist in auth.users | "User not found" |
| user_roles | user_id | Must be unique | "User already has a role assigned" |

## Performance Considerations

### Indexes

All performance-critical indexes are defined:
- `idx_user_roles_user_id`: Fast lookup of user's role
- `idx_user_roles_role`: Fast filtering by role (e.g., list all admins)
- Existing indexes on devices.user_id, sensors.device_id, etc.

### Query Optimization

- Use `auth.user_role()` security definer function instead of JOINing user_roles in RLS policies (99.99% faster)
- Admin dashboard view pre-aggregates counts (avoid N+1 queries)
- Cursor-based pagination for large user lists (see quickstart.md)

## Security Considerations

### Protection Measures

1. **Role Immutability**: user_roles table has no public UPDATE policy - roles can only be changed via migration scripts or admin SQL
2. **Admin Verification**: All RLS policies check `auth.user_role() = 'admin'` to verify admin status
3. **No Service Role Exposure**: Frontend never uses service role key - all admin checks via RLS
4. **Cascade Deletion**: Role records deleted when user account is deleted (no orphaned roles)
5. **No Admin Self-Assignment**: No API endpoint allows users to set their own role to 'admin'

### Audit Trail (Future Enhancement - Out of Scope)

For production systems, consider adding:
- `admin_audit_log` table to track admin actions
- Trigger on UPDATE/DELETE operations to log who performed action
- Retention policy for audit logs

## Migration Strategy

### Step 1: Create user_roles Table

```sql
-- Run as database owner/admin
-- File: supabase/migrations/20251116_create_user_roles.sql

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admin can view all roles
CREATE POLICY "Admin can view all user roles" ON user_roles
  FOR SELECT
  USING (auth.user_role() = 'admin');

-- Users can view their own role
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());
```

### Step 2: Create Helper Function

```sql
-- File: supabase/migrations/20251116_create_user_role_function.sql

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid()),
    'user'  -- Default to 'user' if no role record exists
  );
END;
$$;

GRANT EXECUTE ON FUNCTION auth.user_role() TO authenticated;
```

### Step 3: Backfill Existing Users

```sql
-- File: supabase/migrations/20251116_backfill_user_roles.sql

-- Assign default 'user' role to all existing users
INSERT INTO user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Assign admin role to dadecresce@test.caz
UPDATE user_roles
SET role = 'admin', updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'dadecresce@test.caz');
```

### Step 4: Update RLS Policies

```sql
-- File: supabase/migrations/20251116_update_rls_policies.sql

-- (Include all DROP POLICY / CREATE POLICY statements from "Modified: Row Level Security Policies" section above)
```

### Step 5: Create Admin Dashboard View

```sql
-- File: supabase/migrations/20251116_create_admin_views.sql

-- (Include admin_users_overview view definition from above)
```

### Rollback Plan

If migration fails or needs to be reverted:

```sql
-- Drop in reverse order
DROP VIEW IF EXISTS admin_users_overview;
DROP POLICY IF EXISTS "Admin can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP FUNCTION IF EXISTS auth.user_role();
DROP TABLE IF EXISTS user_roles CASCADE;

-- Restore original RLS policies (from backup)
-- ... (restore original policies)
```

## Testing Data Scenarios

### Test Data Setup

```sql
-- Create test users
INSERT INTO auth.users (id, email) VALUES
  ('user1-uuid', 'user1@test.com'),
  ('user2-uuid', 'user2@test.com'),
  ('admin-uuid', 'dadecresce@test.caz');

-- Assign roles
INSERT INTO user_roles (user_id, role) VALUES
  ('user1-uuid', 'user'),
  ('user2-uuid', 'user'),
  ('admin-uuid', 'admin');

-- Create test devices
INSERT INTO devices (id, user_id, name) VALUES
  ('device1-uuid', 'user1-uuid', 'User1 Greenhouse'),
  ('device2-uuid', 'user2-uuid', 'User2 Greenhouse');
```

### Test Scenarios

1. **Admin Views All Projects**: Logged in as dadecresce@test.caz, SELECT from devices should return both device1-uuid and device2-uuid
2. **Regular User Views Own Only**: Logged in as user1@test.com, SELECT from devices should return only device1-uuid
3. **Admin Edits User Project**: Logged in as admin, UPDATE device2-uuid (owned by user2) should succeed
4. **Regular User Cannot Edit Others**: Logged in as user1, UPDATE device2-uuid should fail (RLS violation)
5. **Admin Cannot Delete Projects**: Logged in as admin, DELETE device should fail (no DELETE policy with admin bypass)

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [research.md](./research.md) - Implementation research and best practices
