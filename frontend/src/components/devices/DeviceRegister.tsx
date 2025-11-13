import { useState } from 'react';
import { PlusCircle, Copy, Check } from 'lucide-react';
import { devicesService } from '../../services/devices.service';
import { cn } from '../../utils/cn';
import { Toast } from '../common/Toast';

interface DeviceRegisterProps {
  onDeviceRegistered: () => void;
}

export function DeviceRegister({ onDeviceRegistered }: DeviceRegisterProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceKey, setDeviceKey] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [copiedDeviceKey, setCopiedDeviceKey] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const response = await devicesService.registerDevice({
        name,
      });

      setDeviceKey(response.device.deviceKey);
      setDeviceId(response.device.id);
      setName('');
      setLoading(false);
      // Show success notification
      setShowSuccessToast(true);
      onDeviceRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register device');
      setLoading(false);
    }
  };

  const handleCopyDeviceKey = () => {
    if (deviceKey) {
      navigator.clipboard.writeText(deviceKey);
      setCopiedDeviceKey(true);
      setTimeout(() => setCopiedDeviceKey(false), 2000);
    }
  };

  const handleCopyDeviceId = () => {
    if (deviceId) {
      navigator.clipboard.writeText(deviceId);
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    }
  };

  const handleClose = () => {
    setDeviceKey(null);
    setDeviceId(null);
    setCopiedDeviceKey(false);
    setCopiedDeviceId(false);
  };

  return (
    <>
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Registra Nuovo Dispositivo</h2>

      {!deviceKey ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome Dispositivo
            </label>
            <input
              id="device-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es., Serra ESP32"
              required
              className={cn(
                'w-full px-3 py-2 border border-gray-300 rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'
              )}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md',
              'hover:bg-green-700 transition-colors',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <PlusCircle className="h-5 w-5" />
            <span>{loading ? 'Registrazione...' : 'Registra Dispositivo'}</span>
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded-md">
            <p className="text-green-800 font-medium mb-2">✅ Dispositivo Registrato con Successo!</p>
            <p className="text-sm text-green-700">
              Salva queste credenziali in modo sicuro. Non potrai più vedere la chiave API.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">ID Dispositivo</label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono break-all">
                {deviceId}
              </code>
              <button
                onClick={handleCopyDeviceId}
                className={cn(
                  'px-3 py-2 rounded-md transition-colors',
                  copiedDeviceId
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
                {copiedDeviceId ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Device Key</label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono break-all">
                {deviceKey}
              </code>
              <button
                onClick={handleCopyDeviceKey}
                className={cn(
                  'px-3 py-2 rounded-md transition-colors',
                  copiedDeviceKey
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
                {copiedDeviceKey ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Importante:</strong> Copia sia l'ID Dispositivo che la Device Key ora. Configurali nel firmware del tuo ESP8266/ESP32 per autenticare le richieste del dispositivo.
            </p>
          </div>

          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Fatto
          </button>
        </div>
      )}
      </div>

      {/* Success Toast Notification */}
      {showSuccessToast && (
        <Toast
          message="Device registered successfully!"
          type="success"
          onClose={() => setShowSuccessToast(false)}
          duration={5000}
        />
      )}
    </>
  );
}
