-- Migration: RPC Function - create_project()
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Creates a new project with auto-generated project_id

CREATE OR REPLACE FUNCTION create_project(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(project_id TEXT, id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_project_id TEXT;
  new_id UUID;
  new_created_at TIMESTAMPTZ;
BEGIN
  -- Verify user exists
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required. Authentication may have failed.';
  END IF;

  -- Validate project name
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Project name cannot be empty';
  END IF;

  -- Generate project ID
  new_project_id := generate_project_id();
  new_id := gen_random_uuid();
  new_created_at := now();

  -- Insert project
  INSERT INTO public.projects (id, project_id, name, description, user_id, created_at, updated_at)
  VALUES (new_id, new_project_id, trim(p_name), p_description, p_user_id, new_created_at, new_created_at);

  RETURN QUERY SELECT new_project_id, new_id, new_created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Project name "%" already exists. Please choose a different name.', p_name;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create project: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_project IS 'Creates a new project with auto-generated project_id (PROJ1, PROJ2, etc.)';
