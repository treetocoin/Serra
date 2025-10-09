import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TimeInterval } from '../../services/history.service';
import { historyService } from '../../services/history.service';

interface AggregatedReading {
  timestamp: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  count: number;
}

interface SensorChartProps {
  data: AggregatedReading[];
  sensorName: string;
  unit: string;
  interval: TimeInterval;
}

export function SensorChart({ data, sensorName, unit, interval }: SensorChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">No data available for selected range</p>
          <p className="text-sm text-gray-500 mt-1">
            Try selecting a different date range or sensor
          </p>
        </div>
      </div>
    );
  }

  // Transform data for chart
  const chartData = data.map((reading) => ({
    timestamp: historyService.formatTimestamp(reading.timestamp, interval),
    value: reading.avg_value,
    min: reading.min_value,
    max: reading.max_value,
  }));

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{sensorName}</h2>
        <p className="text-sm text-gray-600">
          {data.length} data points ({interval === 'raw' ? 'raw readings' : `${interval} average`})
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fontSize: '12px' }}
          />
          <YAxis
            label={{ value: unit, angle: -90, position: 'insideLeft' }}
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
            formatter={(value: number) => [`${value.toFixed(2)} ${unit}`, 'Value']}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            name={interval === 'raw' ? 'Value' : 'Average'}
          />
          {interval !== 'raw' && (
            <>
              <Line
                type="monotone"
                dataKey="min"
                stroke="#3b82f6"
                strokeWidth={1}
                dot={false}
                strokeDasharray="5 5"
                name="Min"
              />
              <Line
                type="monotone"
                dataKey="max"
                stroke="#ef4444"
                strokeWidth={1}
                dot={false}
                strokeDasharray="5 5"
                name="Max"
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
