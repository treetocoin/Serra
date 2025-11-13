-- Migration: Create Projects Table and Sequence
-- Feature: 004-tutto-troppo-complicato
-- Date: 2025-11-12
-- Description: Adds projects table with sequential project IDs (PROJ1, PROJ2, etc.)

-- Create sequence for project IDs
CREATE SEQUENCE IF NOT EXISTS projects_seq
  START 1
  INCREMENT 1
  CACHE 50
  NO CYCLE;

GRANT USAGE ON SEQUENCE projects_seq TO authenticated;

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_id ON projects(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE projects IS 'User greenhouse projects with sequential project IDs';
COMMENT ON COLUMN projects.project_id IS 'Sequential ID in format PROJ1-PROJ999, P1000-P9999';
COMMENT ON COLUMN projects.name IS 'Globally unique project name (e.g., "My Greenhouse")';
