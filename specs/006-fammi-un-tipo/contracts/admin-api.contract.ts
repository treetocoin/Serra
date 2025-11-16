/**
 * Supabase Query Contracts for Admin User Role Feature
 *
 * This file defines the API contracts for querying and mutating data
 * as an admin user. All queries leverage Row Level Security (RLS) policies
 * that automatically enforce admin access rules at the database level.
 *
 * @feature 006-fammi-un-tipo
 * @see ../spec.md - Feature specification
 * @see ../data-model.md - Database schema and RLS policies
 * @see ../research.md - Implementation best practices
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserRole,
  UserRoleRecord,
  AdminUsersOverview,
  AdminUserDetail,
  AdminDeviceInfo,
  AdminProjectDetail,
  AdminSearchFilters,
  AdminUserListResponse,
  AdminUpdateDeviceParams,
  AdminUpdateSensorParams,
  AdminUpdateActuatorParams,
  AdminActionResult,
} from './admin.types';

// ============================================================================
// Admin Role Checking
// ============================================================================

/**
 * Get the current user's role from the user_roles table
 *
 * Implementation Notes:
 * - Queries user_roles table filtered by current user's auth.uid()
 * - Returns 'user' as default if no role record exists
 * - Uses RLS policy: "Users can view own role"
 *
 * @param supabase - Authenticated Supabase client
 * @returns User's role or 'user' as default
 * @throws Error if query fails
 *
 * @see data-model.md - user_roles table
 * @see research.md Section 1 - User Role Storage
 * @see spec.md FR-001, FR-010
 *
 * @example
 * ```typescript
 * const role = await getUserRole(supabase);
 * if (role === 'admin') {
 *   // Show admin UI
 * }
 * ```
 */
export async function getUserRole(supabase: SupabaseClient): Promise<UserRole> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // If no role record exists, default to 'user'
    if (error.code === 'PGRST116') {
      return 'user';
    }
    throw error;
  }

  return (data?.role || 'user') as UserRole;
}

/**
 * Check if current user is an admin
 *
 * Convenience wrapper around getUserRole() for boolean checks.
 *
 * @param supabase - Authenticated Supabase client
 * @returns True if user has admin role
 *
 * @example
 * ```typescript
 * const canViewAdminDashboard = await isAdmin(supabase);
 * ```
 */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const role = await getUserRole(supabase);
  return role === 'admin';
}

// ============================================================================
// Admin Dashboard Queries
// ============================================================================

/**
 * Get all users with aggregated project statistics (Admin Dashboard)
 *
 * Implementation Notes:
 * - Queries admin_users_overview database view
 * - View is protected by RLS: only admins can access
 * - Aggregates device_count, sensor_count, actuator_count, last_activity
 * - Returns all users (regular users + admins)
 *
 * @param supabase - Authenticated Supabase client
 * @returns Array of user overview records
 * @throws Error if user is not admin or query fails
 *
 * @see data-model.md - admin_users_overview view
 * @see spec.md User Story 1 (P1) - Admin Views All User Projects
 * @see spec.md FR-003, FR-004, FR-005
 *
 * @example
 * ```typescript
 * const users = await getAllUsersWithProjects(supabase);
 * console.log(`Total users: ${users.length}`);
 * ```
 */
export async function getAllUsersWithProjects(
  supabase: SupabaseClient
): Promise<AdminUsersOverview[]> {
  const { data, error } = await supabase
    .from('admin_users_overview')
    .select('*')
    .order('email', { ascending: true });

  if (error) {
    console.error('[admin-api.getAllUsersWithProjects] Error:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    user_id: row.user_id,
    email: row.email,
    role: row.role as UserRole,
    user_created_at: new Date(row.user_created_at),
    device_count: row.device_count,
    sensor_count: row.sensor_count,
    actuator_count: row.actuator_count,
    last_activity: row.last_activity ? new Date(row.last_activity) : null,
  }));
}

