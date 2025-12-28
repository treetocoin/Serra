import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Command types
export type DeviceCommandType = 'reset' | 'wifi_update' | 'firmware_update';

// Payload types
export interface WiFiUpdatePayload {
  ssid: string;
  password: string;
}

export interface FirmwareUpdatePayload {
  version: string;
  url: string;
}

// Command status
export type CommandStatus = 'pending' | 'delivered' | 'executed' | 'failed' | 'cancelled';

// Full command type
export interface DeviceCommand {
  id: string;
  device_id: string;
  command_type: DeviceCommandType;
  payload: Record<string, unknown>;
  status: CommandStatus;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
  executed_at: string | null;
  expires_at: string | null;
}

// Firmware version type
export interface FirmwareVersion {
  id: string;
  version: string;
  storage_path: string;
  file_size: number | null;
  checksum_md5: string | null;
  release_notes: string | null;
  is_stable: boolean;
  is_latest: boolean;
  created_at: string;
}

/**
 * Hook to get pending commands for a device
 */
export function useDeviceCommands(deviceId: string) {
  return useQuery({
    queryKey: ['device-commands', deviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_commands')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as DeviceCommand[];
    },
    enabled: !!deviceId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

/**
 * Hook to send a reset command
 */
export function useSendResetCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: 'reset',
          payload: {},
        })
        .select()
        .single();

      if (error) throw error;
      return data as DeviceCommand;
    },
    onSuccess: (_, deviceId) => {
      queryClient.invalidateQueries({ queryKey: ['device-commands', deviceId] });
    },
  });
}

/**
 * Hook to send a WiFi update command
 */
export function useSendWiFiUpdateCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      ssid,
      password,
    }: {
      deviceId: string;
      ssid: string;
      password: string;
    }) => {
      const { data, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: 'wifi_update',
          payload: { ssid, password },
        })
        .select()
        .single();

      if (error) throw error;
      return data as DeviceCommand;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['device-commands', data.device_id] });
    },
  });
}

/**
 * Hook to send a firmware update command
 */
export function useSendFirmwareUpdateCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      version,
      url,
    }: {
      deviceId: string;
      version: string;
      url: string;
    }) => {
      const { data, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: 'firmware_update',
          payload: { version, url },
        })
        .select()
        .single();

      if (error) throw error;
      return data as DeviceCommand;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['device-commands', data.device_id] });
    },
  });
}

/**
 * Hook to cancel a pending command
 */
export function useCancelCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commandId, deviceId }: { commandId: string; deviceId: string }) => {
      const { error } = await supabase
        .from('device_commands')
        .update({ status: 'cancelled' })
        .eq('id', commandId)
        .eq('status', 'pending');

      if (error) throw error;
      return { commandId, deviceId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['device-commands', data.deviceId] });
    },
  });
}

/**
 * Hook to get available firmware versions
 */
export function useFirmwareVersions() {
  return useQuery({
    queryKey: ['firmware-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firmware_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FirmwareVersion[];
    },
  });
}
