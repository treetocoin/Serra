# Implementation Tasks: Simplified Device Onboarding with Project-Scoped Device IDs

**Feature**: 004-tutto-troppo-complicato
**Branch**: `004-tutto-troppo-complicato`
**Date**: 2025-11-12
**Status**: Ready for Implementation

---

## Overview

This document provides actionable implementation tasks for the simplified device onboarding feature, organized by user story for independent implementation and testing.

**Implementation Strategy**: MVP-first, incremental delivery
- **MVP Scope**: User Story 1-4 (complete onboarding flow)
- **P2 Features**: User Story 5-6 (device/project management)

**Total Tasks**: 47
**Parallel Opportunities**: 18 tasks marked [P]

---

## Task Organization

```
Phase 1: Setup & Infrastructure (6 tasks)
Phase 2: Foundational Prerequisites (7 tasks)
Phase 3: User Story 1 - Create Project (8 tasks)
Phase 4: User Story 2 - Register Device in Webapp (7 tasks)
Phase 5: User Story 3 - Configure ESP Device via WiFi Portal (9 tasks)
Phase 6: User Story 4 - Automatic Device Connection (6 tasks)
Phase 7: User Story 5 - Delete and Re-register Device (2 tasks)
Phase 8: User Story 6 - Delete Project (2 tasks)
```

---

## Phase 1: Setup & Infrastructure

**Goal**: Initialize project infrastructure and prepare development environment

**Dependencies**: None (can start immediately)

### T001 - Backup Current Database [P]
**File**: `supabase/backups/backup_20251112.sql`
**Story**: Setup
**Description**:
```sql
-- Create backups of current devices and heartbeats tables
CREATE TABLE IF NOT EXISTS backup_devices_20251112 AS SELECT * FROM devices;
CREATE TABLE IF NOT EXISTS backup_device_heartbeats_20251112 AS SELECT * FROM device_heartbeats LIMIT 10000;

-- Verify backups
SELECT COUNT(*) as device_count FROM backup_devices_20251112;
SELECT COUNT(*) as heartbeat_count FROM backup_device_heartbeats_20251112;
```
**Acceptance**: Backup tables created with data matching production

---

### T002 - Verify Frontend Dependencies [P]
**File**: `frontend/package.json`
**Story**: Setup
**Description**:
```bash
cd frontend
npm install

# Verify key dependencies
npm list @supabase/supabase-js @tanstack/react-query react-router-dom

# Expected versions:
# @supabase/supabase-js@2.74.0
# @tanstack/react-query@5.90.2
# react-router-dom@7.9.3
```
**Acceptance**: All dependencies installed, no version conflicts

---

### T003 - Create Type Definitions for Project [P]
**File**: `frontend/src/types/project.types.ts`
**Story**: Setup
**Description**:
```typescript
export interface Project {
  id: string;                    // UUID
  project_id: string;            // "PROJ1", "PROJ2", etc.
  name: string;                  // User-provided name
  description: string | null;    // Optional description
  user_id: string;               // Owner UUID
  status: 'active' | 'archived';
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}

export interface AvailableDeviceId {
  device_id: string;             // "ESP5"
  device_number: number;         // 5
}
```
**Acceptance**: Type definitions compile without errors, exported correctly

---

### T004 - Update Device Type Definitions [P]
**File**: `frontend/src/types/device.types.ts`
**Story**: Setup
**Description**:
```typescript
// Add new fields to existing Device interface
export interface Device {
  id: string;                    // UUID (legacy)
  composite_device_id: string;   // "PROJ1-ESP5" (NEW)
  project_id: string;            // "PROJ1" (NEW)
  device_number: number;         // 1-20 (NEW)
  name: string;
  device_key?: string;           // Only returned on creation
  device_key_hash: string;
  user_id: string;
  status: 'waiting' | 'online' | 'offline';
  last_seen_at: string | null;
  rssi: number | null;
  ip_address: string | null;
  fw_version: string | null;
  created_at: string;
  updated_at: string;
}
```
**Acceptance**: Updated types compile, existing device code still works

---

### T005 - Create Feature Branch Verification Script [P]
**File**: `.specify/scripts/bash/verify-feature-004.sh`
**Story**: Setup
**Description**:
```bash
#!/bin/bash
# Verify we're on correct branch and setup is complete

EXPECTED_BRANCH="004-tutto-troppo-complicato"
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "ERROR: Not on feature branch $EXPECTED_BRANCH"
  exit 1
fi

echo "✓ On correct branch: $CURRENT_BRANCH"

# Check required files exist
REQUIRED_FILES=(
  "specs/004-tutto-troppo-complicato/spec.md"
  "specs/004-tutto-troppo-complicato/plan.md"
  "specs/004-tutto-troppo-complicato/data-model.md"
  "specs/004-tutto-troppo-complicato/research.md"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: Required file $file not found"
    exit 1
  fi
done

echo "✓ All required spec files present"
echo "✓ Ready for implementation"
```
**Acceptance**: Script runs successfully, confirms setup is complete

---

### T006 - Document ESP8266 Hardware Requirements
**File**: `firmware/ESP8266_Greenhouse_v3.0/HARDWARE.md`
**Story**: Setup
**Description**:
Create documentation listing:
- Supported ESP8266 boards (ESP-01, NodeMCU, Wemos D1 Mini)
- Minimum flash size requirements (4MB recommended)
- RAM requirements (~80KB free for WiFiManager)
- Pin requirements for factory reset button
- Power requirements (5V via USB or 3.3V regulated)
- WiFi antenna requirements

**Acceptance**: Documentation is clear and complete

---

## Phase 2: Foundational Prerequisites

**Goal**: Implement blocking database schema changes and RPC functions needed by ALL user stories

**Dependencies**: Phase 1 complete

**Note**: These tasks MUST complete before any user story can be implemented

### T007 - Create Projects Table and Sequence
**File**: `supabase/migrations/20251112_001_create_projects_table.sql`
**Story**: Foundation
**Description**:
```sql
-- Create sequence for project IDs
CREATE SEQUENCE projects_seq
  START 1
  INCREMENT 1
  CACHE 50
  NO CYCLE;

GRANT USAGE ON SEQUENCE projects_seq TO authenticated;

-- Create projects table
CREATE TABLE projects (
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
CREATE UNIQUE INDEX idx_projects_project_id ON projects(project_id);
CREATE UNIQUE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

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
```
**Acceptance**: Table created, indexes working, RLS policies enforced

---

### T008 - Add Composite ID Columns to Devices Table
**File**: `supabase/migrations/20251112_002_add_composite_device_id.sql`
**Story**: Foundation
**Description**:
```sql
-- Add new columns (nullable during Phase 1-2)
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS composite_device_id TEXT,
ADD COLUMN IF NOT EXISTS project_id TEXT,
ADD COLUMN IF NOT EXISTS device_number INTEGER;

-- Add indexes (will be unique after Phase 3)
CREATE INDEX idx_devices_composite_id ON devices(composite_device_id);
CREATE INDEX idx_devices_project_device_number ON devices(project_id, device_number);

-- Add composite_device_id to heartbeats for denormalized lookup
ALTER TABLE device_heartbeats
ADD COLUMN IF NOT EXISTS composite_device_id TEXT;

CREATE INDEX idx_device_heartbeats_composite_id ON device_heartbeats(composite_device_id, ts DESC);
```
**Acceptance**: Columns added, indexes created, existing data unaffected

---

