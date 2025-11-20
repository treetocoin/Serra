-- Function to create default cycle for new users
CREATE OR REPLACE FUNCTION public.create_default_cycle()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cycles (user_id, duration_weeks, current_week, status, started_at)
  VALUES (NEW.id, 12, 1, 'active', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create cycle when user signs up
CREATE TRIGGER on_user_created_create_cycle
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_cycle();

-- Function to log cycle creation events
CREATE OR REPLACE FUNCTION public.log_cycle_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cycle_events (
    cycle_id,
    user_id,
    event_type,
    metadata,
    previous_state,
    new_state
  ) VALUES (
    NEW.id,
    NEW.user_id,
    'created',
    jsonb_build_object(
      'duration_weeks', NEW.duration_weeks,
      'current_week', NEW.current_week,
      'started_at', NEW.started_at
    ),
    NULL,
    jsonb_build_object(
      'id', NEW.id,
      'duration_weeks', NEW.duration_weeks,
      'current_week', NEW.current_week,
      'status', NEW.status,
      'started_at', NEW.started_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log cycle creation
CREATE TRIGGER on_cycle_created
  AFTER INSERT ON public.cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_cycle_created();

-- Function to log cycle updates
CREATE OR REPLACE FUNCTION public.log_cycle_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type TEXT;
  v_metadata JSONB;
BEGIN
  -- Determine event type based on what changed
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    v_event_type := 'completed';
    v_metadata := jsonb_build_object(
      'completed_at', NEW.completed_at,
      'final_week', NEW.current_week,
      'duration_weeks', NEW.duration_weeks
    );
  ELSIF NEW.duration_weeks != OLD.duration_weeks THEN
    v_event_type := 'duration_updated';
    v_metadata := jsonb_build_object(
      'old_duration', OLD.duration_weeks,
      'new_duration', NEW.duration_weeks
    );
  ELSIF NEW.current_week != OLD.current_week THEN
    v_event_type := 'week_updated';
    v_metadata := jsonb_build_object(
      'old_week', OLD.current_week,
      'new_week', NEW.current_week,
      'progress_percentage', ROUND((NEW.current_week::NUMERIC / NEW.duration_weeks::NUMERIC) * 100, 2)
    );
  ELSE
    -- No relevant changes, skip logging
    RETURN NEW;
  END IF;

  -- Insert event log
  INSERT INTO public.cycle_events (
    cycle_id,
    user_id,
    event_type,
    metadata,
    previous_state,
    new_state
  ) VALUES (
    NEW.id,
    NEW.user_id,
    v_event_type,
    v_metadata,
    jsonb_build_object(
      'duration_weeks', OLD.duration_weeks,
      'current_week', OLD.current_week,
      'status', OLD.status,
      'completed_at', OLD.completed_at
    ),
    jsonb_build_object(
      'duration_weeks', NEW.duration_weeks,
      'current_week', NEW.current_week,
      'status', NEW.status,
      'completed_at', NEW.completed_at
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to log cycle updates
CREATE TRIGGER on_cycle_updated
  AFTER UPDATE ON public.cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_cycle_updated();
