# Admin Role Feature - Developer Quickstart Guide

**Feature**: 006-fammi-un-tipo
**Created**: 2025-11-16
**Target**: Developers implementing the admin role feature

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Database Setup](#2-database-setup)
3. [Implementation Steps by Priority](#3-implementation-steps-by-priority)
4. [Code Examples](#4-code-examples)
5. [Testing Guide](#5-testing-guide)
6. [Common Pitfalls](#6-common-pitfalls)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Getting Started

### Prerequisites

- PostgreSQL 15+ (Supabase)
- Node.js 18+
- TypeScript 5.9.3
- React 19
- Existing Serra project setup

### Project Context

This feature adds an admin user role to allow a designated user (`dadecresce@test.caz`) to view and manage all users' greenhouse projects. The implementation leverages:

- **Backend**: Supabase PostgreSQL with Row Level Security (RLS)
- **Frontend**: React + TypeScript + React Query
- **Auth**: Supabase Auth with custom JWT claims

### Tech Stack Overview

```
Frontend (React + TypeScript)
    |
    ├── React Query Hooks (admin-hooks.contract.ts)
    |       |
    |       └── API Layer (admin-api.contract.ts)
    |               |
    |               └── Supabase Client
    |
Backend (Supabase PostgreSQL)
    |
    ├── user_roles table
    ├── admin_users_overview view
    ├── auth.user_role() function (Security Definer)
    └── RLS Policies (admin bypass)
```

### File Locations

```
frontend/
  src/
    lib/
      hooks/
        useAdmin.ts         # Admin-specific React hooks (create new)
    services/
      admin.service.ts      # Admin API service (create new)
    pages/
      Admin.page.tsx        # Admin dashboard (create new)
      AdminUserDetail.page.tsx  # User detail view (create new)
    components/
      admin/                # Admin UI components (create new)
        UserListTable.tsx
        UserDetailCard.tsx
        ProjectEditForm.tsx

specs/006-fammi-un-tipo/
  contracts/
    admin.types.ts          # Type definitions (already exists)
    admin-api.contract.ts   # API contracts (already exists)
    admin-hooks.contract.ts # Hook contracts (already exists)
```

---

## 2. Database Setup

### Step 1: Create user_roles Table

Execute this migration first. This creates the foundation for role management.

```sql
-- File: supabase/migrations/20251116_create_user_roles.sql

-- Create user_roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own role
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: Admin policy will be added after auth.user_role() function is created
```

**Verification**:
```sql
-- Check table was created
SELECT * FROM user_roles LIMIT 0;

-- Check indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'user_roles';
```

### Step 2: Create auth.user_role() Helper Function

This security definer function provides fast role lookups in RLS policies (99.99% performance improvement vs direct queries).

```sql
-- File: supabase/migrations/20251116_create_user_role_function.sql

-- Create helper function to get user's role
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.user_role() TO authenticated;

-- Now add the admin policy for user_roles table
CREATE POLICY "Admin can view all user roles" ON user_roles
  FOR SELECT
  USING (auth.user_role() = 'admin');
```

**Verification**:
```sql
-- Test function (should return 'user' for non-admin)
SELECT auth.user_role();

-- Check grants
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'user_role';
```

### Step 3: Backfill Existing Users

Assign default 'user' role to all existing users, then promote dadecresce@test.caz to admin.

```sql
-- File: supabase/migrations/20251116_backfill_user_roles.sql

-- Assign default 'user' role to all existing users
INSERT INTO user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Promote dadecresce@test.caz to admin
-- IMPORTANT: This user must exist in auth.users first (manual registration required)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'dadecresce@test.caz'
ON CONFLICT (user_id)
DO UPDATE SET role = 'admin', updated_at = now();
```

**Verification**:
```sql
-- Check all users have roles
SELECT COUNT(*) FROM auth.users;
SELECT COUNT(*) FROM user_roles;
-- These counts should match

-- Check admin user exists
SELECT ur.role, u.email
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'dadecresce@test.caz';
-- Should return: role='admin', email='dadecresce@test.caz'
```

### Step 4: Update RLS Policies for Admin Bypass

Update existing RLS policies on devices, sensors, actuators, and sensor_readings to allow admin access.

```sql
-- File: supabase/migrations/20251116_update_rls_policies.sql

-- ============================================================================
-- DEVICES TABLE
-- ============================================================================

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

-- DELETE: Keep existing policy (admin cannot delete - FR-012)

-- ============================================================================
-- SENSORS TABLE
-- ============================================================================

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

-- ============================================================================
-- ACTUATORS TABLE
-- ============================================================================

-- SELECT: Users see own actuators, admins see all
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

-- UPDATE: Users update own actuators, admins update all
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

-- ============================================================================
-- SENSOR_READINGS TABLE
-- ============================================================================

-- SELECT: Admin can view all readings (for dashboard and troubleshooting)
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

**Verification**:
```sql
-- Test as admin user (use Supabase SQL Editor with auth context)
SET request.jwt.claims.sub = '<admin-user-id>';
SET request.jwt.claims.user_role = 'admin';

-- Should see ALL devices
SELECT COUNT(*) FROM devices;

-- Test as regular user
SET request.jwt.claims.sub = '<regular-user-id>';
SET request.jwt.claims.user_role = 'user';

-- Should see only own devices
SELECT COUNT(*) FROM devices;
```

### Step 5: Create Admin Dashboard View

This view pre-aggregates statistics for the admin dashboard.

```sql
-- File: supabase/migrations/20251116_create_admin_views.sql

-- Create aggregated view for admin dashboard
CREATE OR REPLACE VIEW admin_users_overview AS
SELECT
  u.id as user_id,
  u.email,
  COALESCE(ur.role, 'user') as role,
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

-- Enable RLS on view (Supabase automatically creates RLS-aware views)
-- Policy: Only admins can query this view
CREATE POLICY "Admin can view users overview" ON admin_users_overview
  FOR SELECT
  USING (auth.user_role() = 'admin');
```

**Verification**:
```sql
-- Test as admin
SELECT * FROM admin_users_overview LIMIT 5;

-- Test as non-admin (should return empty or error)
-- Switch to non-admin user context and try same query
```

### Migration Checklist

Before proceeding to frontend implementation:

- [ ] All 5 migration files executed successfully
- [ ] `user_roles` table exists with indexes
- [ ] `auth.user_role()` function exists and returns correct role
- [ ] dadecresce@test.caz has 'admin' role in user_roles table
- [ ] All existing users have 'user' role
- [ ] RLS policies updated on devices, sensors, actuators, sensor_readings
- [ ] admin_users_overview view exists
- [ ] Admin can query all tables, regular users see only own data

---

## 3. Implementation Steps by Priority

The feature is broken into 4 user stories with different priorities (P1-P4). Implement incrementally for faster delivery and feedback.

### Phase 1: P1 - Admin Views All User Projects (MVP)

**Goal**: Admin can see a list of all users and their projects.

**Duration**: 3-5 days

**Tasks**:

1. **Create Type Definitions** (Day 1)
   - Copy `specs/006-fammi-un-tipo/contracts/admin.types.ts` to `frontend/src/types/`
   - Verify TypeScript compilation

2. **Create Admin API Service** (Day 1-2)
   - Create `frontend/src/services/admin.service.ts`
   - Implement `getUserRole()` and `getAllUsersWithProjects()`
   - Test with Supabase client

3. **Create Admin React Hooks** (Day 2)
   - Create `frontend/src/lib/hooks/useAdmin.ts`
   - Implement `useUserRole()` and `useAdminUsersOverview()`
   - Set up React Query cache configuration

4. **Build Admin Dashboard Page** (Day 3-4)
   - Create `frontend/src/pages/Admin.page.tsx`
   - Display users table with device/sensor/actuator counts
   - Add role-based route protection
   - Style with Tailwind CSS (match existing pages)

5. **Add Admin Navigation** (Day 4)
   - Update navigation to show "Admin" link only for admins
   - Use `useUserRole()` hook for conditional rendering

6. **Test & Deploy** (Day 5)
   - Test as admin user (dadecresce@test.caz)
   - Test as regular user (should not see admin UI)
   - Deploy to staging

**Deliverable**: Admin can view list of all users with project statistics.

### Phase 2: P2 - Admin Project Search and Filtering

**Goal**: Admin can search and filter users by email, activity, device count.

**Duration**: 2-3 days

**Tasks**:

1. **Implement Search API** (Day 1)
   - Add `searchUsers()` to admin.service.ts
   - Implement client-side filtering (move to SQL later for performance)

2. **Create Search UI Components** (Day 1-2)
   - Add search input with debouncing
   - Add filter dropdowns (activity, device count)
   - Add pagination controls

3. **Integrate with React Query** (Day 2)
   - Use `useAdminUsersList()` hook
   - Implement `keepPreviousData` for smooth transitions

4. **Test & Deploy** (Day 3)
   - Test search by email
   - Test filters (active users, inactive users, device count)
   - Deploy to staging

**Deliverable**: Admin can quickly find specific users using search and filters.

### Phase 3: P3 - Admin Edits User Project Configurations

**Goal**: Admin can modify devices, sensors, actuators for troubleshooting.

**Duration**: 3-4 days

**Tasks**:

1. **Implement Update APIs** (Day 1)
   - Add `updateDevice()`, `updateSensor()`, `updateActuator()` to admin.service.ts
   - Test mutations with Supabase client

2. **Create Mutation Hooks** (Day 1-2)
   - Implement `useUpdateDevice()`, `useUpdateSensor()`, `useUpdateActuator()`
   - Configure cache invalidation on success

3. **Build Edit Forms** (Day 2-3)
   - Create inline edit forms for device/sensor/actuator names
   - Add "Editing as Admin" badge (FR-013)
   - Disable delete operations (FR-012)

4. **Test Real-time Updates** (Day 3-4)
   - Verify changes visible to project owner
   - Test optimistic updates
   - Handle errors gracefully

5. **Deploy** (Day 4)
   - Deploy to staging
   - Test with multiple users simultaneously

**Deliverable**: Admin can edit configurations on behalf of users.

### Phase 4: P4 - Admin Views Detailed Project Information

**Goal**: Admin can view comprehensive project details including recent readings.

**Duration**: 2-3 days

**Tasks**:

1. **Implement Detail APIs** (Day 1)
   - Add `getUserDetail()` and `getProjectDetails()` to admin.service.ts
   - Fetch recent readings and activity summary

2. **Create Detail View Components** (Day 1-2)
   - Create UserDetailCard component
   - Create ProjectDetailCard component
   - Display recent sensor readings with charts

3. **Add Navigation** (Day 2)
   - Add "View Details" button on user rows
   - Implement drill-down from list to detail view
   - Add breadcrumbs

4. **Test & Deploy** (Day 3)
   - Verify all data displays correctly
   - Test navigation flow
   - Deploy to production

**Deliverable**: Admin can troubleshoot issues by viewing detailed project data.

---

## 4. Code Examples

### 4.1 Admin Route Setup

**File**: `frontend/src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminPage } from './pages/Admin.page';
import { DashboardPage } from './pages/Dashboard.page';
import { useAuth } from './lib/hooks/useAuth';
import { useUserRole } from './lib/hooks/useAdmin';
import { supabase } from './lib/supabase';

const queryClient = new QueryClient();

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: role, isLoading } = useUserRole(supabase);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Regular user routes */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/dati" element={<DatiPage />} />

          {/* Admin-only routes */}
          <Route
            path="/admin"
            element={
              <ProtectedAdminRoute>
                <AdminPage />
              </ProtectedAdminRoute>
            }
          />

          {/* Unauthorized page */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

### 4.2 Admin Dashboard Component

**File**: `frontend/src/pages/Admin.page.tsx`

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Filter } from 'lucide-react';
import { useAdminUsersOverview } from '../lib/hooks/useAdmin';
import { supabase } from '../lib/supabase';
import type { AdminUsersOverview } from '../types/admin.types';

export function AdminPage() {
  const { data: users, isLoading, error } = useAdminUsersOverview(supabase);
  const [searchTerm, setSearchTerm] = useState('');

  // Client-side filtering (move to API for production)
  const filteredUsers = users?.filter((user) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Access Denied
            </h2>
            <p className="text-sm text-red-700">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
            </div>
            <Link
              to="/"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-4">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email..."
              className="flex-1 border-0 focus:ring-0 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Devices
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sensors
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actuators
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers?.map((user) => (
                <UserRow key={user.user_id} user={user} />
              ))}
            </tbody>
          </table>

          {filteredUsers?.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function UserRow({ user }: { user: AdminUsersOverview }) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {user.email}
            </div>
            {user.role === 'admin' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                Admin
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {user.device_count}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {user.sensor_count}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {user.actuator_count}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(user.last_activity)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <Link
          to={`/admin/users/${user.user_id}`}
          className="text-purple-600 hover:text-purple-900"
        >
          View Details
        </Link>
      </td>
    </tr>
  );
}
```

### 4.3 User List with Search/Filter (P2)

**File**: `frontend/src/components/admin/UserListTable.tsx`

```typescript
import { useState } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { useAdminUsersList } from '../../lib/hooks/useAdmin';
import { supabase } from '../../lib/supabase';
import type { AdminSearchFilters } from '../../types/admin.types';

export function UserListTable() {
  const [filters, setFilters] = useState<AdminSearchFilters>({
    email: '',
    active_within_days: undefined,
    page_size: 20,
  });

  const { data, isLoading } = useAdminUsersList(supabase, filters);

  const handleSearchChange = (email: string) => {
    setFilters((prev) => ({ ...prev, email, cursor: undefined }));
  };

  const handleActivityFilter = (days: number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      active_within_days: days,
      cursor: undefined,
    }));
  };

  const handleLoadMore = () => {
    if (data?.next_cursor) {
      setFilters((prev) => ({ ...prev, cursor: data.next_cursor! }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex items-center space-x-4">
          {/* Search Input */}
          <div className="flex-1 flex items-center space-x-2">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email..."
              className="flex-1 border-0 focus:ring-0 text-sm"
              value={filters.email}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Activity Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              className="border-gray-300 rounded-md text-sm"
              value={filters.active_within_days || ''}
              onChange={(e) =>
                handleActivityFilter(
                  e.target.value ? Number(e.target.value) : undefined
                )
              }
            >
              <option value="">All Activity</option>
              <option value="1">Active today</option>
              <option value="7">Active last 7 days</option>
              <option value="30">Active last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Devices
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.data.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.device_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.last_activity
                        ? new Date(user.last_activity).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-purple-600 hover:text-purple-900">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Load More Button */}
            {data?.has_more && (
              <div className="px-6 py-4 bg-gray-50 border-t">
                <button
                  onClick={handleLoadMore}
                  className="w-full flex items-center justify-center space-x-2 text-sm text-purple-600 hover:text-purple-900"
                >
                  <span>Load More</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

### 4.4 Project Detail View with Edit (P3 + P4)

**File**: `frontend/src/pages/AdminUserDetail.page.tsx`

```typescript
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X } from 'lucide-react';
import { useAdminUserDetail, useUpdateDevice } from '../lib/hooks/useAdmin';
import { supabase } from '../lib/supabase';

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { data: userDetail, isLoading } = useAdminUserDetail(supabase, userId || null);
  const updateDeviceMutation = useUpdateDevice(supabase);

  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!userDetail) {
    return <div className="p-8 text-center text-red-600">User not found</div>;
  }

  const handleStartEdit = (deviceId: string, currentName: string) => {
    setEditingDeviceId(deviceId);
    setEditedName(currentName);
  };

  const handleSaveEdit = (deviceId: string) => {
    updateDeviceMutation.mutate(
      {
        device_id: deviceId,
        updates: { name: editedName },
      },
      {
        onSuccess: () => {
          setEditingDeviceId(null);
          alert('Device updated successfully');
        },
        onError: (error) => {
          alert(`Error: ${error.message}`);
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingDeviceId(null);
    setEditedName('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/admin"
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {userDetail.email}
              </h1>
            </div>
            {/* Admin Edit Badge */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              Editing as Admin
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Devices" value={userDetail.device_count} />
          <StatCard label="Sensors" value={userDetail.sensor_count} />
          <StatCard label="Actuators" value={userDetail.actuator_count} />
          <StatCard
            label="Last Active"
            value={
              userDetail.last_activity
                ? new Date(userDetail.last_activity).toLocaleDateString()
                : 'Never'
            }
          />
        </div>

        {/* Devices List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Devices</h2>
          {userDetail.devices.map((device) => (
            <div
              key={device.id}
              className="bg-white shadow rounded-lg p-6"
            >
              {/* Device Header with Inline Edit */}
              <div className="flex items-center justify-between mb-4">
                {editingDeviceId === device.id ? (
                  <div className="flex items-center space-x-2 flex-1">
                    <input
                      type="text"
                      className="flex-1 border-gray-300 rounded-md text-lg font-medium"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(device.id)}
                      disabled={updateDeviceMutation.isLoading}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Save className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-gray-900">
                      {device.name}
                    </h3>
                    <button
                      onClick={() => handleStartEdit(device.id, device.name)}
                      className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Device Info */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className="font-medium">
                    {device.connection_status || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Firmware:</span>{' '}
                  <span className="font-medium">
                    {device.firmware_version || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Sensors */}
              {device.sensors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Sensors ({device.sensors.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {device.sensors.map((sensor) => (
                      <div
                        key={sensor.id}
                        className="p-3 bg-gray-50 rounded"
                      >
                        <div className="text-sm font-medium">
                          {sensor.name || sensor.sensor_type}
                        </div>
                        <div className="text-xs text-gray-500">
                          {sensor.latest_reading ? (
                            <>
                              {sensor.latest_reading.value} {sensor.unit}
                            </>
                          ) : (
                            'No readings'
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actuators */}
              {device.actuators.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Actuators ({device.actuators.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {device.actuators.map((actuator) => (
                      <div
                        key={actuator.id}
                        className="p-3 bg-gray-50 rounded"
                      >
                        <div className="text-sm font-medium">
                          {actuator.name || actuator.actuator_type}
                        </div>
                        <div className="text-xs text-gray-500">
                          State: {actuator.current_state}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {userDetail.devices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No devices registered
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
```

### 4.5 Role-Based Navigation

**File**: Update existing navigation component

```typescript
// Add to existing navigation (e.g., in DashboardPage or App.tsx)
import { useUserRole } from '../lib/hooks/useAdmin';
import { supabase } from '../lib/supabase';

function Navigation() {
  const { data: role } = useUserRole(supabase);

  return (
    <nav className="space-y-2">
      <Link to="/" className="nav-link">
        Dashboard
      </Link>
      <Link to="/devices" className="nav-link">
        Devices
      </Link>
      <Link to="/dati" className="nav-link">
        Data
      </Link>

      {/* Admin-only link */}
      {role === 'admin' && (
        <Link
          to="/admin"
          className="nav-link bg-purple-50 text-purple-700 hover:bg-purple-100"
        >
          Admin Panel
        </Link>
      )}
    </nav>
  );
}
```

---

## 5. Testing Guide

### 5.1 Database Testing

**Test RLS Policies**:

```sql
-- Test as admin user
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims.sub = '<admin-user-id>';
SET LOCAL request.jwt.claims.user_role = 'admin';

-- Should return ALL devices
SELECT COUNT(*) FROM devices;
-- Expected: Total count of all devices in system

-- Should be able to update any device
UPDATE devices SET name = 'Test Admin Edit' WHERE id = '<any-device-id>';
-- Expected: 1 row updated

ROLLBACK;

-- Test as regular user
BEGIN;
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims.sub = '<regular-user-id>';
SET LOCAL request.jwt.claims.user_role = 'user';

-- Should return only own devices
SELECT COUNT(*) FROM devices;
-- Expected: Count of only this user's devices

-- Should NOT be able to update other users' devices
UPDATE devices SET name = 'Hacker' WHERE user_id != '<regular-user-id>';
-- Expected: 0 rows updated (RLS blocks)

ROLLBACK;
```

**Test admin_users_overview View**:

```sql
-- As admin
SELECT * FROM admin_users_overview LIMIT 5;
-- Expected: Returns 5 user records with aggregated stats

-- As non-admin
-- Switch to non-admin user context
SELECT * FROM admin_users_overview;
-- Expected: Empty result or error
```

### 5.2 API Testing

Create a test file: `frontend/src/services/admin.service.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '../lib/supabase';
import { getUserRole, getAllUsersWithProjects } from './admin.service';

describe('Admin API', () => {
  beforeAll(async () => {
    // Sign in as admin user
    await supabase.auth.signInWithPassword({
      email: 'dadecresce@test.caz',
      password: 'admin-password',
    });
  });

  it('should return admin role for admin user', async () => {
    const role = await getUserRole(supabase);
    expect(role).toBe('admin');
  });

  it('should fetch all users for admin', async () => {
    const users = await getAllUsersWithProjects(supabase);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0]).toHaveProperty('email');
    expect(users[0]).toHaveProperty('device_count');
  });

  it('should throw error for non-admin', async () => {
    // Sign in as regular user
    await supabase.auth.signInWithPassword({
      email: 'regular@user.com',
      password: 'password',
    });

    await expect(getAllUsersWithProjects(supabase)).rejects.toThrow();
  });
});
```

### 5.3 Component Testing

**Test Admin Dashboard Rendering**:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AdminPage } from '../pages/Admin.page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('AdminPage', () => {
  it('should render admin dashboard', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });

  it('should display users table', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AdminPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText(/User/i)).toBeInTheDocument();
    });
  });
});
```

### 5.4 E2E Testing (Manual)

**Test Scenario 1: Admin Access**

1. Navigate to `http://localhost:5173/login`
2. Login as `dadecresce@test.caz`
3. Navigate to Dashboard
4. Verify "Admin Panel" link appears in navigation
5. Click "Admin Panel" link
6. Verify admin dashboard loads
7. Verify table shows all users (not just current user)

