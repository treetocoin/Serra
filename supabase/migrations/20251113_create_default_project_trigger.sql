-- Migration: Auto-create default project for new users
-- Date: 2025-11-13
-- Description: When a user registers, automatically create a default project for them

-- Function to create default project
CREATE OR REPLACE FUNCTION public.create_default_project_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_project_id TEXT;
BEGIN
  -- Generate project ID (PROJ1, PROJ2, etc.)
  SELECT 'PROJ' || LPAD((COUNT(*) + 1)::TEXT, 1, '0')
  INTO v_project_id
  FROM public.projects;

  -- Create default project for the user
  INSERT INTO public.projects (
    project_id,
    name,
    description,
    user_id,
    status
  ) VALUES (
    v_project_id,
    'My Greenhouse',
    'Default project',
    NEW.id,
    'active'
  );

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (fires after user registration)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_for_user();

COMMENT ON FUNCTION public.create_default_project_for_user() IS
'Automatically creates a default project (My Greenhouse) for each new user.
Called by trigger on auth.users INSERT.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_default_project_for_user() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_default_project_for_user() TO postgres;
