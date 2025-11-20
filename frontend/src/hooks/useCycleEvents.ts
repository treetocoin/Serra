import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CycleEvent, CycleEventType } from '../types/cycle';

/**
 * Hook to fetch all events for a specific cycle
 */
export function useCycleEvents(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['cycle-events', cycleId],
    queryFn: async (): Promise<CycleEvent[]> => {
      if (!cycleId) return [];

      const { data, error } = await supabase
        .from('cycle_events')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
    enabled: !!cycleId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch events for the current active cycle
 */
export function useActiveCycleEvents() {
  return useQuery({
    queryKey: ['cycle-events', 'active'],
    queryFn: async (): Promise<CycleEvent[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      // Get active cycle
      const { data: activeCycle, error: cycleError } = await supabase
        .from('cycles')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (cycleError || !activeCycle) {
        // No active cycle - return empty array
        return [];
      }

      // Get events for active cycle
      const { data, error } = await supabase
        .from('cycle_events')
        .select('*')
        .eq('cycle_id', activeCycle.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch events filtered by type
 */
export function useCycleEventsByType(
  cycleId: string | undefined,
  eventTypes: CycleEventType[]
) {
  return useQuery({
    queryKey: ['cycle-events', cycleId, 'types', eventTypes],
    queryFn: async (): Promise<CycleEvent[]> => {
      if (!cycleId) return [];

      const { data, error } = await supabase
        .from('cycle_events')
        .select('*')
        .eq('cycle_id', cycleId)
        .in('event_type', eventTypes)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
    enabled: !!cycleId && eventTypes.length > 0,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch all events for the authenticated user (across all cycles)
 */
export function useAllUserCycleEvents() {
  return useQuery({
    queryKey: ['cycle-events', 'all-user'],
    queryFn: async (): Promise<CycleEvent[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { data, error } = await supabase
        .from('cycle_events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Helper function to format event type for display
 */
export function formatEventType(eventType: CycleEventType): string {
  const eventTypeLabels: Record<CycleEventType, string> = {
    created: 'Ciclo Creato',
    duration_updated: 'Durata Aggiornata',
    week_updated: 'Settimana Aggiornata',
    completed: 'Ciclo Completato',
    sensor_reading_associated: 'Lettura Sensore Associata',
  };

  return eventTypeLabels[eventType] || eventType;
}
