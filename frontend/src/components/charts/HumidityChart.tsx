import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

interface Props {
  deviceId: string;
}

interface SensorReading {
  timestamp: string;
  reading_sensor_type: string;
  value: number;
}

export function HumidityChart({ deviceId }: Props) {
  const { data: readings, isLoading } = useQuery({
    queryKey: ['sensor-readings', deviceId, 'humidity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('timestamp, reading_sensor_type, value')
        .eq('sensor_id', deviceId)
        .in('reading_sensor_type', ['dht_sopra_humidity', 'dht_sotto_humidity'])
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data as SensorReading[];
    },
    enabled: !!deviceId,
    refetchInterval: 30000,
  });

  // Show loading skeleton while fetching
  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
        <div className="h-[300px] bg-gray-100 rounded animate-pulse"></div>
      </div>
    );
  }

  // Hide chart if no data
  if (!readings || readings.length === 0) {
    return null;
  }

  // Transform readings to chart format
  const chartData = transformToChartFormat(readings);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Humidity</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          />
          <YAxis
            label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(value) => new Date(value).toLocaleString('it-IT')}
            formatter={(value: number) => [`${value.toFixed(1)}%`]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="dht_sopra_humidity"
            name="Ceiling"
            stroke="#ff7300"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="dht_sotto_humidity"
            name="Ground"
            stroke="#387908"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function transformToChartFormat(readings: SensorReading[]) {
  const grouped = readings.reduce((acc, reading) => {
    const key = reading.timestamp;
    if (!acc[key]) {
      acc[key] = { timestamp: key };
    }
    acc[key][reading.reading_sensor_type] = reading.value;
    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped);
}
