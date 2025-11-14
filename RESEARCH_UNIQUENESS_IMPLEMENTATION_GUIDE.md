# PostgreSQL Global Uniqueness Constraints - Implementation Guide for Serra

**Created**: 2025-11-12
**Context**: Feature 004 - Projects with globally unique names and IDs

---

## Quick Start: Copy-Paste Ready Code

### Step 1: Create Projects Table with Global Uniqueness

```sql
-- Migration: Create projects table with global uniqueness
-- Add to: supabase/migrations/20251112000000_create_projects_table.sql

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Global uniqueness: Only one "Main Greenhouse" across entire system
  name TEXT NOT NULL UNIQUE,

  -- Global uniqueness: Only one PROJ1, PROJ2, etc.
  project_id TEXT NOT NULL UNIQUE CHECK (project_id ~ '^PROJ\d+$'),

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_user_not_archived ON public.projects(user_id)
  WHERE is_archived = FALSE;

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Function to generate next project ID
CREATE OR REPLACE FUNCTION public.get_next_project_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_num INTEGER;
  v_next_id TEXT;
BEGIN
  -- Extract number from all project_ids like "PROJ1"
  SELECT COALESCE(MAX(CAST(SUBSTRING(project_id, 5) AS INTEGER)), 0)
  INTO v_max_num
  FROM public.projects;

  -- Generate next ID
  v_next_id := 'PROJ' || (v_max_num + 1)::TEXT;

  RETURN v_next_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_project_id() TO authenticated;
```

### Step 2: Create Devices Table with Project-Scoped Uniqueness

```sql
-- Migration: Create devices table with project-scoped uniqueness
-- Add to: supabase/migrations/20251112000001_create_projects_devices.sql

-- Update existing devices table
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS device_id_short TEXT;

-- Create a new devices table (or update existing)
-- If updating existing table, migrate data first
CREATE TABLE IF NOT EXISTS public.devices_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Device ID format: ESP1, ESP2, ... ESP20
  device_id_short TEXT NOT NULL CHECK (device_id_short ~ '^ESP\d{1,2}$'),

  -- Friendly name for the device
  name TEXT NOT NULL,

  -- Connection status
  connection_status TEXT DEFAULT 'offline' NOT NULL
    CHECK (connection_status IN ('online', 'offline', 'connection_failed')),

  -- Metadata
  last_seen_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  device_hostname TEXT,
  api_key_hash TEXT NOT NULL UNIQUE,

  -- Project-scoped uniqueness: Each project can have one ESP1, one ESP2, etc.
  -- PROJ1-ESP5 and PROJ2-ESP5 are different devices
  CONSTRAINT unique_device_per_project UNIQUE (project_id, device_id_short)
);

-- Indexes
CREATE INDEX idx_devices_user_id ON public.devices_v2(user_id);
CREATE INDEX idx_devices_project_id ON public.devices_v2(project_id);
CREATE INDEX idx_devices_device_id_short ON public.devices_v2(device_id_short);
CREATE INDEX idx_devices_full_id ON public.devices_v2(project_id, device_id_short);

-- Enable RLS
ALTER TABLE public.devices_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view devices in their projects"
  ON public.devices_v2 FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create devices in their projects"
  ON public.devices_v2 FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update devices in their projects"
  ON public.devices_v2 FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete devices in their projects"
  ON public.devices_v2 FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Function to get available device IDs for a project
CREATE OR REPLACE FUNCTION public.get_available_device_ids(
  p_project_id UUID
)
RETURNS TABLE (device_id_short TEXT, is_available BOOLEAN)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  WITH all_device_ids AS (
    SELECT 'ESP' || num::TEXT AS device_id_short
    FROM generate_series(1, 20) AS num
  ),
  used_ids AS (
    SELECT device_id_short
    FROM public.devices_v2
    WHERE project_id = p_project_id
  )
  SELECT
    a.device_id_short,
    u.device_id_short IS NULL AS is_available
  FROM all_device_ids a
  LEFT JOIN used_ids u ON u.device_id_short = a.device_id_short
  ORDER BY a.device_id_short;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_device_ids(UUID) TO authenticated;
```

