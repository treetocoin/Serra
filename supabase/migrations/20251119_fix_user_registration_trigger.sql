-- Migration: Fix user registration to create both profile and default project
-- Date: 2025-11-19
-- Description: Combines profile creation and project creation in a single trigger
-- Fixes: "Database error saving new user" issue

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create combined function that handles both profile and project creation
CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_project_id TEXT;
BEGIN
  -- Step 1: Create user profile (from original handle_new_user function)
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  -- Step 2: Generate project ID (PROJ1, PROJ2, etc.)
  SELECT 'PROJ' || LPAD((COUNT(*) + 1)::TEXT, 1, '0')
  INTO v_project_id
  FROM public.projects;

  -- Step 3: Create default project for the user
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user_registration for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users (fires after user registration)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_registration();

COMMENT ON FUNCTION public.handle_new_user_registration() IS
'Automatically creates a user profile and default project (My Greenhouse) for each new user.
Called by trigger on auth.users INSERT.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_registration() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user_registration() TO postgres;