**Test Scenario 2: Regular User Cannot Access Admin**

1. Login as regular user (e.g., `user@example.com`)
2. Navigate to Dashboard
3. Verify "Admin Panel" link does NOT appear
4. Manually navigate to `http://localhost:5173/admin`
5. Verify redirect to `/unauthorized`

**Test Scenario 3: Search and Filter**

1. Login as admin
2. Navigate to Admin Panel
3. Type partial email in search box
4. Verify table filters to matching users only
5. Select "Active last 7 days" filter
6. Verify only recently active users shown

**Test Scenario 4: Admin Edits Device**

1. Login as admin
2. Navigate to Admin Panel
3. Click "View Details" on any user
4. Click edit icon on a device name
5. Change device name
6. Click save
7. Verify success message
8. Login as device owner in different browser
9. Verify device name changed

### 5.5 Performance Testing

**Test Query Performance**:

```sql
-- Check admin_users_overview query speed
EXPLAIN ANALYZE
SELECT * FROM admin_users_overview;
-- Expected: < 100ms for thousands of users

-- Check device query with admin bypass
EXPLAIN ANALYZE
SELECT * FROM devices WHERE auth.user_role() = 'admin';
-- Expected: Uses index, < 50ms
```

**Test React Query Caching**:

```typescript
// Open React Query DevTools
// Verify:
// - 'admin-users-overview' query cached for 5 minutes
// - 'admin-user-role' query cached for 1 hour
// - Mutations invalidate related queries
```

