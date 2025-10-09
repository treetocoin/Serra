import { useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onDateChange: (startDate: Date, endDate: Date) => void;
}

type PresetOption = {
  label: string;
  getValue: () => { start: Date; end: Date };
};

const PRESETS: PresetOption[] = [
  {
    label: 'Last 24 hours',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    label: 'Last 7 days',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    label: 'Last 30 days',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    label: 'Last 90 days',
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
];

export function DateRangePicker({ startDate, endDate, onDateChange }: DateRangePickerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);

    if (newStart > endDate) {
      setError('Start date must be before end date');
      return;
    }

    setError(null);
    onDateChange(newStart, endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);

    if (newEnd < startDate) {
      setError('End date must be after start date');
      return;
    }

    if (newEnd > new Date()) {
      setError('End date cannot be in the future');
      return;
    }

    setError(null);
    onDateChange(startDate, newEnd);
  };

  const handlePresetClick = (preset: PresetOption) => {
    const { start, end } = preset.getValue();
    setError(null);
    onDateChange(start, end);
  };

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Calendar className="h-5 w-5 text-green-600" />
        <h2 className="text-lg font-semibold text-gray-900">Date Range</h2>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset)}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-green-100 hover:text-green-700 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom Date Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date & Time
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(startDate)}
            onChange={handleStartDateChange}
            max={formatDateForInput(endDate)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date & Time
          </label>
          <input
            type="datetime-local"
            value={formatDateForInput(endDate)}
            onChange={handleEndDateChange}
            min={formatDateForInput(startDate)}
            max={formatDateForInput(new Date())}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Info */}
      <p className="mt-3 text-xs text-gray-500">
        Date range: {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}{' '}
        days
      </p>
    </div>
  );
}
