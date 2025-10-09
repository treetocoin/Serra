import React, { useState } from 'react';
import { RuleList } from '../components/automation/RuleList';
import { RuleEditor } from '../components/automation/RuleEditor';
import { Settings } from 'lucide-react';

export const AutomationPage: React.FC = () => {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRule = () => {
    setSelectedRuleId(null);
    setIsCreating(true);
  };

  const handleSelectRule = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setIsCreating(true);
  };

  const handleCloseEditor = () => {
    setIsCreating(false);
    setSelectedRuleId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <Settings className="h-8 w-8 text-green-600" />
                <h1 className="text-3xl font-bold text-gray-900">Automazione</h1>
              </div>
              <p className="mt-2 text-gray-600">
                Crea e gestisci regole di automazione basate sui dati dei sensori
              </p>
            </div>
            <button
              onClick={handleCreateRule}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm"
            >
              + Crea Nuova Regola
            </button>
          </div>
        </div>

        {/* Rules List */}
        <RuleList onSelectRule={handleSelectRule} onCreateRule={handleCreateRule} />

        {/* Rule Editor Modal */}
        {isCreating && (
          <RuleEditor ruleId={selectedRuleId} onClose={handleCloseEditor} />
        )}
      </div>
    </div>
  );
};
