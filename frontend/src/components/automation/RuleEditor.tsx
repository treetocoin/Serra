import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useCreateRule, useUpdateRule, useAutomationRule } from '../../lib/hooks/useAutomationRules';
import { ConditionBuilder } from './ConditionBuilder';
import type { CreateRuleRequest, ActionType } from '../../types/automation';

interface Actuator {
  id: string;
  name: string | null;
  actuator_id: string;
  actuator_type: string;
  supports_pwm: boolean;
}

interface RuleAction {
  actuator_id: string;
  action_type: ActionType;
  action_value?: number;
  action_order: number;
}

interface ConditionGroup {
  group_order: number;
  conditions: {
    sensor_id: string;
    operator: string;
    value: number;
    value_max?: number;
    condition_order: number;
  }[];
}

interface RuleEditorProps {
  ruleId?: string | null;
  onClose: () => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({ ruleId, onClose }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(10);
  const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>([
    {
      group_order: 0,
      conditions: [
        {
          sensor_id: '',
          operator: 'gt',
          value: 0,
          condition_order: 0,
        },
      ],
    },
  ]);
  const [actions, setActions] = useState<RuleAction[]>([
    {
      actuator_id: '',
      action_type: 'on',
      action_order: 0,
    },
  ]);

  // Hysteresis state
  const [enableHysteresis, setEnableHysteresis] = useState(false);
  const [onThreshold, setOnThreshold] = useState<number | null>(null);
  const [offThreshold, setOffThreshold] = useState<number | null>(null);
  const [minStateChangeInterval, setMinStateChangeInterval] = useState(60);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRule = useCreateRule();
  const updateRule = useUpdateRule();

  // Fetch existing rule if editing
  const { data: existingRule, isLoading: isLoadingRule } = useAutomationRule(ruleId || '');

  // Load existing rule data into form
  useEffect(() => {
    if (existingRule && ruleId) {
      setName(existingRule.name);
      setDescription(existingRule.description || '');
      setPriority(existingRule.priority);

      // Load condition groups
      if (existingRule.condition_groups && existingRule.condition_groups.length > 0) {
        const groups = existingRule.condition_groups.map(group => ({
          group_order: group.group_order,
          conditions: group.conditions.map(cond => ({
            sensor_id: cond.sensor_id,
            operator: cond.operator,
            value: cond.value,
            value_max: cond.value_max,
            condition_order: cond.condition_order,
          })),
        }));
        setConditionGroups(groups);
      }

      // Load actions
      if (existingRule.actions && existingRule.actions.length > 0) {
        const acts = existingRule.actions.map(action => ({
          actuator_id: action.actuator_id,
          action_type: action.action_type,
          action_value: action.action_value,
          action_order: action.action_order,
        }));
        setActions(acts);
      }

      // Load hysteresis settings
      if (existingRule.on_threshold !== null && existingRule.off_threshold !== null) {
        setEnableHysteresis(true);
        setOnThreshold(existingRule.on_threshold);
        setOffThreshold(existingRule.off_threshold);
        setMinStateChangeInterval(existingRule.min_state_change_interval_seconds || 60);
      }
    }
  }, [existingRule, ruleId]);

  // Fetch all actuators
  const { data: actuators } = useQuery({
    queryKey: ['actuators-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actuators')
        .select('id, name, actuator_id, actuator_type, supports_pwm')
        .order('name');

      if (error) throw error;
      return data as Actuator[];
    },
  });

  const addAction = () => {
    setActions([
      ...actions,
      {
        actuator_id: '',
        action_type: 'on',
        action_order: actions.length,
      },
    ]);
  };

  const removeAction = (index: number) => {
    const updated = actions.filter((_, i) => i !== index);
    // Reorder
    updated.forEach((action, i) => {
      action.action_order = i;
    });
    setActions(updated);
  };

