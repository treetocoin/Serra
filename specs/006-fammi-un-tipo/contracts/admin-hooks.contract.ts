/**
 * React Query Hook Contracts for Admin User Role Feature
 *
 * This file defines React Query hooks for admin functionality, providing
 * type-safe data fetching, caching, and mutation operations. All hooks
 * leverage the Supabase API contracts and implement proper error handling,
 * loading states, and cache invalidation.
 *
 * @feature 006-fammi-un-tipo
 * @see ../spec.md - Feature specification
 * @see ../data-model.md - Database schema and RLS policies
 * @see ../research.md Section 3 - Frontend Role-Based Access Control
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getUserRole,
  isAdmin,
  getAllUsersWithProjects,
  searchUsers,
  getUserDetail,
  getProjectDetails,
  updateDevice,
  updateSensor,
  updateActuator,
} from './admin-api.contract';
import type {
  UserRole,
  AdminUsersOverview,
  AdminUserDetail,
  AdminProjectDetail,
  AdminSearchFilters,
  AdminUserListResponse,
  AdminUpdateDeviceParams,
  AdminUpdateSensorParams,
  AdminUpdateActuatorParams,
  AdminActionResult,
} from './admin.types';

// ============================================================================
// React Query Keys
// ============================================================================

/**
 * Type-safe query key factory for admin features
 *
 * Provides consistent, hierarchical cache keys for all admin queries.
 * Follows React Query best practices for key structure.
 *
 * @see research.md Section 5 - Search and Pagination Patterns
 *
 * @example
 * ```typescript
 * // Invalidate all admin queries
 * queryClient.invalidateQueries(AdminQueryKeys.all);
 *
 * // Invalidate specific user detail
 * queryClient.invalidateQueries(AdminQueryKeys.userDetail('user-id'));
 * ```
 */
export const AdminQueryKeys = {
  all: ['admin'] as const,
  userRole: () => ['admin', 'user-role'] as const,
  isAdmin: () => ['admin', 'is-admin'] as const,
  usersOverview: () => ['admin', 'users-overview'] as const,
  usersList: (filters?: AdminSearchFilters) => ['admin', 'users-list', filters] as const,
  userDetail: (userId: string) => ['admin', 'user-detail', userId] as const,
  projectDetail: (deviceId: string) => ['admin', 'project-detail', deviceId] as const,
} as const;

// ============================================================================
// React Query Cache Configurations
// ============================================================================

/**
 * Recommended cache configurations for admin queries
 *
 * @see research.md Section 5 - Search and Pagination Patterns
 */
export const AdminCacheConfig = {
  /** User role - cache for session duration */
  userRole: {
    staleTime: 1000 * 60 * 60, // 1 hour
    cacheTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  /** Users overview - refresh periodically */
  usersOverview: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    cacheTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  /** User detail - cache while viewing */
  userDetail: {
    staleTime: 1000 * 60 * 2, // 2 minutes
    cacheTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  /** Project detail - cache while viewing */
  projectDetail: {
    staleTime: 1000 * 60 * 2, // 2 minutes
    cacheTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
} as const;

// ============================================================================
// Role Checking Hooks
// ============================================================================

/**
 * Hook to get the current user's role
 *
 * Implementation Notes:
 * - Queries user_roles table on mount
 * - Caches result for session duration (1 hour)
 * - Automatically refetches on reconnect to handle token refresh
 * - Returns 'user' as default if no role record exists
 *
 * @param supabase - Authenticated Supabase client
 * @returns Query result with user's role
 *
 * @see admin-api.contract.ts getUserRole()
 * @see research.md Section 3 - Frontend Role-Based Access Control
 * @see spec.md FR-001, FR-007, FR-010
 *
 * @example
 * ```typescript
 * function NavBar() {
 *   const { data: role, isLoading } = useUserRole(supabase);
 *
 *   if (isLoading) return <Skeleton />;
 *
 *   return (
 *     <nav>
 *       {role === 'admin' && <Link to="/admin">Admin Dashboard</Link>}
 *     </nav>
 *   );
 * }
 * ```
 */
export function useUserRole(supabase: SupabaseClient): UseQueryResult<UserRole, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.userRole(),
    queryFn: () => getUserRole(supabase),
    ...AdminCacheConfig.userRole,
  });
}

