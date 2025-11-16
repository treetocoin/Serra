-- Migration: Create auth.user_role() Security Definer Function
-- Feature: 006-fammi-un-tipo (Admin User Role with Multi-Project View)
-- Created: 2025-11-16
-- Description: Creates a security definer function for efficient role lookups in RLS policies
--              Provides 99.99% performance improvement vs direct queries (per Supabase benchmarks)

-- ============================================================================
-- STEP 1: Create Helper Function
-- ============================================================================

-- Create security definer function to get user's role
-- SECURITY DEFINER: Runs with creator's privileges, bypassing RLS
-- STABLE: Result doesn't change within a single statement (allows caching)
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Return user's role from user_roles table
  -- COALESCE ensures 'user' is returned if no role record exists
  RETURN COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid()),
    'user'  -- Default to 'user' if no role record exists
  );
END;
$$;

-- Add function comment for documentation
COMMENT ON FUNCTION auth.user_role() IS 'Returns the current user''s role (''user'' or ''admin'') for use in RLS policies. Uses SECURITY DEFINER for performance.';

-- ============================================================================
-- STEP 2: Grant Execution Permissions
-- ============================================================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION auth.user_role() TO authenticated;

-- Revoke from anon (unauthenticated) users for security
REVOKE EXECUTE ON FUNCTION auth.user_role() FROM anon;

-- ============================================================================
-- STEP 3: Add Admin Policy to user_roles Table
-- ============================================================================

-- Now that auth.user_role() exists, we can add the admin policy
-- This policy depends on the function created above
CREATE POLICY "Admin can view all user roles" ON public.user_roles
  FOR SELECT
  USING (auth.user_role() = 'admin');

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, execute in reverse order:
--
-- 1. DROP POLICY IF EXISTS "Admin can view all user roles" ON public.user_roles;
-- 2. REVOKE EXECUTE ON FUNCTION auth.user_role() FROM authenticated;
-- 3. DROP FUNCTION IF EXISTS auth.user_role();
--
-- Note: This will break any RLS policies that depend on auth.user_role()

