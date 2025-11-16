/**
 * TimeRangeSelector Component
 *
 * Button group for selecting time range for historical charts.
 * Three options: "Ultime 24 Ore", "Ultimi 7 Giorni", "Ultimi 30 Giorni"
 *
 * @feature 005-lavoriamo-alla-pagina T015
 * @see ../../../specs/005-lavoriamo-alla-pagina/quickstart.md Section 4.3
 */

import type { TimeRangeValue } from '../../types/dati.types';

// ============================================================================
// Component Props
// ============================================================================

export interface TimeRangeSelectorProps {
  selected: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
}

// ============================================================================
// Component
// ============================================================================

export function TimeRangeSelector({ selected, onChange }: TimeRangeSelectorProps) {
  const options: { value: TimeRangeValue; label: string }[] = [
    { value: '24h', label: 'Ultime 24 Ore' },
    { value: '7d', label: 'Ultimi 7 Giorni' },
    { value: '30d', label: 'Ultimi 30 Giorni' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              px-4 py-2 rounded-md font-medium text-sm transition-colors
              ${
                isSelected
                  ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
            `}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
