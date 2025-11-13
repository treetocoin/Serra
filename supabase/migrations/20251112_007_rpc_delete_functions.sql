-- Migration: RPC Functions - delete_project() and delete_device()
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Delete functions for projects and devices with ownership enforcement

-- Delete project (and cascade to devices)
CREATE OR REPLACE FUNCTION delete_project(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  -- Validate input
  IF p_project_id IS NULL OR trim(p_project_id) = '' THEN
    RAISE EXCEPTION 'Project ID required';
  END IF;

  -- Delete project (RLS enforces user ownership)
  -- ON DELETE CASCADE will automatically delete associated devices
  DELETE FROM public.projects
  WHERE project_id = p_project_id AND user_id = auth.uid();

  -- Check if any rows were deleted
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$$;

-- Delete device
CREATE OR REPLACE FUNCTION delete_device(p_composite_device_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  -- Validate input
  IF p_composite_device_id IS NULL OR trim(p_composite_device_id) = '' THEN
    RAISE EXCEPTION 'Composite device ID required';
  END IF;

  -- Delete device (RLS enforces user ownership)
  DELETE FROM public.devices
  WHERE composite_device_id = p_composite_device_id AND user_id = auth.uid();

  -- Check if any rows were deleted
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_project(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_device(TEXT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION delete_project IS 'Deletes a project and all associated devices (cascade). Returns true if deleted, false if not found or access denied.';
COMMENT ON FUNCTION delete_device IS 'Deletes a device. Returns true if deleted, false if not found or access denied.';
