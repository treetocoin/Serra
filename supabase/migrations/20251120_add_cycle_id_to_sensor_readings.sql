-- Add cycle_id column to sensor_readings for historical analysis
ALTER TABLE public.sensor_readings
ADD COLUMN cycle_id UUID REFERENCES public.cycles(id) ON DELETE SET NULL;

-- Create index for efficient cycle-based queries
CREATE INDEX idx_sensor_readings_cycle_id
  ON public.sensor_readings(cycle_id, timestamp DESC);

-- Backfill cycle_id for all existing sensor_readings
-- Associate all readings with the user's first (oldest) cycle
UPDATE public.sensor_readings sr
SET cycle_id = (
  SELECT c.id
  FROM public.cycles c
  JOIN public.sensors s ON s.id = sr.sensor_id
  JOIN public.devices d ON d.id = s.device_id
  WHERE c.user_id = d.user_id
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE sr.cycle_id IS NULL;

-- Log sensor_reading_associated events for backfilled data
-- This creates audit trail for AI/ML training
INSERT INTO public.cycle_events (cycle_id, user_id, event_type, metadata, previous_state, new_state)
SELECT
  c.id as cycle_id,
  c.user_id,
  'sensor_reading_associated'::text as event_type,
  jsonb_build_object(
    'migration', true,
    'reading_count', COUNT(sr.id),
    'migrated_at', NOW()
  ) as metadata,
  NULL as previous_state,
  NULL as new_state
FROM public.cycles c
JOIN public.devices d ON d.user_id = c.user_id
JOIN public.sensors s ON s.device_id = d.id
JOIN public.sensor_readings sr ON sr.sensor_id = s.id AND sr.cycle_id = c.id
GROUP BY c.id, c.user_id
HAVING COUNT(sr.id) > 0;

-- Optional: Add comment for documentation
COMMENT ON COLUMN public.sensor_readings.cycle_id IS
  'Associated cycle for historical analysis. NULL for readings before cycle feature. Used for AI/ML training to correlate environmental data with cultivation cycles.';
