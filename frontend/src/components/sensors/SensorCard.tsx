import { useState } from 'react';
import { AlertTriangle, Edit2, Check, X } from 'lucide-react';
import type { Database } from '../../lib/supabase';
import { sensorsService } from '../../services/sensors.service';
import { supabase } from '../../lib/supabase';
import { cn } from '../../utils/cn';

type Sensor = Database['public']['Tables']['sensors']['Row'];

interface SensorCardProps {
  sensor: Sensor;
  latestValue?: number;
  timestamp?: string;
  onUpdate?: () => void;
}

const PRESET_NAMES = [
  'Aria Sopra',
  'Aria Sotto',
  'Umidità Sopra',
  'Umidità Sotto',
  'Terreno',
  'Serbatoio',
];

export function SensorCard({ sensor, latestValue, timestamp, onUpdate }: SensorCardProps) {
  const config = sensorsService.getSensorConfig(sensor.sensor_type);
  const isAnomalous = latestValue !== undefined && sensorsService.isAnomalous(sensor, latestValue);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedName, setSelectedName] = useState(sensor.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('sensors')
      .update({ name: selectedName })
      .eq('id', sensor.id);

    if (!error) {
      setIsEditing(false);
      onUpdate?.();
    }
    setSaving(false);
  };

  return (
    <div
      className={cn(
        'rounded-lg p-4 border-2 transition-all',
        isAnomalous
          ? 'border-red-300 bg-red-50'
          : `border-gray-200 ${config.bgColor}`,
        'hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
              {!isEditing ? (
                <>
                  <div className="flex items-center space-x-2">
                    <h3 className={cn('font-semibold', config.color)}>
                      {sensor.name || sensor.sensor_type?.replace('_', ' ').toUpperCase() || 'Unknown Sensor'}
                    </h3>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Rename sensor"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{sensor.sensor_id}</p>
                </>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedName}
                    onChange={(e) => setSelectedName(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                  >
                    <option value="">Seleziona nome...</option>
                    {PRESET_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <div className="flex space-x-1">
                    <button
                      onClick={handleSave}
                      disabled={saving || !selectedName}
                      className={cn(
                        'flex items-center space-x-1 px-2 py-1 text-xs bg-green-600 text-white rounded',
                        (saving || !selectedName) && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <Check className="h-3 w-3" />
                      <span>{saving ? 'Salvataggio...' : 'Salva'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setSelectedName(sensor.name || '');
                      }}
                      disabled={saving}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                    >
                      <X className="h-3 w-3" />
                      <span>Annulla</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {latestValue !== undefined ? (
            <div className="mt-3">
              <div className="flex items-baseline space-x-2">
                <span className={cn('text-3xl font-bold', isAnomalous ? 'text-red-600' : config.color)}>
                  {latestValue.toFixed(1)}
                </span>
                <span className={cn('text-lg', isAnomalous ? 'text-red-500' : 'text-gray-600')}>
                  {sensor.unit}
                </span>
              </div>

              {timestamp && (
                <p className="text-xs text-gray-500 mt-1">
                  {sensorsService.formatTimestamp(timestamp)}
                </p>
              )}

              {/* Range info if configured */}
              {(sensor.min_value !== null || sensor.max_value !== null) && (
                <div className="mt-2 text-xs text-gray-500">
                  Intervallo: {sensor.min_value ?? '−∞'} a {sensor.max_value ?? '+∞'} {sensor.unit}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 text-gray-400">
              <p className="text-sm">Nessun dato ancora</p>
              <p className="text-xs">In attesa di letture...</p>
            </div>
          )}
        </div>

        {isAnomalous && (
          <div className="ml-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
        )}
      </div>

      {isAnomalous && (
        <div className="mt-3 bg-red-100 border border-red-300 rounded-md p-2">
          <p className="text-xs text-red-800 font-medium">
            ⚠️ Valore fuori dall'intervallo normale!
          </p>
        </div>
      )}
    </div>
  );
}
