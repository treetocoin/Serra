import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { LogOut, Home, Cpu, Zap, BarChart3, Settings, Shield } from 'lucide-react';
import { useUserRole } from '../lib/hooks/useAdmin';
import {
  useCurrentReadings,
  useComparisonChartData,
} from '../lib/hooks/useDatiData';
import { CurrentReadingCard, CurrentReadingCardSkeleton } from '../components/dati/CurrentReadingCard';
import { TemperatureChart, TemperatureChartSkeleton } from '../components/dati/TemperatureChart';
import { ChartErrorBoundary } from '../components/dati/ChartErrorBoundary';
import type { TimeRangeValue } from '../types/dati.types';
import { CycleProgressBanner } from '../components/CycleProgressBanner';
import { CycleOnboarding } from '../components/CycleOnboarding';
import { useCycle } from '../hooks/useCycle';

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const [timeRangeValue] = useState<TimeRangeValue>('24h');
  const { data: userRole } = useUserRole();
  const { data: cycle, isLoading: isLoadingCycle } = useCycle();

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

  // Fetch current readings for real-time display
  const { data: readings, isLoading: loadingReadings } = useCurrentReadings();

  // Fetch temperature comparison chart data
  const {
    data: temperatureData,
    isLoading: isLoadingTemp,
  } = useComparisonChartData('dht_sopra_temp', 'dht_sotto_temp', timeRangeValue);

  const handleSignOut = async () => {
    await signOut();
  };

  const deviceCount = devices?.length || 0;

  // Show onboarding if no active cycle exists
  if (!isLoadingCycle && !cycle) {
    return <CycleOnboarding />;
  }

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

      {/* Cycle Progress Banner */}
      <CycleProgressBanner />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sezione superiore: Grafico Temperature + Letture Real Time */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Grafico Temperature (2/3 della larghezza) */}
          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Temperatura (Ultime 24h)
            </h3>
            {isLoadingTemp ? (
              <TemperatureChartSkeleton />
            ) : (
              <ChartErrorBoundary>
                <TemperatureChart
                  data={temperatureData || []}
                  timeRangeValue={timeRangeValue}
                />
              </ChartErrorBoundary>
            )}
          </div>

          {/* Letture Real Time (1/3 della larghezza) */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Condizioni Attuali
            </h3>
            <div className="space-y-3">
              {loadingReadings ? (
                <>
                  <CurrentReadingCardSkeleton />
                  <CurrentReadingCardSkeleton />
                  <CurrentReadingCardSkeleton />
                  <CurrentReadingCardSkeleton />
                </>
              ) : readings && readings.length > 0 ? (
                readings.slice(0, 6).map((reading) => (
                  <CurrentReadingCard
                    key={reading.sensorType}
                    reading={reading}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessun dato disponibile
                </p>
              )}
            </div>
            {readings && readings.length > 6 && (
              <Link
                to="/dati"
                className="mt-4 block text-center text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Vedi tutti i sensori →
              </Link>
            )}
          </div>
        </div>

        {/* Sezione navigazione */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Gestione Sistema</h2>

          {/* Prima riga: Dispositivi e Attuatori */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/devices"
              className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:border-green-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Dispositivi</h3>
                <Cpu className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">Gestisci i tuoi dispositivi ESP8266</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{deviceCount}</p>
              <p className="text-xs text-green-600 mt-2">Clicca per gestire →</p>
            </Link>
            <Link
              to="/actuators"
              className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:border-purple-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Attuatori</h3>
                <Zap className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">Controlla luci, pompe e ventole</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">⚡</p>
              <p className="text-xs text-purple-600 mt-2">Clicca per gestire →</p>
            </Link>
          </div>

          {/* Seconda riga: Automazione e Storico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Link
              to="/automation"
              className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Automazione</h3>
                <Settings className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-sm text-gray-600">Crea regole automatiche</p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">🤖</p>
              <p className="text-xs text-indigo-600 mt-2">Clicca per gestire →</p>
            </Link>
            <Link
              to="/history"
              className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:border-orange-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Storico</h3>
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">Visualizza grafici e dati</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">📊</p>
              <p className="text-xs text-orange-600 mt-2">Clicca per visualizzare →</p>
            </Link>
          </div>

          {/* Terza riga: Impostazioni */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Link
              to="/settings"
              className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Impostazioni</h3>
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">Configura durata e settimana del ciclo</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">⚙️</p>
              <p className="text-xs text-blue-600 mt-2">Clicca per configurare →</p>
            </Link>
          </div>

          {/* Admin Link (only for admin users) */}
          {userRole === 'admin' && (
            <div className="mt-4">
              <Link
                to="/admin"
                className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border-2 border-purple-300 hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center mb-2">
                    <Shield className="h-5 w-5 text-purple-600 mr-2" />
                    <h3 className="font-medium text-gray-900">Admin Dashboard</h3>
                  </div>
                  <p className="text-sm text-gray-600">Gestisci tutti gli utenti e progetti</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-purple-600">🛡️</p>
                  <p className="text-xs text-purple-600 mt-2">Clicca per accedere →</p>
                </div>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