### T009 - Implement generate_project_id() RPC Function
**File**: `supabase/migrations/20251112_003_rpc_generate_project_id.sql`
**Story**: Foundation
**Description**:
```sql
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
  seq_value := nextval('public.projects_seq');

  IF seq_value > 9999 THEN
    RAISE EXCEPTION 'Project ID sequence overflow at %', seq_value;
  END IF;

  formatted_id := CASE
    WHEN seq_value <= 999 THEN 'PROJ' || seq_value
    ELSE 'P' || seq_value
  END;

  RETURN formatted_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_project_id() TO authenticated;
```
**Acceptance**: Function generates PROJ1, PROJ2, ..., PROJ999, P1000, ..., P9999

---

### T010 - Implement create_project() RPC Function
**File**: `supabase/migrations/20251112_004_rpc_create_project.sql`
**Story**: Foundation
**Description**:
```sql
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
    RAISE EXCEPTION 'User ID required';
  END IF;

  -- Generate project ID
  new_project_id := generate_project_id();
  new_id := gen_random_uuid();
  new_created_at := now();

  -- Insert project
  INSERT INTO public.projects (id, project_id, name, description, user_id, created_at)
  VALUES (new_id, new_project_id, p_name, p_description, p_user_id, new_created_at);

  RETURN QUERY SELECT new_project_id, new_id, new_created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Project name "%" already exists', p_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_project(TEXT, TEXT, UUID) TO authenticated;
```
**Acceptance**: Function creates projects, handles errors, enforces uniqueness

---

### T011 - Implement get_available_device_ids() RPC Function
**File**: `supabase/migrations/20251112_005_rpc_get_available_device_ids.sql`
**Story**: Foundation
**Description**:
```sql
CREATE OR REPLACE FUNCTION get_available_device_ids(p_project_id TEXT)
RETURNS TABLE(device_id TEXT, device_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

GRANT EXECUTE ON FUNCTION public.get_available_device_ids(TEXT) TO authenticated;
```
**Acceptance**: Function returns available device IDs for a project (ESP1-ESP20 minus registered)

---

### T012 - Implement register_device_with_project() RPC Function
**File**: `supabase/migrations/20251112_006_rpc_register_device.sql`
**Story**: Foundation
**Description**:
```sql
CREATE OR REPLACE FUNCTION register_device_with_project(
  p_name TEXT,
  p_project_id TEXT,
  p_device_number INTEGER,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  composite_device_id TEXT,
  device_key TEXT,
  id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_composite_id TEXT;
  v_device_key TEXT;
  v_device_key_hash TEXT;
  v_new_id UUID;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Validate device number
  IF p_device_number < 1 OR p_device_number > 20 THEN
    RAISE EXCEPTION 'Device number must be between 1 and 20';
  END IF;

  -- Verify project exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE project_id = p_project_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Project not found or access denied';
  END IF;

  -- Construct composite ID
  v_composite_id := p_project_id || '-ESP' || p_device_number;

  -- Generate device key
  v_device_key := encode(gen_random_bytes(32), 'hex');
  v_device_key_hash := encode(digest(v_device_key, 'sha256'), 'hex');

  v_new_id := gen_random_uuid();
  v_created_at := now();

  -- Insert device
  INSERT INTO public.devices (
    id, composite_device_id, project_id, device_number, name,
    device_key_hash, user_id, status, created_at
  ) VALUES (
    v_new_id, v_composite_id, p_project_id, p_device_number, p_name,
    v_device_key_hash, p_user_id, 'waiting', v_created_at
  );

  RETURN QUERY SELECT v_composite_id, v_device_key, v_new_id, v_created_at;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Device ESP% already registered in this project', p_device_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_device_with_project(TEXT, TEXT, INTEGER, UUID) TO authenticated;
```
**Acceptance**: Function registers devices, generates keys, enforces per-project uniqueness

---

### T013 - Implement delete_project() and delete_device() RPC Functions
**File**: `supabase/migrations/20251112_007_rpc_delete_functions.sql`
**Story**: Foundation
**Description**:
```sql
CREATE OR REPLACE FUNCTION delete_project(p_project_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM public.projects
  WHERE project_id = p_project_id AND user_id = auth.uid();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION delete_device(p_composite_device_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted BOOLEAN;
BEGIN
  DELETE FROM public.devices
  WHERE composite_device_id = p_composite_device_id AND user_id = auth.uid();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_project(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_device(TEXT) TO authenticated;
```
**Acceptance**: Functions delete projects/devices, enforce ownership, return success status

---

## Phase 3: User Story 1 - Create Project (P1)

**Goal**: Users can create and view projects in the webapp

**User Story**: A greenhouse owner wants to set up a new greenhouse location. They open the webapp, create a new project with a name (e.g., "Main Greenhouse"), and the system automatically generates a unique 5-character project ID (e.g., "PROJ1").

**Dependencies**: Phase 2 (Foundational Prerequisites) complete

**Independent Test Criteria**:
- ✅ Can create a project with a name and see auto-generated project ID
- ✅ Project appears in projects list with correct ID and name
- ✅ Cannot create duplicate project names (global uniqueness enforced)
- ✅ Project ID follows sequential pattern (PROJ1, PROJ2, etc.)

---

### T014 - Create Projects Service [US1]
**File**: `frontend/src/services/projects.service.ts`
**Story**: US1 - Create Project
**Description**:
```typescript
import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/project.types';

export const projectsService = {
  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getProject(projectId: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) throw error;
    return data;
  },

  async createProject(
    name: string,
    description?: string
  ): Promise<{ project_id: string; id: string; created_at: string }> {
    const { data, error } = await supabase.rpc('create_project', {
      p_name: name,
      p_description: description || null
    });

    if (error) {
      if (error.message.includes('already exists')) {
        throw new Error(`Project name "${name}" is already taken. Please choose a different name.`);
      }
      throw error;
    }

    return data[0];
  },

  async updateProject(
    projectId: string,
    updates: { name?: string; description?: string; status?: 'active' | 'archived' }
  ): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) {
      if (error.message.includes('already exists')) {
        throw new Error(`Project name "${updates.name}" is already taken.`);
      }
      throw error;
    }

    return data;
  },

  async deleteProject(projectId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_project', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  async hasOnlyOneProject(): Promise<boolean> {
    const projects = await this.getProjects();
    return projects.length === 1;
  }
};
```
**Acceptance**: Service compiles, methods work with Supabase, error handling correct

---

### T015 - Create React Query Hooks for Projects [US1] [P]
**File**: `frontend/src/lib/hooks/useProjects.ts`
**Story**: US1 - Create Project
**Description**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsService } from '@/services/projects.service';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.getProjects(),
    staleTime: 30000, // 30 seconds
  });
};

