-- Migration: Create default projects for existing users
-- Date: 2025-11-13
-- Description: Creates "My Greenhouse" project for users who registered before the auto-project trigger

DO $$
DECLARE
  v_user RECORD;
  v_project_id TEXT;
  v_project_count INTEGER;
BEGIN
  -- Get current project count to generate sequential IDs
  SELECT COUNT(*) INTO v_project_count FROM public.projects;

  -- Loop through users without projects
  FOR v_user IN
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.projects p ON p.user_id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Generate next project ID
    v_project_count := v_project_count + 1;
    v_project_id := 'PROJ' || LPAD(v_project_count::TEXT, 1, '0');

    -- Create default project for user (name must be unique)
    INSERT INTO public.projects (
      project_id,
      name,
      description,
      user_id,
      status
    ) VALUES (
      v_project_id,
      'Greenhouse ' || v_project_id,  -- Unique name like "Greenhouse PROJ2"
      'Default project',
      v_user.id,
      'active'
    );

    RAISE NOTICE 'Created project % for user %', v_project_id, v_user.email;
  END LOOP;
END $$;
