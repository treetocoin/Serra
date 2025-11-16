# Admin User Role API Contracts

**Feature**: 006-fammi-un-tipo
**Created**: 2025-11-16
**Status**: Contract Specification

## Overview

This directory contains TypeScript API contracts for the admin user role feature. These contracts define the type-safe interface between the frontend application and Supabase backend, including data types, query functions, and React Query hooks.

## Purpose

The contracts serve as a **single source of truth** for:

1. **Type Safety**: Ensures compile-time validation of all admin operations
2. **Documentation**: Self-documenting API through TypeScript types and JSDoc comments
3. **Development Guide**: Clear examples for implementing admin features
4. **Testing Reference**: Defines expected inputs/outputs for automated tests

## Contract Files

### 1. `admin.types.ts` - Type Definitions

**Purpose**: Core TypeScript type definitions for admin functionality.

**Contents**:
- `UserRole` - User role enumeration ('user' | 'admin')
- `AdminUsersOverview` - Aggregated user statistics (from database view)
- `AdminProjectDetail` - Comprehensive project/device information
- `AdminSearchFilters` - Search and pagination parameters
- Admin action types (update device/sensor/actuator)
- UI state types

**Key Types**:
```typescript
// User role from user_roles table
export type UserRole = 'user' | 'admin';

// Admin dashboard overview (one row per user)
export interface AdminUsersOverview {
  user_id: string;
  email: string;
  role: UserRole;
  device_count: number;
  sensor_count: number;
  actuator_count: number;
  last_activity: Date | null;
}

// Detailed project view for troubleshooting
export interface AdminProjectDetail {
  device: AdminDeviceInfo;
  owner: { user_id: string; email: string; role: UserRole };
  recent_readings: Array<{...}>;
  activity_summary: {
    total_readings: number;
    is_active: boolean;
    // ...
  };
}
```

**Usage**:
```typescript
import type { UserRole, AdminUsersOverview } from './admin.types';

function AdminDashboard() {
  const [users, setUsers] = useState<AdminUsersOverview[]>([]);
  // ...
}
```

**Related Spec Sections**:
- [spec.md](../spec.md) - User Stories 1-4 (all priorities)
- [data-model.md](../data-model.md) - admin_users_overview view
- [data-model.md](../data-model.md) - user_roles table

---

### 2. `admin-api.contract.ts` - Supabase Query Contracts

**Purpose**: Low-level API functions for interacting with Supabase database.

**Contents**:
- `getUserRole()` - Get current user's role from user_roles table
- `isAdmin()` - Check if current user is admin (convenience wrapper)
- `getAllUsersWithProjects()` - Fetch all users for admin dashboard
- `searchUsers()` - Search/filter users with pagination
- `getUserDetail()` - Get detailed user info with all devices
- `getProjectDetails()` - Get comprehensive project/device details
- `updateDevice/Sensor/Actuator()` - Admin edit operations

**Key Functions**:
```typescript
// Check user role (uses RLS policies)
export async function getUserRole(
  supabase: SupabaseClient
): Promise<UserRole>

// Fetch admin dashboard data
export async function getAllUsersWithProjects(
  supabase: SupabaseClient
): Promise<AdminUsersOverview[]>

// Search users with filters and pagination
export async function searchUsers(
  supabase: SupabaseClient,
  filters: AdminSearchFilters
): Promise<AdminUserListResponse>

// Admin update operations (bypasses user_id check via RLS)
export async function updateDevice(
  supabase: SupabaseClient,
  params: AdminUpdateDeviceParams
): Promise<AdminActionResult>
```

**Usage**:
```typescript
import { supabase } from '../lib/supabase';
import { getUserRole, getAllUsersWithProjects } from './admin-api.contract';

// Check if current user is admin
const role = await getUserRole(supabase);
if (role === 'admin') {
  // Fetch all users
  const users = await getAllUsersWithProjects(supabase);
  console.log(`Total users: ${users.length}`);
}
```

**Security Notes**:
- All queries rely on Row Level Security (RLS) policies in Supabase
- Admin access is enforced at **database level**, not just UI
- If user is not admin, RLS policies will return empty results or throw errors
- See [data-model.md](../data-model.md) - "Updated Policies" section

