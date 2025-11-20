export type CycleStatus = 'active' | 'completed';

export interface Cycle {
  id: string;
  user_id: string;
  duration_weeks: number;
  current_week: number;
  flowering_week: number | null;
  status: CycleStatus;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CycleEventType =
  | 'created'
  | 'duration_updated'
  | 'week_updated'
  | 'completed'
  | 'sensor_reading_associated';

export interface CycleEvent {
  id: string;
  cycle_id: string;
  user_id: string;
  event_type: CycleEventType;
  metadata: Record<string, any> | null;
  previous_state: Partial<Cycle> | null;
  new_state: Partial<Cycle> | null;
  created_at: string;
}

export interface CycleWithProgress extends Cycle {
  progress_percentage: number;
  is_complete: boolean;
}

export interface UpdateCycleInput {
  duration_weeks?: number;
  current_week?: number;
  flowering_week?: number | null;
}

export interface CycleValidationError {
  field: 'duration_weeks' | 'current_week';
  message: string;
}
