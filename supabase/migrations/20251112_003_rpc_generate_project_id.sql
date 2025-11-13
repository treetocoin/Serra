-- Migration: RPC Function - generate_project_id()
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Generates sequential project IDs in format PROJ1-PROJ999, P1000-P9999

CREATE OR REPLACE FUNCTION generate_project_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  seq_value BIGINT;
  formatted_id TEXT;
BEGIN
  -- Get next sequence value
  seq_value := nextval('public.projects_seq');

  -- Check for overflow (max 9999 projects)
  IF seq_value > 9999 THEN
    RAISE EXCEPTION 'Project ID sequence overflow at %. Maximum 9999 projects allowed.', seq_value;
  END IF;

  -- Format ID based on sequence value
  -- 1-999: PROJ1, PROJ2, ..., PROJ999
  -- 1000-9999: P1000, P1001, ..., P9999
  formatted_id := CASE
    WHEN seq_value <= 999 THEN 'PROJ' || seq_value
    ELSE 'P' || seq_value
  END;

  RETURN formatted_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_project_id() TO authenticated;

-- Add comment
COMMENT ON FUNCTION generate_project_id IS 'Generates sequential project IDs: PROJ1-PROJ999, P1000-P9999';
