import React from 'react';
import { useRuleExecutionHistory } from '../../lib/hooks/useAutomationRules';
import { CheckCircle, XCircle, MinusCircle } from 'lucide-react';

interface RuleHistoryProps {
  ruleId: string;
}

export const RuleHistory: React.FC<RuleHistoryProps> = ({ ruleId }) => {
  const { data: history, isLoading, error } = useRuleExecutionHistory(ruleId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600">Caricamento storico...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Errore durante il caricamento dello storico esecuzioni.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Nessuna esecuzione registrata per questa regola.</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'skipped':
        return <MinusCircle className="h-5 w-5 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return 'Successo';
      case 'failed':
        return 'Fallito';
      case 'skipped':
        return 'Saltato';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Storico Esecuzioni</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data/Ora
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valore Sensore
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stato
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Errore
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(log.executed_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {log.sensor_value !== null ? log.sensor_value.toString() : '-'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(log.execution_status)}
                    <span className="text-sm text-gray-900">
                      {getStatusLabel(log.execution_status)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {log.error_message || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 text-right">
        Mostrate ultime {history.length} esecuzioni
      </p>
    </div>
  );
};
