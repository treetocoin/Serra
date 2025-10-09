import { useQuery } from '@tanstack/react-query';
import { actuatorsService } from '../../services/actuators.service';
import { ActuatorCard } from './ActuatorCard';
import { Zap } from 'lucide-react';

interface ActuatorListProps {
  deviceId: string;
}

export function ActuatorList({ deviceId }: ActuatorListProps) {
  const {
    data: actuators,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['actuators', deviceId],
    queryFn: async () => {
      const { actuators, error } = await actuatorsService.getActuatorsByDevice(deviceId);
      if (error) throw error;
      return actuators;
    },
    enabled: !!deviceId,
    refetchInterval: 5000, // Poll every 5 seconds for command status updates
  });

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Attuatori</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Attuatori</h2>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Errore nel caricamento degli attuatori: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!actuators || actuators.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Attuatori</h2>
        <div className="text-center py-8">
          <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nessun attuatore rilevato</p>
          <p className="text-sm text-gray-500 mt-1">
            Gli attuatori appariranno automaticamente quando ESP32 li segnala
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Attuatori ({actuators.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actuators.map((actuator) => (
          <ActuatorCard
            key={actuator.id}
            actuator={actuator}
            onCommandSent={() => refetch()}
            onUpdate={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}