export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsService.getProject(projectId),
    staleTime: 30000,
    enabled: !!projectId,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { name: string; description?: string }) =>
      projectsService.createProject(params.name, params.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      projectId: string;
      updates: { name?: string; description?: string; status?: 'active' | 'archived' };
    }) => projectsService.updateProject(params.projectId, params.updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => projectsService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
```
**Acceptance**: Hooks provide caching, refetching, optimistic updates

---

### T016 - Create ProjectCard Component [US1] [P]
**File**: `frontend/src/components/projects/ProjectCard.tsx`
**Story**: US1 - Create Project
**Description**:
```typescript
import { Link } from 'react-router-dom';
import type { Project } from '@/types/project.types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/projects/${project.project_id}`}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-lg transition"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-gray-900">{project.project_id}</h3>
        <span className={`px-2 py-1 text-xs font-medium rounded ${
          project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {project.status}
        </span>
      </div>
      <p className="text-gray-700 font-medium mb-2">{project.name}</p>
      {project.description && (
        <p className="text-gray-500 text-sm">{project.description}</p>
      )}
      <p className="text-gray-400 text-xs mt-4">
        Created {new Date(project.created_at).toLocaleDateString()}
      </p>
    </Link>
  );
}
```
**Acceptance**: Component renders project info, links to detail page

---

### T017 - Create CreateProjectModal Component [US1] [P]
**File**: `frontend/src/components/projects/CreateProjectModal.tsx`
**Story**: US1 - Create Project
**Description**:
```typescript
import { useState } from 'react';
import { useCreateProject } from '@/lib/hooks/useProjects';
import { toast } from 'sonner';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { mutate: createProject, isPending } = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    createProject(
      { name, description: description || undefined },
      {
        onSuccess: (data) => {
          toast.success(`Project ${data.project_id} created successfully!`);
          setName('');
          setDescription('');
          onClose();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              maxLength={100}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
**Acceptance**: Modal opens/closes, form validates, project created on submit

---

### T018 - Create Projects List Page [US1]
**File**: `frontend/src/pages/Projects.page.tsx`
**Story**: US1 - Create Project
**Description**:
```typescript
import { useState } from 'react';
import { useProjects } from '@/lib/hooks/useProjects';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { Plus } from 'lucide-react';

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Projects</h1>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Project
        </button>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">No projects yet</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="text-blue-600 hover:underline"
          >
            Create your first project
          </button>
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
```
**Acceptance**: Page displays projects list, add button opens modal, empty state shown when no projects

---

### T019 - Add Projects Route to App [US1]
**File**: `frontend/src/App.tsx`
**Story**: US1 - Create Project
**Description**:
```typescript
// Add to existing routes
import { ProjectsPage } from './pages/Projects.page';

// In Routes component:
<Route path="/projects" element={<ProjectsPage />} />
```
**Acceptance**: Projects page accessible at /projects route

---

### T020 - Update Navigation to Include Projects Link [US1]
**File**: `frontend/src/components/common/Navigation.tsx`
**Story**: US1 - Create Project
**Description**:
```typescript
// Add projects link to navigation
<Link to="/projects" className="nav-link">
  Projects
</Link>
```
**Acceptance**: Projects link visible in navigation, highlights when active

---

### T021 - Test US1: Create and View Projects [US1]
**File**: Manual testing checklist
**Story**: US1 - Create Project
**Description**:
**Manual Testing Checklist**:
- [ ] Navigate to /projects page
- [ ] Click "Add Project" button, modal opens
- [ ] Enter project name "Main Greenhouse", click Create
- [ ] Verify project appears with ID "PROJ1"
- [ ] Create second project "North Greenhouse"
- [ ] Verify project appears with ID "PROJ2"
- [ ] Try to create duplicate "Main Greenhouse"
- [ ] Verify error "Project name already exists - please choose a different name"
- [ ] Refresh page, verify projects persist
- [ ] Click on project card, verify navigation works

**Acceptance**: All acceptance scenarios from spec.md pass

---

**✅ CHECKPOINT: User Story 1 Complete**
- Users can create projects
- Projects get auto-generated sequential IDs
- Global uniqueness enforced for project names
- Projects display in list with correct information

---

## Phase 4: User Story 2 - Register Device in Webapp (P1)

**Goal**: Users can register ESP devices in projects with predefined device IDs

**User Story**: A greenhouse owner wants to add a new ESP device to one of their projects. They open the webapp, select a project, select an available device ID from a predefined list (ESP1-ESP20), and give it a friendly name. The system creates a device with combined ID "PROJ1-ESP5".

**Dependencies**: Phase 3 (US1) complete

**Independent Test Criteria**:
- ✅ Can see available device IDs (ESP1-ESP20) for a project
- ✅ Can register a device with selected ID and name
- ✅ Device appears with combined ID format "PROJ1-ESP5"
- ✅ Device starts in "waiting for connection" status
- ✅ Registered device IDs removed from available dropdown
- ✅ Same device ID can be used in different projects

---

### T022 - Update Devices Service for Project-Scoped Operations [US2]
**File**: `frontend/src/services/devices.service.ts`
**Story**: US2 - Register Device
**Description**:
```typescript
import { supabase } from '@/lib/supabase';
import type { Device, AvailableDeviceId } from '@/types/device.types';

export const devicesService = {
  async getProjectDevices(projectId: string): Promise<Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('project_id', projectId)
      .order('device_number', { ascending: true });

    if (error) throw error;
    return data;
  },

  async getAvailableDeviceIds(projectId: string): Promise<AvailableDeviceId[]> {
    const { data, error } = await supabase.rpc('get_available_device_ids', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  async registerDevice(
    name: string,
    projectId: string,
    deviceNumber: number
  ): Promise<{
    composite_device_id: string;
    device_key: string;
    id: string;
    created_at: string;
  }> {
    const { data, error } = await supabase.rpc('register_device_with_project', {
      p_name: name,
      p_project_id: projectId,
      p_device_number: deviceNumber
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error(`Device ESP${deviceNumber} is already registered in this project.`);
      }
      throw error;
    }

    return data[0];
  },

  async getDevice(compositeDeviceId: string): Promise<Device> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('composite_device_id', compositeDeviceId)
      .single();

    if (error) throw error;
    return data;
  },

  async deleteDevice(compositeDeviceId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_device', {
      p_composite_device_id: compositeDeviceId
    });

    if (error) throw error;
    return data;
  },

  getConnectionStatus(lastSeenAt: string | null): 'online' | 'offline' | 'never' {
    if (!lastSeenAt) return 'never';

    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    return diffSeconds < 120 ? 'online' : 'offline';
  }
};
```
**Acceptance**: Service methods work with project-scoped RPC functions

---

### T023 - Create React Query Hooks for Devices [US2] [P]
**File**: `frontend/src/lib/hooks/useProjectDevices.ts`
**Story**: US2 - Register Device
**Description**:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesService } from '@/services/devices.service';

export const useProjectDevices = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId, 'devices'],
    queryFn: () => devicesService.getProjectDevices(projectId),
    staleTime: 20000,
    refetchInterval: 30000, // Poll every 30s for status updates
    enabled: !!projectId,
  });
};

export const useAvailableDeviceIds = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId, 'available-device-ids'],
    queryFn: () => devicesService.getAvailableDeviceIds(projectId),
    staleTime: 10000,
    enabled: !!projectId,
  });
};

export const useRegisterDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { name: string; projectId: string; deviceNumber: number }) =>
      devicesService.registerDevice(params.name, params.projectId, params.deviceNumber),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId, 'devices'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.projectId, 'available-device-ids'] });
    },
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (compositeDeviceId: string) => devicesService.deleteDevice(compositeDeviceId),
    onSuccess: (_, compositeDeviceId) => {
      const projectId = compositeDeviceId.split('-')[0];
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'devices'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'available-device-ids'] });
    },
  });
};
```
**Acceptance**: Hooks provide caching, automatic refetching for device status updates

---

### T024 - Create DeviceCard Component [US2] [P]
**File**: `frontend/src/components/devices/DeviceCard.tsx`
**Story**: US2 - Register Device
**Description**:
```typescript
import { Link } from 'react-router-dom';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import type { Device } from '@/types/device.types';
import { devicesService } from '@/services/devices.service';

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const status = device.status || devicesService.getConnectionStatus(device.last_seen_at);

  const statusConfig = {
    online: { icon: Wifi, color: 'text-green-600', bgColor: 'bg-green-100' },
    offline: { icon: WifiOff, color: 'text-red-600', bgColor: 'bg-red-100' },
    waiting: { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    never: { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.never;
  const Icon = config.icon;

  return (
    <Link
      to={`/devices/${device.composite_device_id}`}
      className="block p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{device.composite_device_id}</h3>
        <div className={`flex items-center gap-1 px-2 py-1 rounded ${config.bgColor}`}>
          <Icon size={16} className={config.color} />
          <span className={`text-xs font-medium ${config.color}`}>
            {status}
          </span>
        </div>
      </div>
      <p className="text-gray-700">{device.name}</p>
      {device.last_seen_at && (
        <p className="text-gray-400 text-xs mt-2">
          Last seen: {new Date(device.last_seen_at).toLocaleString()}
        </p>
      )}
    </Link>
  );
}
```
**Acceptance**: Card displays device info, status badge with icon, links to detail page

