import { useState } from 'react';
import { Calendar, TrendingUp, Sprout, Loader2, AlertCircle } from 'lucide-react';
import { useCreateCycle } from '../hooks/useCycle';

interface CycleOnboardingProps {
  onComplete?: () => void;
}

export function CycleOnboarding({ onComplete }: CycleOnboardingProps) {
  const createCycle = useCreateCycle();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [durationWeeks, setDurationWeeks] = useState<string>('12');
  const [currentWeek, setCurrentWeek] = useState<string>('1');
  const [floweringWeek, setFloweringWeek] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleNext = () => {
    setError('');

    if (step === 1) {
      const duration = parseInt(durationWeeks);
      if (isNaN(duration) || duration <= 0) {
        setError('La durata deve essere un numero maggiore di 0');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const current = parseInt(currentWeek);
      const duration = parseInt(durationWeeks);
      if (isNaN(current) || current <= 0) {
        setError('La settimana corrente deve essere un numero maggiore di 0');
        return;
      }
      if (current > duration) {
        setError(`La settimana corrente (${current}) non può essere maggiore della durata totale (${duration})`);
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleComplete = async () => {
    setError('');

    const duration = parseInt(durationWeeks);
    const current = parseInt(currentWeek);
    const flowering = floweringWeek ? parseInt(floweringWeek) : null;

    // Validate flowering week
    if (flowering !== null) {
      if (isNaN(flowering) || flowering <= 0) {
        setError('La settimana di fioritura deve essere un numero maggiore di 0');
        return;
      }
      if (flowering > duration) {
        setError(`La settimana di fioritura (${flowering}) non può essere maggiore della durata totale (${duration})`);
        return;
      }
      if (flowering <= current) {
        setError('La settimana di fioritura deve essere successiva alla settimana corrente');
        return;
      }
    }

    try {
      await createCycle.mutateAsync({
        duration_weeks: duration,
        current_week: current,
        flowering_week: flowering,
      });

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante la creazione del ciclo';
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Sprout className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Benvenuto! 🌱
          </h1>
          <p className="text-gray-600">
            Configura il tuo primo ciclo di coltivazione
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Durata</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className={`flex items-center ${step >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Settimana</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className={`flex items-center ${step >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Fioritura</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Step 1: Duration */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Durata totale del ciclo
              </label>
              <input
                type="number"
                min="1"
                max="52"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
                className="w-full px-6 py-4 text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-transparent text-center"
                placeholder="12"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-600 text-center">
                Numero totale di settimane per il ciclo completo (tipicamente 8-16 settimane)
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Current Week */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                A che settimana sei attualmente?
              </label>
              <input
                type="number"
                min="1"
                max={durationWeeks || 52}
                value={currentWeek}
                onChange={(e) => setCurrentWeek(e.target.value)}
                className="w-full px-6 py-4 text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-transparent text-center"
                placeholder="1"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-600 text-center">
                Se stai iniziando ora, inserisci 1. Altrimenti indica la settimana corrente.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Flowering Week */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Sprout className="h-5 w-5 text-green-600" />
                Settimana di cambio fase (Vegetativa → Fioritura)
              </label>
              <input
                type="number"
                min={parseInt(currentWeek) + 1 || 2}
                max={durationWeeks || 52}
                value={floweringWeek}
                onChange={(e) => setFloweringWeek(e.target.value)}
                className="w-full px-6 py-4 text-2xl font-semibold border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-green-500 focus:border-transparent text-center"
                placeholder="Opzionale"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-600 text-center">
                In quale settimana passerai dalla fase vegetativa alla fioritura?
              </p>
              <p className="mt-1 text-xs text-gray-500 text-center">
                (Opzionale - lascia vuoto se non hai una fase di fioritura)
              </p>
            </div>

            {/* Preview */}
            {floweringWeek && parseInt(floweringWeek) > parseInt(currentWeek) && (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-900 mb-2">Anteprima fasi:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-green-700 mb-1">
                      Fase Vegetativa (settimane 1-{parseInt(floweringWeek) - 1})
                    </div>
                    <div className="h-3 bg-green-600 rounded" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-purple-700 mb-1">
                      Fase Fioritura (settimane {floweringWeek}-{durationWeeks})
                    </div>
                    <div className="h-3 bg-purple-600 rounded" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Indietro
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-colors"
            >
              Avanti
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={createCycle.isPending}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {createCycle.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creazione...
                </>
              ) : (
                'Inizia il Ciclo 🚀'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
