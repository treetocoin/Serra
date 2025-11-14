import { useState } from 'react';
import { PlusCircle, Copy, Check } from 'lucide-react';
import { useAuth } from '../../lib/hooks/useAuth';
import { devicesService } from '../../services/devices.service';
import { cn } from '../../utils/cn';

interface DeviceRegisterProps {
  onDeviceRegistered: () => void;
}

export function DeviceRegister({ onDeviceRegistered }: DeviceRegisterProps) {
  const [name, setName] = useState('');
  const [deviceNumber, setDeviceNumber] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compositeDeviceId, setCompositeDeviceId] = useState<string | null>(null);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setLoading(true);

    try {
      const result = await devicesService.registerDeviceSimple(name, deviceNumber);
      setCompositeDeviceId(result.composite_device_id);
      setName('');
      setDeviceNumber(1);
      setLoading(false);
      onDeviceRegistered();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCopyDeviceId = () => {
    if (compositeDeviceId) {
      navigator.clipboard.writeText(compositeDeviceId);
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    }
  };

  const handleClose = () => {
    setCompositeDeviceId(null);
    setCopiedDeviceId(false);
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Registra Nuovo Dispositivo</h2>

      {!compositeDeviceId ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Dispositivo
              </label>
              <input
                id="device-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es., Serra Principale"
                required
                className={cn(
                  'w-full px-3 py-2 border border-gray-300 rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'
                )}
              />
            </div>

            <div>
              <label htmlFor="device-number" className="block text-sm font-medium text-gray-700 mb-1">
                Numero Dispositivo (1-20)
              </label>
              <input
                id="device-number"
                type="number"
                min="1"
                max="20"
                value={deviceNumber}
                onChange={(e) => setDeviceNumber(parseInt(e.target.value))}
                required
                className={cn(
                  'w-full px-3 py-2 border border-gray-300 rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'
                )}
              />
            </div>
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
              Il dispositivo è ora pronto per essere configurato.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-300 rounded-md p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">ID Dispositivo</label>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono break-all">
                {compositeDeviceId}
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

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Prossimi Passi:</strong>
            </p>
            <ol className="text-sm text-blue-700 mt-2 ml-4 list-decimal space-y-1">
              <li>Alimenta il tuo ESP8266/ESP32</li>
              <li>Connettiti al WiFi "Serra-Setup"</li>
              <li>Inserisci questo ID dispositivo: <strong>{compositeDeviceId}</strong></li>
              <li>Configura la tua rete WiFi</li>
              <li>Il dispositivo genererà automaticamente la sua chiave di sicurezza</li>
            </ol>
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
  );
}
