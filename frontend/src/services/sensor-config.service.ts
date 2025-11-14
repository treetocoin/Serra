import { supabase } from '@/lib/supabase';
import type { SensorConfig, CreateSensorConfig } from '@/types/sensor-config.types';

export const sensorConfigService = {
  /**
   * Fetch active sensor configurations for a device
   */
  async getActiveConfigs(deviceId: string): Promise<SensorConfig[]> {
    const { data, error } = await supabase
      .from('device_sensor_configs')
      .select('*')
      .eq('device_id', deviceId)
      .eq('is_active', true)
      .order('sensor_type', { ascending: true });

    if (error) throw error;
    return data as SensorConfig[];
  },

  /**
   * Create new sensor configuration
   * Checks for duplicate port assignments before creating
   */
  async createConfig(config: CreateSensorConfig): Promise<SensorConfig> {
    // Check for existing active config on same port
    const { data: existing } = await supabase
      .from('device_sensor_configs')
      .select('id, sensor_type')
      .eq('device_id', config.device_id)
      .eq('port_id', config.port_id)
      .eq('is_active', true)
      .single();

    if (existing) {
      throw new Error(
        `Port ${config.port_id} is already configured as ${existing.sensor_type}. Please remove the existing configuration first.`
      );
    }

    const { data, error } = await supabase
      .from('device_sensor_configs')
      .insert(config)
      .select()
      .single();

    if (error) throw error;
    return data as SensorConfig;
  },

  /**
   * Deactivate configuration (soft delete)
   */
  async deactivateConfig(configId: string): Promise<void> {
    const { error } = await supabase
      .from('device_sensor_configs')
      .update({ is_active: false })
      .eq('id', configId);

    if (error) throw error;
  },

  /**
   * Update configuration (deactivate old + create new)
   * Used when user wants to change sensor type or port
   */
  async updateConfig(
    oldConfigId: string,
    newConfig: CreateSensorConfig
  ): Promise<SensorConfig> {
    // Deactivate old config
    await this.deactivateConfig(oldConfigId);

    // Create new config
    return this.createConfig(newConfig);
  },

  /**
   * Count soil moisture sensors configured for a device
   * Used to enforce the maximum of 5 soil moisture sensors
   */
  async countSoilMoistureSensors(deviceId: string): Promise<number> {
    const { data, error } = await supabase
      .from('device_sensor_configs')
      .select('sensor_type')
      .eq('device_id', deviceId)
      .eq('is_active', true)
      .like('sensor_type', 'soil_moisture_%');

    if (error) throw error;
    return data?.length || 0;
  },
};
