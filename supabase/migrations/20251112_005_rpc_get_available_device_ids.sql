-- Migration: RPC Function - get_available_device_ids()
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Returns available device IDs (ESP1-ESP20) for a project

CREATE OR REPLACE FUNCTION get_available_device_ids(p_project_id TEXT)
RETURNS TABLE(device_id TEXT, device_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate project_id
  IF p_project_id IS NULL OR trim(p_project_id) = '' THEN
    RAISE EXCEPTION 'Project ID required';
  END IF;

  -- Generate ESP1-ESP20 and exclude already registered devices
  RETURN QUERY
  SELECT
    'ESP' || nums.n::TEXT as device_id,
    nums.n as device_number
  FROM generate_series(1, 20) AS nums(n)
  LEFT JOIN public.devices d ON d.project_id = p_project_id AND d.device_number = nums.n
  WHERE d.id IS NULL
  ORDER BY nums.n;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_available_device_ids(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_available_device_ids IS 'Returns available device IDs (ESP1-ESP20) for a project, excluding already registered devices';
