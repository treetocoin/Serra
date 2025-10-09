import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { sensorsService } from '../services/sensors.service';
import { supabase } from '../lib/supabase';
import { Home, LogOut, BarChart3, Trash2 } from 'lucide-react';

// Map preset sensor names to sensor types for proper icon/color display
const getSensorTypeFromName = (sensorName: string): string => {
  const nameLower = sensorName.toLowerCase();

  if (nameLower.includes('aria')) return 'temperature';
  if (nameLower.includes('umidità')) return 'humidity';
  if (nameLower.includes('terreno')) return 'soil_moisture';
  if (nameLower.includes('serbatoio')) return 'water_level';

  return 'unknown';
};

export function HistoryPage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  // Time range state
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('6h');
  const [hiddenSensors, setHiddenSensors] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const { data: allSensors } = useQuery({
    queryKey: ['all-sensors', devices?.map((d) => d.id).join(',')],
    queryFn: async () => {
      if (!devices || devices.length === 0) return [];

      const sensorsPromises = devices.map(async (device) => {
        const { sensors } = await sensorsService.getSensorsByDevice(device.id);
        return sensors.map((s) => ({
          ...s,
          deviceName: device.name,
        }));
      });

      const sensorsArrays = await Promise.all(sensorsPromises);
      return sensorsArrays.flat();
    },
    enabled: !!devices && devices.length > 0,
  });

  // Get sensor history for all sensors
  const { data: history, isLoading } = useQuery({
    queryKey: ['sensor-history-all', allSensors?.map((s) => s.id).join(','), timeRange],
    queryFn: async () => {
      if (!allSensors || allSensors.length === 0) return [];

      const now = new Date();
      const startDate = new Date(now);

      switch (timeRange) {
        case '1h':
          startDate.setHours(startDate.getHours() - 1);
          break;
        case '6h':
          startDate.setHours(startDate.getHours() - 6);
          break;
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
      }

      // Get readings for all sensors
      console.log('[History] Fetching for', allSensors.length, 'sensors from', devices?.length, 'devices');
      console.log('[History] Time range:', startDate.toISOString(), 'to', now.toISOString());

      const { data, error } = await supabase
        .from('sensor_readings')
        .select('sensor_id, sensor_name, value, timestamp')
        .in('sensor_id', allSensors.map((s) => s.id))
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true })
        .limit(10000);

      console.log('[History] Query result:', data?.length || 0, 'readings');
      if (error) console.error('[History] Query error:', error);

      if (!data) return [];

      // Group by timestamp
      const grouped = data.reduce((acc: any, reading) => {
        const time = new Date(reading.timestamp).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        });

        if (!acc[time]) {
          acc[time] = { time };
        }

        // Use sensor_name from the reading (snapshot of name at time of reading)
        const sensorLabel = reading.sensor_name || reading.sensor_id;

        // If multiple readings for same label at same time, take average
        if (acc[time][sensorLabel] !== undefined) {
          acc[time][sensorLabel] = (acc[time][sensorLabel] + reading.value) / 2;
        } else {
          acc[time][sensorLabel] = reading.value;
        }

        return acc;
      }, {});

      const result = Object.values(grouped);
      console.log('[History] Grouped data:', result.length, 'points');
      console.log('[History] Sample:', result[0]);

      // Extract unique sensor names from readings for filters
      const allSensorNames = [...new Set(data.map(r => r.sensor_name || r.sensor_id))];

      // Count readings per sensor to filter out sensors with no/few data
      const readingCounts = data.reduce((acc: Record<string, number>, reading) => {
        const name = reading.sensor_name || reading.sensor_id;
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      // Only include sensors with at least 5 readings
      const activeSensorNames = allSensorNames.filter(name => readingCounts[name] >= 5);

      console.log('[History] Unique sensor names:', activeSensorNames);
      console.log('[History] Reading counts:', readingCounts);

      return { data: result, sensorNames: activeSensorNames };
    },
    enabled: !!allSensors && allSensors.length > 0,
    refetchInterval: 30000,
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const toggleSensor = (sensorName: string) => {
    const newHidden = new Set(hiddenSensors);
    if (newHidden.has(sensorName)) {
      newHidden.delete(sensorName);
    } else {
      newHidden.add(sensorName);
    }
    setHiddenSensors(newHidden);
  };

  const handleDeleteAllData = async () => {
    if (!user) return;

    setDeleting(true);

    const { data, error } = await supabase.rpc('delete_all_sensor_readings', {
      user_id_param: user.id,
    });

    if (error) {
      alert(`Errore nell'eliminazione dei dati: ${error.message}`);
      setDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['sensor-history-all'] });
      setDeleting(false);
      setShowDeleteConfirm(false);
      alert(`${data.deleted_count} letture eliminate con successo`);
    }
  };

  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
              </Link>
              <span className="text-gray-300">|</span>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-6 w-6 text-green-600" />
                <h1 className="text-2xl font-bold text-gray-900">Storico Sensori</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  title="Elimina tutti i dati storici"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Elimina Dati</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDeleteAllData}
                    disabled={deleting}
                    className={`flex items-center space-x-2 px-3 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors ${
                      deleting ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{deleting ? 'Eliminazione...' : 'Conferma'}</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
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
          {/* Time Range Selector */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Intervallo Temporale</h2>
              <div className="flex space-x-2">
                {(['1h', '6h', '24h', '7d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      timeRange === range
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {range === '1h' && 'Ultima Ora'}
                    {range === '6h' && 'Ultime 6 Ore'}
                    {range === '24h' && 'Ultime 24 Ore'}
                    {range === '7d' && 'Ultimi 7 Giorni'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sensor Filters */}
          {history && !Array.isArray(history) && history.sensorNames && history.sensorNames.length > 0 && (
            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Sensori
              </h2>
              <div className="flex flex-wrap gap-2">
                {history.sensorNames.map((sensorName: string, index: number) => {
                  const isHidden = hiddenSensors.has(sensorName);
                  // Try to find sensor config from matching sensor
                  const matchingSensor = allSensors?.find(s => s.name === sensorName);
                  const sensorType = matchingSensor
                    ? matchingSensor.sensor_type
                    : getSensorTypeFromName(sensorName);
                  const config = sensorsService.getSensorConfig(sensorType);

                  return (
                    <button
                      key={sensorName}
                      onClick={() => toggleSensor(sensorName)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md border-2 transition-all ${
                        isHidden
                          ? 'bg-gray-100 border-gray-300 opacity-50'
                          : `border-gray-300 ${config.bgColor}`
                      }`}
                    >
                      <span className="text-xl">{config.icon}</span>
                      <span className="font-medium text-sm">{sensorName}</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: isHidden ? '#9ca3af' : colors[index % colors.length] }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Letture Sensori</h2>
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              </div>
            ) : history && !Array.isArray(history) && history.data && history.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={history.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {history.sensorNames?.map((sensorName: string, index: number) => {
                    if (hiddenSensors.has(sensorName)) return null;

                    // Try to find matching sensor for unit
                    const matchingSensor = allSensors?.find(s => s.name === sensorName);
                    const unit = matchingSensor?.unit || '';

                    return (
                      <Line
                        key={sensorName}
                        type="monotone"
                        dataKey={sensorName}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        name={unit ? `${sensorName} [${unit}]` : sensorName}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nessun dato disponibile per questo intervallo temporale
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
