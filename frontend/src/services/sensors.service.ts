import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

type Sensor = Database['public']['Tables']['sensors']['Row'];
type SensorReading = Database['public']['Tables']['sensor_readings']['Row'];

export interface SensorWithLatestReading extends Sensor {
  latestReading?: {
    value: number;
    timestamp: string;
  };
}

/**
 * Sensors Service
 * Manages sensor data retrieval and monitoring
 */
export const sensorsService = {
  /**
   * Get all sensors for a device
   */
  async getSensorsByDevice(deviceId: string): Promise<{
    sensors: Sensor[];
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('sensors')
        .select('*')
        .eq('device_id', deviceId)
        .eq('is_active', true)
        .order('discovered_at', { ascending: true });

      if (error) throw error;

      return {
        sensors: data || [],
        error: null,
      };
    } catch (error) {
      return {
        sensors: [],
        error: error as Error,
      };
    }
  },

  /**
   * Get latest readings for multiple sensors
   */
  async getLatestReadings(sensorIds: string[]): Promise<{
    readings: Record<string, { value: number; timestamp: string }>;
    error: Error | null;
  }> {
    try {
      if (sensorIds.length === 0) {
        return { readings: {}, error: null };
      }

      // Get latest reading for each sensor
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('sensor_id, value, timestamp')
        .in('sensor_id', sensorIds)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group by sensor_id and take the first (latest) reading
      const readings: Record<string, { value: number; timestamp: string }> = {};

      data?.forEach((reading) => {
        if (!readings[reading.sensor_id]) {
          readings[reading.sensor_id] = {
            value: reading.value,
            timestamp: reading.timestamp,
          };
        }
      });

      return {
        readings,
        error: null,
      };
    } catch (error) {
      return {
        readings: {},
        error: error as Error,
      };
    }
  },

  /**
   * Get sensor history for a specific time range
   */
  async getSensorHistory(
    sensorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    readings: SensorReading[];
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .eq('sensor_id', sensorId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true })
        .limit(1000); // Limit to prevent excessive data

      if (error) throw error;

      return {
        readings: data || [],
        error: null,
      };
    } catch (error) {
      return {
        readings: [],
        error: error as Error,
      };
    }
  },

  /**
   * Get sensors with their latest readings for a device
   */
  async getSensorsWithLatestReadings(deviceId: string): Promise<{
    sensors: SensorWithLatestReading[];
    error: Error | null;
  }> {
    try {
      // Get all sensors for device
      const { sensors, error: sensorsError } = await this.getSensorsByDevice(deviceId);

      if (sensorsError) throw sensorsError;
      if (sensors.length === 0) {
        return { sensors: [], error: null };
      }

      // Get latest readings
      const sensorIds = sensors.map((s) => s.id);
      const { readings, error: readingsError } = await this.getLatestReadings(sensorIds);

      if (readingsError) throw readingsError;

      // Combine sensors with their latest readings
      const sensorsWithReadings: SensorWithLatestReading[] = sensors.map((sensor) => ({
        ...sensor,
        latestReading: readings[sensor.id],
      }));

      return {
        sensors: sensorsWithReadings,
        error: null,
      };
    } catch (error) {
      return {
        sensors: [],
        error: error as Error,
      };
    }
  },

  /**
   * Check if sensor reading is anomalous (outside min/max bounds)
   */
  isAnomalous(sensor: Sensor, value: number): boolean {
    if (sensor.min_value !== null && value < sensor.min_value) {
      return true;
    }
    if (sensor.max_value !== null && value > sensor.max_value) {
      return true;
    }
    return false;
  },

  /**
   * Get sensor type icon and color
   */
  getSensorConfig(sensorType: string): {
    icon: string;
    color: string;
    bgColor: string;
  } {
    const configs: Record<string, { icon: string; color: string; bgColor: string }> = {
      temperature: { icon: '🌡️', color: 'text-red-600', bgColor: 'bg-red-50' },
      dht_sopra_temp: { icon: '🌡️', color: 'text-red-500', bgColor: 'bg-red-50' },
      dht_sotto_temp: { icon: '🌡️', color: 'text-blue-500', bgColor: 'bg-blue-50' },
      humidity: { icon: '💧', color: 'text-blue-600', bgColor: 'bg-blue-50' },
      dht_sopra_humidity: { icon: '💧', color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
      dht_sotto_humidity: { icon: '💧', color: 'text-sky-600', bgColor: 'bg-sky-50' },
      soil_moisture: { icon: '🌱', color: 'text-green-600', bgColor: 'bg-green-50' },
      water_level: { icon: '💧', color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
      light_level: { icon: '☀️', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      ph: { icon: '⚗️', color: 'text-purple-600', bgColor: 'bg-purple-50' },
      ec: { icon: '⚡', color: 'text-orange-600', bgColor: 'bg-orange-50' },
      co2: { icon: '🌫️', color: 'text-gray-600', bgColor: 'bg-gray-50' },
    };

    return configs[sensorType] || { icon: '📊', color: 'text-gray-600', bgColor: 'bg-gray-50' };
  },

  /**
   * Get human-readable display name for sensor type (Italian)
   *
   * @param sensorType - Sensor type from database
   * @returns Italian display name
   * @feature 005-lavoriamo-alla-pagina (T004)
   */
  getDisplayName(sensorType: string): string {
    const displayNames: Record<string, string> = {
      dht_sopra_temp: 'Temperatura Sopra',
      dht_sopra_humidity: 'Umidità Sopra',
      dht_sotto_temp: 'Temperatura Sotto',
      dht_sotto_humidity: 'Umidità Sotto',
      soil_moisture: 'Umidità Terreno',
      water_level: 'Livello Serbatoio',
      unconfigured: 'Non Configurato',
      // Legacy fallbacks
      temperature: 'Temperatura',
      humidity: 'Umidità',
      soil_moisture_1: 'Umidità Terreno 1',
      soil_moisture_2: 'Umidità Terreno 2',
      soil_moisture_3: 'Umidità Terreno 3',
      soil_moisture_4: 'Umidità Terreno 4',
      soil_moisture_5: 'Umidità Terreno 5',
    };

    return displayNames[sensorType] || sensorType;
  },

  /**
   * Format sensor value with unit
   */
  formatValue(value: number, unit: string): string {
    return `${value.toFixed(1)} ${unit}`;
  },

  /**
   * Format timestamp as relative time
   */
  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = (now.getTime() - date.getTime()) / 1000;

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  },
};
