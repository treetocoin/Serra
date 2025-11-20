-- Create cycles table
CREATE TABLE IF NOT EXISTS public.cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_weeks INTEGER NOT NULL DEFAULT 12 CHECK (duration_weeks > 0),
  current_week INTEGER NOT NULL DEFAULT 1 CHECK (current_week > 0 AND current_week <= duration_weeks),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX cycles_one_active_per_user
  ON public.cycles(user_id)
  WHERE status = 'active';

CREATE INDEX idx_cycles_user_id ON public.cycles(user_id);
CREATE INDEX idx_cycles_created_at ON public.cycles(created_at);

-- Enable RLS
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own cycles"
  ON public.cycles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cycles"
  ON public.cycles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cycles"
  ON public.cycles FOR UPDATE
  USING (auth.uid() = user_id);
