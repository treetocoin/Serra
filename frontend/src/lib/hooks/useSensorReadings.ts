import { useQuery } from '@tanstack/react-query';
import { sensorsService } from '../../services/sensors.service';

/**
 * Hook to fetch and auto-refresh sensor readings
 * Polls every 30 seconds for real-time updates
 */
export function useSensorReadings(deviceId: string | undefined) {
  return useQuery({
    queryKey: ['sensor-readings', deviceId],
    queryFn: async () => {
      if (!deviceId) return [];

      const { sensors, error } = await sensorsService.getSensorsWithLatestReadings(deviceId);
      if (error) throw error;
      return sensors;
    },
    enabled: !!deviceId,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
  });
}
