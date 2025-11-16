/**
 * React Query Hooks for Admin User Role Feature
 *
 * Provides type-safe data fetching, caching, and mutation operations for admin functionality.
 * All hooks leverage Supabase RLS policies for automatic access control.
 *
 * @feature 006-fammi-un-tipo
 * @see ../../types/admin.types.ts - Type definitions
 * @see ../../services/admin.service.ts - API layer
 */

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
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
} from '../../services/admin.service';
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
} from '../../types/admin.types';

// ============================================================================
// React Query Keys
// ============================================================================

/**
 * Type-safe query key factory for admin features
 *
 * Provides consistent, hierarchical cache keys for all admin queries.
 * Follows React Query best practices for key structure.
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
 * Queries user_roles table on mount, caches result for session duration.
 * Returns 'user' as default if no role record exists.
 *
 * @returns Query result with user's role
 *
 * @example
 * ```typescript
 * function NavBar() {
 *   const { data: role, isLoading } = useUserRole();
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
export function useUserRole(): UseQueryResult<UserRole, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.userRole(),
    queryFn: () => getUserRole(),
    ...AdminCacheConfig.userRole,
  });
}

/**
 * Hook to check if current user is an admin
 *
 * Convenience wrapper around useUserRole() for boolean checks.
 *
 * @returns Query result with boolean admin status
 *
 * @example
 * ```typescript
 * function ProtectedRoute({ children }: { children: React.ReactNode }) {
 *   const { data: isUserAdmin, isLoading } = useIsAdmin();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isUserAdmin) return <Navigate to="/unauthorized" />;
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useIsAdmin(): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.isAdmin(),
    queryFn: () => isAdmin(),
    ...AdminCacheConfig.userRole,
  });
}

// ============================================================================
// Admin Dashboard Hooks
// ============================================================================

/**
 * Hook to fetch all users with project statistics (Admin Dashboard)
 *
 * Fetches from admin_users_overview view with automatic RLS enforcement.
 * Only succeeds if user has admin role.
 *
 * @returns Query result with users overview data
 *
 * @example
 * ```typescript
 * function AdminDashboard() {
 *   const { data: users, isLoading, error } = useAdminUsersOverview();
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
export function useAdminUsersOverview(): UseQueryResult<AdminUsersOverview[], Error> {
  return useQuery({
    queryKey: AdminQueryKeys.usersOverview(),
    queryFn: () => getAllUsersWithProjects(),
    ...AdminCacheConfig.usersOverview,
  });
}

/**
 * Hook to search and filter users with pagination
 *
 * Uses cursor-based pagination for efficient large dataset handling.
 * Filters are reactive - changing filters triggers new query.
 *
 * @param filters - Search and pagination parameters
 * @returns Query result with paginated user list
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
 *   const { data, isLoading } = useAdminUsersList(filters);
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
  filters?: AdminSearchFilters
): UseQueryResult<AdminUserListResponse, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.usersList(filters),
    queryFn: () => searchUsers(filters),
    ...AdminCacheConfig.usersOverview,
    placeholderData: (previousData) => previousData, // Show old data while fetching new page (replaces keepPreviousData)
  });
}

/**
 * Hook to fetch detailed information for a specific user
 *
 * Fetches user overview + all devices with sensors/actuators and latest readings.
 * Only enabled when userId is provided.
 *
 * @param userId - User UUID to fetch details for (or null to disable)
 * @returns Query result with detailed user information
 *
 * @example
 * ```typescript
 * function UserDetailModal({ userId }: { userId: string | null }) {
 *   const { data: userDetail, isLoading } = useAdminUserDetail(userId);
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
export function useAdminUserDetail(userId: string | null): UseQueryResult<AdminUserDetail, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.userDetail(userId || ''),
    queryFn: () => getUserDetail(userId!),
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
 * Fetches device info, owner info, recent readings (last 24h), and activity summary.
 * Only enabled when deviceId is provided.
 *
 * @param deviceId - Device UUID to fetch details for (or null to disable)
 * @returns Query result with detailed project information
 *
 * @example
 * ```typescript
 * function ProjectDetailPage() {
 *   const { deviceId } = useParams();
 *   const { data: project, isLoading } = useAdminProjectDetail(deviceId);
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
  deviceId: string | null
): UseQueryResult<AdminProjectDetail, Error> {
  return useQuery({
    queryKey: AdminQueryKeys.projectDetail(deviceId || ''),
    queryFn: () => getProjectDetails(deviceId!),
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
 * Automatically invalidates related queries on success.
 * Changes are visible to device owner via Supabase real-time.
 *
 * @returns Mutation object with mutate function and state
 *
 * @example
 * ```typescript
 * function DeviceEditForm({ device }: { device: AdminDeviceInfo }) {
 *   const updateDeviceMutation = useUpdateDevice();
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
export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation<AdminActionResult, Error, AdminUpdateDeviceParams>({
    mutationFn: (params) => updateDevice(params),
    onSuccess: (_data, variables) => {
      // Invalidate all queries that might show this device
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.usersOverview() });
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.projectDetail(variables.device_id) });
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.all });
    },
  });
}

/**
 * Hook to update sensor configuration as admin
 *
 * @example
 * ```typescript
 * function SensorEditForm({ sensor }: { sensor: AdminSensorInfo }) {
 *   const updateSensorMutation = useUpdateSensor();
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
export function useUpdateSensor() {
  const queryClient = useQueryClient();

  return useMutation<AdminActionResult, Error, AdminUpdateSensorParams>({
    mutationFn: (params) => updateSensor(params),
    onSuccess: () => {
      // Invalidate all admin queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.all });
    },
  });
}

/**
 * Hook to update actuator configuration as admin
 *
 * @example
 * ```typescript
 * function ActuatorEditForm({ actuator }: { actuator: AdminActuatorInfo }) {
 *   const updateActuatorMutation = useUpdateActuator();
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
export function useUpdateActuator() {
  const queryClient = useQueryClient();

  return useMutation<AdminActionResult, Error, AdminUpdateActuatorParams>({
    mutationFn: (params) => updateActuator(params),
    onSuccess: () => {
      // Invalidate all admin queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.all });
    },
  });
}
