/**
 * StaleDataAlert Component
 *
 * Banner warning displayed when any sensor has stale data (>15 minutes old).
 * User can dismiss the alert, which persists for the current session.
 *
 * @feature 005-lavoriamo-alla-pagina T030
 * @see ../../../specs/005-lavoriamo-alla-pagina/tasks.md T030
 */

import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';

// ============================================================================
// Component Props
// ============================================================================

export interface StaleDataAlertProps {
  onDismiss?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function StaleDataAlert({ onDismiss }: StaleDataAlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center justify-between gap-3"
      role="alert"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
        <p className="text-sm text-yellow-800 font-medium">
          Alcuni sensori non inviano dati da più di 15 minuti
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-yellow-600 hover:text-yellow-800 transition-colors flex-shrink-0"
        aria-label="Chiudi avviso"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
