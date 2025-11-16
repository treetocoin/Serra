/**
 * Type Definitions for Admin User Role Feature
 *
 * These types define the domain models for admin user role functionality,
 * including user roles, admin dashboard data, project details, and search filters.
 *
 * @feature 006-fammi-un-tipo
 * @see ../spec.md - Feature specification
 * @see ../data-model.md - Database schema and entities
 */

// ============================================================================
// User Role Types
// ============================================================================

/**
 * User role enumeration
 *
 * @see data-model.md - user_roles table
 * @see spec.md FR-001
 */
export type UserRole = 'user' | 'admin';

/**
 * User role record from user_roles table
 *
 * @see data-model.md - user_roles table schema
 */
export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Admin Dashboard Types
// ============================================================================

/**
 * Aggregated user overview for admin dashboard
 *
 * Represents a single row from the admin_users_overview database view.
 * Provides admin with at-a-glance statistics for each registered user.
 *
 * @see data-model.md - admin_users_overview view
 * @see spec.md User Story 1 (P1) - Admin Views All User Projects
 * @see spec.md FR-005
 */
export interface AdminUsersOverview {
  /** User UUID from auth.users */
  user_id: string;

  /** User email address */
  email: string;

  /** Current user role */
  role: UserRole;

  /** When user registered in the system */
  user_created_at: Date;

  /** Total devices owned by user */
  device_count: number;

  /** Total sensors across all user's devices */
  sensor_count: number;

  /** Total actuators across all user's devices */
  actuator_count: number;

  /** Most recent sensor reading timestamp (null if no data) */
  last_activity: Date | null;
}

/**
 * Extended user information with device details
 *
 * Used in detailed admin views to show all devices for a specific user.
 */
export interface AdminUserDetail extends AdminUsersOverview {
  /** List of all devices owned by this user */
  devices: AdminDeviceInfo[];
}

/**
 * Device information for admin view
 *
 * Includes device metadata, connection status, and counts of sensors/actuators.
 */
export interface AdminDeviceInfo {
  id: string;
  user_id: string;
  name: string;
  connection_status: string | null;
  last_seen_at: Date | null;
  registered_at: Date;
  firmware_version: string | null;
  configuration_requested: boolean;
  composite_device_id: string | null;
  device_number: number | null;
  project_id: string | null;
  config_version: number;

  /** Sensors attached to this device */
  sensors: AdminSensorInfo[];

  /** Actuators attached to this device */
  actuators: AdminActuatorInfo[];
}

/**
 * Sensor information for admin view
 */
export interface AdminSensorInfo {
  id: string;
  device_id: string;
  sensor_id: string;
  sensor_type: string;
  unit: string;
  name: string | null;
  min_value: number | null;
  max_value: number | null;
  discovered_at: Date;
  is_active: boolean;

  /** Latest reading for this sensor (optional) */
  latest_reading?: {
    value: number;
    timestamp: Date;
  } | null;
}

/**
 * Actuator information for admin view
 */
export interface AdminActuatorInfo {
  id: string;
  device_id: string;
  actuator_id: string;
  actuator_type: string;
  name: string | null;
  current_state: number;
  supports_pwm: boolean;
  discovered_at: Date;
  is_active: boolean;
}

// ============================================================================
// Admin Project Detail Types
// ============================================================================

/**
 * Detailed project view for admin (project = device with all metadata)
 *
 * Consolidates all information about a single user's project/device
 * for troubleshooting and support purposes.
 *
 * @see spec.md User Story 4 (P4) - Admin Views Detailed Project Information
 */
export interface AdminProjectDetail {
  /** Device/project information */
  device: AdminDeviceInfo;

  /** Owner information */
  owner: {
    user_id: string;
    email: string;
    role: UserRole;
  };

  /** Recent sensor readings (last 24 hours) */
  recent_readings: {
    sensor_id: string;
    sensor_name: string | null;
    sensor_type: string;
    readings: Array<{
      timestamp: Date;
      value: number;
    }>;
  }[];

  /** Activity summary */
  activity_summary: {
    total_readings: number;
    readings_last_24h: number;
    readings_last_7d: number;
    last_reading_at: Date | null;
    is_active: boolean; // true if reading in last 15 minutes
  };
}

// ============================================================================
// Search & Filter Types
// ============================================================================

/**
 * Filters for admin user search and pagination
 *
 * @see spec.md User Story 2 (P2) - Admin Project Search and Filtering
 */
export interface AdminSearchFilters {
  /** Search by user email (partial match) */
  email?: string;

  /** Filter by user role */
  role?: UserRole;

  /** Filter by minimum device count */
  min_devices?: number;

  /** Filter by maximum device count */
  max_devices?: number;

  /** Filter by activity: users with readings in last N days */
  active_within_days?: number;

  /** Filter by activity: users with no readings in last N days */
  inactive_for_days?: number;

  /** Sort field */
  sort_by?: 'email' | 'user_created_at' | 'device_count' | 'last_activity';

  /** Sort direction */
  sort_direction?: 'asc' | 'desc';

  /** Pagination: page size (default 20) */
  page_size?: number;

  /** Pagination: cursor for next page (user_id) */
  cursor?: string;
}

/**
 * Paginated response for admin user list
 */
export interface AdminUserListResponse {
  /** User records for current page */
  data: AdminUsersOverview[];

  /** Cursor for next page (null if no more pages) */
  next_cursor: string | null;

  /** Whether there are more pages */
  has_more: boolean;

  /** Total count (may be slow for large datasets, optional) */
  total?: number;
}

// ============================================================================
// Admin Action Types
// ============================================================================

/**
 * Parameters for admin updating a device
 *
 * @see spec.md User Story 3 (P3) - Admin Edits User Project Configurations
 * @see spec.md FR-011
 */
export interface AdminUpdateDeviceParams {
  device_id: string;
  updates: {
    name?: string;
    connection_status?: string | null;
    firmware_version?: string | null;
    configuration_requested?: boolean;
    composite_device_id?: string | null;
    device_number?: number | null;
    project_id?: string | null;
  };
}

/**
 * Parameters for admin updating a sensor
 */
export interface AdminUpdateSensorParams {
  sensor_id: string;
  updates: {
    name?: string | null;
    sensor_type?: string;
    unit?: string;
    min_value?: number | null;
    max_value?: number | null;
    is_active?: boolean;
  };
}

/**
 * Parameters for admin updating an actuator
 */
export interface AdminUpdateActuatorParams {
  actuator_id: string;
  updates: {
    name?: string | null;
    actuator_type?: string;
    supports_pwm?: boolean;
    is_active?: boolean;
  };
}

/**
 * Result of admin action
 */
export interface AdminActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Admin dashboard UI state
 */
export interface AdminDashboardState {
  /** Current search/filter values */
  filters: AdminSearchFilters;

  /** Selected user for detail view */
  selected_user_id: string | null;

  /** Selected device for detail view */
  selected_device_id: string | null;

  /** Whether admin is in edit mode */
  is_editing: boolean;
}

/**
 * Admin project edit context
 *
 * Indicates when admin is editing another user's project.
 *
 * @see spec.md FR-013
 */
export interface AdminEditContext {
  is_admin_editing: boolean;
  project_owner_email: string;
  admin_email: string;
}

// ============================================================================
// Validation & Status Types
// ============================================================================

/**
 * User activity status for admin dashboard
 */
export type UserActivityStatus = 'active' | 'inactive' | 'never_active';

/**
 * Helper to determine user activity status
 */
export interface UserActivityInfo {
  status: UserActivityStatus;
  last_activity: Date | null;
  days_since_activity: number | null;
  message: string;
}
