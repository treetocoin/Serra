/**
 * Supabase Query Contracts for Dati Page
 *
 * These interfaces define the exact shape of data returned from Supabase queries.
 * They serve as the contract between the database and the frontend application.
 *
 * @version 1.0.0
 * @feature 005-lavoriamo-alla-pagina
 */

// ============================================================================
// Base Types from Database Schema
// ============================================================================

export type SensorType =
  | 'dht_sopra_temp'
  | 'dht_sopra_humidity'
  | 'dht_sotto_temp'
  | 'dht_sotto_humidity'
  | 'soil_moisture_1'
  | 'soil_moisture_2'
  | 'soil_moisture_3'
  | 'soil_moisture_4'
  | 'soil_moisture_5'
  | 'water_level'
  | 'unconfigured';

export type DeviceStatus = 'online' | 'offline' | 'error';

// ============================================================================
// Query 1: Get Current Readings
// ============================================================================

/**
 * Query: Fetch latest reading per sensor type for user's devices
 *
 * SQL:
 * ```sql
 * SELECT sr.sensor_type, sr.value, sr.timestamp, sr.device_id, s.unit
 * FROM sensor_readings sr
 * JOIN sensors s ON sr.sensor_id = s.id
 * JOIN devices d ON s.device_id = d.id
 * WHERE d.user_id = $userId
 * ORDER BY sr.timestamp DESC
 * ```
 *
 * Supabase Query:
 * ```typescript
 * supabase
 *   .from('sensor_readings')
 *   .select('sensor_type, value, timestamp, device_id, sensors(unit)')
 *   .eq('devices.user_id', userId)
 *   .order('timestamp', { ascending: false })
 * ```
 */
export interface CurrentReadingQueryResult {
  sensor_type: SensorType;
  value: number;
  timestamp: string; // ISO 8601 string
  device_id: string; // UUID
  sensors: {
    unit: string;
  } | null;
}

// ============================================================================
// Query 2: Get Time-Series Data (Full Granularity)
// ============================================================================

/**
 * Query: Fetch time-series readings for specific sensors in a date range
 *
 * Supabase Query:
 * ```typescript
 * supabase
 *   .from('sensor_readings')
 *   .select('timestamp, value, sensor_type')
 *   .in('sensor_id', sensorIds)
 *   .gte('timestamp', startDate.toISOString())
 *   .lte('timestamp', endDate.toISOString())
 *   .order('timestamp', { ascending: true })
 *   .limit(10000)
 * ```
 */
export interface TimeSeriesQueryResult {
  timestamp: string; // ISO 8601 string
  value: number;
  sensor_type: SensorType;
}

// ============================================================================
// Query 3: Get Time-Series Data (Aggregated via RPC)
// ============================================================================

/**
 * Query: Fetch aggregated time-series data using SQL aggregation
 *
 * Note: This would be implemented as a Supabase RPC function in a future
 * migration. For now, aggregation is done client-side in the service layer.
 *
 * Future RPC signature:
 * ```sql
 * CREATE FUNCTION get_aggregated_sensor_data(
 *   p_sensor_ids UUID[],
 *   p_start_date TIMESTAMPTZ,
 *   p_end_date TIMESTAMPTZ,
 *   p_interval TEXT -- 'hour' or 'day'
 * ) RETURNS TABLE (
 *   bucket TIMESTAMPTZ,
 *   sensor_type TEXT,
 *   avg_value NUMERIC,
 *   min_value NUMERIC,
 *   max_value NUMERIC,
 *   sample_count INTEGER
 * )
 * ```
 */
export interface AggregatedTimeSeriesQueryResult {
  bucket: string; // ISO 8601 string (start of time bucket)
  sensor_type: SensorType;
  avg_value: number;
  min_value: number;
  max_value: number;
  sample_count: number;
}

// ============================================================================
// Query 4: Get Devices for User
// ============================================================================

/**
 * Query: Fetch all devices for a user
 *
 * Supabase Query:
 * ```typescript
 * supabase
 *   .from('devices')
 *   .select('id, name, connection_status, last_seen_at')
 *   .eq('user_id', userId)
 * ```
 */
export interface DeviceQueryResult {
  id: string; // UUID
  name: string;
  connection_status: DeviceStatus;
  last_seen_at: string | null; // ISO 8601 string
}

// ============================================================================
// Query 5: Get Sensors for Devices
// ============================================================================

/**
 * Query: Fetch all sensors for specific devices
 *
 * Supabase Query:
 * ```typescript
 * supabase
 *   .from('sensors')
 *   .select('id, device_id, sensor_type, unit, name, is_active')
 *   .in('device_id', deviceIds)
 *   .eq('is_active', true)
 * ```
 */
export interface SensorQueryResult {
  id: string; // UUID
  device_id: string; // UUID
  sensor_type: SensorType;
  unit: string;
  name: string | null;
  is_active: boolean;
}

// ============================================================================
// Query Response Wrappers
// ============================================================================

/**
 * Standard Supabase query response wrapper
 */
export interface SupabaseQueryResponse<T> {
  data: T[] | null;
  error: {
    message: string;
    details: string;
    hint: string;
    code: string;
  } | null;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Expected Supabase error codes that the frontend should handle
 */
export const SUPABASE_ERROR_CODES = {
  PGRST116: 'No rows found', // Not an error for our use case
  '42P01': 'Undefined table', // Database schema issue
  '42883': 'Undefined function', // RPC function not found
  PGRST301: 'Request timeout',
  '08006': 'Connection failure',
} as const;

export type SupabaseErrorCode = keyof typeof SUPABASE_ERROR_CODES;
