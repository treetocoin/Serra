import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { sensorsService } from '../services/sensors.service';
import { SensorCard } from '../components/sensors/SensorCard';
import { Home, LogOut, Thermometer } from 'lucide-react';

export function SensorsPage() {
  const { user, signOut } = useAuth();

  // Get all devices for user
  const { data: devices } = useQuery({
    queryKey: ['devices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { devices } = await devicesService.getDevices(user.id);
      return devices;
    },
    enabled: !!user,
  });

  // Get all sensors from all devices
  const { data: allSensors, isLoading, refetch } = useQuery({
    queryKey: ['all-sensors-with-readings', devices?.map((d) => d.id).join(',')],
    queryFn: async () => {
      if (!devices || devices.length === 0) return [];

      const sensorsPromises = devices.map(async (device) => {
        const { sensors } = await sensorsService.getSensorsWithLatestReadings(device.id);
        return sensors.map((s) => ({
          ...s,
          deviceName: device.name,
        }));
      });

      const sensorsArrays = await Promise.all(sensorsPromises);
      return sensorsArrays.flat();
    },
    enabled: !!devices && devices.length > 0,
    refetchInterval: 30000,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors"
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              <span className="text-gray-300">|</span>
              <div className="flex items-center space-x-2">
                <Thermometer className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">Tutti i Sensori</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Esci</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {isLoading ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            </div>
          ) : !allSensors || allSensors.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-8">
                <Thermometer className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Nessun sensore rilevato</p>
                <p className="text-sm text-gray-500 mt-1">
                  I sensori appariranno automaticamente quando i dispositivi inviano dati
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Group sensors by device */}
              {devices?.map((device) => {
                const deviceSensors = allSensors.filter(
                  (s) => (s as any).deviceName === device.name
                );

                if (deviceSensors.length === 0) return null;

                return (
                  <div key={device.id} className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {device.name} ({deviceSensors.length} sensori)
                      </h2>
                      <Link
                        to={`/devices/${device.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Vai al dispositivo →
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deviceSensors.map((sensor) => (
                        <SensorCard
                          key={sensor.id}
                          sensor={sensor}
                          latestValue={sensor.latestReading?.value}
                          timestamp={sensor.latestReading?.timestamp}
                          onUpdate={() => refetch()}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
