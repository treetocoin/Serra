import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesService } from '../../services/devices.service';

export const useProjectDevices = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId, 'devices'],
    queryFn: () => devicesService.getProjectDevices(projectId),
    staleTime: 20000,
    refetchInterval: 30000, // Poll every 30s for status updates
    enabled: !!projectId,
  });
};

export const useAvailableDeviceIds = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId, 'available-device-ids'],
    queryFn: () => devicesService.getAvailableDeviceIds(projectId),
    staleTime: 10000,
    enabled: !!projectId,
  });
};

export const useRegisterDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { name: string; projectId: string; deviceNumber: number }) =>
      devicesService.registerDevice(params.name, params.projectId, params.deviceNumber),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId, 'devices'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId, 'available-device-ids'] });
    },
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (compositeDeviceId: string) => devicesService.deleteDevice(compositeDeviceId),
    onSuccess: (_, compositeDeviceId) => {
      const projectId = compositeDeviceId.split('-')[0];
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'devices'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'available-device-ids'] });
    },
  });
};
