import { useCycle, useCompleteCycle, useCreateCycle } from '../hooks/useCycle';
import { Loader2, Calendar, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

export function CycleProgressBanner() {
  const { data: cycle, isLoading, error } = useCycle();
  const completeCycle = useCompleteCycle();
  const createCycle = useCreateCycle();
  const [showCompletionAlert, setShowCompletionAlert] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            <span className="text-sm text-gray-500">Caricamento ciclo...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border-b border-red-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">
              Errore nel caricamento del ciclo: {error.message}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // No cycle state
  if (!cycle) {
    return (
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">
                Nessun ciclo attivo. Crea un nuovo ciclo per iniziare.
              </span>
            </div>
            <Link
              to="/settings"
              className="text-sm font-medium text-amber-700 hover:text-amber-900 underline"
            >
              Vai alle Impostazioni →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if cycle is complete or near completion
  const isNearCompletion = cycle.progress_percentage >= 90;
  const isComplete = cycle.is_complete;

  // Show completion alert when cycle reaches 100%
  if (isComplete && !showCompletionAlert) {
    setShowCompletionAlert(true);
  }

  // Handle cycle completion
  const handleCompleteCycle = async () => {
    try {
      await completeCycle.mutateAsync();
      setShowCompletionAlert(false);
      // Success message will be handled by react-query invalidation
    } catch (err) {
      console.error('Error completing cycle:', err);
    }
  };

  // Handle new cycle creation
  const handleStartNewCycle = async () => {
    try {
      await createCycle.mutateAsync(12); // Default 12 weeks
      setShowCompletionAlert(false);
    } catch (err) {
      console.error('Error creating new cycle:', err);
    }
  };

  // Completion Alert Modal
  if (showCompletionAlert) {
    return (
      <div className="bg-green-600 border-b border-green-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-white" />
              <div>
                <h3 className="text-lg font-semibold text-white">🎉 Ciclo Completato!</h3>
                <p className="text-sm text-green-100">
                  Hai raggiunto la settimana {cycle.current_week} di {cycle.duration_weeks}. Complimenti!
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompletionAlert(false)}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm"
              >
                Continua
              </button>
              <button
                onClick={handleStartNewCycle}
                disabled={createCycle.isPending}
                className="px-4 py-2 bg-white text-green-700 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createCycle.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creazione...
                  </>
                ) : (
                  'Inizia Nuovo Ciclo'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine banner color based on progress
  const getBannerColor = () => {
    if (isNearCompletion) return 'bg-amber-50 border-amber-200';
    if (cycle.progress_percentage >= 50) return 'bg-blue-50 border-blue-200';
    return 'bg-green-50 border-green-200';
  };

  const getProgressBarColor = () => {
    if (isNearCompletion) return 'bg-amber-600';
    if (cycle.progress_percentage >= 50) return 'bg-blue-600';
    return 'bg-green-600';
  };

  const getTextColor = () => {
    if (isNearCompletion) return 'text-amber-900';
    if (cycle.progress_percentage >= 50) return 'text-blue-900';
    return 'text-green-900';
  };

  return (
    <div className={`${getBannerColor()} border-b shadow-sm`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left side: Cycle info */}
          <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <Calendar className={`h-5 w-5 ${getTextColor()}`} />
              <div>
                <p className={`text-sm font-medium ${getTextColor()}`}>
                  Ciclo di Coltivazione
                </p>
                <p className="text-xs text-gray-600">
                  Iniziato il {new Date(cycle.started_at).toLocaleDateString('it-IT')}
                </p>
              </div>
            </div>

            {/* Progress info */}
            <div className="flex items-center gap-2 ml-4">
              <TrendingUp className={`h-4 w-4 ${getTextColor()}`} />
              <span className={`text-sm font-semibold ${getTextColor()}`}>
                Settimana {cycle.current_week} di {cycle.duration_weeks}
              </span>
            </div>
          </div>

          {/* Right side: Progress bar */}
          <div className="flex items-center gap-4 flex-1 w-full md:w-auto md:max-w-md">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">
                  {cycle.flowering_week ? 'Fasi' : 'Progresso'}
                </span>
                <span className={`text-sm font-bold ${getTextColor()}`}>
                  {cycle.progress_percentage}%
                </span>
              </div>

              {/* Progress bar with phases */}
              {cycle.flowering_week ? (
                <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  {/* Vegetative phase background */}
                  <div
                    className="absolute left-0 top-0 h-full bg-green-300"
                    style={{
                      width: `${((cycle.flowering_week - 1) / cycle.duration_weeks) * 100}%`,
                    }}
                  />
                  {/* Flowering phase background */}
                  <div
                    className="absolute right-0 top-0 h-full bg-purple-300"
                    style={{
                      width: `${
                        ((cycle.duration_weeks - cycle.flowering_week + 1) / cycle.duration_weeks) * 100
                      }%`,
                    }}
                  />
                  {/* Current progress overlay */}
                  <div
                    className={`absolute left-0 top-0 h-full transition-all duration-500 ease-out ${
                      cycle.current_week < cycle.flowering_week ? 'bg-green-600' : 'bg-purple-600'
                    }`}
                    style={{ width: `${cycle.progress_percentage}%` }}
                  />
                  {/* Phase divider */}
                  <div
                    className="absolute top-0 w-0.5 h-full bg-white"
                    style={{
                      left: `${((cycle.flowering_week - 1) / cycle.duration_weeks) * 100}%`,
                    }}
                  />
                </div>
              ) : (
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${getProgressBarColor()} h-3 rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${cycle.progress_percentage}%` }}
                  />
                </div>
              )}

              {/* Phase labels */}
              {cycle.flowering_week && (
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className={`${cycle.current_week < cycle.flowering_week ? 'font-semibold text-green-700' : 'text-gray-500'}`}>
                    🌱 Vegetativa
                  </span>
                  <span className={`${cycle.current_week >= cycle.flowering_week ? 'font-semibold text-purple-700' : 'text-gray-500'}`}>
                    🌸 Fioritura
                  </span>
                </div>
              )}
            </div>

            <Link
              to="/settings"
              className={`text-sm font-medium ${getTextColor()} hover:underline whitespace-nowrap`}
            >
              Modifica →
            </Link>
          </div>
        </div>

        {/* Warning for near completion */}
        {isNearCompletion && !isComplete && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            <p className="text-xs text-amber-800">
              ⚠️ Il ciclo sta per completarsi. Prepara il prossimo ciclo!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