/**
 * Search and filter users with pagination
 *
 * Implementation Notes:
 * - Uses cursor-based pagination (more efficient than offset for large datasets)
 * - Filters are applied client-side after fetching from view (view is already admin-filtered)
 * - For production, consider implementing filters in SQL for better performance
 *
 * @param supabase - Authenticated Supabase client
 * @param filters - Search and pagination parameters
 * @returns Paginated user list with cursor for next page
 * @throws Error if user is not admin or query fails
 *
 * @see research.md Section 5 - Search and Pagination Patterns
 * @see spec.md User Story 2 (P2) - Admin Project Search and Filtering
 * @see spec.md FR-003, SC-003
 *
 * @example
 * ```typescript
 * const result = await searchUsers(supabase, {
 *   email: 'test',
 *   active_within_days: 7,
 *   page_size: 20,
 * });
 * console.log(`Found ${result.data.length} users`);
 * ```
 */
export async function searchUsers(
  supabase: SupabaseClient,
  filters: AdminSearchFilters = {}
): Promise<AdminUserListResponse> {
  const {
    email,
    role,
    min_devices,
    max_devices,
    active_within_days,
    inactive_for_days,
    sort_by = 'email',
    sort_direction = 'asc',
    page_size = 20,
    cursor,
  } = filters;

  // Build query
  let query = supabase.from('admin_users_overview').select('*', { count: 'exact' });

  // Apply cursor pagination
  if (cursor) {
    query = query.gt('user_id', cursor);
  }

  // Apply sorting
  query = query.order(sort_by, { ascending: sort_direction === 'asc' });

  // Apply limit
  query = query.limit(page_size);

  const { data, error, count } = await query;

  if (error) {
    console.error('[admin-api.searchUsers] Error:', error);
    throw error;
  }

  let filteredData = data || [];

  // Apply client-side filters (in production, move to SQL)
  if (email) {
    const searchTerm = email.toLowerCase();
    filteredData = filteredData.filter((user) => user.email.toLowerCase().includes(searchTerm));
  }

  if (role) {
    filteredData = filteredData.filter((user) => user.role === role);
  }

  if (min_devices !== undefined) {
    filteredData = filteredData.filter((user) => user.device_count >= min_devices);
  }

  if (max_devices !== undefined) {
    filteredData = filteredData.filter((user) => user.device_count <= max_devices);
  }

  if (active_within_days !== undefined) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - active_within_days);
    filteredData = filteredData.filter(
      (user) => user.last_activity && new Date(user.last_activity) >= cutoffDate
    );
  }

  if (inactive_for_days !== undefined) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactive_for_days);
    filteredData = filteredData.filter(
      (user) => !user.last_activity || new Date(user.last_activity) < cutoffDate
    );
  }

  // Transform to typed response
  const transformedData: AdminUsersOverview[] = filteredData.map((row) => ({
    user_id: row.user_id,
    email: row.email,
    role: row.role as UserRole,
    user_created_at: new Date(row.user_created_at),
    device_count: row.device_count,
    sensor_count: row.sensor_count,
    actuator_count: row.actuator_count,
    last_activity: row.last_activity ? new Date(row.last_activity) : null,
  }));

  // Get cursor for next page
  const nextCursor =
    transformedData.length === page_size
      ? transformedData[transformedData.length - 1].user_id
      : null;

  return {
    data: transformedData,
    next_cursor: nextCursor,
    has_more: transformedData.length === page_size,
    total: count || undefined,
  };
}

/**
 * Get detailed information for a specific user (all devices, sensors, actuators)
 *
 * Implementation Notes:
 * - Queries devices table with nested joins to sensors and actuators
 * - RLS policies automatically enforce admin access
 * - Includes latest sensor readings for monitoring
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - User UUID to fetch details for
 * @returns Detailed user information with all devices
 * @throws Error if user is not admin or query fails
 *
 * @see spec.md User Story 4 (P4) - Admin Views Detailed Project Information
 * @see spec.md FR-004, FR-005
 *
 * @example
 * ```typescript
 * const userDetail = await getUserDetail(supabase, 'user-uuid-123');
 * console.log(`User has ${userDetail.devices.length} devices`);
 * ```
 */
