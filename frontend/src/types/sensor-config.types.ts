// Standard sensor type enumeration (database types)
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

// UI sensor types (simplified for user selection)
export type UISensorType =
  | 'dht_sopra'
  | 'dht_sotto'
  | 'soil_moisture_1'
  | 'soil_moisture_2'
  | 'soil_moisture_3'
  | 'soil_moisture_4'
  | 'soil_moisture_5'
  | 'water_level';

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

// Sensor type display labels (full database types)
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

// UI sensor type labels (simplified for user selection)
export const UI_SENSOR_TYPE_LABELS: Record<UISensorType, string> = {
  dht_sopra: 'DHT Sopra',
  dht_sotto: 'DHT Sotto',
  soil_moisture_1: 'Soil Moisture 1',
  soil_moisture_2: 'Soil Moisture 2',
  soil_moisture_3: 'Soil Moisture 3',
  soil_moisture_4: 'Soil Moisture 4',
  soil_moisture_5: 'Soil Moisture 5',
  water_level: 'Water Level',
};

// Helper to check if sensor type is DHT (temp/humidity pair)
export function isDHTSensor(sensorType: SensorType): boolean {
  return sensorType.startsWith('dht_') && (sensorType.endsWith('_temp') || sensorType.endsWith('_humidity'));
}

// Helper to get base DHT type from temp/humidity variant
export function getDHTBase(sensorType: SensorType): UISensorType | null {
  if (sensorType === 'dht_sopra_temp' || sensorType === 'dht_sopra_humidity') return 'dht_sopra';
  if (sensorType === 'dht_sotto_temp' || sensorType === 'dht_sotto_humidity') return 'dht_sotto';
  return null;
}
