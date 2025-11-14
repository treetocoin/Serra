// Standard sensor type enumeration
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

// Sensor configuration entity
export interface SensorConfig {
  id: string;
  device_id: string;
  sensor_type: SensorType;
  port_id: string;
  configured_at: string;
  is_active: boolean;
}

// Create config payload
export interface CreateSensorConfig {
  device_id: string;
  sensor_type: SensorType;
  port_id: string;
}

// Port validation
export const PORT_ID_REGEX = /^[A-Za-z0-9_-]+$/;
export const PORT_ID_MAX_LENGTH = 50;

export function isValidPortId(portId: string): boolean {
  return (
    portId.length > 0 &&
    portId.length <= PORT_ID_MAX_LENGTH &&
    PORT_ID_REGEX.test(portId)
  );
}

// Sensor type display labels
export const SENSOR_TYPE_LABELS: Record<SensorType, string> = {
  dht_sopra_temp: 'DHT Sopra (Temperature)',
  dht_sopra_humidity: 'DHT Sopra (Humidity)',
  dht_sotto_temp: 'DHT Sotto (Temperature)',
  dht_sotto_humidity: 'DHT Sotto (Humidity)',
  soil_moisture_1: 'Soil Moisture 1',
  soil_moisture_2: 'Soil Moisture 2',
  soil_moisture_3: 'Soil Moisture 3',
  soil_moisture_4: 'Soil Moisture 4',
  soil_moisture_5: 'Soil Moisture 5',
  water_level: 'Water Level',
  unconfigured: 'Unconfigured',
};
