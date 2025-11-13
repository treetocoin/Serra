import { ExternalLink, Info } from 'lucide-react';

interface DeviceSetupProps {
  deviceId: string;
  deviceName: string;
  hasSensors: boolean;
  deviceHostname?: string;
}

export function DeviceSetup({ deviceId, deviceName, hasSensors, deviceHostname }: DeviceSetupProps) {

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <Info className="h-8 w-8 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Configurazione Sensori
          </h3>

          <p className="text-sm text-blue-800 mb-4">
            {hasSensors
              ? 'Per aggiungere nuovi sensori, accedi alla pagina di configurazione del dispositivo ESP tramite il link qui sopra (sezione "Configurazione ESP").'
              : `Il dispositivo ${deviceName} è online e pronto. Accedi alla pagina di configurazione del dispositivo ESP tramite il link qui sopra per configurare i pin dei sensori.`
            }
          </p>

          <div className="bg-white border border-blue-300 rounded-md p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <span>📋</span> Come funziona
            </h4>
            <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
              <li>Collega fisicamente i sensori (DHT22, DHT11, ecc.) ai pin GPIO dell'ESP</li>
              <li>Accedi alla pagina di configurazione del dispositivo (link sopra → "Configura Sensori")</li>
              <li>Imposta il pin GPIO, il tipo di sensore e un nome personalizzato</li>
              <li>Salva la configurazione</li>
              <li>I sensori inizieranno automaticamente a inviare dati ogni 30 secondi</li>
              <li>I sensori appariranno automaticamente qui sotto</li>
            </ol>
          </div>

          {deviceHostname && (
            <div className="mt-4">
              <a
                href={`${deviceHostname}/config`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Apri Configurazione ESP</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
