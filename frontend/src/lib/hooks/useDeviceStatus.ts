import { useQuery } from '@tanstack/react-query';
import { devicesService } from '../../services/devices.service';

/**
 * Hook to monitor device connection status
 * Polls devices every 30s and calculates status based on last_seen_at
 */
export function useDeviceStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ['device-status', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { devices, error } = await devicesService.getDevices(userId);
      if (error) throw error;

      // Calculate real-time status for each device
      return devices.map((device) => ({
        ...device,
        calculatedStatus: devicesService.getConnectionStatus(device.last_seen_at),
      }));
    },
    enabled: !!userId,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
  });
}
