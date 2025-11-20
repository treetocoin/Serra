-- Add flowering_week column to cycles table
ALTER TABLE public.cycles
ADD COLUMN flowering_week INTEGER CHECK (flowering_week IS NULL OR (flowering_week > 0 AND flowering_week <= duration_weeks));

-- Add comment for documentation
COMMENT ON COLUMN public.cycles.flowering_week IS
  'Week number when the cycle transitions from vegetative to flowering phase. NULL means no transition or single-phase cycle.';

-- Update existing cycles to NULL (user will configure later)
UPDATE public.cycles
SET flowering_week = NULL
WHERE flowering_week IS NULL;
