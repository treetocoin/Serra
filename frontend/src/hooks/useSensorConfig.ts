import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sensorConfigService } from '@/services/sensor-config.service';
import type { CreateSensorConfig } from '@/types/sensor-config.types';

/**
 * Query key factory for sensor configurations
 */
export const sensorConfigKeys = {
  all: ['sensor-configs'] as const,
  byDevice: (deviceId: string) => ['sensor-configs', deviceId] as const,
};

/**
 * Hook to fetch active sensor configurations for a device
 */
export function useSensorConfigs(deviceId: string) {
  return useQuery({
    queryKey: sensorConfigKeys.byDevice(deviceId),
    queryFn: () => sensorConfigService.getActiveConfigs(deviceId),
    staleTime: 60000, // 1 minute - configs change infrequently
    enabled: !!deviceId,
  });
}

/**
 * Hook to create a new sensor configuration
 */
export function useCreateSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: CreateSensorConfig) =>
      sensorConfigService.createConfig(config),
    onSuccess: (data) => {
      // Invalidate device configs to refetch
      queryClient.invalidateQueries({
        queryKey: sensorConfigKeys.byDevice(data.device_id),
      });
    },
  });
}

/**
 * Hook to deactivate a sensor configuration
 */
export function useDeactivateSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, deviceId }: { configId: string; deviceId: string }) =>
      sensorConfigService.deactivateConfig(configId),
    onSuccess: (_, variables) => {
      // Invalidate device configs to refetch
      queryClient.invalidateQueries({
        queryKey: sensorConfigKeys.byDevice(variables.deviceId),
      });
    },
  });
}

/**
 * Hook to update a sensor configuration (deactivate old + create new)
 */
export function useUpdateSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      oldConfigId,
      newConfig,
    }: {
      oldConfigId: string;
      newConfig: CreateSensorConfig;
    }) => sensorConfigService.updateConfig(oldConfigId, newConfig),
    onSuccess: (data) => {
      // Invalidate device configs to refetch
      queryClient.invalidateQueries({
        queryKey: sensorConfigKeys.byDevice(data.device_id),
      });
    },
  });
}

/**
 * Hook to count soil moisture sensors for a device
 */
export function useSoilMoistureSensorCount(deviceId: string) {
  return useQuery({
    queryKey: [...sensorConfigKeys.byDevice(deviceId), 'soil-count'],
    queryFn: () => sensorConfigService.countSoilMoistureSensors(deviceId),
    staleTime: 60000,
    enabled: !!deviceId,
  });
}