---

## 6. Common Pitfalls

### 6.1 RLS Policy Mistakes

**Pitfall**: Forgetting to add admin bypass to all relevant policies.

```sql
-- WRONG: Only added admin bypass to SELECT
CREATE POLICY "Users can update own devices" ON devices
  FOR UPDATE
  USING (user_id = auth.uid());

-- CORRECT: Add admin bypass to UPDATE too
CREATE POLICY "Users can update own or admin updates all" ON devices
  FOR UPDATE
  USING (user_id = auth.uid() OR auth.user_role() = 'admin');
```

**Pitfall**: Using `user_metadata` instead of custom table (security risk).

```sql
-- WRONG: user_metadata can be modified by users
SELECT raw_user_meta_data->>'role' FROM auth.users;

-- CORRECT: Use separate user_roles table
SELECT role FROM user_roles WHERE user_id = auth.uid();
```

### 6.2 Frontend Mistakes

**Pitfall**: Trusting client-side role check alone.

```typescript
// WRONG: Only client-side check
function AdminDashboard() {
  const { data: role } = useUserRole();
  if (role !== 'admin') return <div>Access denied</div>;
  // Fetch sensitive data without server validation
}

// CORRECT: RLS policies enforce on server
// Client-side check is for UX only, RLS blocks unauthorized access
```

