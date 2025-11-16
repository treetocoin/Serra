import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Cpu, Activity, Calendar, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useAdminUserDetail, useUserRole } from '../lib/hooks/useAdmin';
import {
  useAdminCurrentReadings,
  useAdminComparisonChartData,
  useAdminTimeSeriesData,
} from '../lib/hooks/useDatiData';
import { CurrentReadingCard, CurrentReadingCardSkeleton } from '../components/dati/CurrentReadingCard';
import { TimeRangeSelector } from '../components/dati/TimeRangeSelector';
import { ChartErrorBoundary } from '../components/dati/ChartErrorBoundary';
import {
  TemperatureChart,
  TemperatureChartSkeleton,
} from '../components/dati/TemperatureChart';
import {
  HumidityChart,
  HumidityChartSkeleton,
} from '../components/dati/HumidityChart';
import {
  SoilMoistureChart,
  SoilMoistureChartSkeleton,
} from '../components/dati/SoilMoistureChart';
import {
  TankLevelChart,
  TankLevelChartSkeleton,
} from '../components/dati/TankLevelChart';
import type { TimeRangeValue } from '../types/dati.types';

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data: role, isLoading: loadingRole } = useUserRole();
  const { data: userDetail, isLoading, error } = useAdminUserDetail(userId || null);

  // Time range state for charts
  const [timeRangeValue, setTimeRangeValue] = useState<TimeRangeValue>('24h');

  // Fetch current readings for this user
  const { data: readings, isLoading: loadingReadings, isFetching } = useAdminCurrentReadings(userId || null);

  // Fetch chart data for this user
  const {
    data: temperatureData,
    isLoading: isLoadingTemp,
  } = useAdminComparisonChartData(userId || null, 'dht_sopra_temp', 'dht_sotto_temp', timeRangeValue);

  const {
    data: humidityData,
    isLoading: isLoadingHumidity,
  } = useAdminComparisonChartData(userId || null, 'dht_sopra_humidity', 'dht_sotto_humidity', timeRangeValue);

  const {
    data: soilMoistureData,
    isLoading: isLoadingSoil,
  } = useAdminTimeSeriesData(userId || null, 'soil_moisture', timeRangeValue);

  const {
    data: tankLevelData,
    isLoading: isLoadingTank,
  } = useAdminTimeSeriesData(userId || null, 'water_level', timeRangeValue);

  // Show loading while checking role
  if (loadingRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifica permessi...</p>
        </div>
      </div>
    );
  }

  // Redirect if not admin
  if (role !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dettagli Utente</h1>
                <p className="text-sm text-gray-600">Vista amministratore</p>
              </div>
            </div>
            <Link
              to="/admin"
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Admin Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento dettagli utente...</p>
          </div>
        ) : error ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-red-600 mb-2">Errore nel caricamento dati</div>
            <p className="text-sm text-gray-600">{error.message}</p>
          </div>
        ) : !userDetail ? (
          <div className="bg-white shadow rounded-lg p-12 text-center text-gray-600">
            Utente non trovato
          </div>
        ) : (
          <>
            {/* User Info Card */}
            <div className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-2xl">
                      {userDetail.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-4">
                    <h2 className="text-2xl font-bold text-gray-900">{userDetail.email}</h2>
                    <div className="flex items-center mt-1">
                      {userDetail.role === 'admin' ? (
                        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800">
                          Admin
                        </span>
                      ) : (
                        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-100 text-gray-800">
                          Utente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Registrato</div>
                  <div className="text-lg font-medium text-gray-900">
                    {new Date(userDetail.user_created_at).toLocaleDateString('it-IT', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<Cpu className="h-6 w-6 text-blue-600" />}
                  label="Dispositivi"
                  value={userDetail.device_count}
                  color="blue"
                />
                <StatCard
                  icon={<Activity className="h-6 w-6 text-green-600" />}
                  label="Sensori"
                  value={userDetail.sensor_count}
                  color="green"
                />
                <StatCard
                  icon={<Cpu className="h-6 w-6 text-orange-600" />}
                  label="Attuatori"
                  value={userDetail.actuator_count}
                  color="orange"
                />
                <StatCard
                  icon={<Calendar className="h-6 w-6 text-purple-600" />}
                  label="Ultima Attività"
                  value={
                    userDetail.last_activity
                      ? formatRelativeTime(userDetail.last_activity)
                      : 'Mai'
                  }
                  color="purple"
                />
              </div>
            </div>

            {/* Devices List */}
            {userDetail.devices.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center text-gray-600">
                Nessun dispositivo registrato
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Dispositivi ({userDetail.devices.length})
                </h2>
                {userDetail.devices.map((device) => (
                  <div
                    key={device.id}
                    className="bg-white shadow rounded-lg p-6"
                  >
                    {/* Device Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{device.name}</h3>
                        <p className="text-sm text-gray-500">ID: {device.id.substring(0, 8)}...</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {device.connection_status === 'online' ? (
                          <div className="flex items-center text-green-600">
                            <Wifi className="h-5 w-5 mr-1" />
                            <span className="text-sm font-medium">Online</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <WifiOff className="h-5 w-5 mr-1" />
                            <span className="text-sm font-medium">Offline</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Device Info */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Firmware:</span>{' '}
                        <span className="font-medium">
                          {device.firmware_version || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Registrato:</span>{' '}
                        <span className="font-medium">
                          {new Date(device.registered_at).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Ultimo Visto:</span>{' '}
                        <span className="font-medium">
                          {device.last_seen_at
                            ? formatRelativeTime(device.last_seen_at)
                            : 'Mai'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Config Ver:</span>{' '}
                        <span className="font-medium">v{device.config_version}</span>
                      </div>
                    </div>

                    {/* Sensors */}
                    {device.sensors.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Sensori ({device.sensors.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {device.sensors.map((sensor) => (
                            <div
                              key={sensor.id}
                              className="p-3 bg-gray-50 rounded border border-gray-200"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {sensor.name || sensor.sensor_type}
                                </span>
                                {sensor.is_active ? (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                    Attivo
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                                    Inattivo
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                Tipo: {sensor.sensor_type}
                              </div>
                              {sensor.latest_reading && (
                                <div className="mt-2 text-sm">
                                  <span className="font-bold text-blue-600">
                                    {sensor.latest_reading.value.toFixed(1)} {sensor.unit}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-2">
                                    {formatRelativeTime(sensor.latest_reading.timestamp)}
                                  </span>
                                </div>
                              )}
                              {!sensor.latest_reading && (
                                <div className="mt-2 text-xs text-gray-400">
                                  Nessuna lettura
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actuators */}
                    {device.actuators.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Attuatori ({device.actuators.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {device.actuators.map((actuator) => (
                            <div
                              key={actuator.id}
                              className="p-3 bg-gray-50 rounded border border-gray-200"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {actuator.name || actuator.actuator_type}
                                </span>
                                {actuator.is_active ? (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                    Attivo
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                                    Inattivo
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                Tipo: {actuator.actuator_type}
                              </div>
                              <div className="mt-2 text-sm">
                                <span className="text-gray-600">Stato: </span>
                                <span className="font-bold text-orange-600">
                                  {actuator.current_state}
                                  {actuator.supports_pwm && '%'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {device.sensors.length === 0 && device.actuators.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        Nessun sensore o attuatore configurato
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Current Readings Section */}
            <section className="mt-12">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Condizioni Attuali
                    </h2>
                    <p className="text-sm text-gray-600">
                      Letture in tempo reale dai sensori
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <RefreshCw
                      className={`h-4 w-4 ${isFetching ? 'animate-spin text-purple-600' : ''}`}
                    />
                    <span>
                      {isFetching ? 'Aggiornamento...' : 'Auto-refresh attivo'}
                    </span>
                  </div>
                </div>

                {loadingReadings ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <CurrentReadingCardSkeleton key={i} />
                    ))}
                  </div>
                ) : readings && readings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {readings.map((reading) => (
                      <CurrentReadingCard
                        key={reading.sensorType}
                        reading={reading}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nessuna lettura disponibile
                  </div>
                )}
              </div>
            </section>

            {/* Historical Charts Section */}
            <section className="mt-12">
              {/* Time Range Selector */}
              <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <TimeRangeSelector
                  selected={timeRangeValue}
                  onChange={setTimeRangeValue}
                />
              </div>

              {/* Section Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Storico</h2>
                <p className="text-sm text-gray-600">
                  Andamento temporale dei sensori
                </p>
              </div>

              {/* Charts Grid */}
              <div className="space-y-6">
                {/* Temperature Chart */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Temperatura (Sopra vs Sotto)
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

                {/* Humidity Chart */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Umidità (Sopra vs Sotto)
                  </h3>
                  {isLoadingHumidity ? (
                    <HumidityChartSkeleton />
                  ) : (
                    <ChartErrorBoundary>
                      <HumidityChart
                        data={humidityData || []}
                        timeRangeValue={timeRangeValue}
                      />
                    </ChartErrorBoundary>
                  )}
                </div>

                {/* Soil Moisture Chart */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Umidità Terreno
                  </h3>
                  {isLoadingSoil ? (
                    <SoilMoistureChartSkeleton />
                  ) : (
                    <ChartErrorBoundary>
                      <SoilMoistureChart
                        data={soilMoistureData || []}
                        timeRangeValue={timeRangeValue}
                      />
                    </ChartErrorBoundary>
                  )}
                </div>

                {/* Tank Level Chart */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Livello Serbatoio
                  </h3>
                  {isLoadingTank ? (
                    <TankLevelChartSkeleton />
                  ) : (
                    <ChartErrorBoundary>
                      <TankLevelChart
                        data={tankLevelData || []}
                        timeRangeValue={timeRangeValue}
                      />
                    </ChartErrorBoundary>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// Helper Components
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    orange: 'bg-orange-50',
    purple: 'bg-purple-50',
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-4`}>
      <div className="flex items-center mb-2">
        {icon}
        <span className="ml-2 text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

// Helper function for relative time
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Adesso';
  if (diffMins < 60) return `${diffMins}m fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  if (diffDays < 7) return `${diffDays}g fa`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sett fa`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mesi fa`;
  return `${Math.floor(diffDays / 365)}anni fa`;
}