  const updateAction = (index: number, field: keyof RuleAction, value: any) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [field]: value };

    // Reset action_value if action_type is not set_value
    if (field === 'action_type' && value !== 'set_value') {
      updated[index].action_value = undefined;
    }

    setActions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    // Validation
    if (!name.trim()) {
      setError('Il nome è obbligatorio');
      setIsSaving(false);
      return;
    }

    if (conditionGroups.length === 0 || conditionGroups[0].conditions.length === 0) {
      setError('Aggiungi almeno una condizione');
      setIsSaving(false);
      return;
    }

    if (actions.length === 0) {
      setError('Aggiungi almeno un\'azione');
      setIsSaving(false);
      return;
    }

    // Check all conditions have sensor_id
    for (const group of conditionGroups) {
      for (const cond of group.conditions) {
        if (!cond.sensor_id) {
          setError('Seleziona un sensore per tutte le condizioni');
          setIsSaving(false);
          return;
        }
      }
    }

    // Check all actions have actuator_id
    for (const action of actions) {
      if (!action.actuator_id) {
        setError('Seleziona un attuatore per tutte le azioni');
        setIsSaving(false);
        return;
      }
      if (action.action_type === 'set_value' && action.action_value === undefined) {
        setError('Specifica un valore per le azioni di tipo "Set Value"');
        setIsSaving(false);
        return;
      }
    }

    // Validate hysteresis
    if (enableHysteresis) {
      if (onThreshold === null || offThreshold === null) {
        setError('Specifica entrambe le soglie per l\'isteresi');
        setIsSaving(false);
        return;
      }
      if (onThreshold >= offThreshold) {
        setError('La soglia ON deve essere minore della soglia OFF');
        setIsSaving(false);
        return;
      }
    }

    try {
      if (ruleId) {
        // Update existing rule - note: updating conditions/actions requires deleting and recreating
        // For now, we'll just update the metadata
        await updateRule.mutateAsync({
          ruleId,
          updates: {
            name: name.trim(),
            description: description.trim() || undefined,
            priority,
          },
        });
      } else {
        // Create new rule
        const request: CreateRuleRequest = {
          name: name.trim(),
          description: description.trim() || undefined,
          priority,
          is_active: true,
          on_threshold: enableHysteresis ? onThreshold : undefined,
          off_threshold: enableHysteresis ? offThreshold : undefined,
          min_state_change_interval_seconds: enableHysteresis ? minStateChangeInterval : undefined,
          condition_groups: conditionGroups.map(group => ({
            group_order: group.group_order,
            conditions: group.conditions.map(cond => ({
              sensor_id: cond.sensor_id,
              operator: cond.operator as any,
              value: cond.value,
              value_max: cond.value_max,
              condition_order: cond.condition_order,
            })),
          })),
          actions: actions.map(action => ({
            actuator_id: action.actuator_id,
            action_type: action.action_type,
            action_value: action.action_value,
            action_order: action.action_order,
          })),
        };

        await createRule.mutateAsync(request);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingRule && ruleId) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            <span className="text-gray-700">Caricamento regola...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {ruleId ? 'Modifica Regola' : 'Nuova Regola di Automazione'}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Regola *
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="es. Ventilazione automatica"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrizione
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrizione opzionale della regola"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Priorità (0-1000, più alto = priorità maggiore)
                </label>
                <input
                  type="number"
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  min={0}
                  max={1000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se più regole si attivano contemporaneamente, viene eseguita quella con priorità maggiore
                </p>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <ConditionBuilder
                conditionGroups={conditionGroups}
                onChange={setConditionGroups}
              />
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Azioni</h3>
              </div>

              {actions.map((action, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Azione {index + 1}
                    </span>
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={action.actuator_id}
                      onChange={(e) => updateAction(index, 'actuator_id', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    >
                      <option value="">Seleziona attuatore</option>
                      {actuators?.map((actuator) => (
                        <option key={actuator.id} value={actuator.id}>
                          {actuator.name || actuator.actuator_id} ({actuator.actuator_type})
                        </option>
                      ))}
                    </select>

                    <select
                      value={action.action_type}
                      onChange={(e) =>
                        updateAction(index, 'action_type', e.target.value as ActionType)
                      }
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="on">Accendi (ON)</option>
                      <option value="off">Spegni (OFF)</option>
                      <option value="set_value">Imposta Valore (PWM)</option>
                    </select>

                    {action.action_type === 'set_value' && (
                      <input
                        type="number"
                        value={action.action_value || ''}
                        onChange={(e) =>
                          updateAction(index, 'action_value', parseInt(e.target.value))
                        }
                        placeholder="Valore (0-100)"
                        min={0}
                        max={100}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        required
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addAction}
                className="w-full py-2 text-sm text-green-600 border border-green-300 rounded-md hover:bg-green-50"
              >
                + Aggiungi Azione
              </button>
            </div>

            {/* Hysteresis Configuration */}
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enableHysteresis"
                  checked={enableHysteresis}
                  onChange={(e) => setEnableHysteresis(e.target.checked)}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="enableHysteresis" className="text-sm font-medium text-gray-700">
                  Abilita Isteresi (Anti-oscillazione)
                </label>
              </div>
              <p className="text-xs text-gray-500 ml-6">
                L'isteresi previene il rapido ciclo on/off impostando soglie separate per accensione e spegnimento
              </p>

              {enableHysteresis && (
                <div className="ml-6 space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="onThreshold" className="block text-xs font-medium text-gray-700 mb-1">
                        Soglia ON (°C) *
                      </label>
                      <input
                        type="number"
                        id="onThreshold"
                        value={onThreshold ?? ''}
                        onChange={(e) => setOnThreshold(e.target.value ? parseFloat(e.target.value) : null)}
                        step="0.1"
                        placeholder="es. 15"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        required={enableHysteresis}
                      />
                      <p className="mt-1 text-xs text-gray-500">Attiva quando sotto questa temperatura</p>
                    </div>

                    <div>
                      <label htmlFor="offThreshold" className="block text-xs font-medium text-gray-700 mb-1">
                        Soglia OFF (°C) *
                      </label>
                      <input
                        type="number"
                        id="offThreshold"
                        value={offThreshold ?? ''}
                        onChange={(e) => setOffThreshold(e.target.value ? parseFloat(e.target.value) : null)}
                        step="0.1"
                        placeholder="es. 18"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        required={enableHysteresis}
                      />
                      <p className="mt-1 text-xs text-gray-500">Disattiva quando sopra questa temperatura</p>
                    </div>

                    <div>
                      <label htmlFor="minInterval" className="block text-xs font-medium text-gray-700 mb-1">
                        Intervallo Minimo (secondi)
                      </label>
                      <input
                        type="number"
                        id="minInterval"
                        value={minStateChangeInterval}
                        onChange={(e) => setMinStateChangeInterval(parseInt(e.target.value))}
                        min={1}
                        placeholder="60"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">Tempo minimo tra cambi di stato</p>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded border border-blue-300">
                    <p className="text-xs font-medium text-blue-900 mb-1">Esempio:</p>
                    <p className="text-xs text-blue-700">
                      Con ON=15°C e OFF=18°C: il riscaldamento si accende quando la temperatura scende sotto 15°C e
                      si spegne quando supera 18°C, evitando oscillazioni rapide nella zona 15-18°C.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSaving ? 'Salvataggio...' : 'Salva Regola'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
