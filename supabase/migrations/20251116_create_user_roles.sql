-- Migration: Create user_roles Table
-- Feature: 006-fammi-un-tipo (Admin User Role with Multi-Project View)
-- Created: 2025-11-16
-- Description: Creates the user_roles table to store user role assignments separately from Supabase Auth for security

-- ============================================================================
-- STEP 1: Create user_roles Table
-- ============================================================================

-- Create user_roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one role per user
  UNIQUE(user_id)
);

-- Add comment for documentation
COMMENT ON TABLE user_roles IS 'Stores user role assignments for role-based access control';
COMMENT ON COLUMN user_roles.role IS 'User role: ''user'' for regular users, ''admin'' for administrators';

-- ============================================================================
-- STEP 2: Create Indexes for Performance
-- ============================================================================

-- Index on user_id for fast role lookups
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Index on role for filtering (e.g., list all admins)
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- ============================================================================
-- STEP 3: Enable Row Level Security
-- ============================================================================

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own role
CREATE POLICY "Users can view own role" ON user_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: "Admin can view all user roles" policy will be added in next migration
-- after auth.user_role() function is created to avoid circular dependency

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, execute:
--
-- DROP TABLE IF EXISTS user_roles CASCADE;
--
-- This will remove the table, all data, indexes, and policies.
-- CASCADE will also remove any dependent objects.