---

### T025 - Create RegisterDeviceModal Component [US2] [P]
**File**: `frontend/src/components/devices/RegisterDeviceModal.tsx`
**Story**: US2 - Register Device
**Description**:
```typescript
import { useState } from 'react';
import { useRegisterDevice, useAvailableDeviceIds } from '@/lib/hooks/useProjectDevices';
import { toast } from 'sonner';

interface RegisterDeviceModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RegisterDeviceModal({ projectId, isOpen, onClose }: RegisterDeviceModalProps) {
  const [deviceName, setDeviceName] = useState('');
  const [deviceNumber, setDeviceNumber] = useState<number>(1);
  const { data: availableIds } = useAvailableDeviceIds(projectId);
  const { mutate: registerDevice, isPending } = useRegisterDevice();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    registerDevice(
      { name: deviceName, projectId, deviceNumber },
      {
        onSuccess: (data) => {
          toast.success(`Device ${data.composite_device_id} registered!`);
          // Show device key in modal or separate component
          alert(`Device Key (save this): ${data.device_key}`);
          setDeviceName('');
          onClose();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Register New Device</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device Name *
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              maxLength={100}
              placeholder="e.g., Temperature Sensor"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Device ID *
            </label>
            <select
              value={deviceNumber}
              onChange={(e) => setDeviceNumber(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              {availableIds?.map((id) => (
                <option key={id.device_number} value={id.device_number}>
                  {id.device_id}
                </option>
              ))}
            </select>
            {availableIds && availableIds.length === 0 && (
              <p className="text-red-600 text-sm mt-1">
                No available device IDs. Delete a device to free up an ID.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isPending || !availableIds || availableIds.length === 0}
            >
              {isPending ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
**Acceptance**: Modal shows available device IDs, registers device, displays device key

---

### T026 - Create Project Detail Page with Device List [US2]
**File**: `frontend/src/pages/ProjectDetail.page.tsx`
**Story**: US2 - Register Device
**Description**:
```typescript
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@/lib/hooks/useProjects';
import { useProjectDevices } from '@/lib/hooks/useProjectDevices';
import { DeviceCard } from '@/components/devices/DeviceCard';
import { RegisterDeviceModal } from '@/components/devices/RegisterDeviceModal';
import { Plus } from 'lucide-react';

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const { data: devices, isLoading: devicesLoading } = useProjectDevices(projectId!);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  if (projectLoading || devicesLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!project) {
    return <div className="container mx-auto px-4 py-8">Project not found</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{project.project_id} - {project.name}</h1>
        {project.description && (
          <p className="text-gray-600 mt-2">{project.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Devices</h2>
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Device
        </button>
      </div>

      {devices && devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">No devices registered yet</p>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="text-blue-600 hover:underline"
          >
            Register your first device
          </button>
        </div>
      )}

      <RegisterDeviceModal
        projectId={projectId!}
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />
    </div>
  );
}
```
**Acceptance**: Page shows project info, device list, register button opens modal

---

### T027 - Add Project Detail Route [US2]
**File**: `frontend/src/App.tsx`
**Story**: US2 - Register Device
**Description**:
```typescript
import { ProjectDetailPage } from './pages/ProjectDetail.page';

// In Routes:
<Route path="/projects/:projectId" element={<ProjectDetailPage />} />
```
**Acceptance**: Project detail page accessible at /projects/:projectId

---

### T028 - Test US2: Register Devices in Projects [US2]
**File**: Manual testing checklist
**Story**: US2 - Register Device
**Description**:
**Manual Testing Checklist**:
- [ ] Navigate to project detail page (PROJ1)
- [ ] Click "Add Device", modal opens showing available device IDs (ESP1-ESP20)
- [ ] Select ESP5, enter name "Temperature Sensor", click Register
- [ ] Verify device appears with ID "PROJ1-ESP5" and status "waiting for connection"
- [ ] Verify device key is displayed (save for ESP configuration)
- [ ] Click "Add Device" again
- [ ] Verify ESP5 is not in the available dropdown anymore
- [ ] Register another device ESP10 in same project
- [ ] Navigate to different project (PROJ2)
- [ ] Verify ESP5 is available in PROJ2 (device IDs scoped per project)
- [ ] Register ESP5 in PROJ2 as "PROJ2-ESP5"
- [ ] Verify both PROJ1-ESP5 and PROJ2-ESP5 exist independently

**Acceptance**: All acceptance scenarios from spec.md pass

---

**✅ CHECKPOINT: User Story 2 Complete**
- Users can register devices in projects
- Device IDs (ESP1-ESP20) available per project
- Devices get combined IDs (PROJ1-ESP5)
- Registered device IDs removed from dropdown
- Same device ID can be used across different projects

---

## Phase 5: User Story 3 - Configure ESP Device via WiFi Portal (P1)

**Goal**: ESP firmware creates WiFi portal for device configuration

**User Story**: A greenhouse owner powers on their new ESP device. The device creates a WiFi access point called "Serra-Setup". They connect their phone to this AP, which opens a configuration portal. In the portal, they enter project ID and select device ID, enter WiFi credentials, and submit.

**Dependencies**: Phase 4 (US2) complete

**Independent Test Criteria**:
- ✅ ESP creates "Serra-Setup" WiFi AP on boot
- ✅ Captive portal opens when connected to AP
- ✅ Portal has project ID input (with uppercase normalization) and device ID dropdown
- ✅ Portal accepts WiFi credentials
- ✅ Configuration saves to EEPROM with combined device ID
- ✅ ESP restarts and attempts WiFi connection

---

### T029 - Create ESP8266 Firmware v3.0 Project Structure [US3]
**File**: `firmware/ESP8266_Greenhouse_v3.0/`
**Story**: US3 - Configure ESP
**Description**:
Create directory structure:
```
firmware/ESP8266_Greenhouse_v3.0/
├── ESP8266_Greenhouse_v3.0.ino    # Main sketch
├── config.h                        # Configuration structs and functions
├── portal.h                        # WiFiManager portal HTML
├── heartbeat.h                     # Heartbeat sending logic
├── README.md                       # Setup instructions
└── examples/
    └── test_eeprom.ino            # EEPROM testing sketch
```
**Acceptance**: Directory structure created, files ready for implementation

---

### T030 - Implement Device Configuration Struct and EEPROM Functions [US3]
**File**: `firmware/ESP8266_Greenhouse_v3.0/config.h`
**Story**: US3 - Configure ESP
**Description**:
```cpp
#ifndef CONFIG_H
#define CONFIG_H

#include <EEPROM.h>

#define EEPROM_SIZE 512
#define EEPROM_OFFSET 0

// Device configuration stored in EEPROM
struct DeviceConfig {
  char composite_device_id[15];  // "PROJ1-ESP5" + null (max 14 chars)
  char wifi_ssid[33];            // WiFi SSID (32 + null)
  char wifi_password[64];        // WiFi password (63 + null)
  char device_key[65];           // Device key (64 hex + null)
  uint32_t crc32;                // CRC32 checksum
};

extern DeviceConfig deviceConfig;

// Function prototypes
void loadConfig();
void saveConfig();
uint32_t calculateCRC32(const uint8_t* data, size_t length);
bool validateConfig();
void clearConfig();

#endif
```

Implement functions in config.cpp:
```cpp
#include "config.h"

DeviceConfig deviceConfig;

uint32_t calculateCRC32(const uint8_t* data, size_t length) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t i = 0; i < length; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
    }
  }
  return crc ^ 0xFFFFFFFF;
}