### Step 3: TypeScript Service Layer

```typescript
// frontend/src/services/projects.service.ts

import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  user_id: string;
  name: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Map PostgreSQL constraint names to user-friendly error messages
 */
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'projects_name_key': 'A project with this name already exists. Please choose a different name.',
  'projects_name_unique': 'A project with this name already exists. Please choose a different name.',
  'projects_project_id_key': 'This project ID is already taken.',
  'projects_project_id_unique': 'This project ID is already taken.',
};

/**
 * Translate PostgreSQL error into user-friendly message
 */
function translateProjectError(error: DatabaseError): string {
  // Extract constraint name from error message
  const constraintMatch = error.details?.match(/violates unique constraint "([^"]+)"/);
  const constraintName = constraintMatch ? constraintMatch[1] : '';

  if (constraintName in ERROR_MESSAGE_MAP) {
    return ERROR_MESSAGE_MAP[constraintName as keyof typeof ERROR_MESSAGE_MAP];
  }

  if (error.code === '23505') { // UNIQUE VIOLATION
    return 'This value is already in use. Please choose a different one.';
  }

  return error.message || 'An unexpected error occurred. Please try again.';
}

export const projectsService = {
  /**
   * Check if a project name is available (for real-time validation)
   * Returns true if name is NOT taken
   */
  async isNameAvailable(name: string): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('name', name);

      if (error) {
        console.error('Name availability check failed:', error);
        return false; // Conservative: assume unavailable on error
      }

      return (count || 0) === 0;
    } catch (error) {
      console.error('Name availability check error:', error);
      return false;
    }
  },

  /**
   * Create a new project with global unique constraints
   *
   * Constraints enforced:
   * - Project name must be globally unique
   * - Project ID must be globally unique (auto-generated)
   */
  async createProject(name: string): Promise<{
    success: boolean;
    project?: Project;
    error?: string;
  }> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Validate input
    if (!name?.trim()) {
      return {
        success: false,
        error: 'Project name is required',
      };
    }

    if (name.length > 255) {
      return {
        success: false,
        error: 'Project name must be 255 characters or less',
      };
    }

    try {
      // Step 1: Generate next project ID
      const { data: projectIdData, error: idError } = await supabase.rpc(
        'get_next_project_id'
      );

      if (idError) {
        console.error('Failed to generate project ID:', idError);
        return {
          success: false,
          error: 'Failed to generate project ID. Please try again.',
        };
      }

      const projectId = projectIdData as string;

      // Step 2: Insert project (UNIQUE constraints will be enforced)
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: name.trim(),
          project_id: projectId,
        })
        .select()
        .single();

      if (error) {
        // Translate database error
        const userMessage = translateProjectError(error as DatabaseError);
        return {
          success: false,
          error: userMessage,
        };
      }

      return {
        success: true,
        project: data,
      };
    } catch (error) {
      console.error('Project creation error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    }
  },

  /**
   * Get all projects for current user
   */
  async getProjects(): Promise<{
    projects: Project[];
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        projects: data || [],
      };
    } catch (error) {
      return {
        projects: [],
        error: error as Error,
      };
    }
  },

  /**
   * Get single project by ID
   */
  async getProject(projectId: string): Promise<{
    project?: Project;
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      return {
        project: data,
      };
    } catch (error) {
      return {
        error: error as Error,
      };
    }
  },
};
```

### Step 4: Devices Service

