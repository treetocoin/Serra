import { useQuery } from '@tanstack/react-query';
import { AlertCircle, X } from 'lucide-react';
import { devicesService } from '../../services/devices.service';

interface QRCodeDisplayProps {
  deviceId: string;
  onClose: () => void;
}

/**
 * QR Code Display Modal Component
 *
 * Displays a WiFi QR code for easy ESP device onboarding.
 * Users scan the QR code with their phone to automatically connect
 * to the device's configuration WiFi network.
 *
 * Features:
 * - Generates QR code from device's unique WiFi SSID
 * - Caches QR code indefinitely (hostname doesn't change)
 * - Shows helpful instructions for scanning and connecting
 * - Provides fallback manual connection instructions
 */
export function QRCodeDisplay({ deviceId, onClose }: QRCodeDisplayProps) {
  const { data: qrCode, isLoading, error } = useQuery({
    queryKey: ['qr-code', deviceId],
    queryFn: () => devicesService.generateQRCode(deviceId),
    staleTime: Infinity, // QR code never stales (hostname doesn't change)
    gcTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours (gcTime replaces cacheTime in React Query v5)
    retry: false, // Don't retry if device hasn't connected yet
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Device WiFi QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="text-gray-600 text-sm">Generating QR code...</p>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Failed to generate QR code</p>
                <p className="text-sm mt-1">{(error as Error).message}</p>
              </div>
            </div>

            {(error as Error).message.includes('hostname not available') && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>What does this mean?</strong>
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  The device has not connected to the platform yet. Configure the device with WiFi credentials first, then it will send its hostname and you can generate the QR code.
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {qrCode && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 flex flex-col items-center">
              <img
                src={qrCode.qrDataURL}
                alt="WiFi QR Code"
                className="w-64 h-64"
              />
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-gray-700">Network SSID:</p>
                <code className="text-base font-mono text-gray-900 bg-white px-3 py-1 rounded border border-gray-300 inline-block mt-1">
                  {qrCode.ssid}
                </code>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
              <p className="text-sm text-blue-800 font-medium mb-2">Instructions:</p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Scan this QR code with your phone's camera</li>
                <li>Your phone will automatically connect to the device's WiFi network "{qrCode.ssid}"</li>
                <li>Open the configuration page to set UUID and API Key</li>
              </ol>
            </div>

            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
              <p className="text-sm text-green-800 font-medium mb-2">Device Configuration Page:</p>
              <a
                href={`${qrCode.hostname}/config`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 underline hover:text-green-900 font-mono break-all"
              >
                {qrCode.hostname}/config
              </a>
              <p className="text-xs text-green-700 mt-2">
                Click here after connecting to WiFi "{qrCode.ssid}" to configure UUID and API Key
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md">
              <p className="text-xs text-yellow-800">
                <strong>Alternative:</strong> If QR code doesn't work, manually connect to WiFi network "{qrCode.ssid}" (no password required)
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
