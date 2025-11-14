import { useState, useEffect } from 'react';
import { useCreateSensorConfig, useUpdateSensorConfig, useSoilMoistureSensorCount } from '@/hooks/useSensorConfig';
import { UI_SENSOR_TYPE_LABELS, isValidPortId, getDHTBase } from '@/types/sensor-config.types';
import type { UISensorType, SensorConfig } from '@/types/sensor-config.types';

interface Props {
  deviceId: string;
  editingConfig?: SensorConfig | null;
  onSuccess?: () => void;
  onCancelEdit?: () => void;
}

// Available GPIO pins for Wemos D1 Mini
const AVAILABLE_PINS = [
  { value: 'D1', label: 'D1 (GPIO5) - Recommended for DHT22', gpio: 5 },
  { value: 'D2', label: 'D2 (GPIO4) - Recommended for DHT22', gpio: 4 },
  { value: 'D3', label: 'D3 (GPIO0)', gpio: 0 },
  { value: 'D4', label: 'D4 (GPIO2) - Built-in LED', gpio: 2 },
  { value: 'D5', label: 'D5 (GPIO14)', gpio: 14 },
  { value: 'D6', label: 'D6 (GPIO12)', gpio: 12 },
  { value: 'D7', label: 'D7 (GPIO13)', gpio: 13 },
  { value: 'D8', label: 'D8 (GPIO15)', gpio: 15 },
  { value: 'A0', label: 'A0 - Analog (for soil/water sensors)', gpio: null },
];

// Normalize port ID from database format to select format
function normalizePortId(dbPortId: string): string {
  // Remove -humidity suffix if present
  const basePort = dbPortId.replace(/-humidity$/, '');

  // Convert GPIO4 -> D2, GPIO5 -> D1, etc.
  if (basePort.startsWith('GPIO')) {
    const gpioNum = parseInt(basePort.replace('GPIO', ''));
    const pin = AVAILABLE_PINS.find(p => p.gpio === gpioNum);
    return pin?.value || basePort;
  }

  return basePort;
}

export function SensorConfigForm({ deviceId, editingConfig, onSuccess, onCancelEdit }: Props) {
  const [sensorType, setSensorType] = useState<UISensorType>('dht_sopra');
  const [portId, setPortId] = useState('D2'); // Default to D2
  const [error, setError] = useState('');

  const createConfig = useCreateSensorConfig();
  const updateConfig = useUpdateSensorConfig();

  // Set form values when editing
  useEffect(() => {
    if (editingConfig) {
      // Convert database type to UI type
      const baseType = getDHTBase(editingConfig.sensor_type);
      if (baseType) {
        setSensorType(baseType);
      } else {
        setSensorType(editingConfig.sensor_type as UISensorType);
      }
      // Normalize port_id from database format (e.g., GPIO4 -> D2)
      setPortId(normalizePortId(editingConfig.port_id));
    } else {
      setSensorType('dht_sopra');
      setPortId('D2'); // Reset to default
    }
  }, [editingConfig]);
  const { data: soilMoistureCount } = useSoilMoistureSensorCount(deviceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Convert D-pin format to GPIO format for consistency with firmware
    // D1 -> GPIO5, D2 -> GPIO4, etc.
    let finalPortId = portId;
    const selectedPin = AVAILABLE_PINS.find(p => p.value === portId);
    if (selectedPin && selectedPin.gpio !== null) {
      finalPortId = `GPIO${selectedPin.gpio}`;
    }

    // Validate port ID
    if (!isValidPortId(finalPortId)) {
      setError('Port ID must be alphanumeric with - or _ only (max 50 chars)');
      return;
    }

    // Check soil moisture limit
    if (
      sensorType.startsWith('soil_moisture_') &&
      soilMoistureCount !== undefined &&
      soilMoistureCount >= 5
    ) {
      setError('Maximum 5 soil moisture sensors allowed per device');
      return;
    }

    try {
      // If DHT sensor, create BOTH temp and humidity configs
      if (sensorType === 'dht_sopra' || sensorType === 'dht_sotto') {
        const baseName = sensorType === 'dht_sopra' ? 'dht_sopra' : 'dht_sotto';

        if (editingConfig) {
          // When editing DHT, update both temp and humidity configs
          // TODO: Also update the paired config if it exists

          // Update the current one
          await updateConfig.mutateAsync({
            oldConfigId: editingConfig.id,
            newConfig: {
              device_id: deviceId,
              sensor_type: editingConfig.sensor_type, // Keep same type (temp or humidity)
              port_id: finalPortId,
            },
          });
        } else {
          // Create both temp and humidity configs
          await createConfig.mutateAsync({
            device_id: deviceId,
            sensor_type: `${baseName}_temp` as any,
            port_id: finalPortId,
          });

          await createConfig.mutateAsync({
            device_id: deviceId,
            sensor_type: `${baseName}_humidity` as any,
            port_id: `${finalPortId}-humidity`,
          });
        }
      } else {
        // Non-DHT sensors: single config
        if (editingConfig) {
          await updateConfig.mutateAsync({
            oldConfigId: editingConfig.id,
            newConfig: {
              device_id: deviceId,
              sensor_type: sensorType as any,
              port_id: finalPortId,
            },
          });
        } else {
          await createConfig.mutateAsync({
            device_id: deviceId,
            sensor_type: sensorType as any,
            port_id: finalPortId,
          });
        }
      }

      // Reset form
      setPortId('D2');
      setSensorType('dht_sopra');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || `Failed to ${editingConfig ? 'update' : 'create'} configuration`);
    }
  };

  // Use UI sensor types (simplified)
  const availableSensorTypes = Object.entries(UI_SENSOR_TYPE_LABELS);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {editingConfig ? 'Modifica Configurazione Sensore' : 'Aggiungi Configurazione Sensore'}
        </h3>
        {editingConfig && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Annulla
          </button>
        )}
      </div>

      <div>
        <label htmlFor="sensor-type" className="block text-sm font-medium text-gray-700 mb-1">
          Sensor Type
        </label>
        <select
          id="sensor-type"
          value={sensorType}
          onChange={(e) => setSensorType(e.target.value as UISensorType)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {availableSensorTypes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="port-id" className="block text-sm font-medium text-gray-700 mb-1">
          Pin GPIO
        </label>
        <select
          id="port-id"
          value={portId}
          onChange={(e) => setPortId(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        >
          {AVAILABLE_PINS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          DHT22 sensors: use D1 or D2 • Analog sensors (soil/water): use A0
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {soilMoistureCount !== undefined && soilMoistureCount > 0 && (
        <div className="text-xs text-gray-500">
          Soil moisture sensors configured: {soilMoistureCount}/5
        </div>
      )}

      <button
        type="submit"
        disabled={createConfig.isPending || updateConfig.isPending}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {editingConfig
          ? (updateConfig.isPending ? 'Aggiornamento...' : 'Aggiorna Sensore')
          : (createConfig.isPending ? 'Aggiunta...' : 'Aggiungi Sensore')}
      </button>
    </form>
  );
}
