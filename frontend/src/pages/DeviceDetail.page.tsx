import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { useDeleteDevice } from '../lib/hooks/useProjectDevices';
import { supabase } from '../lib/supabase';
import { SensorList } from '../components/sensors/SensorList';
import { ActuatorList } from '../components/actuators/ActuatorList';
import { DeviceSetup } from '../components/devices/DeviceSetup';
import { QRCodeDisplay } from '../components/devices/QRCodeDisplay';
import { Toast } from '../components/common/Toast';
import { Home, ArrowLeft, LogOut, Wifi, WifiOff, AlertCircle, LineChart, QrCode, Copy, Check, Trash2 } from 'lucide-react';

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showQRCode, setShowQRCode] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [showConnectionWarning, setShowConnectionWarning] = useState(false);
  const { mutate: deleteDevice, isPending: isDeleting } = useDeleteDevice();

  const { data: device, isLoading, error } = useQuery({
    queryKey: ['device', id],
    queryFn: async () => {
      if (!id) throw new Error('No device ID');
      return await devicesService.getDevice(id);
    },
    enabled: !!id,
    refetchInterval: 30000,
  });

  // Check if device has sensors (for showing/hiding setup card)
  const { data: sensors } = useQuery({
    queryKey: ['sensors-count', device?.id], // Use device UUID, not composite_device_id
    queryFn: async () => {
      if (!device?.id) return [];
      const { data } = await supabase
        .from('sensors')
        .select('id')
        .eq('device_id', device.id); // Use UUID from device object
      return data || [];
    },
    enabled: !!device?.id,
    refetchInterval: 10000, // Check more frequently during setup
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const handleCopyDeviceId = () => {
    if (device?.composite_device_id) {
      navigator.clipboard.writeText(device.composite_device_id);
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    }
  };

  const handleDelete = () => {
    if (!device) return;

    const confirmMessage = `Are you sure you want to delete ${device.composite_device_id}? This action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      deleteDevice(device.composite_device_id, {
        onSuccess: () => {
          console.log('Device deleted successfully');
          navigate(`/projects/${device.project_id}`);
        },
        onError: (error: Error) => {
          alert(`Failed to delete device: ${error.message}`);
        },
      });
    }
  };

  // Calculate device status (must be before early returns for hooks to work)
  const dbStatus = device?.connection_status;
  const calculatedStatus = device?.last_seen_at
    ? devicesService.getConnectionStatus(device.last_seen_at)
    : 'offline';
  const status = dbStatus === 'connection_failed' ? 'connection_failed' : calculatedStatus;

  // Show warning toast when device enters connection_failed status
  useEffect(() => {
    if (status === 'connection_failed') {
      setShowConnectionWarning(true);
    }
  }, [status]);

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

  // Status configuration for UI display
  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-600', bg: 'bg-green-50', label: 'Online' },
    offline: { icon: WifiOff, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Offline' },
    connection_failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Errore Connessione' },
    error: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Errore' },
  };
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.error;
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Informazioni Dispositivo</h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowQRCode(true)}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Visualizza QR Code</span>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete Device"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-500">ID Dispositivo</label>
                <div className="mt-1 flex items-center space-x-2">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm font-mono text-gray-900 break-all">
                    {device.composite_device_id || device.id}
                  </code>
                  <button
                    onClick={handleCopyDeviceId}
                    className={`px-3 py-2 rounded-md transition-colors flex-shrink-0 ${
                      copiedDeviceId
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    title="Copia ID Dispositivo"
                  >
                    {copiedDeviceId ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              </div>
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
              {device.device_hostname && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Configurazione ESP</label>
                  <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
                    <a
                      href={device.device_hostname}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline inline-flex items-center space-x-1"
                    >
                      <span>{device.device_hostname}</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <span className="text-gray-400 hidden sm:inline">|</span>
                    <a
                      href={`${device.device_hostname}/config`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Configura Sensori</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Setup Sensors Card - Only show if device is online */}
          {status === 'online' ? (
            <DeviceSetup
              deviceId={device.id}
              deviceName={device.name}
              hasSensors={(sensors?.length ?? 0) > 0}
              deviceHostname={device.device_hostname || undefined}
            />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Configurazione non disponibile
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Il dispositivo deve essere online per rilevare sensori e attuatori.
                    Assicurati che il dispositivo sia connesso e attendi che lo stato diventi "Online".
                  </p>
                </div>
              </div>
            </div>
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

      {/* QR Code Modal */}
      {showQRCode && (
        <QRCodeDisplay
          deviceId={device.id}
          onClose={() => setShowQRCode(false)}
        />
      )}

      {/* Connection Failed Warning Toast */}
      {showConnectionWarning && (
        <Toast
          message="Device failed to connect to WiFi. Try scanning QR code again to reconfigure network settings."
          type="warning"
          onClose={() => setShowConnectionWarning(false)}
          duration={8000}
        />
      )}
    </div>
  );
}