**Pitfall**: Not handling loading states properly.

```typescript
// WRONG: Shows admin UI briefly before role loads
function Navigation() {
  const { data: role } = useUserRole();
  return <>{role === 'admin' && <AdminLink />}</>;
}

// CORRECT: Hide until loaded
function Navigation() {
  const { data: role, isLoading } = useUserRole();
  if (isLoading) return null;
  return <>{role === 'admin' && <AdminLink />}</>;
}
```

### 6.3 Performance Issues

**Pitfall**: Not using security definer function in RLS policies.

```sql
-- SLOW: Queries user_roles table for every row
CREATE POLICY "example" ON devices
  FOR SELECT
  USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
  );

-- FAST: Uses cached security definer function (99.99% faster)
CREATE POLICY "example" ON devices
  FOR SELECT
  USING (auth.user_role() = 'admin');
```

**Pitfall**: Client-side filtering instead of SQL.

```typescript
// SLOW: Fetches all data then filters in JavaScript
const { data: allUsers } = useAdminUsersOverview();
const filteredUsers = allUsers.filter(u => u.email.includes(search));

// FAST: Filter in SQL query
const { data: filteredUsers } = useAdminUsersList({ email: search });
```

### 6.4 Security Issues

**Pitfall**: Exposing service role key to frontend.