```typescript
// frontend/src/services/devices-v2.service.ts

import { supabase } from '../lib/supabase';

interface Device {
  id: string;
  user_id: string;
  project_id: string;
  device_id_short: string;
  name: string;
  connection_status: string;
  last_seen_at: string | null;
  registered_at: string;
  device_hostname: string | null;
  api_key_hash: string;
}

interface AvailableDeviceId {
  device_id_short: string;
  is_available: boolean;
}

interface DatabaseError {
  code: string;
  message: string;
  details?: string;
}

const DEVICE_ERROR_MAP: Record<string, string> = {
  'unique_device_per_project': 'This device ID is already registered in this project.',
  'devices_api_key_hash_key': 'This API key is already in use.',
};

function translateDeviceError(error: DatabaseError): string {
  const constraintMatch = error.details?.match(/violates unique constraint "([^"]+)"/);
  const constraintName = constraintMatch ? constraintMatch[1] : '';

  if (constraintName in DEVICE_ERROR_MAP) {
    return DEVICE_ERROR_MAP[constraintName as keyof typeof DEVICE_ERROR_MAP];
  }

  if (error.code === '23505') {
    return 'This device configuration is already in use. Please choose a different ID.';
  }

  return error.message || 'An unexpected error occurred.';
}

export const devicesServiceV2 = {
  /**
   * Get available device IDs for a project
   * Returns ESP1 through ESP20, with availability status
   */
  async getAvailableDeviceIds(projectId: string): Promise<{
    devices: AvailableDeviceId[];
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase.rpc(
        'get_available_device_ids',
        { p_project_id: projectId }
      );

      if (error) throw error;

      return {
        devices: data || [],
      };
    } catch (error) {
      return {
        devices: [],
        error: error as Error,
      };
    }
  },

  /**
   * Create a new device in a project
   *
   * Constraints enforced:
   * - Each project can have at most one of each device ID (ESP1-ESP20)
   * - But PROJ1-ESP5 and PROJ2-ESP5 are different devices
   */
  async createDevice(
    projectId: string,
    deviceIdShort: string,
    name: string
  ): Promise<{
    success: boolean;
    device?: Device;
    error?: string;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        error: 'Not authenticated',
      };
    }

    // Validate device ID format
    if (!deviceIdShort.match(/^ESP\d{1,2}$/)) {
      return {
        success: false,
        error: 'Invalid device ID format. Use ESP1-ESP20.',
      };
    }

    if (!name?.trim()) {
      return {
        success: false,
        error: 'Device name is required',
      };
    }

    try {
      // Generate API key hash (simplified - in reality use crypto)
      const apiKeyHash = `hash_${projectId}_${deviceIdShort}_${Date.now()}`;

      // Insert device (project-scoped unique constraint will be checked)
      const { data, error } = await supabase
        .from('devices_v2')
        .insert({
          user_id: user.id,
          project_id: projectId,
          device_id_short: deviceIdShort,
          name: name.trim(),
          connection_status: 'offline',
          api_key_hash: apiKeyHash,
        })
        .select()
        .single();

      if (error) {
        const userMessage = translateDeviceError(error as DatabaseError);
        return {
          success: false,
          error: userMessage,
        };
      }

      return {
        success: true,
        device: data,
      };
    } catch (error) {
      console.error('Device creation error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred.',
      };
    }
  },

  /**
   * Get all devices in a project
   */
  async getProjectDevices(projectId: string): Promise<{
    devices: Device[];
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices_v2')
        .select('*')
        .eq('project_id', projectId)
        .order('registered_at', { ascending: false });

      if (error) throw error;

      return {
        devices: data || [],
      };
    } catch (error) {
      return {
        devices: [],
        error: error as Error,
      };
    }
  },

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string): Promise<{
    device?: Device;
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices_v2')
        .select('*')
        .eq('id', deviceId)
        .single();

      if (error) throw error;

      return {
        device: data,
      };
    } catch (error) {
      return {
        error: error as Error,
      };
    }
  },

  /**
   * Get device by composite ID (project_id + device_id_short)
   * Useful for devices identifying themselves via heartbeat
   */
  async getDeviceByCompositeId(projectId: string, deviceIdShort: string): Promise<{
    device?: Device;
    error?: Error;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices_v2')
        .select('*')
        .eq('project_id', projectId)
        .eq('device_id_short', deviceIdShort)
        .single();

      if (error) throw error;

      return {
        device: data,
      };
    } catch (error) {
      return {
        error: error as Error,
      };
    }
  },
};
```

### Step 5: React Components

#### CreateProjectModal

