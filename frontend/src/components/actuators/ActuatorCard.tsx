import { useState } from 'react';
import { Power, Loader2, Edit2, Check, X } from 'lucide-react';
import type { Database } from '../../lib/supabase';
import { actuatorsService } from '../../services/actuators.service';
import { supabase } from '../../lib/supabase';
import { cn } from '../../utils/cn';

type Actuator = Database['public']['Tables']['actuators']['Row'];
type Command = Database['public']['Tables']['commands']['Row'];

interface ActuatorWithState extends Actuator {
  lastCommand?: Command;
}

interface ActuatorCardProps {
  actuator: ActuatorWithState;
  onCommandSent?: () => void;
  onUpdate?: () => void;
}

const PRESET_NAMES = [
  'Luce',
  'Acqua',
  'Ventola',
];

export function ActuatorCard({ actuator, onCommandSent, onUpdate }: ActuatorCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [pwmValue, setPwmValue] = useState(() => actuatorsService.getPwmValue(actuator));
  const [isEditing, setIsEditing] = useState(false);
  const [selectedName, setSelectedName] = useState(actuator.name || '');
  const [saving, setSaving] = useState(false);

  const config = actuatorsService.getActuatorConfig(actuator.actuator_type);
  const isOn = actuatorsService.isActuatorOn(actuator);
  const commandStatus = actuator.lastCommand
    ? actuatorsService.getCommandStatusConfig(actuator.lastCommand.status)
    : null;

  const handleToggle = async () => {
    setIsLoading(true);
    const commandType = isOn ? 'turn_off' : 'turn_on';

    const { error } = await actuatorsService.sendCommand(actuator.id, commandType);

    if (error) {
      console.error('Failed to send command:', error);
      alert(`Failed to ${commandType.replace('_', ' ')}: ${error.message}`);
    } else {
      onCommandSent?.();
    }

    setIsLoading(false);
  };

  const handlePwmChange = async (value: number) => {
    setPwmValue(value);
  };

  const handlePwmCommit = async () => {
    setIsLoading(true);

    const { error } = await actuatorsService.sendCommand(actuator.id, 'set_pwm', pwmValue);

    if (error) {
      console.error('Failed to send PWM command:', error);
      alert(`Failed to set PWM: ${error.message}`);
    } else {
      onCommandSent?.();
    }

    setIsLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('actuators')
      .update({ name: selectedName })
      .eq('id', actuator.id);

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
        isOn ? `${config.bgColor} border-${config.color.split('-')[1]}-300` : 'border-gray-200 bg-gray-50',
        'hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
              {!isEditing ? (
                <>
                  <div className="flex items-center space-x-2">
                    <h3 className={cn('font-semibold', config.color)}>
                      {actuator.name || config.label}
                    </h3>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Rinomina attuatore"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">{actuator.actuator_id}</p>
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
                        setSelectedName(actuator.name || '');
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
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={cn(
            'p-2 rounded-lg transition-all',
            isOn
              ? `${config.bgColor} ${config.color} hover:opacity-80`
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
          title={isOn ? 'Turn Off' : 'Turn On'}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Power className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* PWM Control for PWM-capable actuators */}
      {actuator.supports_pwm && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">PWM Level</label>
            <span className={cn('text-sm font-semibold', config.color)}>
              {Math.round((pwmValue / 255) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={pwmValue}
            onChange={(e) => handlePwmChange(parseInt(e.target.value, 10))}
            onMouseUp={handlePwmCommit}
            onTouchEnd={handlePwmCommit}
            disabled={isLoading}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
        </div>
      )}

      {/* Current State */}
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-600">Status:</span>
        <span className={cn('font-medium', isOn ? 'text-green-600' : 'text-gray-500')}>
          {isOn ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Last Command Status */}
      {commandStatus && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-500">Last Command:</span>
          <span className={cn('font-medium', commandStatus.color)}>{commandStatus.label}</span>
        </div>
      )}
    </div>
  );
}
