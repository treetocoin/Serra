import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];
type DeviceInsert = Database['public']['Tables']['devices']['Insert'];

export interface RegisterDeviceData {
  name: string;
  userId: string;
}

export interface DeviceWithApiKey extends Device {
  apiKey?: string; // Plain API key (shown only once)
}

/**
 * Device Service
 * Manages ESP32 device registration, status, and API keys
 */
export const devicesService = {
  /**
   * Generate a secure API key for device authentication
   */
  generateApiKey(): string {
    // Generate 32-byte random hex string (64 characters)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Hash API key for secure storage (using a simple hash for demo)
   * In production, use bcrypt or similar
   */
  async hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Register a new device and generate API key
   */
  async registerDevice({ name, userId }: RegisterDeviceData): Promise<{
    device: DeviceWithApiKey | null;
    error: Error | null;
  }> {
    try {
      // Generate API key
      const apiKey = this.generateApiKey();
      const apiKeyHash = await this.hashApiKey(apiKey);

      // Create device record
      const { data, error } = await supabase
        .from('devices')
        .insert({
          user_id: userId,
          name,
          api_key_hash: apiKeyHash,
          connection_status: 'offline',
        })
        .select()
        .single();

      if (error) throw error;

      // Return device with plain API key (only shown once)
      return {
        device: { ...data, apiKey },
        error: null,
      };
    } catch (error) {
      return {
        device: null,
        error: error as Error,
      };
    }
  },

  /**
   * Get all devices for a user
   */
  async getDevices(userId: string): Promise<{
    devices: Device[];
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', userId)
        .order('registered_at', { ascending: false });

      if (error) throw error;

      return {
        devices: data || [],
        error: null,
      };
    } catch (error) {
      return {
        devices: [],
        error: error as Error,
      };
    }
  },

  /**
   * Get a single device by ID
   */
  async getDevice(deviceId: string): Promise<{
    device: Device | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('id', deviceId)
        .single();

      if (error) throw error;

      return {
        device: data,
        error: null,
      };
    } catch (error) {
      return {
        device: null,
        error: error as Error,
      };
    }
  },

  /**
   * Update device information
   */
  async updateDevice(
    deviceId: string,
    updates: Partial<DeviceInsert>
  ): Promise<{
    device: Device | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', deviceId)
        .select()
        .single();

      if (error) throw error;

      return {
        device: data,
        error: null,
      };
    } catch (error) {
      return {
        device: null,
        error: error as Error,
      };
    }
  },

  /**
   * Delete a device (cascades to sensors, actuators, readings)
   */
  async deleteDevice(deviceId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.from('devices').delete().eq('id', deviceId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  /**
   * Check device connection status based on last_seen_at
   */
  getConnectionStatus(lastSeenAt: string | null): 'online' | 'offline' | 'error' {
    if (!lastSeenAt) return 'offline';

    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    // Device is online if seen within last 90 seconds (30-60s poll + buffer)
    if (diffSeconds < 90) return 'online';
    return 'offline';
  },

  /**
   * Request sensor configuration from device
   * Sets configuration_requested flag that ESP8266 will poll for
   */
  async requestSensorConfiguration(deviceId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ configuration_requested: true })
        .eq('id', deviceId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