export async function getUserDetail(
  supabase: SupabaseClient,
  userId: string
): Promise<AdminUserDetail> {
  // First, get user overview
  const { data: overview, error: overviewError } = await supabase
    .from('admin_users_overview')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (overviewError) {
    console.error('[admin-api.getUserDetail] Overview error:', overviewError);
    throw overviewError;
  }

  // Then, get all devices with sensors and actuators
  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select(
      `
      *,
      sensors (*),
      actuators (*)
    `
    )
    .eq('user_id', userId);

  if (devicesError) {
    console.error('[admin-api.getUserDetail] Devices error:', devicesError);
    throw devicesError;
  }

  // Transform devices to AdminDeviceInfo
  const transformedDevices: AdminDeviceInfo[] = await Promise.all(
    (devices || []).map(async (device) => {
      // For each sensor, get latest reading
      const sensorsWithReadings = await Promise.all(
        (device.sensors || []).map(async (sensor) => {
          const { data: latestReading } = await supabase
            .from('sensor_readings')
            .select('value, timestamp')
            .eq('sensor_id', sensor.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .single();

          return {
            ...sensor,
            discovered_at: new Date(sensor.discovered_at),
            latest_reading: latestReading
              ? {
                  value: latestReading.value,
                  timestamp: new Date(latestReading.timestamp),
                }
              : null,
          };
        })
      );

      return {
        ...device,
        registered_at: new Date(device.registered_at),
        last_seen_at: device.last_seen_at ? new Date(device.last_seen_at) : null,
        sensors: sensorsWithReadings,
        actuators: (device.actuators || []).map((actuator) => ({
          ...actuator,
          discovered_at: new Date(actuator.discovered_at),
        })),
      };
    })
  );

  return {
    user_id: overview.user_id,
    email: overview.email,
    role: overview.role as UserRole,
    user_created_at: new Date(overview.user_created_at),
    device_count: overview.device_count,
    sensor_count: overview.sensor_count,
    actuator_count: overview.actuator_count,
    last_activity: overview.last_activity ? new Date(overview.last_activity) : null,
    devices: transformedDevices,
  };
}

// ============================================================================
// Admin Project Detail Queries
// ============================================================================

/**
 * Get comprehensive project/device details including recent readings
 *
 * Implementation Notes:
 * - Consolidates device, owner, and activity data
 * - Fetches last 24 hours of readings for monitoring
 * - Calculates activity summary metrics
 *
 * @param supabase - Authenticated Supabase client
 * @param deviceId - Device UUID
 * @returns Detailed project information for admin support
 * @throws Error if user is not admin or query fails
 *
 * @see spec.md User Story 4 (P4) - Admin Views Detailed Project Information
 * @see spec.md FR-004, FR-005
 *
 * @example
 * ```typescript
 * const project = await getProjectDetails(supabase, 'device-uuid-123');
 * console.log(`Project has ${project.activity_summary.total_readings} total readings`);
 * ```
 */
export async function getProjectDetails(
  supabase: SupabaseClient,
  deviceId: string
): Promise<AdminProjectDetail> {
  // Fetch device with all nested data
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select(
      `
      *,
      sensors (*),
      actuators (*)
    `
    )
    .eq('id', deviceId)
    .single();

  if (deviceError) {
    console.error('[admin-api.getProjectDetails] Device error:', deviceError);
    throw deviceError;
  }

  // Fetch owner information from auth.users via admin_users_overview
  const { data: owner, error: ownerError } = await supabase
    .from('admin_users_overview')
    .select('user_id, email, role')
    .eq('user_id', device.user_id)
    .single();

  if (ownerError) {
    console.error('[admin-api.getProjectDetails] Owner error:', ownerError);
    throw ownerError;
  }

  // Fetch recent readings (last 24 hours) for all sensors on this device
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week_ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sensorIds = (device.sensors || []).map((s) => s.id);

  const { data: recentReadings, error: readingsError } = await supabase
    .from('sensor_readings')
    .select('sensor_id, timestamp, value')
    .in('sensor_id', sensorIds)
    .gte('timestamp', yesterday.toISOString())
    .order('timestamp', { ascending: false });

  if (readingsError) {
    console.error('[admin-api.getProjectDetails] Readings error:', readingsError);
    throw readingsError;
  }

  // Count total readings and readings in last 7 days
  const { count: totalCount } = await supabase
    .from('sensor_readings')
    .select('*', { count: 'exact', head: true })
    .in('sensor_id', sensorIds);

  const { count: weekCount } = await supabase
    .from('sensor_readings')
    .select('*', { count: 'exact', head: true })
    .in('sensor_id', sensorIds)
    .gte('timestamp', week_ago.toISOString());

  // Group readings by sensor
  const readingsBySensor = new Map<string, Array<{ timestamp: Date; value: number }>>();

  for (const reading of recentReadings || []) {
    if (!readingsBySensor.has(reading.sensor_id)) {
      readingsBySensor.set(reading.sensor_id, []);
    }
    readingsBySensor.get(reading.sensor_id)!.push({
      timestamp: new Date(reading.timestamp),
      value: reading.value,
    });
  }

  // Find most recent reading across all sensors
  let lastReadingAt: Date | null = null;
  if (recentReadings && recentReadings.length > 0) {
    lastReadingAt = new Date(recentReadings[0].timestamp);
  }

  // Determine if device is active (reading in last 15 minutes)
  const isActive = lastReadingAt
    ? (now.getTime() - lastReadingAt.getTime()) / (1000 * 60) <= 15
    : false;

  return {
    device: {
      ...device,
      registered_at: new Date(device.registered_at),
      last_seen_at: device.last_seen_at ? new Date(device.last_seen_at) : null,
      sensors: (device.sensors || []).map((s) => ({
        ...s,
        discovered_at: new Date(s.discovered_at),
      })),
      actuators: (device.actuators || []).map((a) => ({
        ...a,
        discovered_at: new Date(a.discovered_at),
      })),
    },
    owner: {
      user_id: owner.user_id,
      email: owner.email,
      role: owner.role as UserRole,
    },
    recent_readings: (device.sensors || []).map((sensor) => ({
      sensor_id: sensor.id,
      sensor_name: sensor.name,
      sensor_type: sensor.sensor_type,
      readings: readingsBySensor.get(sensor.id) || [],
    })),
    activity_summary: {
      total_readings: totalCount || 0,
      readings_last_24h: (recentReadings || []).length,
      readings_last_7d: weekCount || 0,
      last_reading_at: lastReadingAt,
      is_active: isActive,
    },
  };
}

// ============================================================================
// Admin Mutation Operations
// ============================================================================

/**
 * Update device configuration as admin
 *
 * Implementation Notes:
 * - Uses RLS policy: "Users or admin can update devices"
 * - Admin can update any device (bypasses user_id check)
 * - Changes are immediately visible to device owner via real-time
 *
 * @param supabase - Authenticated Supabase client
 * @param params - Device ID and fields to update
 * @returns Success result with updated device data
 * @throws Error if user is not admin or update fails
 *
 * @see data-model.md - Updated RLS policies for devices table
 * @see research.md Section 4 - Real-time Sync for Multi-User Scenarios
 * @see spec.md User Story 3 (P3) - Admin Edits User Project Configurations
 * @see spec.md FR-011, FR-014
 *
 * @example
 * ```typescript
 * const result = await updateDevice(supabase, {
 *   device_id: 'device-uuid-123',
 *   updates: { name: 'Greenhouse Alpha' }
 * });
 * ```
 */
export async function updateDevice(
  supabase: SupabaseClient,
  params: AdminUpdateDeviceParams
): Promise<AdminActionResult> {
  const { device_id, updates } = params;

  const { data, error } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', device_id)
    .select()
    .single();

  if (error) {
    console.error('[admin-api.updateDevice] Error:', error);
    return {
      success: false,
      message: 'Failed to update device',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Device updated successfully',
    data,
  };
}

/**
 * Update sensor configuration as admin
 *
 * @see updateDevice for implementation notes
 */
export async function updateSensor(
  supabase: SupabaseClient,
  params: AdminUpdateSensorParams
): Promise<AdminActionResult> {
  const { sensor_id, updates } = params;

  const { data, error } = await supabase
    .from('sensors')
    .update(updates)
    .eq('id', sensor_id)
    .select()
    .single();

  if (error) {
    console.error('[admin-api.updateSensor] Error:', error);
    return {
      success: false,
      message: 'Failed to update sensor',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Sensor updated successfully',
    data,
  };
}

/**
 * Update actuator configuration as admin
 *
 * @see updateDevice for implementation notes
 */
export async function updateActuator(
  supabase: SupabaseClient,
  params: AdminUpdateActuatorParams
): Promise<AdminActionResult> {
  const { actuator_id, updates } = params;

  const { data, error } = await supabase
    .from('actuators')
    .update(updates)
    .eq('id', actuator_id)
    .select()
    .single();

  if (error) {
    console.error('[admin-api.updateActuator] Error:', error);
    return {
      success: false,
      message: 'Failed to update actuator',
      error: error.message,
    };
  }

  return {
    success: true,
    message: 'Actuator updated successfully',
    data,
  };
}
