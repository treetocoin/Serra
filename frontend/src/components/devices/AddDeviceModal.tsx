import { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { devicesService } from '../../services/devices.service';
import { cn } from '../../utils/cn';

interface AddDeviceModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddDeviceModal({ onClose, onSuccess }: AddDeviceModalProps) {
  const queryClient = useQueryClient();
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredDevice, setRegisteredDevice] = useState<{
    id: string;
    name: string;
    deviceKey: string;
  } | null>(null);
  const [provisioningQRCode, setProvisioningQRCode] = useState<string | null>(null);
  const [copiedDeviceKey, setCopiedDeviceKey] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);

  // Generate provisioning QR code when device is registered
  useEffect(() => {
    if (registeredDevice) {
      devicesService
        .generateProvisioningQRCode(registeredDevice.id, registeredDevice.deviceKey)
        .then(setProvisioningQRCode)
        .catch(console.error);
    }
  }, [registeredDevice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      setError('Device name is required');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await devicesService.registerDevice({
        name: deviceName.trim(),
      });

      setRegisteredDevice({
        id: response.device.id,
        name: response.device.name,
        deviceKey: response.device.deviceKey,
      });
      setDeviceName('');

      // Invalidate devices query to trigger immediate refetch
      queryClient.invalidateQueries({ queryKey: ['devices'] });

      onSuccess?.();
    } catch (err) {
      setError((err as Error).message || 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDeviceKey = () => {
    if (registeredDevice?.deviceKey) {
      navigator.clipboard.writeText(registeredDevice.deviceKey);
      setCopiedDeviceKey(true);
      setTimeout(() => setCopiedDeviceKey(false), 2000);
    }
  };

  const handleCopyDeviceId = () => {
    if (registeredDevice?.id) {
      navigator.clipboard.writeText(registeredDevice.id);
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    }
  };

  const handleClose = () => {
    setRegisteredDevice(null);
    setDeviceName('');
    setError(null);
    setCopiedDeviceKey(false);
    setCopiedDeviceId(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Device</h2>

        {!registeredDevice ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="device-name" className="block text-sm font-medium text-gray-700 mb-2">
                Device Name
              </label>
              <input
                id="device-name"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., Serra ESP32"
                required
                disabled={loading}
                className={cn(
                  'w-full px-3 py-2 border border-gray-300 rounded-md',
                  'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className={cn(
                  'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
              <p className="text-green-800 font-medium mb-2">Device Registered Successfully!</p>
              <p className="text-sm text-green-700">
                Save these credentials securely. The Device Key will not be shown again.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-300 rounded-md p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Device ID</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono break-all">
                  {registeredDevice.id}
                </code>
                <button
                  onClick={handleCopyDeviceId}
                  className={cn(
                    'px-3 py-2 rounded-md transition-colors flex-shrink-0',
                    copiedDeviceId
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                  aria-label="Copy Device ID"
                >
                  {copiedDeviceId ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-300 rounded-md p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Device Key</label>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono break-all">
                  {registeredDevice.deviceKey}
                </code>
                <button
                  onClick={handleCopyDeviceKey}
                  className={cn(
                    'px-3 py-2 rounded-md transition-colors flex-shrink-0',
                    copiedDeviceKey
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                  aria-label="Copy Device Key"
                >
                  {copiedDeviceKey ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {provisioningQRCode && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-3">📱 Setup Instructions</h3>

                <div className="flex flex-col items-center mb-4">
                  <img
                    src={provisioningQRCode}
                    alt="Setup QR Code"
                    className="w-48 h-48 border-2 border-blue-300 rounded-lg bg-white p-2"
                  />
                </div>

                <div className="space-y-3 text-sm text-blue-800">
                  <div className="bg-white rounded-lg p-3 border border-blue-300">
                    <p className="font-semibold mb-2">Step 1: Power On ESP8266</p>
                    <p className="text-xs text-blue-700">
                      Device creates WiFi network: <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">Serra-Setup</span>
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-blue-300">
                    <p className="font-semibold mb-2">Step 2: Connect & Scan QR</p>
                    <p className="text-xs text-blue-700">
                      Connect phone to Serra-Setup, captive portal opens. Scan QR code above to provision device.
                    </p>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-blue-300">
                    <p className="font-semibold mb-2">Step 3: Configure WiFi</p>
                    <p className="text-xs text-blue-700">
                      Click "Configure WiFi" button, select your home network, enter password, and save.
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                    <p className="text-xs text-green-800">
                      <strong>✓ Done!</strong> Device connects and appears online in seconds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Important:</strong> Save the Device Key securely. It will not be shown again after closing this window.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
