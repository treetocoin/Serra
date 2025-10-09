import React, { useState } from 'react';
import { useAutomationRules, useUpdateRule, useDeleteRule } from '../../lib/hooks/useAutomationRules';
import { RuleCard } from './RuleCard';

interface RuleListProps {
  onSelectRule: (ruleId: string) => void;
  onCreateRule: () => void;
}

export const RuleList: React.FC<RuleListProps> = ({ onSelectRule, onCreateRule }) => {
  const { data: rules, isLoading, error } = useAutomationRules();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleToggle = async (ruleId: string, isActive: boolean) => {
    try {
      await updateRule.mutateAsync({
        ruleId,
        updates: { is_active: isActive },
      });
    } catch (error) {
      console.error('Error toggling rule:', error);
      alert('Errore durante l\'attivazione/disattivazione della regola');
    }
  };

  const handleDelete = async (ruleId: string) => {
    const confirmed = window.confirm(
      'Sei sicuro di voler eliminare questa regola? Questa azione non può essere annullata.'
    );

    if (!confirmed) return;

    setDeletingId(ruleId);
    try {
      await deleteRule.mutateAsync(ruleId);
    } catch (error) {
      console.error('Error deleting rule:', error);
      alert('Errore durante l\'eliminazione della regola');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Caricamento regole...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Errore durante il caricamento delle regole. Riprova più tardi.
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🤖</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nessuna regola di automazione
        </h3>
        <p className="text-gray-600 mb-6">
          Crea la tua prima regola per automatizzare la gestione della serra
        </p>
        <button
          onClick={onCreateRule}
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors"
        >
          + Crea Prima Regola
        </button>
      </div>
    );
  }

  // Sort by priority (descending) then by creation date
  const sortedRules = [...rules].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Totale Regole</p>
          <p className="text-2xl font-bold text-gray-900">{rules.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-green-200">
          <p className="text-sm text-gray-600">Regole Attive</p>
          <p className="text-2xl font-bold text-green-600">
            {rules.filter(r => r.is_active).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-600">Esecuzioni Totali</p>
          <p className="text-2xl font-bold text-blue-600">
            {rules.reduce((sum, r) => sum + r.trigger_count, 0)}
          </p>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {sortedRules.map((rule) => (
          <div key={rule.id} className={deletingId === rule.id ? 'opacity-50' : ''}>
            <RuleCard
              rule={rule}
              onEdit={(r) => onSelectRule(r.id)}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