void loadConfig() {
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.get(EEPROM_OFFSET, deviceConfig);
  EEPROM.end();
}

void saveConfig() {
  deviceConfig.crc32 = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(EEPROM_OFFSET, deviceConfig);
  EEPROM.commit();
  EEPROM.end();
}

bool validateConfig() {
  uint32_t calculatedCRC = calculateCRC32((uint8_t*)&deviceConfig, sizeof(DeviceConfig) - sizeof(uint32_t));
  return calculatedCRC == deviceConfig.crc32 &&
         strlen(deviceConfig.composite_device_id) > 0 &&
         strlen(deviceConfig.wifi_ssid) > 0;
}

void clearConfig() {
  memset(&deviceConfig, 0, sizeof(DeviceConfig));
  saveConfig();
}
```
**Acceptance**: Config saves to/loads from EEPROM, CRC validates correctly

---

### T031 - Create WiFiManager Portal HTML with Custom Fields [US3]
**File**: `firmware/ESP8266_Greenhouse_v3.0/portal.h`
**Story**: US3 - Configure ESP
**Description**:
```cpp
#ifndef PORTAL_H
#define PORTAL_H

const char CUSTOM_HTML[] PROGMEM = R"(
<style>
  input[type='text'], input[type='password'], select {
    font-size: 16px;
    width: 100%;
    padding: 12px;
    margin: 8px 0;
    box-sizing: border-box;
  }
</style>

<br/><label for='device_select'>Device ID *</label>
<select id='device_select' class='button' onchange="document.getElementById('device_num').value=this.value">
  <option value='1'>ESP-1</option>
  <option value='2'>ESP-2</option>
  <option value='3'>ESP-3</option>
  <option value='4'>ESP-4</option>
  <option value='5'>ESP-5</option>
  <option value='6'>ESP-6</option>
  <option value='7'>ESP-7</option>
  <option value='8'>ESP-8</option>
  <option value='9'>ESP-9</option>
  <option value='10'>ESP-10</option>
  <option value='11'>ESP-11</option>
  <option value='12'>ESP-12</option>
  <option value='13'>ESP-13</option>
  <option value='14'>ESP-14</option>
  <option value='15'>ESP-15</option>
  <option value='16'>ESP-16</option>
  <option value='17'>ESP-17</option>
  <option value='18'>ESP-18</option>
  <option value='19'>ESP-19</option>
  <option value='20'>ESP-20</option>
</select>

<script>
  // Hide the hidden field
  var label = document.querySelector("label[for='device_num']");
  if (label) label.style.display = 'none';
  var input = document.getElementById('device_num');
  if (input) input.style.display = 'none';
</script>
)";

#endif
```
**Acceptance**: HTML renders correctly in captive portal, dropdown functional

---

### T032 - Implement Main WiFiManager Setup Logic [US3]
**File**: `firmware/ESP8266_Greenhouse_v3.0/ESP8266_Greenhouse_v3.0.ino`
**Story**: US3 - Configure ESP
**Description**:
```cpp
#include <ESP8266WiFi.h>
#include <WiFiManager.h>
#include "config.h"
#include "portal.h"

WiFiManager wifiManager;
WiFiManagerParameter* param_project_id;
WiFiManagerParameter* param_device_num;
WiFiManagerParameter* param_device_key;
WiFiManagerParameter* custom_dropdown;

void saveConfigCallback() {
  Serial.println("Saving configuration...");

  // Get values from parameters
  String projectId = String(param_project_id->getValue());
  projectId.toUpperCase(); // Normalize to uppercase

  int deviceNum = atoi(param_device_num->getValue());

  // Construct composite device ID
  String compositeId = projectId + "-ESP" + String(deviceNum);

  // Save to config struct
  strncpy(deviceConfig.composite_device_id, compositeId.c_str(), 14);
  strncpy(deviceConfig.device_key, param_device_key->getValue(), 64);

  // WiFi credentials are saved automatically by WiFiManager
  // We'll retrieve them after connection

  Serial.print("Composite Device ID: ");
  Serial.println(deviceConfig.composite_device_id);
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nESP8266 Greenhouse v3.0");

  // Load existing config
  loadConfig();

  // Check if config is valid
  if (validateConfig()) {
    Serial.println("Valid configuration found");
    Serial.print("Device ID: ");
    Serial.println(deviceConfig.composite_device_id);

    // Try to connect to WiFi
    WiFi.begin(deviceConfig.wifi_ssid, deviceConfig.wifi_password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(1000);
      Serial.print(".");
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi connected!");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
      return; // Skip portal, go to main loop
    } else {
      Serial.println("\nWiFi connection failed, starting portal");
    }
  } else {
    Serial.println("No valid configuration, starting portal");
  }

  // Setup WiFiManager parameters
  param_project_id = new WiFiManagerParameter(
    "proj_id",
    "Project ID",
    "",
    10,
    " onchange='this.value=this.value.toUpperCase()'"
  );

  param_device_num = new WiFiManagerParameter("device_num", "Device Number", "1", 3);

  param_device_key = new WiFiManagerParameter(
    "device_key",
    "Device Key (from webapp)",
    "",
    64,
    " placeholder='64 hex characters'"
  );

  custom_dropdown = new WiFiManagerParameter(CUSTOM_HTML);

  wifiManager.setSaveConfigCallback(saveConfigCallback);
  wifiManager.setBreakAfterConfig(true);

  wifiManager.setCustomHeadElement(
    "<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
  );

  wifiManager.addParameter(param_project_id);
  wifiManager.addParameter(param_device_num);
  wifiManager.addParameter(custom_dropdown);
  wifiManager.addParameter(param_device_key);

  // Start portal
  if (!wifiManager.autoConnect("Serra-Setup")) {
    Serial.println("Failed to connect, restarting...");
    ESP.restart();
  }

  // If we get here, WiFi is connected
  Serial.println("WiFi connected!");

  // Save WiFi credentials to config
  strncpy(deviceConfig.wifi_ssid, WiFi.SSID().c_str(), 32);
  strncpy(deviceConfig.wifi_password, WiFi.psk().c_str(), 63);

  // Save full config to EEPROM
  saveConfig();

  Serial.println("Configuration saved, restarting...");
  delay(1000);
  ESP.restart();
}

void loop() {
  // Main loop will handle heartbeat sending (implemented in T033)
  delay(60000); // 60 seconds
}
```
**Acceptance**: ESP creates AP, portal accepts inputs, saves config, restarts

---

### T033 - Implement Heartbeat Sending Logic [US3]
**File**: `firmware/ESP8266_Greenhouse_v3.0/heartbeat.h`
**Story**: US3 - Configure ESP
**Description**:
```cpp
#ifndef HEARTBEAT_H
#define HEARTBEAT_H

#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

#define SUPABASE_URL "https://fmyomzywzjtxmabvvjcd.supabase.co"
#define HEARTBEAT_ENDPOINT "/functions/v1/device-heartbeat"

bool sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, skipping heartbeat");
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure(); // For testing; use certificate validation in production

  HTTPClient http;

  String url = String(SUPABASE_URL) + String(HEARTBEAT_ENDPOINT);
  http.begin(client, url);

  // Headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", deviceConfig.device_key);
  http.addHeader("x-composite-device-id", deviceConfig.composite_device_id);

  // Body
  StaticJsonDocument<200> doc;
  doc["rssi"] = WiFi.RSSI();
  doc["ip_address"] = WiFi.localIP().toString();
  doc["fw_version"] = "v3.0.0";

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.println("Heartbeat sent successfully");
    String response = http.getString();
    Serial.println(response);
    http.end();
    return true;
  } else {
    Serial.print("Heartbeat failed: ");
    Serial.println(httpCode);
    http.end();
    return false;
  }
}

