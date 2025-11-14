import { useState, useEffect } from 'react';
import { useCreateSensorConfig, useUpdateSensorConfig, useSoilMoistureSensorCount } from '@/hooks/useSensorConfig';
import { SENSOR_TYPE_LABELS, isValidPortId } from '@/types/sensor-config.types';
import type { SensorType, SensorConfig } from '@/types/sensor-config.types';

interface Props {
  deviceId: string;
  editingConfig?: SensorConfig | null;
  onSuccess?: () => void;
  onCancelEdit?: () => void;
}

export function SensorConfigForm({ deviceId, editingConfig, onSuccess, onCancelEdit }: Props) {
  const [sensorType, setSensorType] = useState<SensorType>('dht_sopra_temp');
  const [portId, setPortId] = useState('');
  const [error, setError] = useState('');

  const createConfig = useCreateSensorConfig();
  const updateConfig = useUpdateSensorConfig();

  // Set form values when editing
  useEffect(() => {
    if (editingConfig) {
      setSensorType(editingConfig.sensor_type);
      setPortId(editingConfig.port_id);
    } else {
      setSensorType('dht_sopra_temp');
      setPortId('');
    }
  }, [editingConfig]);
  const { data: soilMoistureCount } = useSoilMoistureSensorCount(deviceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate port ID
    if (!isValidPortId(portId)) {
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
      if (editingConfig) {
        // Update existing configuration
        await updateConfig.mutateAsync({
          oldConfigId: editingConfig.id,
          newConfig: {
            device_id: deviceId,
            sensor_type: sensorType,
            port_id: portId,
          },
        });
      } else {
        // Create new configuration
        await createConfig.mutateAsync({
          device_id: deviceId,
          sensor_type: sensorType,
          port_id: portId,
        });
      }

      // Reset form
      setPortId('');
      setSensorType('dht_sopra_temp');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || `Failed to ${editingConfig ? 'update' : 'create'} configuration`);
    }
  };

  // Filter out unconfigured from dropdown
  const availableSensorTypes = Object.entries(SENSOR_TYPE_LABELS).filter(
    ([key]) => key !== 'unconfigured'
  );

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
          onChange={(e) => setSensorType(e.target.value as SensorType)}
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
          Port ID
        </label>
        <input
          id="port-id"
          type="text"
          value={portId}
          onChange={(e) => setPortId(e.target.value)}
          placeholder="e.g., GPIO4, A0, D1"
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Alphanumeric with dash or underscore only (e.g., GPIO4, A0, D1)
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