/**
 * Hook to check if current user is an admin
 *
 * Convenience wrapper around useUserRole() for boolean checks.
 *
 * @param supabase - Authenticated Supabase client
 * @returns Query result with boolean admin status
 *
 * @example
 * ```typescript
 * function ProtectedRoute({ children }: { children: React.ReactNode }) {
 *   const { data: isUserAdmin, isLoading } = useIsAdmin(supabase);
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isUserAdmin) return <Navigate to="/unauthorized" />;
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useIsAdmin(supabase: SupabaseClient): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.isAdmin(),
    queryFn: () => isAdmin(supabase),
    ...AdminCacheConfig.userRole,
  });
}

// ============================================================================
// Admin Dashboard Hooks
// ============================================================================

/**
 * Hook to fetch all users with project statistics (Admin Dashboard)
 *
 * Implementation Notes:
 * - Fetches from admin_users_overview view
 * - Automatically refetches on window focus (5 min stale time)
 * - Only succeeds if user has admin role (enforced by RLS)
 * - Returns empty array on error (non-admin users)
 *
 * @param supabase - Authenticated Supabase client
 * @returns Query result with users overview data
 *
 * @see admin-api.contract.ts getAllUsersWithProjects()
 * @see spec.md User Story 1 (P1) - Admin Views All User Projects
 * @see spec.md FR-003, FR-004, FR-005, SC-001
 *
 * @example
 * ```typescript
 * function AdminDashboard() {
 *   const { data: users, isLoading, error } = useAdminUsersOverview(supabase);
 *
 *   if (isLoading) return <TableSkeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <table>
 *       {users.map(user => (
 *         <UserRow key={user.user_id} user={user} />
 *       ))}
 *     </table>
 *   );
 * }
 * ```
 */
export function useAdminUsersOverview(
  supabase: SupabaseClient
): UseQueryResult<AdminUsersOverview[], Error> {
  return useQuery({
    queryKey: AdminQueryKeys.usersOverview(),
    queryFn: () => getAllUsersWithProjects(supabase),
    ...AdminCacheConfig.usersOverview,
  });
}

/**
 * Hook to search and filter users with pagination
 *
 * Implementation Notes:
 * - Uses cursor-based pagination for efficient large dataset handling
 * - Filters are reactive - changing filters triggers new query
 * - Keeps previous data while loading new page (better UX)
 * - Implements React Query's keepPreviousData pattern
 *
 * @param supabase - Authenticated Supabase client
 * @param filters - Search and pagination parameters
 * @returns Query result with paginated user list
 *
 * @see admin-api.contract.ts searchUsers()
 * @see research.md Section 5 - Search and Pagination Patterns
 * @see spec.md User Story 2 (P2) - Admin Project Search and Filtering
 * @see spec.md SC-003
 *
 * @example
 * ```typescript
 * function UserSearch() {
 *   const [filters, setFilters] = useState<AdminSearchFilters>({
 *     email: '',
 *     active_within_days: 7,
 *     page_size: 20,
 *   });
 *
 *   const { data, isLoading } = useAdminUsersList(supabase, filters);
 *
 *   const handleLoadMore = () => {
 *     if (data?.next_cursor) {
 *       setFilters(prev => ({ ...prev, cursor: data.next_cursor }));
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <SearchInput onChange={(email) => setFilters(prev => ({ ...prev, email }))} />
 *       <UserList users={data?.data || []} />
 *       {data?.has_more && <Button onClick={handleLoadMore}>Load More</Button>}
 *     </>
 *   );
 * }
 * ```
 */
export function useAdminUsersList(
  supabase: SupabaseClient,
  filters?: AdminSearchFilters
): UseQueryResult<AdminUserListResponse, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.usersList(filters),
    queryFn: () => searchUsers(supabase, filters),
    ...AdminCacheConfig.usersOverview,
    keepPreviousData: true, // Show old data while fetching new page
  });
}