#endif
```

Update main loop in .ino file:
```cpp
#include "heartbeat.h"

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 60000; // 60 seconds

void loop() {
  unsigned long now = millis();

  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  delay(100);
}
```
**Acceptance**: Heartbeat sends every 60 seconds with correct headers and payload

---

### T034 - Add Factory Reset Button Handler [US3] [P]
**File**: `firmware/ESP8266_Greenhouse_v3.0/ESP8266_Greenhouse_v3.0.ino`
**Story**: US3 - Configure ESP
**Description**:
```cpp
#define RESET_BUTTON_PIN D3  // GPIO 0 (adjust for your board)

void checkResetButton() {
  static unsigned long buttonPressStart = 0;
  const unsigned long LONG_PRESS_DURATION = 5000; // 5 seconds

  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    if (buttonPressStart == 0) {
      buttonPressStart = millis();
    }

    if (millis() - buttonPressStart >= LONG_PRESS_DURATION) {
      Serial.println("Factory reset triggered");
      clearConfig();
      wifiManager.resetSettings();
      Serial.println("Configuration cleared, restarting...");
      delay(1000);
      ESP.restart();
    }
  } else {
    buttonPressStart = 0;
  }
}

void setup() {
  // ... existing setup code ...

  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);

  // ... rest of setup ...
}

void loop() {
  checkResetButton();

  // ... existing loop code ...
}
```
**Acceptance**: Holding reset button for 5 seconds clears config and recreates AP

---

### T035 - Create ESP Firmware README [US3] [P]
**File**: `firmware/ESP8266_Greenhouse_v3.0/README.md`
**Story**: US3 - Configure ESP
**Description**:
Create comprehensive README with:
- Hardware requirements
- Pin configuration (reset button)
- Library dependencies (WiFiManager, ArduinoJson)
- Upload instructions
- Configuration workflow
- Troubleshooting common issues
- Serial monitor output examples

**Acceptance**: README is clear and complete, enables developers to set up ESP

---

### T036 - Create EEPROM Test Sketch [US3] [P]
**File**: `firmware/ESP8266_Greenhouse_v3.0/examples/test_eeprom.ino`
**Story**: US3 - Configure ESP
**Description**:
```cpp
#include <EEPROM.h>
#include "../config.h"

void setup() {
  Serial.begin(115200);
  Serial.println("\nEEPROM Test Sketch");

  // Test writing
  strcpy(deviceConfig.composite_device_id, "PROJ1-ESP5");
  strcpy(deviceConfig.wifi_ssid, "TestNetwork");
  strcpy(deviceConfig.wifi_password, "TestPassword123");
  strcpy(deviceConfig.device_key, "a1b2c3d4e5f67890" /* 64 chars */);

  saveConfig();
  Serial.println("Configuration saved to EEPROM");

  // Test reading
  memset(&deviceConfig, 0, sizeof(DeviceConfig));
  loadConfig();

  Serial.print("Composite Device ID: ");
  Serial.println(deviceConfig.composite_device_id);

  Serial.print("WiFi SSID: ");
  Serial.println(deviceConfig.wifi_ssid);

  Serial.print("Config Valid: ");
  Serial.println(validateConfig() ? "Yes" : "No");
}

