import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// Database types (generated from Supabase schema)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      devices: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          connection_status: string | null;
          last_seen_at: string | null;
          registered_at: string;
          api_key_hash: string;
          firmware_version: string | null;
          configuration_requested: boolean;
          composite_device_id: string | null;
          device_number: number | null;
          project_id: string | null;
          config_version: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          connection_status?: string | null;
          last_seen_at?: string | null;
          registered_at?: string;
          api_key_hash: string;
          firmware_version?: string | null;
          configuration_requested?: boolean;
          composite_device_id?: string | null;
          device_number?: number | null;
          project_id?: string | null;
          config_version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          connection_status?: string | null;
          last_seen_at?: string | null;
          api_key_hash?: string;
          registered_at?: string;
          firmware_version?: string | null;
          configuration_requested?: boolean;
          composite_device_id?: string | null;
          device_number?: number | null;
          project_id?: string | null;
          config_version?: number;
        };
      };
      sensors: {
        Row: {
          id: string;
          device_id: string;
          sensor_id: string;
          sensor_type: string;
          unit: string;
          name: string | null;
          min_value: number | null;
          max_value: number | null;
          discovered_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          device_id: string;
          sensor_id: string;
          sensor_type: string;
          unit: string;
          name?: string | null;
          min_value?: number | null;
          max_value?: number | null;
          discovered_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          device_id?: string;
          sensor_id?: string;
          sensor_type?: string;
          unit?: string;
          name?: string | null;
          min_value?: number | null;
          max_value?: number | null;
          discovered_at?: string;
          is_active?: boolean;
        };
      };
      actuators: {
        Row: {
          id: string;
          device_id: string;
          actuator_id: string;
          actuator_type: string;
          name: string | null;
          current_state: number;
          supports_pwm: boolean;
          discovered_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          device_id: string;
          actuator_id: string;
          actuator_type: string;
          name?: string | null;
          current_state?: number;
          supports_pwm?: boolean;
          discovered_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          device_id?: string;
          actuator_id?: string;
          actuator_type?: string;
          name?: string | null;
          current_state?: number;
          supports_pwm?: boolean;
          discovered_at?: string;
          is_active?: boolean;
        };
      };
      sensor_readings: {
        Row: {
          id: number;
          sensor_id: string;
          timestamp: string;
          value: number;
        };
        Insert: {
          id?: number;
          sensor_id: string;
          timestamp?: string;
          value: number;
        };
        Update: {
          id?: number;
          sensor_id?: string;
          timestamp?: string;
          value?: number;
        };
      };
      commands: {
        Row: {
          id: string;
          actuator_id: string;
          command_type: string;
          value: number | null;
          created_at: string;
          delivered_at: string | null;
          executed_at: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          actuator_id: string;
          command_type: string;
          value?: number | null;
          created_at?: string;
          delivered_at?: string | null;
          executed_at?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          actuator_id?: string;
          command_type?: string;
          value?: number | null;
          created_at?: string;
          delivered_at?: string | null;
          executed_at?: string | null;
          status?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      confirm_command_execution: {
        Args: {
          p_command_id: string;
          p_success?: boolean;
          p_new_state?: number;
        };
        Returns: boolean;
      };
      get_latest_sensor_readings: {
        Args: { user_id_param: string };
        Returns: Array<{
          device_id: string;
          device_name: string;
          sensor_id: string;
          sensor_name: string;
          sensor_type: string;
          value: number;
          unit: string;
          reading_timestamp: string;
        }>;
      };
      get_pending_commands: {
        Args: { device_id_param: string };
        Returns: Array<{
          id: string;
          actuator_id: string;
          command_type: string;
          value: number;
        }>;
      };
      upsert_sensor: {
        Args: {
          p_device_id: string;
          p_sensor_id: string;
          p_sensor_type: string;
          p_unit?: string;
          p_name?: string;
          p_min_value?: number;
          p_max_value?: number;
        };
        Returns: string;
      };
      upsert_actuator: {
        Args: {
          p_device_id: string;
          p_actuator_id: string;
          p_actuator_type: string;
          p_name?: string;
          p_supports_pwm?: boolean;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
};
