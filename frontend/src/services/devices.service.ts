import { supabase } from '../lib/supabase';
import type { Device, AvailableDeviceId } from '../types/device.types';

export const devicesService = {
  // Legacy method - for backward compatibility only
  async getDevices(_userId?: string): Promise<{ devices: Device[]; error: Error | null }> {
    console.warn('getDevices() is deprecated. Use getProjectDevices() instead.');
    return { devices: [], error: null };
  },

  async getProjectDevices(projectId: string): Promise<Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('project_id', projectId)
      .order('device_number', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getAvailableDeviceIds(projectId: string): Promise<AvailableDeviceId[]> {
    const { data, error } = await supabase.rpc('get_available_device_ids', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  async registerDevice(
    name: string,
    projectId: string,
    deviceNumber: number
  ): Promise<{
    composite_device_id: string;
    id: string;
    registered_at: string;
  }> {
    const { data, error } = await supabase.rpc('register_device_with_project', {
      p_name: name,
      p_project_id: projectId,
      p_device_number: deviceNumber
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error(`Device ESP${deviceNumber} is already registered in this project.`);
      }
      throw error;
    }

    return data[0];
  },

  async getDevice(compositeDeviceId: string): Promise<Device> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('composite_device_id', compositeDeviceId)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDevice(compositeDeviceId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_device', {
      p_composite_device_id: compositeDeviceId
    });

    if (error) throw error;
    return data;
  },

  getConnectionStatus(lastSeenAt: string | null): 'online' | 'offline' | 'never' {
    if (!lastSeenAt) return 'never';

    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    return diffSeconds < 120 ? 'online' : 'offline';
  }
};