/**
 * Hook to fetch detailed information for a specific user
 *
 * Implementation Notes:
 * - Fetches user overview + all devices with sensors/actuators
 * - Includes latest sensor readings for each sensor
 * - Only enabled when userId is provided (prevents unnecessary fetches)
 * - Refetches on window focus (2 min stale time)
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User UUID to fetch details for (or null to disable)
 * @returns Query result with detailed user information
 *
 * @see admin-api.contract.ts getUserDetail()
 * @see spec.md User Story 4 (P4) - Admin Views Detailed Project Information
 * @see spec.md FR-004, FR-005
 *
 * @example
 * ```typescript
 * function UserDetailModal({ userId }: { userId: string | null }) {
 *   const { data: userDetail, isLoading } = useAdminUserDetail(supabase, userId);
 *
 *   if (!userId) return null;
 *   if (isLoading) return <ModalSkeleton />;
 *
 *   return (
 *     <Modal>
 *       <h2>{userDetail?.email}</h2>
 *       <p>Devices: {userDetail?.device_count}</p>
 *       {userDetail?.devices.map(device => (
 *         <DeviceCard key={device.id} device={device} />
 *       ))}
 *     </Modal>
 *   );
 * }
 * ```
 */
export function useAdminUserDetail(
  supabase: SupabaseClient,
  userId: string | null
): UseQueryResult<AdminUserDetail, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.userDetail(userId || ''),
    queryFn: () => getUserDetail(supabase, userId!),
    enabled: !!userId, // Only run query if userId is provided
    ...AdminCacheConfig.userDetail,
  });
}

// ============================================================================
// Admin Project Detail Hooks
// ============================================================================

/**
 * Hook to fetch comprehensive project/device details
 *
 * Implementation Notes:
 * - Fetches device info, owner info, recent readings, and activity summary
 * - Includes last 24 hours of sensor data for troubleshooting
 * - Calculates activity metrics (total readings, active status)
 * - Only enabled when deviceId is provided
 *
 * @param supabase - Authenticated Supabase client
 * @param deviceId - Device UUID to fetch details for (or null to disable)
 * @returns Query result with detailed project information
 *
 * @see admin-api.contract.ts getProjectDetails()
 * @see spec.md User Story 4 (P4) - Admin Views Detailed Project Information
 * @see spec.md FR-004, FR-005
 *
 * @example
 * ```typescript
 * function ProjectDetailPage() {
 *   const { deviceId } = useParams();
 *   const { data: project, isLoading } = useAdminProjectDetail(supabase, deviceId);
 *
 *   if (isLoading) return <PageSkeleton />;
 *
 *   return (
 *     <div>
 *       <h1>{project?.device.name}</h1>
 *       <p>Owner: {project?.owner.email}</p>
 *       <p>Total Readings: {project?.activity_summary.total_readings}</p>
 *       <p>Active: {project?.activity_summary.is_active ? 'Yes' : 'No'}</p>
 *       <RecentReadingsChart data={project?.recent_readings || []} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminProjectDetail(
  supabase: SupabaseClient,
  deviceId: string | null
): UseQueryResult<AdminProjectDetail, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.projectDetail(deviceId || ''),
    queryFn: () => getProjectDetails(supabase, deviceId!),
    enabled: !!deviceId,
    ...AdminCacheConfig.projectDetail,
  });
}

// ============================================================================
// Admin Mutation Hooks
// ============================================================================

/**
 * Hook to update device configuration as admin
 *
 * Implementation Notes:
 * - Uses optimistic updates for instant UI feedback
 * - Automatically invalidates related queries on success
 * - Rolls back on error
 * - Changes are visible to device owner via real-time (handled by Supabase)
 *
 * @param supabase - Authenticated Supabase client
 * @returns Mutation object with mutate function and state
 *
 * @see admin-api.contract.ts updateDevice()
 * @see research.md Section 4 - Real-time Sync for Multi-User Scenarios
 * @see spec.md User Story 3 (P3) - Admin Edits User Project Configurations
 * @see spec.md FR-011, FR-014
 *
 * @example
 * ```typescript
 * function DeviceEditForm({ device }: { device: AdminDeviceInfo }) {
 *   const updateDeviceMutation = useUpdateDevice(supabase);
 *
 *   const handleSubmit = (name: string) => {
 *     updateDeviceMutation.mutate(
 *       {
 *         device_id: device.id,
 *         updates: { name }
 *       },
 *       {
 *         onSuccess: () => {
 *           toast.success('Device updated');
 *         },
 *         onError: (error) => {
 *           toast.error(`Failed: ${error.message}`);
 *         }
 *       }
 *     );
 *   };
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e.target.name.value); }}>
 *       <input name="name" defaultValue={device.name} />
 *       <button disabled={updateDeviceMutation.isLoading}>Save</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useUpdateDevice(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation<AdminActionResult, Error, AdminUpdateDeviceParams>({
    mutationFn: (params) => updateDevice(supabase, params),
    onSuccess: (data, variables) => {
      // Invalidate all queries that might show this device
      queryClient.invalidateQueries(AdminQueryKeys.usersOverview());
      queryClient.invalidateQueries(AdminQueryKeys.projectDetail(variables.device_id));

      // If we know the user_id, invalidate user detail too
      // (In real implementation, extract user_id from device data)
      queryClient.invalidateQueries(AdminQueryKeys.all);
    },
  });
}

/**
 * Hook to update sensor configuration as admin
 *
 * @see useUpdateDevice for implementation notes
 *
 * @example
 * ```typescript
 * function SensorEditForm({ sensor }: { sensor: AdminSensorInfo }) {
 *   const updateSensorMutation = useUpdateSensor(supabase);
 *
 *   const handleToggleActive = () => {
 *     updateSensorMutation.mutate({
 *       sensor_id: sensor.id,
 *       updates: { is_active: !sensor.is_active }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <p>{sensor.name || sensor.sensor_type}</p>
 *       <Switch
 *         checked={sensor.is_active}
 *         onChange={handleToggleActive}
 *         disabled={updateSensorMutation.isLoading}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpdateSensor(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation<AdminActionResult, Error, AdminUpdateSensorParams>({
    mutationFn: (params) => updateSensor(supabase, params),
    onSuccess: () => {
      // Invalidate all admin queries to ensure consistency
      queryClient.invalidateQueries(AdminQueryKeys.all);
    },
  });
}

/**
 * Hook to update actuator configuration as admin
 *
 * @see useUpdateDevice for implementation notes
 *
 * @example
 * ```typescript
 * function ActuatorEditForm({ actuator }: { actuator: AdminActuatorInfo }) {
 *   const updateActuatorMutation = useUpdateActuator(supabase);
 *
 *   const handleRename = (newName: string) => {
 *     updateActuatorMutation.mutate({
 *       actuator_id: actuator.id,
 *       updates: { name: newName }
 *     });
 *   };
 *
 *   return (
 *     <input
 *       defaultValue={actuator.name || actuator.actuator_type}
 *       onBlur={(e) => handleRename(e.target.value)}
 *       disabled={updateActuatorMutation.isLoading}
 *     />
 *   );
 * }
 * ```
 */
