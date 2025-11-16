-- Migration: Backfill Existing Users with Default Roles
-- Feature: 006-fammi-un-tipo (Admin User Role with Multi-Project View)
-- Created: 2025-11-16
-- Description: Assigns default 'user' role to all existing users, then promotes admin user

-- ============================================================================
-- PREREQUISITE CHECK
-- ============================================================================
-- Ensure admin user exists before running this migration!
-- The admin user (dadecresce@test.caz) must have already registered via Supabase Auth.
-- If not, this migration will still succeed but the admin user won't be promoted.

-- ============================================================================
-- STEP 1: Assign Default 'user' Role to All Existing Users
-- ============================================================================

-- Insert default 'user' role for all existing users who don't have a role yet
-- ON CONFLICT DO NOTHING: Skip users who already have a role assigned
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- STEP 2: Promote Admin User
-- ============================================================================

-- Promote dadecresce@test.caz to admin role
-- ON CONFLICT: Update role to 'admin' if user already has a 'user' role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'dadecresce@test.caz'
ON CONFLICT (user_id)
DO UPDATE SET
  role = 'admin',
  updated_at = now();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after migration to verify success:
--
-- 1. Check total users have roles:
-- SELECT COUNT(*) as total_users FROM auth.users;
-- SELECT COUNT(*) as total_roles FROM public.user_roles;
-- -- These counts should match
--
-- 2. Check admin user exists with correct role:
-- SELECT u.email, ur.role, ur.created_at, ur.updated_at
-- FROM auth.users u
-- JOIN public.user_roles ur ON ur.user_id = u.id
-- WHERE u.email = 'dadecresce@test.caz';
-- -- Expected: email='dadecresce@test.caz', role='admin'
--
-- 3. Check all other users have 'user' role:
-- SELECT COUNT(*) as regular_users
-- FROM public.user_roles
-- WHERE role = 'user';
-- -- Expected: (total users - 1)

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, execute:
--
-- DELETE FROM public.user_roles;
--
-- This will remove all role assignments.
-- WARNING: This will break admin access until roles are re-assigned.