```typescript
// NEVER DO THIS
const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);

// ALWAYS use anon key with RLS
const supabase = createClient(url, ANON_KEY);
```

**Pitfall**: Allowing admin to delete users/projects.

```sql
-- WRONG: Gives admin DELETE permission
CREATE POLICY "Admin can delete" ON devices
  FOR DELETE
  USING (auth.user_role() = 'admin');

-- CORRECT: No DELETE policy for admin (FR-012)
-- Only owner can delete their own devices
```

---

## 7. Troubleshooting

### Issue: "Permission denied for table user_roles"

**Cause**: RLS is enabled but policies are missing.

**Solution**:
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_roles';

-- Check policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'user_roles';

-- If missing, recreate policies
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());
```

### Issue: "admin_users_overview returns empty for admin"

**Cause**: RLS policy on view is incorrect or function auth.user_role() not working.

**Solution**:
```sql
-- Test function directly
SELECT auth.user_role();
-- Should return 'admin' when logged in as admin

-- Check view policy
SELECT policyname FROM pg_policies WHERE tablename = 'admin_users_overview';

-- If missing, recreate
CREATE POLICY "Admin can view users overview" ON admin_users_overview
  FOR SELECT
  USING (auth.user_role() = 'admin');
```

### Issue: "Admin sees only own devices, not all"

**Cause**: RLS policy not updated or security definer function not granted.

**Solution**:
```sql
-- Check policy
SELECT policyname, definition FROM pg_policies WHERE tablename = 'devices';

