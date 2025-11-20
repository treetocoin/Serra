import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Cycle, CycleWithProgress, UpdateCycleInput } from '../types/cycle';

/**
 * Hook to fetch the current active cycle for the authenticated user
 */
export function useCycle() {
  return useQuery({
    queryKey: ['cycle', 'active'],
    queryFn: async (): Promise<CycleWithProgress | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (error) {
        // No active cycle found is not an error
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      // Calculate progress
      const progress_percentage = Math.round((data.current_week / data.duration_weeks) * 100);
      const is_complete = data.current_week >= data.duration_weeks;

      return {
        ...data,
        progress_percentage,
        is_complete,
      };
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch all cycles (active + completed) for the authenticated user
 */
export function useCycles() {
  return useQuery({
    queryKey: ['cycles', 'all'],
    queryFn: async (): Promise<Cycle[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { data, error } = await supabase
        .from('cycles')
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
 * Hook to update the current active cycle
 */
export function useUpdateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCycleInput): Promise<Cycle> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      // Validate input
      if (input.duration_weeks !== undefined && input.duration_weeks <= 0) {
        throw new Error('La durata deve essere maggiore di 0 settimane');
      }

      if (input.current_week !== undefined && input.current_week <= 0) {
        throw new Error('La settimana corrente deve essere maggiore di 0');
      }

      // Get active cycle
      const { data: activeCycle, error: fetchError } = await supabase
        .from('cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (fetchError || !activeCycle) {
        throw new Error('Nessun ciclo attivo trovato');
      }

      // Validate current_week against duration_weeks
      const newDuration = input.duration_weeks ?? activeCycle.duration_weeks;
      const newWeek = input.current_week ?? activeCycle.current_week;

      if (newWeek > newDuration) {
        throw new Error(
          `La settimana corrente (${newWeek}) non può essere maggiore della durata totale (${newDuration} settimane). Riduci la settimana corrente o aumenta la durata.`
        );
      }

      // Update cycle
      const { data, error } = await supabase
        .from('cycles')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeCycle.id)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      // Invalidate both active cycle and all cycles queries
      queryClient.invalidateQueries({ queryKey: ['cycle', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['cycles', 'all'] });
    },
  });
}

/**
 * Hook to complete the current active cycle
 */
export function useCompleteCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Cycle> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      // Get active cycle
      const { data: activeCycle, error: fetchError } = await supabase
        .from('cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (fetchError || !activeCycle) {
        throw new Error('Nessun ciclo attivo trovato');
      }

      // Mark as completed
      const { data, error } = await supabase
        .from('cycles')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeCycle.id)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['cycles', 'all'] });
    },
  });
}

/**
 * Hook to create a new cycle (manually or via onboarding)
 */
export function useCreateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      duration_weeks: number;
      current_week?: number;
      flowering_week?: number | null;
    }): Promise<Cycle> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      if (input.duration_weeks <= 0) {
        throw new Error('La durata deve essere maggiore di 0 settimane');
      }

      const currentWeek = input.current_week || 1;
      if (currentWeek <= 0 || currentWeek > input.duration_weeks) {
        throw new Error('La settimana corrente deve essere compresa tra 1 e la durata totale');
      }

      if (input.flowering_week !== undefined && input.flowering_week !== null) {
        if (input.flowering_week <= 0 || input.flowering_week > input.duration_weeks) {
          throw new Error('La settimana di fioritura deve essere compresa tra 1 e la durata totale');
        }
      }

      // Check if there's already an active cycle
      const { data: existingCycle } = await supabase
        .from('cycles')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (existingCycle) {
        throw new Error('Esiste già un ciclo attivo. Completa il ciclo corrente prima di crearne uno nuovo.');
      }

      // Create new cycle
      const { data, error } = await supabase
        .from('cycles')
        .insert({
          user_id: user.id,
          duration_weeks: input.duration_weeks,
          current_week: currentWeek,
          flowering_week: input.flowering_week ?? null,
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['cycles', 'all'] });
    },
  });
}