**Related Spec Sections**:
- [spec.md](../spec.md) FR-003, FR-004, FR-005 (admin viewing all data)
- [spec.md](../spec.md) FR-011, FR-012 (admin editing with restrictions)
- [data-model.md](../data-model.md) - RLS policies for devices, sensors, actuators
- [research.md](../research.md) Section 2 - RLS Best Practices

---

### 3. `admin-hooks.contract.ts` - React Query Hook Contracts

**Purpose**: High-level React hooks for data fetching, caching, and mutations.

**Contents**:
- `useUserRole()` - Get current user's role with caching
- `useIsAdmin()` - Boolean admin check with caching
- `useAdminUsersOverview()` - Fetch all users for dashboard
- `useAdminUsersList()` - Search/filter users with pagination
- `useAdminUserDetail()` - Fetch detailed user info
- `useAdminProjectDetail()` - Fetch project/device details
- `useUpdateDevice/Sensor/Actuator()` - Mutation hooks for admin edits
- `AdminQueryKeys` - Type-safe React Query cache keys
- `AdminCacheConfig` - Recommended cache configurations

**Key Hooks**:
```typescript
// Check user role (cached for 1 hour)
export function useUserRole(
  supabase: SupabaseClient
): UseQueryResult<UserRole, Error>

// Fetch admin dashboard data (refetch every 5 min)
export function useAdminUsersOverview(
  supabase: SupabaseClient
): UseQueryResult<AdminUsersOverview[], Error>

// Search users with pagination
export function useAdminUsersList(
  supabase: SupabaseClient,
  filters?: AdminSearchFilters
): UseQueryResult<AdminUserListResponse, Error>

// Mutation for admin edits (auto-invalidates cache)
export function useUpdateDevice(
  supabase: SupabaseClient
): UseMutationResult<AdminActionResult, Error, AdminUpdateDeviceParams>
```

**Usage**:
```typescript
import { supabase } from '../lib/supabase';
import { useUserRole, useAdminUsersOverview, useUpdateDevice } from './admin-hooks.contract';

function AdminDashboard() {
  // Check if user is admin
  const { data: role, isLoading: roleLoading } = useUserRole(supabase);

  // Fetch all users (only succeeds if admin)
  const { data: users, isLoading: usersLoading } = useAdminUsersOverview(supabase);

  // Mutation for editing devices
  const updateDeviceMutation = useUpdateDevice(supabase);

  if (roleLoading || usersLoading) return <LoadingSpinner />;
  if (role !== 'admin') return <Navigate to="/unauthorized" />;

  const handleEditDevice = (deviceId: string, name: string) => {
    updateDeviceMutation.mutate(
      { device_id: deviceId, updates: { name } },
      {
        onSuccess: () => toast.success('Device updated'),
        onError: (err) => toast.error(err.message),
      }
    );
  };

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {users.map(user => (
        <UserRow key={user.user_id} user={user} onEdit={handleEditDevice} />
      ))}
    </div>
  );
}
```

**React Query Best Practices**:
- **Caching**: Different cache times for different data types (see `AdminCacheConfig`)
- **Invalidation**: Mutations automatically invalidate related queries
- **Loading States**: All hooks return `isLoading`, `error`, and `data`
- **Pagination**: Uses `keepPreviousData` for smooth page transitions
- **Optimistic Updates**: Mutations can use optimistic updates (commented in code)

**Related Spec Sections**:
- [spec.md](../spec.md) - All User Stories (P1-P4)
- [research.md](../research.md) Section 3 - Frontend Role-Based Access Control
- [research.md](../research.md) Section 4 - Real-time Sync
- [research.md](../research.md) Section 5 - Pagination Patterns

---

## Relationship to Data Model and RLS Policies

### Database Schema

The contracts map directly to the database schema defined in [data-model.md](../data-model.md):

| Contract Type | Database Entity | RLS Policy |
|---------------|----------------|------------|
| `UserRole` | `user_roles.role` | "Users can view own role" |
| `AdminUsersOverview` | `admin_users_overview` view | "Admin can view users overview" |
| `AdminDeviceInfo` | `devices` table | "Users or admin can view devices" |
| `AdminSensorInfo` | `sensors` table | "Users or admin can view sensors" |
| `AdminActuatorInfo` | `actuators` table | "Users or admin can view actuators" |

