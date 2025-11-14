import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

interface Props {
  deviceId: string;
}

interface SensorReading {
  timestamp: string;
  value: number;
}

export function SoilMoisture5Chart({ deviceId }: Props) {
  const { data: readings, isLoading } = useQuery({
    queryKey: ['sensor-readings', deviceId, 'soil-moisture-5'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('timestamp, value')
        .eq('sensor_id', deviceId)
        .eq('reading_sensor_type', 'soil_moisture_5')
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

  if (!readings || readings.length === 0) {
    return null;
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Soil Moisture 5</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={readings}>
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
            label={{ value: 'Moisture (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(value) => new Date(value).toLocaleString('it-IT')}
            formatter={(value: number) => [`${value.toFixed(1)}%`]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name="Soil Moisture 5"
            stroke="#bc8f8f"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
