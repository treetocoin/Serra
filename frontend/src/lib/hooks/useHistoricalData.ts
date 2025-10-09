import { useQuery } from '@tanstack/react-query';
import { historyService, type TimeInterval } from '../../services/history.service';

interface UseHistoricalDataParams {
  sensorId: string | null;
  startDate: Date;
  endDate: Date;
  interval?: TimeInterval;
}

/**
 * Hook to fetch historical sensor data with automatic interval selection
 */
export function useHistoricalData({
  sensorId,
  startDate,
  endDate,
  interval,
}: UseHistoricalDataParams) {
  // Auto-determine best interval if not specified
  const selectedInterval = interval || historyService.getBestInterval(startDate, endDate);

  return useQuery({
    queryKey: ['historical-data', sensorId, startDate.toISOString(), endDate.toISOString(), selectedInterval],
    queryFn: async () => {
      if (!sensorId) return [];

      const { data, error } = await historyService.getAggregatedData(
        sensorId,
        selectedInterval,
        startDate,
        endDate
      );

      if (error) throw error;
      return data;
    },
    enabled: !!sensorId,
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
}