### RLS Policy Enforcement

All admin queries use the following RLS pattern:

```sql
-- Example: devices table policy
CREATE POLICY "Users can view own or admin sees all devices" ON devices
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    auth.user_role() = 'admin'  -- Admin bypass
  );
```

**Key Points**:
1. **Regular users** see only their own data (`user_id = auth.uid()`)
2. **Admin users** see all data (`auth.user_role() = 'admin'`)
3. **Security definer function** `auth.user_role()` checks user_roles table
4. **Admin cannot delete** projects or users (no DELETE policy with admin bypass)

See [data-model.md](../data-model.md) - "Modified: Row Level Security Policies" for full SQL.

---

## How to Use These Contracts

### Step 1: Import Types

```typescript
import type {
  UserRole,
  AdminUsersOverview,
  AdminProjectDetail,
} from '@/specs/006-fammi-un-tipo/contracts/admin.types';
```

### Step 2: Use React Query Hooks

```typescript
import { useUserRole, useAdminUsersOverview } from '@/specs/006-fammi-un-tipo/contracts/admin-hooks.contract';
import { supabase } from '@/lib/supabase';

function MyAdminComponent() {
  const { data: role, isLoading } = useUserRole(supabase);
  const { data: users } = useAdminUsersOverview(supabase);

  // Component logic...
}
```

### Step 3: Protect Routes

```typescript
import { useIsAdmin } from '@/specs/006-fammi-un-tipo/contracts/admin-hooks.contract';
import { Navigate } from 'react-router-dom';

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { data: isUserAdmin, isLoading } = useIsAdmin(supabase);

  if (isLoading) return <LoadingSpinner />;
  if (!isUserAdmin) return <Navigate to="/unauthorized" />;

  return <>{children}</>;
}
```

### Step 4: Implement Search/Pagination

```typescript
import { useState } from 'react';
import { useAdminUsersList } from '@/specs/006-fammi-un-tipo/contracts/admin-hooks.contract';
import type { AdminSearchFilters } from '@/specs/006-fammi-un-tipo/contracts/admin.types';

function AdminUserSearch() {
  const [filters, setFilters] = useState<AdminSearchFilters>({
    email: '',
    active_within_days: 7,
    page_size: 20,
  });

  const { data, isLoading } = useAdminUsersList(supabase, filters);

  return (
    <div>
      <input
        placeholder="Search by email"
        onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value }))}
      />
      {isLoading ? <Skeleton /> : <UserTable users={data?.data || []} />}
      {data?.has_more && (
        <button onClick={() => setFilters(prev => ({ ...prev, cursor: data.next_cursor }))}>
          Load More
        </button>
      )}
    </div>
  );
}
```

### Step 5: Implement Admin Edits

```typescript
import { useUpdateDevice } from '@/specs/006-fammi-un-tipo/contracts/admin-hooks.contract';

function DeviceEditForm({ device }: { device: AdminDeviceInfo }) {
  const updateMutation = useUpdateDevice(supabase);

  const handleSubmit = (name: string) => {
    updateMutation.mutate(
      {
        device_id: device.id,
        updates: { name },
      },
      {
        onSuccess: () => alert('Device updated!'),
        onError: (err) => alert(`Error: ${err.message}`),
      }
    );
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e.target.name.value); }}>
      <input name="name" defaultValue={device.name} />
      <button disabled={updateMutation.isLoading}>Save</button>
    </form>
  );
}
```

---

## Testing Strategy

### Unit Tests (Type Contracts)

Test that types enforce correct structure:

```typescript
import type { AdminUsersOverview, UserRole } from './admin.types';

describe('admin.types', () => {
  it('should enforce UserRole enum', () => {
    const validRole: UserRole = 'admin';
    const invalidRole: UserRole = 'superuser'; // TypeScript error
  });

  it('should enforce AdminUsersOverview structure', () => {
    const validOverview: AdminUsersOverview = {
      user_id: 'uuid',
      email: 'test@example.com',
      role: 'user',
      user_created_at: new Date(),
      device_count: 5,
      sensor_count: 10,
      actuator_count: 3,
      last_activity: new Date(),
    };
  });
});
```

