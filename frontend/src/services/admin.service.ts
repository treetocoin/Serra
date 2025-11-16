/**
 * Admin Service
 *
 * Provides API functions for admin user role feature.
 * All queries leverage Row Level Security (RLS) policies that
 * automatically enforce admin access rules at the database level.
 *
 * @feature 006-fammi-un-tipo
 * @see ../types/admin.types.ts - Type definitions
 */

import { supabase } from '../lib/supabase';
import type {
  UserRole,
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
} from '../types/admin.types';

// ============================================================================
// Admin Role Checking
// ============================================================================

/**
 * Get the current user's role from the user_roles table
 *
 * Uses RLS policy: "Users can view own role"
 * Returns 'user' as default if no role record exists
 *
 * @returns User's role or 'user' as default
 * @throws Error if query fails or user not authenticated
 */
export async function getUserRole(): Promise<UserRole> {
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
 * Convenience wrapper around getUserRole() for boolean checks
 *
 * @returns True if user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getUserRole();
  return role === 'admin';
}

// ============================================================================
// Admin Dashboard Queries
// ============================================================================

/**
 * Get all users with aggregated project statistics
 *
 * Queries admin_users_overview database view which is protected by RLS.
 * Only admins can access this view.
 *
 * @returns Array of user overview records
 * @throws Error if user is not admin or query fails
 */
export async function getAllUsersWithProjects(): Promise<AdminUsersOverview[]> {
  const { data, error } = await supabase
    .from('admin_users_overview')
    .select('*')
    .order('email', { ascending: true });

  if (error) {
    console.error('[admin.service.getAllUsersWithProjects] Error:', error);
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
 * Uses cursor-based pagination for efficiency.
 * Filters are applied via SQL queries where possible.
 *
 * @param filters - Search and pagination parameters
 * @returns Paginated user list with cursor for next page
 * @throws Error if user is not admin or query fails
 */
export async function searchUsers(
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
    console.error('[admin.service.searchUsers] Error:', error);
    throw error;
  }

  let filteredData = data || [];

  // Apply client-side filters (in production, move to SQL for better performance)
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
 * Get detailed information for a specific user
 *
 * Includes all devices with sensors, actuators, and latest readings.
 * RLS policies automatically enforce admin access.
 *
 * @param userId - User UUID to fetch details for
 * @returns Detailed user information with all devices
 * @throws Error if user is not admin or query fails
 */
export async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  // First, get user overview
  const { data: overview, error: overviewError } = await supabase
    .from('admin_users_overview')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (overviewError) {
    console.error('[admin.service.getUserDetail] Overview error:', overviewError);
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
    console.error('[admin.service.getUserDetail] Devices error:', devicesError);
    throw devicesError;
  }

  // Transform devices to AdminDeviceInfo
  const transformedDevices: AdminDeviceInfo[] = await Promise.all(
    (devices || []).map(async (device) => {
      // For each sensor, get latest reading
      const sensorsWithReadings = await Promise.all(
        (device.sensors || []).map(async (sensor: any) => {
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
        actuators: (device.actuators || []).map((actuator: any) => ({
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
 * Consolidates device, owner, and activity data.
 * Fetches last 24 hours of readings for monitoring.
 *
 * @param deviceId - Device UUID
 * @returns Detailed project information for admin support
 * @throws Error if user is not admin or query fails
 */
export async function getProjectDetails(deviceId: string): Promise<AdminProjectDetail> {
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
    console.error('[admin.service.getProjectDetails] Device error:', deviceError);
    throw deviceError;
  }

  // Fetch owner information from admin_users_overview
  const { data: owner, error: ownerError } = await supabase
    .from('admin_users_overview')
    .select('user_id, email, role')
    .eq('user_id', device.user_id)
    .single();

  if (ownerError) {
    console.error('[admin.service.getProjectDetails] Owner error:', ownerError);
    throw ownerError;
  }

  // Fetch recent readings (last 24 hours) for all sensors on this device
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week_ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sensorIds = (device.sensors || []).map((s: any) => s.id);

  const { data: recentReadings, error: readingsError } = await supabase
    .from('sensor_readings')
    .select('sensor_id, timestamp, value')
    .in('sensor_id', sensorIds)
    .gte('timestamp', yesterday.toISOString())
    .order('timestamp', { ascending: false });

  if (readingsError) {
    console.error('[admin.service.getProjectDetails] Readings error:', readingsError);
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
      sensors: (device.sensors || []).map((s: any) => ({
        ...s,
        discovered_at: new Date(s.discovered_at),
      })),
      actuators: (device.actuators || []).map((a: any) => ({
        ...a,
        discovered_at: new Date(a.discovered_at),
      })),
    },
    owner: {
      user_id: owner.user_id,
      email: owner.email,
      role: owner.role as UserRole,
    },
    recent_readings: (device.sensors || []).map((sensor: any) => ({
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
 * Uses RLS policy: "Users or admin can update devices"
 * Admin can update any device (bypasses user_id check)
 *
 * @param params - Device ID and fields to update
 * @returns Success result with updated device data
 * @throws Error if user is not admin or update fails
 */
export async function updateDevice(params: AdminUpdateDeviceParams): Promise<AdminActionResult> {
  const { device_id, updates } = params;

  const { data, error } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', device_id)
    .select()
    .single();

  if (error) {
    console.error('[admin.service.updateDevice] Error:', error);
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
 * @param params - Sensor ID and fields to update
 * @returns Success result with updated sensor data
 */
export async function updateSensor(params: AdminUpdateSensorParams): Promise<AdminActionResult> {
  const { sensor_id, updates } = params;

  const { data, error } = await supabase
    .from('sensors')
    .update(updates)
    .eq('id', sensor_id)
    .select()
    .single();

  if (error) {
    console.error('[admin.service.updateSensor] Error:', error);
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
 * @param params - Actuator ID and fields to update
 * @returns Success result with updated actuator data
 */
export async function updateActuator(
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
    console.error('[admin.service.updateActuator] Error:', error);
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

/**
 * Admin Service
 *
 * Export all admin functions as a service object for convenience
 */
export const adminService = {
  getUserRole,
  isAdmin,
  getAllUsersWithProjects,
  searchUsers,
  getUserDetail,
  getProjectDetails,
  updateDevice,
  updateSensor,
  updateActuator,
};