-- Should include: auth.user_role() = 'admin'

-- Check function grants
SELECT routine_name, grantee FROM information_schema.routine_privileges
WHERE routine_name = 'user_role';

-- Should show: authenticated role has EXECUTE
```

### Issue: "useUserRole() returns 'user' for admin"

**Cause**: user_roles table not populated or JWT not refreshed.

**Solution**:
```sql
-- Check user_roles table
SELECT u.email, ur.role
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE u.email = 'dadecresce@test.caz';

-- Should return: role='admin'
```

If role is correct but hook returns 'user':
```typescript
// Force JWT refresh
await supabase.auth.refreshSession();

// Then re-query
const role = await getUserRole(supabase);
```

### Issue: "React Query not invalidating after mutation"

**Cause**: Incorrect query key invalidation.

**Solution**:
```typescript
// WRONG: Typo in query key
queryClient.invalidateQueries(['admin-users']); // Doesn't match

// CORRECT: Use AdminQueryKeys constants
queryClient.invalidateQueries(AdminQueryKeys.usersOverview());
```

### Issue: "Admin edits not visible to project owner"

**Cause**: Frontend cache not refreshing or real-time not enabled.

**Solution**:

1. Check if Supabase Realtime is enabled:
```sql
-- Enable realtime on devices table
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
```

2. Verify React Query refetches:
```typescript
// Owner's component should refetch on window focus
const { data } = useQuery({
  queryKey: ['devices'],
  queryFn: getDevices,
  refetchOnWindowFocus: true, // Important!
});
```

### Issue: "Performance degradation with many users"

**Cause**: Missing indexes or inefficient queries.

**Solution**:
```sql
-- Add missing indexes
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_sensors_device_id ON sensors(device_id);
CREATE INDEX idx_sensor_readings_sensor_id ON sensor_readings(sensor_id);