### Integration Tests (API Contracts)

Test that API functions work with Supabase:

```typescript
import { getUserRole, getAllUsersWithProjects } from './admin-api.contract';
import { supabase } from '@/lib/supabase';

describe('admin-api.contract', () => {
  it('should return user role for authenticated user', async () => {
    const role = await getUserRole(supabase);
    expect(role).toMatch(/^(user|admin)$/);
  });

  it('should fetch all users for admin', async () => {
    // Assumes test user is admin
    const users = await getAllUsersWithProjects(supabase);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  it('should throw error for non-admin accessing getAllUsersWithProjects', async () => {
    // Mock non-admin user
    await expect(getAllUsersWithProjects(supabase)).rejects.toThrow();
  });
});
```

### E2E Tests (React Hooks)

Test that hooks work in React components:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useUserRole, useAdminUsersOverview } from './admin-hooks.contract';
import { supabase } from '@/lib/supabase';

describe('admin-hooks.contract', () => {
  it('should return user role', async () => {
    const { result } = renderHook(() => useUserRole(supabase));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toMatch(/^(user|admin)$/);
  });

  it('should fetch admin users overview', async () => {
    const { result } = renderHook(() => useAdminUsersOverview(supabase));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeInstanceOf(Array);
  });
});
```

---

## Migration Path

These contracts are designed to be implemented incrementally:

### Phase 1: Database Setup (Week 1)
1. Create `user_roles` table ([data-model.md](../data-model.md))
2. Create `auth.user_role()` helper function
3. Update RLS policies for admin bypass
4. Create `admin_users_overview` view
5. Assign admin role to `dadecresce@test.caz`

### Phase 2: API Layer (Week 2)
1. Implement `admin-api.contract.ts` functions
2. Test API functions with admin and non-admin users
3. Verify RLS policies work correctly

### Phase 3: React Hooks (Week 3)
1. Implement `admin-hooks.contract.ts` hooks
2. Set up React Query with proper cache configuration
3. Test hooks in isolation with mock Supabase client

### Phase 4: UI Implementation (Week 4)
1. Build admin dashboard using `useAdminUsersOverview()`
2. Implement search using `useAdminUsersList()`
3. Add detail views using `useAdminUserDetail()` and `useAdminProjectDetail()`
4. Implement edit functionality using mutation hooks

### Phase 5: Polish & Testing (Week 5)
1. E2E tests for all user stories
2. Performance optimization (check query speed)
3. Security audit (verify RLS enforcement)
4. Documentation and training

---

## Common Patterns

### Pattern 1: Role-Based Rendering

```typescript
function Navigation() {
  const { data: role } = useUserRole(supabase);

  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>
      {role === 'admin' && <Link to="/admin">Admin Panel</Link>}
    </nav>
  );
}
```

### Pattern 2: Protected Routes

```typescript
function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<UserDashboard />} />
      <Route
        path="/admin"
        element={
          <ProtectedAdminRoute>
            <AdminDashboard />
          </ProtectedAdminRoute>
        }
      />
    </Routes>
  );
}
```

### Pattern 3: Admin Edit Context

```typescript
function DeviceCard({ device }: { device: AdminDeviceInfo }) {
  const { data: role } = useUserRole(supabase);
  const isAdminEditing = role === 'admin' && device.user_id !== currentUserId;

  return (
    <div>
      {isAdminEditing && (
        <Badge variant="warning">
          Editing as Admin (Owner: {device.owner_email})
        </Badge>
      )}
      <DeviceForm device={device} readonly={!isAdminEditing && !isOwner} />
    </div>
  );
}
```

---

## References

- [spec.md](../spec.md) - Feature specification and user stories
- [data-model.md](../data-model.md) - Database schema and RLS policies
- [research.md](../research.md) - Implementation best practices
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [React Query Documentation](https://tanstack.com/query/latest)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-16
**Maintained By**: Development Team
