import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { ActuatorEditor } from './ActuatorEditor';

interface Device {
  id: string;
  name: string;
}

interface Actuator {
  id: string;
  device_id: string;
  actuator_id: string;
  actuator_type: string;
  name: string | null;
  current_state: number;
  supports_pwm: boolean;
  discovered_at: string;
  is_active: boolean;
}

interface GroupedActuators {
  device: Device;
  actuators: Actuator[];
}

export const ActuatorManager: React.FC = () => {
  const [selectedActuator, setSelectedActuator] = useState<Actuator | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Fetch all devices
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data as Device[];
    },
  });

  // Fetch all actuators
  const { data: actuators, isLoading: actuatorsLoading, refetch } = useQuery({
    queryKey: ['actuators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actuators')
        .select('*')
        .order('discovered_at');

      if (error) throw error;
      return data as Actuator[];
    },
  });

  // Group actuators by device
  const groupedActuators: GroupedActuators[] = React.useMemo(() => {
    if (!devices || !actuators) return [];

    return devices
      .map(device => ({
        device,
        actuators: actuators.filter(a => a.device_id === device.id),
      }))
      .filter(group => group.actuators.length > 0);
  }, [devices, actuators]);

  const handleEdit = (actuator: Actuator) => {
    setSelectedActuator(actuator);
    setIsEditorOpen(true);
  };

  const handleClose = () => {
    setSelectedActuator(null);
    setIsEditorOpen(false);
    refetch();
  };

  const getActuatorIcon = (type: string) => {
    const icons: Record<string, string> = {
      relay: '🔌',
      pump: '💧',
      fan: '💨',
      heater: '🔥',
      light: '💡',
      valve: '🚰',
    };
    return icons[type] || '⚡';
  };

  if (devicesLoading || actuatorsLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Caricamento attuatori...</span>
      </div>
    );
  }

  if (groupedActuators.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⚡</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nessun attuatore trovato
        </h3>
        <p className="text-gray-600">
          Collega un dispositivo ESP32 con attuatori per visualizzarli qui
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {groupedActuators.map(({ device, actuators: deviceActuators }) => (
          <div key={device.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
              <p className="text-sm text-gray-600">{deviceActuators.length} attuatori</p>
            </div>

            <div className="divide-y divide-gray-200">
              {deviceActuators.map(actuator => (
                <div
                  key={actuator.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-3xl">
                        {getActuatorIcon(actuator.actuator_type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {actuator.name || `Attuatore ${actuator.actuator_id}`}
                        </h4>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-xs text-gray-500">
                            Tipo: {actuator.actuator_type}
                          </span>
                          {actuator.supports_pwm && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              PWM
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            actuator.current_state > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {actuator.current_state > 0 ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleEdit(actuator)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Modifica
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isEditorOpen && selectedActuator && (
        <ActuatorEditor
          actuator={selectedActuator}
          onClose={handleClose}
        />
      )}
    </>
  );
};