-- Check query plans
EXPLAIN ANALYZE SELECT * FROM admin_users_overview;

-- Look for "Seq Scan" - indicates missing index
```

### Issue: "TypeScript errors in contract files"

**Cause**: Contract files not in TypeScript include path.

**Solution**:

Update `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@contracts/*": ["../specs/006-fammi-un-tipo/contracts/*"]
    }
  },
  "include": [
    "src/**/*",
    "../specs/006-fammi-un-tipo/contracts/**/*"
  ]
}
```

Or copy contracts to `frontend/src/types/`:
```bash
cp specs/006-fammi-un-tipo/contracts/*.ts frontend/src/types/
```

---

## Additional Resources

### Documentation References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Custom Claims](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
- [Research](./research.md)
- [API Contracts](./contracts/README.md)

### Quick Command Reference

```bash
# Database migrations
psql $DATABASE_URL -f supabase/migrations/20251116_create_user_roles.sql

# Frontend development
cd frontend
npm install
npm run dev

# Run tests
npm run test

# Type checking
npm run type-check

# Build for production
npm run build
```

### Support

For questions or issues:
1. Check [research.md](./research.md) for implementation patterns
2. Review [contracts/README.md](./contracts/README.md) for API usage
3. Search existing issues in project repository
4. Create new issue with detailed reproduction steps

---

**Document Version**: 1.0
**Last Updated**: 2025-11-16
**Maintained By**: Development Team
