import { useMutation, useQueryClient } from '@tanstack/react-query';
import { actuatorsService } from '../../services/actuators.service';
import type { Database } from '../supabase';

type Command = Database['public']['Tables']['commands']['Row'];

interface SendCommandParams {
  actuatorId: string;
  commandType: 'turn_on' | 'turn_off' | 'set_pwm';
  value?: number;
}

/**
 * Hook for controlling actuators with optimistic UI updates
 * Polls command status until executed
 */
export function useActuatorControl(deviceId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: SendCommandParams) => {
      const { command, error } = await actuatorsService.sendCommand(
        params.actuatorId,
        params.commandType,
        params.value
      );

      if (error) throw error;
      if (!command) throw new Error('No command returned');

      return command;
    },

    // Optimistic update: immediately update UI
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['actuators', deviceId] });

      // Snapshot previous value
      const previousActuators = queryClient.getQueryData(['actuators', deviceId]);

      // Optimistically update actuator state
      queryClient.setQueryData(['actuators', deviceId], (old: any) => {
        if (!old) return old;

        return old.map((actuator: any) => {
          if (actuator.id !== params.actuatorId) return actuator;

          // Update current_state based on command type
          let newState = actuator.current_state;
          if (params.commandType === 'turn_on') {
            newState = actuator.supports_pwm ? 255 : 1;
          } else if (params.commandType === 'turn_off') {
            newState = 0;
          } else if (params.commandType === 'set_pwm') {
            newState = params.value ?? 0;
          }

          return {
            ...actuator,
            current_state: newState,
            lastCommand: {
              command_type: params.commandType,
              value: params.value ?? null,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          };
        });
      });

      return { previousActuators };
    },

    // On error, rollback to previous state
    onError: (err, _params, context) => {
      if (context?.previousActuators) {
        queryClient.setQueryData(['actuators', deviceId], context.previousActuators);
      }
      console.error('Command failed:', err);
    },

    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['actuators', deviceId] });
    },

    // Poll command status after sending
    onSuccess: (command: Command) => {
      pollCommandStatus(command.id);
    },
  });

  /**
   * Poll command status until it's executed or fails
   */
  const pollCommandStatus = async (commandId: string) => {
    const maxAttempts = 20; // Poll for 20 seconds max
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.warn('Command polling timeout');
        return;
      }

      attempts++;

      const { command, error } = await actuatorsService.getCommandStatus(commandId);

      if (error) {
        console.error('Error polling command status:', error);
        return;
      }

      if (command?.status === 'executed' || command?.status === 'failed') {
        // Command completed, refetch actuators to get updated state
        queryClient.invalidateQueries({ queryKey: ['actuators', deviceId] });
        return;
      }

      // Continue polling
      setTimeout(poll, 1000);
    };

    poll();
  };

  return mutation;
}
