import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/hooks/useAuth';
import { devicesService } from '../../services/devices.service';
import { DeviceCard } from './DeviceCard';
import { Cpu } from 'lucide-react';

export function DeviceList() {
  const { user } = useAuth();

  const {
    data: devices,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['devices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { devices, error } = await devicesService.getDevices(user.id);
      if (error) throw error;
      return devices;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds to update device status
  });

  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Errore nel caricamento dei dispositivi: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-8">
          <Cpu className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Nessun dispositivo registrato ancora</p>
          <p className="text-sm text-gray-500 mt-1">
            Registra il tuo primo dispositivo ESP32 sopra per iniziare
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        I Tuoi Dispositivi ({devices.length})
      </h2>
      <div className="space-y-3">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} onDelete={() => refetch()} />
        ))}
      </div>
    </div>
  );
}