void loop() {}
```
**Acceptance**: Test sketch verifies EEPROM read/write/validate functions work

---

### T037 - Test US3: Configure ESP via WiFi Portal [US3]
**File**: Manual testing checklist
**Story**: US3 - Configure ESP
**Description**:
**Manual Testing Checklist**:
- [ ] Upload firmware to ESP8266
- [ ] Power on ESP, verify "Serra-Setup" AP appears
- [ ] Connect phone/computer to "Serra-Setup" AP
- [ ] Verify captive portal opens automatically
- [ ] See project ID input field and device ID dropdown (ESP1-ESP20)
- [ ] Enter "proj1" in project ID field
- [ ] Select "ESP5" from device ID dropdown
- [ ] Enter WiFi SSID and password
- [ ] Enter device key (from webapp registration)
- [ ] Submit form, verify success message
- [ ] Verify ESP restarts and attempts WiFi connection
- [ ] Check serial monitor for "WiFi connected!" message
- [ ] Verify composite device ID "PROJ1-ESP5" in serial output
- [ ] Test factory reset: hold reset button for 5 seconds
- [ ] Verify ESP clears config and recreates "Serra-Setup" AP

**Acceptance**: All acceptance scenarios from spec.md pass

---

**✅ CHECKPOINT: User Story 3 Complete**
- ESP creates WiFi portal on boot
- Portal has project ID input with uppercase normalization
- Portal has device ID dropdown (ESP1-ESP20)
- Configuration saves to EEPROM with combined device ID
- ESP restarts and connects to WiFi
- Factory reset clears configuration

---

## Phase 6: User Story 4 - Automatic Device Connection (P1)

**Goal**: ESP devices automatically connect and update status in webapp

**User Story**: After configuring the ESP device via the WiFi portal, the device connects to the user's home WiFi network and sends a heartbeat message to the backend. The backend matches this ID with the device registered in the webapp and updates the device status to "online".

**Dependencies**: Phase 5 (US3) complete

**Independent Test Criteria**:
- ✅ ESP sends heartbeat with composite device ID and device key
- ✅ Backend validates composite ID format and device key
- ✅ Backend updates device status to "online" on valid heartbeat
- ✅ Webapp shows device status change within 10 seconds
- ✅ Device status changes to "offline" when heartbeats stop for >2 minutes

---

### T038 - Update Edge Function to Accept Composite Device IDs [US4]
**File**: `supabase/functions/device-heartbeat/index.ts`
**Story**: US4 - Automatic Connection
**Description**:
```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const COMPOSITE_ID_REGEX = /^[A-Z0-9]{4,5}-ESP(1[0-9]|20|[1-9])$/;

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Extract headers
  const deviceKey = req.headers.get('x-device-key');
  const deviceUUID = req.headers.get('x-device-uuid'); // Legacy support
  const compositeDeviceId = req.headers.get('x-composite-device-id'); // New

  // Extract telemetry from body
  const body = await req.json();
  const { rssi, ip_address, fw_version } = body;

  // Determine lookup strategy
  let device;
  let lookupField;

  if (compositeDeviceId) {
    // Validate format
    if (!COMPOSITE_ID_REGEX.test(compositeDeviceId)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid composite device ID format',
        details: 'Expected format: PROJ1-ESP5 (project ID + device number 1-20)'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Lookup by composite ID
    const { data, error } = await supabase
      .from('devices')
      .select('id, device_key_hash, composite_device_id')
      .eq('composite_device_id', compositeDeviceId)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Device not found',
        details: `Device ${compositeDeviceId} is not registered`
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    device = data;
    lookupField = compositeDeviceId;
  } else if (deviceUUID) {
    // Legacy UUID lookup
    const { data, error } = await supabase
      .from('devices')
      .select('id, device_key_hash, composite_device_id')
      .eq('id', deviceUUID)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Device not found'
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    device = data;
    lookupField = deviceUUID;
  } else {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing device identifier',
      details: 'Provide either x-device-uuid or x-composite-device-id header'
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Verify device key
  if (!deviceKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing device key',
      details: 'x-device-key header is required'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // Hash provided key and compare
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const providedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (providedHash !== device.device_key_hash) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid device key',
      details: 'Device key does not match stored hash'
    }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  // Insert heartbeat
  const { error: heartbeatError } = await supabase
    .from('device_heartbeats')
    .insert({
      device_id: device.id,
      composite_device_id: device.composite_device_id || lookupField,
      rssi,
      ip_address,
      fw_version,
      ts: new Date().toISOString()
    });

  if (heartbeatError) {
    console.error('Heartbeat insert error:', heartbeatError);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to insert heartbeat'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Update device status
  const { error: updateError } = await supabase
    .from('devices')
    .update({
      status: 'online',
      last_seen_at: new Date().toISOString(),
      rssi,
      ip_address,
      fw_version
    })
    .eq('id', device.id);

  if (updateError) {
    console.error('Device update error:', updateError);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update device status'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Success
  return new Response(JSON.stringify({
    success: true,
    device_id: device.composite_device_id || lookupField,
    status: 'online',
    timestamp: new Date().toISOString()
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
```
**Acceptance**: Edge Function accepts both UUID and composite ID, validates format, updates status

---

### T039 - Deploy Updated Edge Function [US4]
**File**: Command line
**Story**: US4 - Automatic Connection
**Description**:
```bash
cd supabase/functions
supabase functions deploy device-heartbeat

# Test with curl
curl -X POST https://fmyomzywzjtxmabvvjcd.supabase.co/functions/v1/device-heartbeat \
  -H "x-device-key: YOUR_DEVICE_KEY" \
  -H "x-composite-device-id: PROJ1-ESP5" \
  -H "Content-Type: application/json" \
  -d '{
    "rssi": -65,
    "ip_address": "192.168.1.100",
    "fw_version": "v3.0.0"
  }'
```
**Acceptance**: Edge Function deployed, test curl returns success

---

### T040 - Create Offline Detection Edge Function [US4] [P]
**File**: `supabase/functions/detect-offline-devices/index.ts`
**Story**: US4 - Automatic Connection
**Description**:
```typescript
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OFFLINE_THRESHOLD_SECONDS = 120; // 2 minutes

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find devices that should be offline
  const thresholdTime = new Date(Date.now() - OFFLINE_THRESHOLD_SECONDS * 1000).toISOString();

  const { data: offlineDevices, error } = await supabase
    .from("devices")
    .select("id, composite_device_id, last_seen_at, status")
    .eq("status", "online")
    .lt("last_seen_at", thresholdTime);

  if (error) {
    console.error('Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Update their status
  if (offlineDevices && offlineDevices.length > 0) {
    const deviceIds = offlineDevices.map(d => d.id);

    const { error: updateError } = await supabase
      .from("devices")
      .update({ status: "offline" })
      .in("id", deviceIds);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Marked ${offlineDevices.length} devices as offline`);
  }

  return new Response(
    JSON.stringify({
      processed: offlineDevices?.length || 0,
      threshold_seconds: OFFLINE_THRESHOLD_SECONDS,
      timestamp: new Date().toISOString()
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```
**Acceptance**: Function finds and marks offline devices correctly

---

### T041 - Deploy Offline Detection Edge Function [US4]
**File**: Command line
**Story**: US4 - Automatic Connection
**Description**:
```bash
cd supabase/functions
supabase functions deploy detect-offline-devices

# Test manually
curl -X POST https://fmyomzywzjtxmabvvjcd.supabase.co/functions/v1/detect-offline-devices \
  -H "Authorization: Bearer SERVICE_ROLE_KEY"
```
**Acceptance**: Function deployed, can be invoked manually

---

### T042 - Setup External Cron for Offline Detection [US4]
**File**: `.github/workflows/offline-detection.yml` or external cron service
**Story**: US4 - Automatic Connection
**Description**:
```yaml
name: Detect Offline Devices

on:
  schedule:
    - cron: '* * * * *'  # Every minute

jobs:
  detect-offline:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Edge Function
        run: |
          curl -X POST https://fmyomzywzjtxmabvvjcd.supabase.co/functions/v1/detect-offline-devices \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

**Alternative**: Use external cron service (cron-job.org, etc.)

**Acceptance**: Offline detection runs automatically every minute

---

### T043 - Test US4: Automatic Device Connection [US4]
**File**: Manual testing checklist
**Story**: US4 - Automatic Connection
**Description**:
**Manual Testing Checklist**:
- [ ] Register device PROJ1-ESP5 in webapp, save device key
- [ ] Configure physical ESP with PROJ1, ESP5, WiFi, and device key
- [ ] Verify ESP connects to WiFi (check serial monitor)
- [ ] Verify ESP sends first heartbeat within 10 seconds
- [ ] Refresh webapp, verify PROJ1-ESP5 status changes to "online"
- [ ] Verify device detail page shows "Settings" button enabled
- [ ] Verify last_seen_at timestamp updates
- [ ] Verify RSSI, IP, firmware version displayed
- [ ] Power off ESP, wait 3 minutes
- [ ] Refresh webapp, verify PROJ1-ESP5 status changes to "offline"
- [ ] Power on ESP again
- [ ] Verify PROJ1-ESP5 status changes back to "online" (automatic recovery)
- [ ] Try heartbeat with non-existent device "PROJ1-ESP99"
- [ ] Verify heartbeat rejected with 404 error
- [ ] Try heartbeat with wrong device key
- [ ] Verify heartbeat rejected with 401 error

**Acceptance**: All acceptance scenarios from spec.md pass

---

**✅ CHECKPOINT: User Story 4 Complete**
- ESP sends heartbeat with composite device ID
- Backend validates and accepts heartbeat
- Device status updates to "online" in webapp
- Offline detection marks devices offline after 2 minutes
- Automatic recovery when devices come back online

---

## Phase 7: User Story 5 - Delete and Re-register Device (P2)

**Goal**: Users can delete devices and re-register the same device ID

**User Story**: A greenhouse owner wants to remove an old ESP device from their system and free up that ID for future use within the same project. They delete the device from the webapp, which makes the device ID available again.

**Dependencies**: Phase 6 (US4) complete

**Independent Test Criteria**:
- ✅ Can delete a device from webapp
- ✅ Deleted device ID becomes available in dropdown for that project
- ✅ Heartbeats from deleted devices are rejected
- ✅ Can re-register the same device ID after deletion

---

### T044 - Add Delete Device Button to Device Detail Page [US5]
**File**: `frontend/src/pages/DeviceDetail.page.tsx`
**Story**: US5 - Delete Device
**Description**:
```typescript
import { useNavigate } from 'react-router-dom';
import { useDeleteDevice } from '@/lib/hooks/useProjectDevices';
import { toast } from 'sonner';

// In component:
const navigate = useNavigate();
const { mutate: deleteDevice } = useDeleteDevice();

const handleDelete = () => {
  if (window.confirm(`Are you sure you want to delete ${device.composite_device_id}? This action cannot be undone.`)) {
    deleteDevice(device.composite_device_id, {
      onSuccess: () => {
        toast.success('Device deleted successfully');
        navigate(`/projects/${device.project_id}`);
      },
      onError: (error) => {
        toast.error('Failed to delete device');
      }
    });
  }
};

// In JSX:
<button
  onClick={handleDelete}
  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
>
  Delete Device
</button>
```
**Acceptance**: Delete button shown, confirmation required, device deleted on confirm

---

### T045 - Test US5: Delete and Re-register Device [US5]
**File**: Manual testing checklist
**Story**: US5 - Delete Device
**Description**:
**Manual Testing Checklist**:
- [ ] Register device PROJ1-ESP7 in webapp
- [ ] Navigate to device detail page
- [ ] Click "Delete Device", confirm deletion
- [ ] Verify PROJ1-ESP7 removed from device list
- [ ] Navigate to project detail page, click "Add Device"
- [ ] Verify ESP7 appears in available device ID dropdown
- [ ] Re-register ESP7 as "PROJ1-ESP7" (new device)
- [ ] Power on physical ESP configured as PROJ1-ESP7 (old config)
- [ ] Verify heartbeat rejected (device no longer exists)
- [ ] Configure physical ESP with new device key
- [ ] Verify ESP connects successfully as new PROJ1-ESP7

**Acceptance**: All acceptance scenarios from spec.md pass

---

**✅ CHECKPOINT: User Story 5 Complete**
- Users can delete devices
- Deleted device IDs become available for re-registration
- Heartbeats from deleted devices are rejected
- Can re-register same device ID with new configuration

---

## Phase 8: User Story 6 - Delete Project (P2)

**Goal**: Users can delete entire projects and all associated devices

**User Story**: A greenhouse owner wants to remove an entire project that is no longer in use. They delete the project from the webapp, which also deletes all devices associated with that project.

**Dependencies**: Phase 7 (US5) complete

**Independent Test Criteria**:
- ✅ Can delete a project
- ✅ Project deletion cascades to all devices
- ✅ Warning shown when deleting last project
- ✅ Heartbeats from devices in deleted projects are rejected

---

### T046 - Add Delete Project Button with Last Project Warning [US6]
**File**: `frontend/src/pages/ProjectDetail.page.tsx`
**Story**: US6 - Delete Project
**Description**:
```typescript
import { projectsService } from '@/services/projects.service';
import { useDeleteProject } from '@/lib/hooks/useProjects';

// In component:
const { mutate: deleteProject } = useDeleteProject();

const handleDeleteProject = async () => {
  const isLastProject = await projectsService.hasOnlyOneProject();

  const message = isLastProject
    ? 'This is your last project. Deleting it will remove all devices. Continue?'
    : `Are you sure you want to delete ${project.name} and all its devices? This action cannot be undone.`;

  if (window.confirm(message)) {
    deleteProject(project.project_id, {
      onSuccess: () => {
        toast.success('Project deleted successfully');
        navigate('/projects');
      },
      onError: (error) => {
        toast.error('Failed to delete project');
      }
    });
  }
};

// In JSX:
<button
  onClick={handleDeleteProject}
  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
>
  Delete Project
</button>
```
**Acceptance**: Delete button shown, special warning for last project, cascades to devices

---

### T047 - Test US6: Delete Project [US6]
**File**: Manual testing checklist
**Story**: US6 - Delete Project
**Description**:
**Manual Testing Checklist**:
- [ ] Create project PROJ1 with devices PROJ1-ESP1 and PROJ1-ESP2
- [ ] Navigate to project detail page
- [ ] Click "Delete Project", confirm deletion
- [ ] Verify PROJ1 and all its devices removed from account
- [ ] Create new project, verify it gets next sequential ID (PROJ2, PROJ3, etc.)
- [ ] Create one project with online devices
- [ ] Delete the project
- [ ] Verify devices send heartbeats but heartbeats are rejected (project no longer exists)
- [ ] Create one project (only project in account)
- [ ] Click "Delete Project"
- [ ] Verify warning message: "This is your last project. Deleting it will remove all devices. Continue?"
- [ ] Confirm deletion
- [ ] Verify project deleted, user has zero projects
- [ ] Verify user can still create new projects

**Acceptance**: All acceptance scenarios from spec.md pass

---

**✅ CHECKPOINT: User Story 6 Complete**
- Users can delete projects
- Project deletion cascades to all devices
- Special warning for last project deletion
- Heartbeats from devices in deleted projects are rejected

---

## Dependencies

### User Story Dependencies

```
Phase 1: Setup & Infrastructure
    ↓
Phase 2: Foundational Prerequisites (BLOCKING - must complete before any user story)
    ↓
    ├─→ Phase 3: User Story 1 (Create Project) - P1
    │       ↓
    │   Phase 4: User Story 2 (Register Device) - P1
    │       ↓
    │   Phase 5: User Story 3 (Configure ESP) - P1
    │       ↓
    │   Phase 6: User Story 4 (Automatic Connection) - P1
    │       ↓
    │       ├─→ Phase 7: User Story 5 (Delete Device) - P2
    │       │
    │       └─→ Phase 8: User Story 6 (Delete Project) - P2
```

**Critical Path (MVP)**:
1. Setup & Infrastructure (T001-T006)
2. Foundational Prerequisites (T007-T013)
3. User Story 1: Create Project (T014-T021)
4. User Story 2: Register Device (T022-T028)
5. User Story 3: Configure ESP (T029-T037)
6. User Story 4: Automatic Connection (T038-T043)

**Post-MVP**:
7. User Story 5: Delete Device (T044-T045)
8. User Story 6: Delete Project (T046-T047)

---

## Parallel Execution Opportunities

### Phase 1 (Setup): All tasks can run in parallel
- T001, T002, T003, T004, T005, T006

### Phase 2 (Foundational): Sequential (database migrations)
- Must run in order: T007 → T008 → T009 → T010 → T011 → T012 → T013

### Phase 3 (US1): Parallelizable after service layer
- T014 (Service) must complete first
- Then parallel: T015, T016, T017
- Then: T018 → T019 → T020 → T021

### Phase 4 (US2): Parallelizable after service layer
- T022 (Service) must complete first
- Then parallel: T023, T024, T025
- Then: T026 → T027 → T028

### Phase 5 (US3): Multiple parallel streams
- T029 → T030, T031, T032, T033 (parallel)
- T034, T035, T036 (parallel)
- Then: T037

### Phase 6 (US4): Backend + Frontend parallel
- T038 → T039 (Edge Function)
- T040 → T041 → T042 (Offline Detection, parallel with T038-T039)
- Then: T043

---

## Implementation Notes

### MVP Scope (Recommended First Release)
**Tasks**: T001-T043 (43 tasks)
**User Stories**: US1, US2, US3, US4 (P1 only)
**Timeline**: 2-3 weeks for small team

**What's included**:
- Complete project management
- Device registration with project scoping
- ESP WiFi portal configuration
- Automatic device connection and status updates
- Offline detection

**What's deferred**:
- Device deletion (US5)
- Project deletion (US6)

### Post-MVP (User Management)
**Tasks**: T044-T047 (4 tasks)
**User Stories**: US5, US6 (P2)
**Timeline**: 1 week

**Rationale**: Deletion features are important but not critical for initial onboarding. Users can create and use devices without needing to delete them immediately.

---

## Summary

**Total Tasks**: 47
**Parallel Opportunities**: 18 tasks marked [P]
**Phases**: 8 (2 foundational + 6 user stories)
**Critical Path Length**: ~43 tasks (MVP)

**Estimated Timeline**:
- Phase 1 (Setup): 1 day
- Phase 2 (Foundational): 2 days
- Phase 3 (US1): 2 days
- Phase 4 (US2): 2 days
- Phase 5 (US3): 3 days
- Phase 6 (US4): 2 days
- Phase 7 (US5): 1 day
- Phase 8 (US6): 1 day

**Total**: ~14 days for full implementation

**MVP (US1-4)**: ~10 days

---

## Next Steps

1. Review tasks with team
2. Assign tasks to developers
3. Set up project tracking (GitHub Projects, Jira, etc.)
4. Begin with Phase 1 (Setup) tasks in parallel
5. Complete Phase 2 (Foundational) before starting user stories
6. Implement user stories in priority order (P1 first)
7. Test each user story independently before moving to next
8. Deploy MVP after US4 complete
9. Gather user feedback before implementing P2 features
