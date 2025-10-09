import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { OperatorType } from '../../types/automation';
import { OPERATOR_OPTIONS } from '../../types/automation';

interface Sensor {
  id: string;
  name: string | null;
  sensor_id: string;
  sensor_type: string;
  unit: string;
}

interface Condition {
  sensor_id: string;
  operator: OperatorType;
  value: number;
  value_max?: number;
  condition_order: number;
}

interface ConditionGroup {
  group_order: number;
  conditions: Condition[];
}

interface ConditionBuilderProps {
  conditionGroups: ConditionGroup[];
  onChange: (groups: ConditionGroup[]) => void;
}

export const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  conditionGroups,
  onChange,
}) => {
  // Fetch all sensors
  const { data: sensors } = useQuery({
    queryKey: ['sensors-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensors')
        .select('id, name, sensor_id, sensor_type, unit')
        .order('name');

      if (error) throw error;
      return data as Sensor[];
    },
  });

  const addConditionGroup = () => {
    const newGroup: ConditionGroup = {
      group_order: conditionGroups.length,
      conditions: [
        {
          sensor_id: '',
          operator: 'gt',
          value: 0,
          condition_order: 0,
        },
      ],
    };
    onChange([...conditionGroups, newGroup]);
  };

  const removeConditionGroup = (groupIndex: number) => {
    const updated = conditionGroups.filter((_, i) => i !== groupIndex);
    // Reorder group_order
    updated.forEach((group, index) => {
      group.group_order = index;
    });
    onChange(updated);
  };

  const addCondition = (groupIndex: number) => {
    const updated = [...conditionGroups];
    const newCondition: Condition = {
      sensor_id: '',
      operator: 'gt',
      value: 0,
      condition_order: updated[groupIndex].conditions.length,
    };
    updated[groupIndex].conditions.push(newCondition);
    onChange(updated);
  };

  const removeCondition = (groupIndex: number, conditionIndex: number) => {
    const updated = [...conditionGroups];
    updated[groupIndex].conditions = updated[groupIndex].conditions.filter(
      (_, i) => i !== conditionIndex
    );
    // Reorder condition_order
    updated[groupIndex].conditions.forEach((cond, index) => {
      cond.condition_order = index;
    });
    onChange(updated);
  };

  const updateCondition = (
    groupIndex: number,
    conditionIndex: number,
    field: keyof Condition,
    value: any
  ) => {
    const updated = [...conditionGroups];
    updated[groupIndex].conditions[conditionIndex] = {
      ...updated[groupIndex].conditions[conditionIndex],
      [field]: value,
    };
    onChange(updated);
  };

  const getSensorName = (sensorId: string) => {
    const sensor = sensors?.find(s => s.id === sensorId);
    return sensor?.name || sensor?.sensor_id || 'Seleziona sensore';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Condizioni</h3>
        <p className="text-xs text-gray-500">
          Le condizioni nello stesso gruppo sono combinate con AND, i gruppi con OR
        </p>
      </div>

      {conditionGroups.map((group, groupIndex) => (
        <div key={groupIndex} className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">
                Gruppo {groupIndex + 1}
              </span>
              {groupIndex > 0 && (
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded font-medium">
                  OR
                </span>
              )}
            </div>
            {conditionGroups.length > 1 && (
              <button
                type="button"
                onClick={() => removeConditionGroup(groupIndex)}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Rimuovi Gruppo
              </button>
            )}
          </div>

          <div className="space-y-2">
            {group.conditions.map((condition, conditionIndex) => (
              <div key={conditionIndex} className="bg-white p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  {conditionIndex > 0 && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                      AND
                    </span>
                  )}
                  {group.conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCondition(groupIndex, conditionIndex)}
                      className="ml-auto text-xs text-red-600 hover:text-red-700"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  {/* Sensor Select */}
                  <select
                    value={condition.sensor_id}
                    onChange={(e) =>
                      updateCondition(groupIndex, conditionIndex, 'sensor_id', e.target.value)
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    required
                  >
                    <option value="">Seleziona sensore</option>
                    {sensors?.map((sensor) => (
                      <option key={sensor.id} value={sensor.id}>
                        {sensor.name || sensor.sensor_id} ({sensor.unit})
                      </option>
                    ))}
                  </select>

                  {/* Operator Select */}
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(
                        groupIndex,
                        conditionIndex,
                        'operator',
                        e.target.value as OperatorType
                      )
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.symbol} ({op.label})
                      </option>
                    ))}
                  </select>

                  {/* Value Input */}
                  <input
                    type="number"
                    step="0.1"
                    value={condition.value}
                    onChange={(e) =>
                      updateCondition(groupIndex, conditionIndex, 'value', parseFloat(e.target.value))
                    }
                    placeholder="Valore"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    required
                  />

                  {/* Value Max (for BETWEEN operator) */}
                  {condition.operator === 'between' && (
                    <input
                      type="number"
                      step="0.1"
                      value={condition.value_max || ''}
                      onChange={(e) =>
                        updateCondition(
                          groupIndex,
                          conditionIndex,
                          'value_max',
                          parseFloat(e.target.value)
                        )
                      }
                      placeholder="Valore max"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addCondition(groupIndex)}
              className="w-full py-2 text-sm text-blue-600 border border-blue-300 rounded-md hover:bg-blue-50"
            >
              + Aggiungi Condizione (AND)
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addConditionGroup}
        className="w-full py-2 text-sm text-purple-600 border border-purple-300 rounded-md hover:bg-purple-50"
      >
        + Aggiungi Gruppo di Condizioni (OR)
      </button>
    </div>
  );
};
