import { useState } from 'react';
import { Loader2, Calendar, TrendingUp, AlertCircle, CheckCircle, Sprout } from 'lucide-react';
import { useCycle, useUpdateCycle } from '../hooks/useCycle';

export function CycleSettings() {
  const { data: cycle, isLoading, error } = useCycle();
  const updateCycle = useUpdateCycle();

  const [durationWeeks, setDurationWeeks] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<string>('');
  const [floweringWeek, setFloweringWeek] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Initialize form when cycle loads
  const handleFormInit = () => {
    if (cycle && !durationWeeks && !currentWeek) {
      setDurationWeeks(cycle.duration_weeks.toString());
      setCurrentWeek(cycle.current_week.toString());
      setFloweringWeek(cycle.flowering_week ? cycle.flowering_week.toString() : '');
    }
  };

  // Reset form to cycle values
  const handleReset = () => {
    if (cycle) {
      setDurationWeeks(cycle.duration_weeks.toString());
      setCurrentWeek(cycle.current_week.toString());
      setFloweringWeek(cycle.flowering_week ? cycle.flowering_week.toString() : '');
      setValidationError('');
      setSuccessMessage('');
    }
  };

  // Validate and update cycle
  const handleUpdate = async () => {
    setValidationError('');
    setSuccessMessage('');

    const newDuration = parseInt(durationWeeks);
    const newWeek = parseInt(currentWeek);
    const newFlowering = floweringWeek ? parseInt(floweringWeek) : null;

    // Client-side validation
    if (isNaN(newDuration) || newDuration <= 0) {
      setValidationError('La durata deve essere un numero maggiore di 0');
      return;
    }

    if (isNaN(newWeek) || newWeek <= 0) {
      setValidationError('La settimana corrente deve essere un numero maggiore di 0');
      return;
    }

    if (newWeek > newDuration) {
      setValidationError(
        `La settimana corrente (${newWeek}) non può essere maggiore della durata totale (${newDuration} settimane). Riduci la settimana corrente o aumenta la durata.`
      );
      return;
    }

    // Validate flowering week
    if (newFlowering !== null) {
      if (isNaN(newFlowering) || newFlowering <= 0) {
        setValidationError('La settimana di fioritura deve essere un numero maggiore di 0');
        return;
      }
      if (newFlowering > newDuration) {
        setValidationError(
          `La settimana di fioritura (${newFlowering}) non può essere maggiore della durata totale (${newDuration} settimane).`
        );
        return;
      }
    }

    try {
      await updateCycle.mutateAsync({
        duration_weeks: newDuration,
        current_week: newWeek,
        flowering_week: newFlowering,
      });

      setSuccessMessage('✅ Ciclo aggiornato con successo!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'aggiornamento';
      setValidationError(errorMessage);
    }
  };

  // Initialize form on first render
  if (cycle && !durationWeeks && !currentWeek) {
    handleFormInit();
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-600">Caricamento impostazioni ciclo...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <p>Errore nel caricamento del ciclo: {error.message}</p>
        </div>
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 text-amber-600">
          <AlertCircle className="h-5 w-5" />
          <p>Nessun ciclo attivo trovato. Il ciclo verrà creato automaticamente al prossimo accesso.</p>
        </div>
      </div>
    );
  }

  const hasChanges =
    durationWeeks !== cycle.duration_weeks.toString() ||
    currentWeek !== cycle.current_week.toString() ||
    floweringWeek !== (cycle.flowering_week ? cycle.flowering_week.toString() : '');

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">Impostazioni Ciclo</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configura la durata del ciclo e la settimana corrente
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Validation Error */}
        {validationError && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800">{validationError}</p>
          </div>
        )}

        {/* Duration Input */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Durata Totale (settimane)
            </div>
          </label>
          <input
            id="duration"
            type="number"
            min="1"
            max="52"
            value={durationWeeks}
            onChange={(e) => {
              setDurationWeeks(e.target.value);
              setValidationError('');
              setSuccessMessage('');
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Es. 12"
          />
          <p className="mt-1 text-xs text-gray-500">
            Numero totale di settimane per il ciclo completo (1-52)
          </p>
        </div>

        {/* Current Week Input */}
        <div>
          <label htmlFor="currentWeek" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Settimana Corrente
            </div>
          </label>
          <input
            id="currentWeek"
            type="number"
            min="1"
            max={durationWeeks ? parseInt(durationWeeks) : 52}
            value={currentWeek}
            onChange={(e) => {
              setCurrentWeek(e.target.value);
              setValidationError('');
              setSuccessMessage('');
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Es. 5"
          />
          <p className="mt-1 text-xs text-gray-500">
            Settimana attuale del ciclo (1-{durationWeeks || '...'})
          </p>
        </div>

        {/* Flowering Week Input */}
        <div>
          <label htmlFor="floweringWeek" className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              Settimana di Cambio Fase (Opzionale)
            </div>
          </label>
          <input
            id="floweringWeek"
            type="number"
            min="1"
            max={durationWeeks ? parseInt(durationWeeks) : 52}
            value={floweringWeek}
            onChange={(e) => {
              setFloweringWeek(e.target.value);
              setValidationError('');
              setSuccessMessage('');
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Es. 6 (opzionale)"
          />
          <p className="mt-1 text-xs text-gray-500">
            Settimana di transizione dalla fase vegetativa alla fioritura (lascia vuoto se non applicabile)
          </p>
        </div>

        {/* Progress Preview */}
        {durationWeeks && currentWeek && !isNaN(parseInt(durationWeeks)) && !isNaN(parseInt(currentWeek)) && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Anteprima Progresso</p>

            {floweringWeek && !isNaN(parseInt(floweringWeek)) ? (
              // Two-phase progress bar (vegetative + flowering)
              <>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 relative h-3 bg-gray-200 rounded-full overflow-hidden">
                    {/* Vegetative phase background */}
                    <div
                      className="absolute left-0 top-0 h-full bg-green-300"
                      style={{
                        width: `${((parseInt(floweringWeek) - 1) / parseInt(durationWeeks)) * 100}%`,
                      }}
                    />
                    {/* Flowering phase background */}
                    <div
                      className="absolute right-0 top-0 h-full bg-purple-300"
                      style={{
                        width: `${
                          ((parseInt(durationWeeks) - parseInt(floweringWeek) + 1) / parseInt(durationWeeks)) * 100
                        }%`,
                      }}
                    />
                    {/* Current progress overlay */}
                    <div
                      className={`absolute left-0 top-0 h-full transition-all ${
                        parseInt(currentWeek) < parseInt(floweringWeek) ? 'bg-green-600' : 'bg-purple-600'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.round((parseInt(currentWeek) / parseInt(durationWeeks)) * 100))}%`,
                      }}
                    />
                    {/* Phase divider */}
                    <div
                      className="absolute top-0 w-0.5 h-full bg-white"
                      style={{
                        left: `${((parseInt(floweringWeek) - 1) / parseInt(durationWeeks)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.min(100, Math.round((parseInt(currentWeek) / parseInt(durationWeeks)) * 100))}%
                  </span>
                </div>

                {/* Phase labels */}
                <div className="flex items-center justify-between text-xs">
                  <span className={`${parseInt(currentWeek) < parseInt(floweringWeek) ? 'font-semibold text-green-700' : 'text-gray-500'}`}>
                    🌱 Vegetativa (1-{parseInt(floweringWeek) - 1})
                  </span>
                  <span className={`${parseInt(currentWeek) >= parseInt(floweringWeek) ? 'font-semibold text-purple-700' : 'text-gray-500'}`}>
                    🌸 Fioritura ({floweringWeek}-{durationWeeks})
                  </span>
                </div>
              </>
            ) : (
              // Single-phase progress bar
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((parseInt(currentWeek) / parseInt(durationWeeks)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {Math.min(100, Math.round((parseInt(currentWeek) / parseInt(durationWeeks)) * 100))}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Settimana {currentWeek} di {durationWeeks}
                </p>
              </>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleUpdate}
            disabled={!hasChanges || updateCycle.isPending}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {updateCycle.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvataggio...
              </>
            ) : (
              'Salva Modifiche'
            )}
          </button>

          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Annulla
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>💡 Suggerimento:</strong> Gli aggiornamenti del ciclo vengono tracciati automaticamente per
            l'analisi AI. Ogni modifica crea un evento nel registro.
          </p>
        </div>
      </div>
    </div>
  );
}
