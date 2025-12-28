import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/hooks/useAuth';
import { devicesService } from '../services/devices.service';
import { supabase } from '../lib/supabase';
import { SensorList } from '../components/sensors/SensorList';
import { ActuatorList } from '../components/actuators/ActuatorList';
import { DeviceSetup } from '../components/devices/DeviceSetup';
import { SensorConfigForm } from '../components/devices/SensorConfigForm';
import { useSensorConfigs, useDeactivateSensorConfig } from '../hooks/useSensorConfig';
import { SENSOR_TYPE_LABELS, getDHTBase, UI_SENSOR_TYPE_LABELS } from '../types/sensor-config.types';
import type { SensorConfig } from '../types/sensor-config.types';
import {
  TemperatureChart,
  HumidityChart,
  WaterLevelChart,
  SoilMoisture1Chart,
  SoilMoisture2Chart,
  SoilMoisture3Chart,
  SoilMoisture4Chart,
  SoilMoisture5Chart,
} from '../components/charts';
import { Home, ArrowLeft, LogOut, Wifi, WifiOff, AlertCircle, LineChart, Copy, Check, Trash2, Edit } from 'lucide-react';
import { useState } from 'react';
import { DeviceRemoteControl } from '../components/devices/DeviceRemoteControl';

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [editingConfig, setEditingConfig] = useState<any | null>(null);

  // Fetch sensor configurations
  const { data: sensorConfigs } = useSensorConfigs(id || '');
  const deactivateConfig = useDeactivateSensorConfig();

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

  const handleCopyId = async () => {
    if (!device?.composite_device_id) return;
    try {
      await navigator.clipboard.writeText(device.composite_device_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRemoveConfig = (configId: string) => {
    if (!id) return;
    if (confirm('Rimuovere questa configurazione sensore? I dati storici verranno preservati.')) {
      deactivateConfig.mutate({ configId, deviceId: id });
    }
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

            {/* Device ID - Prominente per configurazione */}
            {device.composite_device_id && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="text-sm font-medium text-gray-500 block mb-2">
                  ID Dispositivo
                  <span className="ml-2 text-xs text-gray-400">(da inserire nella configurazione ESP8266)</span>
                </label>
                <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border-2 border-blue-300">
                  <code className="flex-1 text-lg font-mono font-bold text-blue-900">
                    {device.composite_device_id}
                  </code>
                  <button
                    onClick={handleCopyId}
                    className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shrink-0"
                    title="Copia ID"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span className="text-sm">Copiato!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span className="text-sm">Copia</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Usa questo ID per configurare l'ESP8266 via portale web (http://serrasetup.local)
                </p>
              </div>
            )}
          </div>

          {/* Remote Control Section */}
          <DeviceRemoteControl
            deviceId={device.id}
            deviceName={device.name}
            isOnline={status === 'online'}
            currentFirmwareVersion={device.firmware_version}
          />

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

          {/* Sensor Configuration Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configurazione Sensori Standard</h2>
            <p className="text-sm text-gray-600 mb-6">
              Configura i sensori standard collegati al dispositivo specificando il tipo e la porta fisica.
            </p>

            {/* Existing Configurations */}
            {sensorConfigs && sensorConfigs.length > 0 ? (
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-medium text-gray-700">Configurazioni Attive</h3>
                {(() => {
                  // Group DHT sensors (temp + humidity pairs)
                  const grouped: { [key: string]: SensorConfig[] } = {};
                  const nonDHT: SensorConfig[] = [];

                  sensorConfigs.forEach((config) => {
                    const dhtBase = getDHTBase(config.sensor_type);
                    if (dhtBase) {
                      if (!grouped[dhtBase]) grouped[dhtBase] = [];
                      grouped[dhtBase].push(config);
                    } else {
                      nonDHT.push(config);
                    }
                  });

                  // Render grouped DHT sensors + non-DHT sensors
                  return (
                    <>
                      {/* DHT Sensors (grouped) */}
                      {Object.entries(grouped).map(([dhtType, configs]) => {
                        const mainConfig = configs.find(c => c.sensor_type.endsWith('_temp')) || configs[0];
                        return (
                          <div
                            key={dhtType}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center space-x-3">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {UI_SENSOR_TYPE_LABELS[dhtType as keyof typeof UI_SENSOR_TYPE_LABELS]}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Porta: {mainConfig.port_id.replace(/-humidity$/, '')} • Temp + Humidity
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setEditingConfig(mainConfig)}
                                disabled={deactivateConfig.isPending}
                                className="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                                title="Modifica configurazione"
                              >
                                <Edit className="h-4 w-4" />
                                <span className="text-sm">Modifica</span>
                              </button>
                              <button
                                onClick={() => {
                                  // Remove both temp and humidity configs
                                  if (confirm('Rimuovere questo sensore DHT (temperatura e umidità)?')) {
                                    configs.forEach(c => handleRemoveConfig(c.id));
                                  }
                                }}
                                disabled={deactivateConfig.isPending}
                                className="flex items-center space-x-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                title="Rimuovi configurazione"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="text-sm">Rimuovi</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Non-DHT Sensors */}
                      {nonDHT.map((config) => (
                        <div
                          key={config.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center space-x-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                {SENSOR_TYPE_LABELS[config.sensor_type]}
                              </p>
                              <p className="text-sm text-gray-500">Porta: {config.port_id}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setEditingConfig(config)}
                              disabled={deactivateConfig.isPending}
                              className="flex items-center space-x-1 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                              title="Modifica configurazione"
                            >
                              <Edit className="h-4 w-4" />
                              <span className="text-sm">Modifica</span>
                            </button>
                            <button
                              onClick={() => handleRemoveConfig(config.id)}
                              disabled={deactivateConfig.isPending}
                              className="flex items-center space-x-1 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              title="Rimuovi configurazione"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="text-sm">Rimuovi</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                <p className="text-sm text-gray-600">
                  Nessun sensore configurato. Aggiungi la prima configurazione usando il form qui sotto.
                </p>
              </div>
            )}

            {/* Add/Edit Configuration Form */}
            <SensorConfigForm
              deviceId={device.id}
              editingConfig={editingConfig}
              onSuccess={() => setEditingConfig(null)}
              onCancelEdit={() => setEditingConfig(null)}
            />
          </div>

          {/* Sensor Charts Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Grafici Sensori</h2>

            {/* Temperature and Humidity Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TemperatureChart deviceId={device.id} />
              <HumidityChart deviceId={device.id} />
            </div>

            {/* Water Level Chart */}
            <WaterLevelChart deviceId={device.id} />

            {/* Soil Moisture Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <SoilMoisture1Chart deviceId={device.id} />
              <SoilMoisture2Chart deviceId={device.id} />
              <SoilMoisture3Chart deviceId={device.id} />
              <SoilMoisture4Chart deviceId={device.id} />
              <SoilMoisture5Chart deviceId={device.id} />
            </div>
          </div>

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
