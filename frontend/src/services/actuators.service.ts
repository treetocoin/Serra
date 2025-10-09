import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

type Actuator = Database['public']['Tables']['actuators']['Row'];
type Command = Database['public']['Tables']['commands']['Row'];

interface ActuatorWithState extends Actuator {
  lastCommand?: Command;
}

class ActuatorsService {
  /**
   * Get all actuators for a device with their current state
   */
  async getActuatorsByDevice(deviceId: string): Promise<{
    actuators: ActuatorWithState[];
    error: Error | null;
  }> {
    try {
      const { data: actuators, error: actuatorsError } = await supabase
        .from('actuators')
        .select('*')
        .eq('device_id', deviceId)
        .order('discovered_at', { ascending: true });

      if (actuatorsError) throw actuatorsError;
      if (!actuators || actuators.length === 0) {
        return { actuators: [], error: null };
      }

      // Get latest command for each actuator
      const actuatorIds = actuators.map((a) => a.id);
      const { data: commands, error: commandsError } = await supabase
        .from('commands')
        .select('*')
        .in('actuator_id', actuatorIds)
        .order('created_at', { ascending: false });

      if (commandsError) throw commandsError;

      // Match latest command to each actuator
      const actuatorsWithState: ActuatorWithState[] = actuators.map((actuator) => {
        const lastCommand = commands?.find((cmd) => cmd.actuator_id === actuator.id);
        return {
          ...actuator,
          lastCommand,
        };
      });

      return { actuators: actuatorsWithState, error: null };
    } catch (error) {
      console.error('Error fetching actuators:', error);
      return { actuators: [], error: error as Error };
    }
  }

  /**
   * Send a command to an actuator
   * Commands are queued and executed by ESP32 when it polls
   */
  async sendCommand(
    actuatorId: string,
    commandType: 'turn_on' | 'turn_off' | 'set_pwm',
    value?: number
  ): Promise<{
    command: Command | null;
    error: Error | null;
  }> {
    try {
      const { data: command, error } = await supabase
        .from('commands')
        .insert({
          actuator_id: actuatorId,
          command_type: commandType,
          value: value ?? null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return { command, error: null };
    } catch (error) {
      console.error('Error sending command:', error);
      return { command: null, error: error as Error };
    }
  }

  /**
   * Get command status by ID
   */
  async getCommandStatus(commandId: string): Promise<{
    command: Command | null;
    error: Error | null;
  }> {
    try {
      const { data: command, error } = await supabase
        .from('commands')
        .select('*')
        .eq('id', commandId)
        .single();

      if (error) throw error;

      return { command, error: null };
    } catch (error) {
      console.error('Error fetching command status:', error);
      return { command: null, error: error as Error };
    }
  }

  /**
   * Get actuator type configuration (icon, label, color)
   */
  getActuatorConfig(type: string): {
    icon: string;
    label: string;
    color: string;
    bgColor: string;
  } {
    const configs: Record<
      string,
      { icon: string; label: string; color: string; bgColor: string }
    > = {
      relay: { icon: '🔌', label: 'Relay', color: 'text-purple-600', bgColor: 'bg-purple-50' },
      pump: { icon: '💧', label: 'Water Pump', color: 'text-blue-600', bgColor: 'bg-blue-50' },
      fan: { icon: '💨', label: 'Fan', color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
      heater: {
        icon: '🔥',
        label: 'Heater',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      },
      light: { icon: '💡', label: 'Light', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      valve: { icon: '🚰', label: 'Valve', color: 'text-teal-600', bgColor: 'bg-teal-50' },
    };

    return (
      configs[type] || {
        icon: '⚡',
        label: type.replace('_', ' ').toUpperCase(),
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
      }
    );
  }

  /**
   * Determine if actuator is currently ON based on current_state or last command
   */
  isActuatorOn(actuator: ActuatorWithState): boolean {
    // Use current_state if available
    if (actuator.current_state !== null) {
      return actuator.current_state > 0;
    }

    // Fallback to last command if available
    if (actuator.lastCommand) {
      if (actuator.lastCommand.command_type === 'turn_on') return true;
      if (actuator.lastCommand.command_type === 'turn_off') return false;
      if (actuator.lastCommand.command_type === 'set_pwm') {
        return (actuator.lastCommand.value ?? 0) > 0;
      }
    }

    return false;
  }

  /**
   * Get PWM value (0-255) for PWM-capable actuators
   */
  getPwmValue(actuator: ActuatorWithState): number {
    if (actuator.current_state !== null) {
      return actuator.current_state;
    }

    if (actuator.lastCommand?.command_type === 'set_pwm') {
      return actuator.lastCommand.value ?? 0;
    }

    return 0;
  }

  /**
   * Get command status label and color
   */
  getCommandStatusConfig(status: string): {
    label: string;
    color: string;
  } {
    const configs: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'text-yellow-600' },
      executed: { label: 'Executed', color: 'text-green-600' },
      failed: { label: 'Failed', color: 'text-red-600' },
    };

    return configs[status] || { label: status, color: 'text-gray-600' };
  }
}

export const actuatorsService = new ActuatorsService();