```typescript
// frontend/src/components/projects/CreateProjectModal.tsx

import { useState, useRef, useCallback } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { Toast } from '../common/Toast';
import { projectsService } from '../../services/projects.service';

export function CreateProjectModal() {
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Debounced name availability check
   */
  const handleNameChange = useCallback((value: string) => {
    setProjectName(value);

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (value.trim().length === 0) {
      setNameAvailable(null);
      return;
    }

    setIsChecking(true);
    checkTimeoutRef.current = setTimeout(async () => {
      const available = await projectsService.isNameAvailable(value);
      setNameAvailable(available);
      setIsChecking(false);
    }, 500);
  }, []);

  /**
   * Create project with error handling
   */
  const handleCreateProject = async () => {
    setIsLoading(true);

    const result = await projectsService.createProject(projectName);

    if (result.success && result.project) {
      setToast({
        type: 'success',
        message: `Project "${result.project.name}" created successfully!`,
      });
      setProjectName('');
      // TODO: Emit event or navigate to project
    } else {
      setToast({
        type: 'error',
        message: result.error || 'Failed to create project',
      });
    }

    setIsLoading(false);
  };

  const isSubmitDisabled =
    isLoading ||
    nameAvailable === false ||
    projectName.trim() === '' ||
    isChecking;

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Create New Project</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Project Name
        </label>
        <input
          type="text"
          placeholder="e.g., Main Greenhouse"
          value={projectName}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={isLoading}
          maxLength={255}
          className={`w-full px-4 py-2 border rounded-lg transition-colors ${
            nameAvailable === false
              ? 'border-red-500 bg-red-50'
              : nameAvailable === true
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 bg-white'
          }`}
        />

        {/* Status indicators */}
        <div className="mt-2 min-h-6">
          {isChecking && (
            <div className="flex items-center text-gray-500 text-sm">
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Checking availability...
            </div>
          )}
          {!isChecking && nameAvailable === false && (
            <div className="flex items-center text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              This project name is already taken
            </div>
          )}
          {!isChecking && nameAvailable === true && (
            <div className="flex items-center text-green-600 text-sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              Project name is available
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleCreateProject}
        disabled={isSubmitDisabled}
        className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
          isSubmitDisabled
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        }`}
      >
        {isLoading ? 'Creating Project...' : 'Create Project'}
      </button>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={5000}
        />
      )}
    </div>
  );
}
```

#### CreateDeviceModal

```typescript
// frontend/src/components/devices/CreateDeviceModal.tsx

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Toast } from '../common/Toast';
import { devicesServiceV2 } from '../../services/devices-v2.service';

interface CreateDeviceModalProps {
  projectId: string;
}

