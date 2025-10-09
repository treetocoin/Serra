import { useState } from 'react';
import { Settings, Check } from 'lucide-react';
import { devicesService } from '../../services/devices.service';
import { cn } from '../../utils/cn';

interface DeviceSetupProps {
  deviceId: string;
  deviceName: string;
  hasSensors: boolean;
  onSetupComplete: () => void;
}

export function DeviceSetup({ deviceId, deviceName, hasSensors, onSetupComplete }: DeviceSetupProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetupSensors = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error: err } = await devicesService.requestSensorConfiguration(deviceId);

    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);

      // Notify parent to refresh
      setTimeout(() => {
        onSetupComplete();
        setSuccess(false);
      }, 3000);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <Settings className="h-8 w-8 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Rilevamento Sensori e Attuatori
          </h3>

          {!success ? (
            <>
              <p className="text-sm text-blue-800 mb-4">
                {hasSensors
                  ? `Clicca il pulsante per rilevare nuovi sensori o attuatori collegati al dispositivo ${deviceName}.`
                  : `Il tuo dispositivo ${deviceName} è online e pronto. Clicca il pulsante per rilevare e registrare tutti i sensori e gli attuatori collegati.`
                }
              </p>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSetupSensors}
                disabled={loading}
                className={cn(
                  'flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md',
                  'hover:bg-blue-700 transition-colors',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Settings className="h-5 w-5" />
                <span>{loading ? 'Rilevamento...' : 'Rileva Sensori'}</span>
              </button>

              {loading && (
                <p className="mt-3 text-xs text-blue-700">
                  ⏳ In attesa di risposta dal dispositivo (potrebbe richiedere fino a 30 secondi)...
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center space-x-2 text-green-700">
              <Check className="h-5 w-5" />
              <span className="font-medium">
                Richiesta inviata! Il dispositivo rileverà i sensori a breve.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
