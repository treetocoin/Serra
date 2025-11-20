-- Create cycle_events table
CREATE TABLE IF NOT EXISTS public.cycle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'duration_updated',
    'week_updated',
    'completed',
    'sensor_reading_associated'
  )),
  metadata JSONB,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cycle_events_cycle_time
  ON public.cycle_events(cycle_id, created_at DESC);

CREATE INDEX idx_cycle_events_type
  ON public.cycle_events(event_type);

CREATE INDEX idx_cycle_events_user_id
  ON public.cycle_events(user_id);

CREATE INDEX idx_cycle_events_metadata
  ON public.cycle_events USING GIN(metadata);

-- Enable RLS
ALTER TABLE public.cycle_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own cycle events"
  ON public.cycle_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert cycle events"
  ON public.cycle_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