export function CreateDeviceModal({ projectId }: CreateDeviceModalProps) {
  const [deviceIdShort, setDeviceIdShort] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load available device IDs on mount
  useEffect(() => {
    loadAvailableDevices();
  }, [projectId]);

  async function loadAvailableDevices() {
    const result = await devicesServiceV2.getAvailableDeviceIds(projectId);
    setAvailableDevices(result.devices.filter(d => d.is_available));
  }

  async function handleCreateDevice() {
    if (!deviceIdShort || !deviceName.trim()) {
      setToast({
        type: 'error',
        message: 'Please select a device ID and enter a name',
      });
      return;
    }

    setIsLoading(true);

    const result = await devicesServiceV2.createDevice(
      projectId,
      deviceIdShort,
      deviceName
    );

    if (result.success && result.device) {
      setToast({
        type: 'success',
        message: `Device ${deviceIdShort} created successfully!`,
      });
      setDeviceIdShort('');
      setDeviceName('');
      await loadAvailableDevices();
    } else {
      setToast({
        type: 'error',
        message: result.error || 'Failed to create device',
      });
    }

    setIsLoading(false);
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Add Device to Project</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Device ID
        </label>
        <select
          value={deviceIdShort}
          onChange={(e) => setDeviceIdShort(e.target.value)}
          disabled={isLoading || availableDevices.length === 0}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select a device ID</option>
          {availableDevices.map((device) => (
            <option key={device.device_id_short} value={device.device_id_short}>
              {device.device_id_short}
            </option>
          ))}
        </select>
        {availableDevices.length === 0 && (
          <div className="flex items-center text-yellow-600 text-sm mt-2">
            <AlertCircle className="w-4 h-4 mr-2" />
            All device IDs are in use
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Device Name
        </label>
        <input
          type="text"
          placeholder="e.g., Temperature Sensor"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          disabled={isLoading}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <button
        onClick={handleCreateDevice}
        disabled={isLoading || !deviceIdShort || !deviceName.trim()}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {isLoading ? 'Creating...' : 'Create Device'}
      </button>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
```

---

## Testing Checklist

### Unit Tests: Constraint Enforcement

```sql
-- Run these tests in Supabase SQL Editor

-- Test 1: Project name global uniqueness
DO $$
BEGIN
  -- Insert first project
  INSERT INTO projects (user_id, name, project_id)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Main Greenhouse', 'PROJ1');

  -- Try to insert duplicate name (should fail)
  BEGIN
    INSERT INTO projects (user_id, name, project_id)
    VALUES ('00000000-0000-0000-0000-000000000002', 'Main Greenhouse', 'PROJ2');
    RAISE EXCEPTION 'Test FAILED: Duplicate name was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Test PASSED: Duplicate project name prevented';
  END;

  -- Cleanup
  DELETE FROM projects WHERE name = 'Main Greenhouse';
END;
$$;

-- Test 2: Project ID global uniqueness
DO $$
BEGIN
  INSERT INTO projects (user_id, name, project_id)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Greenhouse A', 'PROJ10');

  BEGIN
    INSERT INTO projects (user_id, name, project_id)
    VALUES ('00000000-0000-0000-0000-000000000002', 'Greenhouse B', 'PROJ10');
    RAISE EXCEPTION 'Test FAILED: Duplicate project ID was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Test PASSED: Duplicate project ID prevented';
  END;

  DELETE FROM projects WHERE project_id = 'PROJ10';
END;
$$;

-- Test 3: Device project-scoped uniqueness
DO $$
DECLARE
  proj_id_1 UUID;
  proj_id_2 UUID;
BEGIN
  -- Create two projects
  INSERT INTO projects (user_id, name, project_id)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Proj A', 'PROJ20')
  RETURNING id INTO proj_id_1;

  INSERT INTO projects (user_id, name, project_id)
  VALUES ('00000000-0000-0000-0000-000000000002', 'Proj B', 'PROJ21')
  RETURNING id INTO proj_id_2;

  -- Add ESP5 to PROJ20
  INSERT INTO devices_v2 (user_id, project_id, device_id_short, name, api_key_hash)
  VALUES ('00000000-0000-0000-0000-000000000001', proj_id_1, 'ESP5', 'Sensor 1', 'hash1');

  -- Add ESP5 to PROJ21 (different project, should work)
  INSERT INTO devices_v2 (user_id, project_id, device_id_short, name, api_key_hash)
  VALUES ('00000000-0000-0000-0000-000000000002', proj_id_2, 'ESP5', 'Sensor 2', 'hash2');

  RAISE NOTICE 'Test PASSED: Same device ID allowed in different projects';

  -- Try to add another ESP5 to PROJ20 (should fail)
  BEGIN
    INSERT INTO devices_v2 (user_id, project_id, device_id_short, name, api_key_hash)
    VALUES ('00000000-0000-0000-0000-000000000001', proj_id_1, 'ESP5', 'Sensor 3', 'hash3');
    RAISE EXCEPTION 'Test FAILED: Duplicate device in same project was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Test PASSED: Duplicate device in same project prevented';
  END;

  -- Cleanup
  DELETE FROM projects WHERE project_id IN ('PROJ20', 'PROJ21');
END;
$$;
```

### Integration Tests: TypeScript

```typescript
// frontend/src/__tests__/projects.service.test.ts

import { projectsService } from '../services/projects.service';
import { supabase } from '../lib/supabase';

describe('projectsService', () => {
  describe('createProject', () => {
    it('should create a project with unique name', async () => {
      const result = await projectsService.createProject(`Test Project ${Date.now()}`);

      expect(result.success).toBe(true);
      expect(result.project?.name).toBeDefined();
      expect(result.project?.project_id).toMatch(/^PROJ\d+$/);
    });

    it('should reject duplicate project name', async () => {
      const name = `Duplicate Test ${Date.now()}`;

      // Create first project
      const result1 = await projectsService.createProject(name);
      expect(result1.success).toBe(true);

      // Try to create duplicate
      const result2 = await projectsService.createProject(name);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already exists');

      // Cleanup
      if (result1.project?.id) {
        await supabase.from('projects').delete().eq('id', result1.project.id);
      }
    });

    it('should generate sequential project IDs', async () => {
      const result1 = await projectsService.createProject(`Project A ${Date.now()}`);
      const result2 = await projectsService.createProject(`Project B ${Date.now()}`);

      expect(result1.project?.project_id).toBeDefined();
      expect(result2.project?.project_id).toBeDefined();

      const id1 = parseInt(result1.project!.project_id.slice(4));
      const id2 = parseInt(result2.project!.project_id.slice(4));
      expect(id2).toBeGreaterThan(id1);

      // Cleanup
      if (result1.project?.id) {
        await supabase.from('projects').delete().eq('id', result1.project.id);
      }
      if (result2.project?.id) {
        await supabase.from('projects').delete().eq('id', result2.project.id);
      }
    });
  });

  describe('isNameAvailable', () => {
    it('should return true for available names', async () => {
      const result = await projectsService.isNameAvailable(`Available ${Date.now()}`);
      expect(result).toBe(true);
    });

    it('should return false for taken names', async () => {
      const name = `Taken ${Date.now()}`;
      await projectsService.createProject(name);

      const result = await projectsService.isNameAvailable(name);
      expect(result).toBe(false);

      // Cleanup
      const { data } = await supabase.from('projects').select('id').eq('name', name);
      if (data && data[0]) {
        await supabase.from('projects').delete().eq('id', data[0].id);
      }
    });
  });
});
```

---

## Migration Guide (If Updating Existing Devices Table)

If you already have a `devices` table without project scoping:

```sql
-- Step 1: Add project-related columns to existing table
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS project_id UUID,
ADD COLUMN IF NOT EXISTS device_id_short TEXT;

-- Step 2: Update RLS policies to include project checks
CREATE POLICY "Updated RLS policy"
  ON public.devices FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Step 3: Add constraint for project-scoped uniqueness
ALTER TABLE public.devices
ADD CONSTRAINT unique_device_per_project UNIQUE (project_id, device_id_short);

-- Step 4: Re-create indexes
REINDEX INDEX idx_devices_project_id;
REINDEX INDEX idx_devices_full_id;
```

---

## Performance Tuning

Monitor these queries to ensure good performance:

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('projects', 'devices_v2')
ORDER BY idx_scan DESC;

-- Identify missing indexes
SELECT
  schemaname,
  tablename,
  attname,
  null_frac,
  n_distinct,
  correlation
FROM pg_stats
WHERE tablename IN ('projects', 'devices_v2')
AND correlation < 0 -- Negatively correlated = good for indexes
ORDER BY tablename, correlation;

-- Check table bloat
SELECT
  current_database(),
  schemaname,
  tablename,
  ROUND(100 * (CASE WHEN otta > 0 THEN sml_heap_size::numeric / otta ELSE 0 END)) AS table_bloat_ratio
FROM pg_bloat_check
WHERE tablename IN ('projects', 'devices_v2');
```

---

## Debugging

### Common Issues

**Issue**: "duplicate key value violates unique constraint 'projects_name_key'"
- **Cause**: Project name already exists globally
- **Solution**: Check available names with `projectsService.isNameAvailable()` or use different name

**Issue**: "no unique or exclusion constraint matching the ON CONFLICT specification"
- **Cause**: Using ON CONFLICT without explicit constraint name
- **Solution**: Use exact constraint name: `ON CONFLICT (name) DO ...`

**Issue**: Device shows as "offline" after creation
- **Cause**: Device hasn't sent heartbeat yet
- **Solution**: Ensure ESP sends heartbeat with correct project_id + device_id_short format

---

## Summary

Implement in this order:

1. Create projects table with global UNIQUE constraints
2. Update/create devices table with project-scoped UNIQUE constraint
3. Implement projects.service.ts with error translation
4. Implement devices-v2.service.ts
5. Build React components
6. Run SQL tests to verify constraints
7. Run TypeScript integration tests
8. Monitor performance metrics

---

**Last Updated**: 2025-11-12
