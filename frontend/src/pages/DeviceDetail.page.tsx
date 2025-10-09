import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { supabase } from '../lib/supabase';
import { SensorList } from '../components/sensors/SensorList';
import { ActuatorList } from '../components/actuators/ActuatorList';
import { DeviceSetup } from '../components/devices/DeviceSetup';
import { Home, ArrowLeft, LogOut, Wifi, WifiOff, AlertCircle, LineChart } from 'lucide-react';

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: device, isLoading, error } = useQuery({
    queryKey: ['device', id],
    queryFn: async () => {
      if (!id) throw new Error('No device ID');
      const { device, error } = await devicesService.getDevice(id);
      if (error) throw error;
      return device;
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Check if device has sensors (for showing/hiding setup card)
  const { data: sensors } = useQuery({
    queryKey: ['sensors-count', id], // Different key to avoid conflict
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase
        .from('sensors')
        .select('id')
        .eq('device_id', id);
      return data || [];
    },
    enabled: !!id,
    refetchInterval: 10000, // Check more frequently during setup
  });

  const handleSignOut = async () => {
    await signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              to="/devices"
              className="flex items-center space-x-2 text-gray-600 hover:text-green-600"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Torna ai Dispositivi</span>
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            Errore nel caricamento del dispositivo: {(error as Error)?.message || 'Dispositivo non trovato'}
          </div>
        </main>
      </div>
    );
  }

  const status = devicesService.getConnectionStatus(device.last_seen_at);
  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-600', bg: 'bg-green-50', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Offline' },
    error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Errore' },
  };
  const config = statusConfig[status];
  const StatusIcon = config.icon;

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
              <Link
                to="/devices"
                className="flex items-center space-x-2 text-gray-600 hover:text-green-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Dispositivi</span>
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
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
          {/* Device Info Card */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Dispositivo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Stato</label>
                <div className={`mt-1 flex items-center space-x-2 ${config.color}`}>
                  <StatusIcon className="h-5 w-5" />
                  <span className="font-medium">{config.label}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Ultimo Accesso</label>
                <div className="mt-1 text-gray-900">
                  {device.last_seen_at
                    ? new Date(device.last_seen_at).toLocaleString('it-IT')
                    : 'Mai'}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Registrato</label>
                <div className="mt-1 text-gray-900">
                  {new Date(device.registered_at).toLocaleString('it-IT')}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Versione Firmware</label>
                <div className="mt-1 text-gray-900">{device.firmware_version || 'Sconosciuta'}</div>
              </div>
            </div>
          </div>

          {/* Setup Sensors Card - Only show if device is online and has no sensors */}
          {status === 'online' && (
            <DeviceSetup
              deviceId={device.id}
              deviceName={device.name}
              hasSensors={(sensors?.length ?? 0) > 0}
              onSetupComplete={() => {
                // Invalidate both device and sensors queries to force refresh
                queryClient.invalidateQueries({ queryKey: ['device', id] });
                queryClient.invalidateQueries({ queryKey: ['sensors', id] });
              }}
            />
          )}

          {/* History Link */}
          {(sensors?.length ?? 0) > 0 && (
            <div className="flex justify-end">
              <Link
                to={`/devices/${device.id}/history`}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <LineChart className="h-5 w-5" />
                <span>Visualizza Storico</span>
              </Link>
            </div>
          )}

          {/* Sensors Section */}
          <SensorList deviceId={device.id} />

          {/* Actuators Section */}
          <ActuatorList deviceId={device.id} />
        </div>
      </main>
    </div>
  );
}
