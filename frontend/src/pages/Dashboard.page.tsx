import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { sensorsService } from '../services/sensors.service';
import { LogOut, Home, Cpu, Thermometer, Zap, BarChart3, Settings } from 'lucide-react';

export function DashboardPage() {
  const { user, signOut } = useAuth();

  // Fetch devices
  const { data: devices } = useQuery({
    queryKey: ['devices', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { devices, error } = await devicesService.getDevices(user.id);
      if (error) throw error;
      return devices;
    },
    enabled: !!user,
  });

  // Fetch all sensors across all devices
  const { data: allSensors } = useQuery({
    queryKey: ['all-sensors', user?.id],
    queryFn: async () => {
      if (!devices || devices.length === 0) return [];

      const sensorPromises = devices.map((device) =>
        sensorsService.getSensorsWithLatestReadings(device.id)
      );

      const results = await Promise.all(sensorPromises);
      const allSensors = results.flatMap((result) => result.sensors || []);
      return allSensors;
    },
    enabled: !!devices && devices.length > 0,
    refetchInterval: 30000,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const deviceCount = devices?.length || 0;
  const sensorCount = allSensors?.length || 0;
  const activeSensors = allSensors?.filter((s) => s.latestReading).length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Home className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Gestione Serra</h1>
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
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Benvenuto nella Dashboard!</h2>
          <p className="text-gray-600 mb-4">
            Il tuo sistema di gestione serra è pronto. Funzionalità di gestione dispositivi, monitoraggio sensori e controllo attuatori sono disponibili.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <Link
              to="/devices"
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Dispositivi</h3>
                <Cpu className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Collega i tuoi dispositivi ESP32</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{deviceCount}</p>
              <p className="text-xs text-green-600 mt-2">Clicca per gestire →</p>
            </Link>
            <Link
              to="/sensors"
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Sensori</h3>
                <Thermometer className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Monitora la tua serra</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">{sensorCount}</p>
              {sensorCount > 0 && (
                <p className="text-xs text-blue-600 mt-1">{activeSensors} attivi</p>
              )}
              <p className="text-xs text-blue-600 mt-2">Clicca per gestire →</p>
            </Link>
            <Link
              to="/actuators"
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-purple-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Attuatori</h3>
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">Gestisci i tuoi attuatori</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">⚡</p>
              <p className="text-xs text-purple-600 mt-2">Clicca per gestire →</p>
            </Link>
            <Link
              to="/automation"
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Automazione</h3>
                <Settings className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-sm text-gray-600">Regole di automazione</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">🤖</p>
              <p className="text-xs text-indigo-600 mt-2">Clicca per gestire →</p>
            </Link>
            <Link
              to="/history"
              className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Storico</h3>
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">Visualizza dati storici</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">📊</p>
              <p className="text-xs text-orange-600 mt-2">Clicca per visualizzare →</p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