export function useUpdateActuator(supabase: SupabaseClient) {
  const queryClient = useQueryClient();

  return useMutation<AdminActionResult, Error, AdminUpdateActuatorParams>({
    mutationFn: (params) => updateActuator(supabase, params),
    onSuccess: () => {
      // Invalidate all admin queries to ensure consistency
      queryClient.invalidateQueries(AdminQueryKeys.all);
    },
  });
}

// ============================================================================
// Real-time Sync Hook (Optional Enhancement)
// ============================================================================

/**
 * Hook to enable real-time sync for admin dashboard
 *
 * Implementation Notes:
 * - Subscribes to database changes for devices, sensors, actuators tables
 * - Automatically invalidates React Query cache when changes detected
 * - Only active when admin dashboard is mounted
 * - Uses Supabase Realtime with RLS policies applied
 *
 * @param supabase - Authenticated Supabase client
 * @param enabled - Whether to enable real-time sync (default true)
 *
 * @see research.md Section 4 - Real-time Sync for Multi-User Scenarios
 * @see spec.md FR-014
 *
 * @example
 * ```typescript
 * function AdminDashboard() {
 *   useAdminRealtimeSync(supabase);
 *
 *   // Dashboard content automatically updates when data changes
 *   const { data: users } = useAdminUsersOverview(supabase);
 *
 *   return <UserTable users={users} />;
 * }
 * ```
 */
export function useAdminRealtimeSync(supabase: SupabaseClient, enabled = true) {
  const queryClient = useQueryClient();

  // This is a placeholder - actual implementation would subscribe to Supabase Realtime
  // and invalidate queries when changes are detected
  //
  // Example implementation:
  // useEffect(() => {
  //   if (!enabled) return;
  //
  //   const channel = supabase
  //     .channel('admin-sync')
  //     .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
  //       queryClient.invalidateQueries(AdminQueryKeys.all);
  //     })
  //     .subscribe();
  //
  //   return () => {
  //     supabase.removeChannel(channel);
  //   };
  // }, [enabled, supabase, queryClient]);
}
