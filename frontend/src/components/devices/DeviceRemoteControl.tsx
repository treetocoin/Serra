import { useState } from 'react';
import {
  RotateCcw,
  Wifi,
  Download,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  useDeviceCommands,
  useSendResetCommand,
  useSendWiFiUpdateCommand,
  useSendFirmwareUpdateCommand,
  useCancelCommand,
  useFirmwareVersions,
  type CommandStatus,
} from '../../hooks/useDeviceCommands';

interface DeviceRemoteControlProps {
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
  currentFirmwareVersion: string | null;
}

// Status badge component
function CommandStatusBadge({ status }: { status: CommandStatus }) {
  const config: Record<CommandStatus, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'In attesa' },
    delivered: { icon: Loader2, color: 'text-blue-600 bg-blue-50', label: 'Inviato' },
    executed: { icon: CheckCircle, color: 'text-green-600 bg-green-50', label: 'Eseguito' },
    failed: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Fallito' },
    cancelled: { icon: X, color: 'text-gray-600 bg-gray-50', label: 'Annullato' },
  };

  const { icon: Icon, color, label } = config[status];

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className={`h-3 w-3 mr-1 ${status === 'delivered' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

// Command type label
function getCommandTypeLabel(type: string): string {
  switch (type) {
    case 'reset':
      return 'Riavvio';
    case 'wifi_update':
      return 'Aggiornamento WiFi';
    case 'firmware_update':
      return 'Aggiornamento Firmware';
    default:
      return type;
  }
}

export function DeviceRemoteControl({
  deviceId,
  deviceName,
  isOnline,
  currentFirmwareVersion,
}: DeviceRemoteControlProps) {
  const [showWiFiModal, setShowWiFiModal] = useState(false);
  const [showOTAModal, setShowOTAModal] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // WiFi form state
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  // Queries and mutations
  const { data: commands = [] } = useDeviceCommands(deviceId);
  const { data: firmwareVersions = [] } = useFirmwareVersions();
  const sendReset = useSendResetCommand();
  const sendWiFiUpdate = useSendWiFiUpdateCommand();
  const sendFirmwareUpdate = useSendFirmwareUpdateCommand();
  const cancelCommand = useCancelCommand();

  // Check for pending commands
  const pendingCommands = commands.filter((c) => c.status === 'pending' || c.status === 'delivered');
  const hasPendingCommand = pendingCommands.length > 0;

  // Handle reset
  const handleReset = async () => {
    try {
      await sendReset.mutateAsync(deviceId);
      setShowConfirmReset(false);
    } catch (error) {
      console.error('Failed to send reset command:', error);
    }
  };

  // Handle WiFi update
  const handleWiFiUpdate = async () => {
    if (!wifiSsid.trim()) return;

    try {
      await sendWiFiUpdate.mutateAsync({
        deviceId,
        ssid: wifiSsid.trim(),
        password: wifiPassword,
      });
      setShowWiFiModal(false);
      setWifiSsid('');
      setWifiPassword('');
    } catch (error) {
      console.error('Failed to send WiFi update command:', error);
    }
  };

  // Handle firmware update
  const handleFirmwareUpdate = async (version: string, url: string) => {
    try {
      await sendFirmwareUpdate.mutateAsync({
        deviceId,
        version,
        url,
      });
      setShowOTAModal(false);
    } catch (error) {
      console.error('Failed to send firmware update command:', error);
    }
  };

  // Handle cancel command
  const handleCancelCommand = async (commandId: string) => {
    try {
      await cancelCommand.mutateAsync({ commandId, deviceId });
    } catch (error) {
      console.error('Failed to cancel command:', error);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Controllo Remoto</h2>

      {/* Device status warning */}
      {!isOnline && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <strong>Device offline.</strong> I comandi saranno eseguiti quando il device tornerà online
            (max 60 secondi dopo la riconnessione).
          </div>
        </div>
      )}

      {/* Pending command warning */}
      {hasPendingCommand && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
          <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Comando in attesa.</strong> Attendere l'esecuzione prima di inviare un nuovo
            comando.
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* Reset button */}
        <button
          onClick={() => setShowConfirmReset(true)}
          disabled={hasPendingCommand || sendReset.isPending}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="h-5 w-5" />
          <span>Riavvia Device</span>
        </button>

        {/* WiFi update button */}
        <button
          onClick={() => setShowWiFiModal(true)}
          disabled={hasPendingCommand || sendWiFiUpdate.isPending}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Wifi className="h-5 w-5" />
          <span>Cambia WiFi</span>
        </button>

        {/* OTA update button */}
        <button
          onClick={() => setShowOTAModal(true)}
          disabled={hasPendingCommand || sendFirmwareUpdate.isPending}
          className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="h-5 w-5" />
          <span>Aggiorna Firmware</span>
        </button>
      </div>

      {/* Command history */}
      {commands.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Ultimi Comandi</h3>
          <div className="space-y-2">
            {commands.slice(0, 5).map((cmd) => (
              <div
                key={cmd.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium">{getCommandTypeLabel(cmd.command_type)}</span>
                  <CommandStatusBadge status={cmd.status} />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {new Date(cmd.created_at).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {cmd.status === 'pending' && (
                    <button
                      onClick={() => handleCancelCommand(cmd.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Annulla comando"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {cmd.error_message && (
                    <p className="text-xs text-red-600 mt-1">{cmd.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reset confirmation modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 text-orange-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Conferma Riavvio</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Sei sicuro di voler riavviare il device <strong>{deviceName}</strong>?
              <br />
              <span className="text-sm text-gray-500">
                Il device si riavvierà e tornerà online entro 1-2 minuti.
              </span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmReset(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annulla
              </button>
              <button
                onClick={handleReset}
                disabled={sendReset.isPending}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
              >
                {sendReset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Riavvia</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WiFi update modal */}
      {showWiFiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Aggiorna WiFi</h3>
              <button onClick={() => setShowWiFiModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Attenzione:</strong> Se la nuova rete non funziona, il device tornerà
              automaticamente alla rete precedente dopo 30 secondi.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SSID (nome rete)</label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="Nome della rete WiFi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="Password della rete WiFi"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowWiFiModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Annulla
              </button>
              <button
                onClick={handleWiFiUpdate}
                disabled={!wifiSsid.trim() || sendWiFiUpdate.isPending}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {sendWiFiUpdate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Aggiorna WiFi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTA update modal */}
      {showOTAModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Aggiorna Firmware</h3>
              <button onClick={() => setShowOTAModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Firmware attuale: <strong>{currentFirmwareVersion || 'Sconosciuto'}</strong>
              </p>
            </div>

            {firmwareVersions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Download className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nessuna versione firmware disponibile.</p>
                <p className="text-sm mt-1">
                  Carica un firmware nella sezione Admin per abilitare gli aggiornamenti OTA.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {firmwareVersions.map((fw) => {
                  const isCurrent = currentFirmwareVersion === fw.version;
                  return (
                    <div
                      key={fw.id}
                      className={`p-4 rounded-lg border ${
                        isCurrent ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{fw.version}</span>
                            {fw.is_latest && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                Ultima
                              </span>
                            )}
                            {fw.is_stable && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                Stabile
                              </span>
                            )}
                            {isCurrent && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-800 text-xs rounded-full">
                                Installato
                              </span>
                            )}
                          </div>
                          {fw.release_notes && (
                            <p className="text-sm text-gray-600 mt-1">{fw.release_notes}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(fw.created_at).toLocaleDateString('it-IT')}
                            {fw.file_size && ` - ${(fw.file_size / 1024).toFixed(0)} KB`}
                          </p>
                        </div>
                        {!isCurrent && (
                          <button
                            onClick={() =>
                              handleFirmwareUpdate(
                                fw.version,
                                `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${fw.storage_path}`
                              )
                            }
                            disabled={sendFirmwareUpdate.isPending}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            {sendFirmwareUpdate.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span>Installa</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowOTAModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
