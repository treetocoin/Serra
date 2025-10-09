import React, { useState } from 'react';
import type { AutomationRule } from '../../types/automation';
import { RuleHistory } from './RuleHistory';

interface RuleCardProps {
  rule: AutomationRule;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string, isActive: boolean) => void;
}

export const RuleCard: React.FC<RuleCardProps> = ({ rule, onEdit, onDelete, onToggle }) => {
  const [showHistory, setShowHistory] = useState(false);

  const handleToggle = () => {
    onToggle(rule.id, !rule.is_active);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Mai';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className={`bg-white rounded-lg border-2 transition-all ${
      rule.is_active ? 'border-green-200 hover:border-green-400' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>

              {/* Priority Badge */}
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Priorità: {rule.priority}
              </span>

              {/* Active/Inactive Badge */}
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                rule.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {rule.is_active ? 'Attiva' : 'Disattivata'}
              </span>
            </div>

            {rule.description && (
              <p className="mt-2 text-sm text-gray-600">{rule.description}</p>
            )}

            {/* Statistics */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Esecuzioni</p>
                <p className="text-lg font-semibold text-gray-900">{rule.trigger_count}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ultima esecuzione</p>
                <p className="text-sm text-gray-900">{formatDate(rule.last_triggered_at)}</p>
              </div>
            </div>

            {/* Hysteresis Indicator */}
            {rule.on_threshold !== null && rule.off_threshold !== null && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <span className="font-medium text-blue-900">Isteresi:</span>{' '}
                <span className="text-blue-700">
                  ON a {rule.on_threshold}°C, OFF a {rule.off_threshold}°C
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="ml-4 flex flex-col space-y-2">
            {/* Toggle Active/Inactive */}
            <button
              onClick={handleToggle}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                rule.is_active
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
              title={rule.is_active ? 'Disattiva regola' : 'Attiva regola'}
            >
              {rule.is_active ? 'Disattiva' : 'Attiva'}
            </button>

            {/* View History Button */}
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
            >
              Storico
            </button>

            {/* Edit Button */}
            <button
              onClick={() => onEdit(rule)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Modifica
            </button>

            {/* Delete Button */}
            <button
              onClick={() => onDelete(rule.id)}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50"
            >
              Elimina
            </button>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Storico Esecuzioni - {rule.name}
              </h3>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              <RuleHistory ruleId={rule.id} />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowHistory(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
