import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sensorsService } from '../../services/sensors.service';
import { SensorCard } from './SensorCard';
import { Thermometer } from 'lucide-react';

interface SensorListProps {
  deviceId: string;
}

export function SensorList({ deviceId }: SensorListProps) {
  const queryClient = useQueryClient();

  const {
    data: sensors,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sensors', deviceId],
    queryFn: async () => {
      const { sensors, error } = await sensorsService.getSensorsWithLatestReadings(deviceId);
      if (error) throw error;
      return sensors;
    },
    enabled: !!deviceId,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 25000, // Consider data fresh for 25 seconds
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sensori</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sensori</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Errore nel caricamento dei sensori: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!sensors || sensors.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sensori</h2>
        <div className="text-center py-8">
          <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nessun sensore rilevato</p>
          <p className="text-sm text-gray-500 mt-1">
            I sensori appariranno automaticamente quando ESP32 invia dati
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Sensori ({sensors.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sensors.map((sensor) => (
          <SensorCard
            key={sensor.id}
            sensor={sensor}
            latestValue={sensor.latestReading?.value}
            timestamp={sensor.latestReading?.timestamp}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['sensors', deviceId] });
            }}
          />
        ))}
      </div>
    </div>
  );
}
