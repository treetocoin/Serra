# Frontend Implementation Guide: Device ID Migration

**Feature**: 004-tutto-troppo-complicato - Project-Scoped Device IDs
**Status**: Ready for Development
**Compatibility**: React 18+ with TypeScript 5+

---

## Overview

This guide covers the frontend changes needed to support the new project-scoped device ID system (`PROJ1-ESP5` format) while maintaining backward compatibility with existing UUID-based devices.

**Key Changes**:
- Old system: Devices identified by UUID (unique, hard to remember)
- New system: Devices identified by composite ID (PROJ1-ESP5, human-readable)
- Migration period: Both systems work in parallel (Phase 2-3)
- Deprecation: UUID system removed after Phase 4

---

## Phase 1-2: Add Project Support (No Breaking Changes)

### Step 1: Update Type Definitions

```typescript
// frontend/src/lib/supabase.ts
// Update database types to include new columns

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string; // UUID
          user_id: string; // UUID
          name: string;
          project_id: string; // PROJ1, PROJ2, etc.
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string;
          // id, user_id, project_id auto-generated
        };
        Update: {
          name?: string;
          description?: string;
        };
      };
      devices: {
        Row: {
          id: string; // UUID (keep for backward compatibility)
          user_id: string;
          name: string;

          // NEW: Project relationship
          project_id: string | null; // UUID of projects table
          composite_device_id: string | null; // PROJ1-ESP5 format
          device_number: number | null; // 1-20

          // Existing columns
          connection_status: 'online' | 'offline' | 'error' | 'connection_failed';
          last_seen_at: string | null;
          registered_at: string;
          device_key_hash: string;
          firmware_version: string | null;

          // Existing columns (being deprecated)
          api_key_hash?: string; // Phase 4: remove
        };
        Insert: {
          name: string;
          user_id: string;
          project_id?: string; // NEW
          device_number?: number; // NEW
          composite_device_id?: string; // NEW
          connection_status?: string;
        };
        Update: {
          name?: string;
          connection_status?: string;
          last_seen_at?: string;
          composite_device_id?: string;
        };
      };
    };
  };
};
```

### Step 2: Create Projects Service

```typescript
// frontend/src/services/projects.service.ts

import { supabase, type Database } from '../lib/supabase';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface CreateProjectResponse {
  project: Project;
  error: Error | null;
}

export const projectsService = {
  /**
   * Create new project with auto-generated ID
   * Calls create_project() RPC function
   */
  async createProject(
    request: CreateProjectRequest
  ): Promise<CreateProjectResponse> {
    try {
      const { data, error } = await supabase.rpc('create_project', {
        name_param: request.name,
        description_param: request.description || null,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Project creation returned no data');
      }

      return {
        project: data[0] as Project,
        error: null,
      };
    } catch (error) {
      return {
        project: null as any,
        error: error as Error,
      };
    }
  },

  /**
   * Get all projects for current user
   */
  async getProjects(): Promise<{
    projects: Project[];
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        projects: data || [],
        error: null,
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
    project: Project | null;
    error: Error | null;
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
        error: null,
      };
    } catch (error) {
      return {
        project: null,
        error: error as Error,
      };
    }
  },

  /**
   * Get available device IDs for a project
   * Calls get_available_device_ids() RPC function
   */
  async getAvailableDeviceIds(projectId: string): Promise<{
    available: Array<{
      device_number: number;
      device_id: string; // PROJ1-ESP1, PROJ1-ESP2, etc.
      is_available: boolean;
    }>;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase.rpc(
        'get_available_device_ids',
        {
          project_id_param: projectId,
        }
      );

      if (error) throw error;

      return {
        available: data || [],
        error: null,
      };
    } catch (error) {
      return {
        available: [],
        error: error as Error,
      };
    }
  },

  /**
   * Delete project (with confirmation)
   */
  async deleteProject(projectId: string): Promise<{
    error: Error | null;
  }> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
```

### Step 3: Update Device Service

```typescript
// frontend/src/services/devices.service.ts
// (additions to existing service)

export interface RegisterDeviceInProjectRequest {
  projectId: string; // UUID of project (from projects table)
  deviceNumber: number; // 1-20
  name: string;
}

export interface RegisterDeviceInProjectResponse {
  device: {
    id: string;
    name: string;
    compositeDeviceId: string; // PROJ1-ESP5
    projectId: string;
    deviceNumber: number;
    registeredAt: string;
  };
  error: Error | null;
}

export const devicesService = {
  // ... existing functions ...

  /**
   * Register device in NEW system (project-scoped)
   * Uses composite ID format: PROJ1-ESP5
   */
  async registerDeviceInProject(
    request: RegisterDeviceInProjectRequest
  ): Promise<RegisterDeviceInProjectResponse> {
    try {
      // Call register_device_with_project() RPC function
      const { data, error } = await supabase.rpc(
        'register_device_with_project',
        {
          name_param: request.name,
          project_id_param: request.projectId,
          device_number_param: request.deviceNumber,
        }
      );

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Device registration returned no data');
      }

      const device = data[0];

      return {
        device: {
          id: device.id,
          name: device.name,
          compositeDeviceId: device.composite_device_id,
          projectId: device.project_id,
          deviceNumber: device.device_number,
          registeredAt: device.registered_at,
        },
        error: null,
      };
    } catch (error) {
      return {
        device: null as any,
        error: error as Error,
      };
    }
  },

  /**
   * Get device by composite ID (new system) OR UUID (old system)
   * Handles both formats transparently
   */
  async getDeviceByAnyId(
    deviceId: string
  ): Promise<{ device: Device | null; error: Error | null }> {
    try {
      // Detect format
      const isCompositeId = /^PROJ\d+-ESP\d+$/.test(deviceId);

      if (isCompositeId) {
        // New format: lookup by composite_device_id
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('composite_device_id', deviceId)
          .single();

        if (error) throw error;
        return { device: data, error: null };
      } else {
        // Old format: lookup by UUID
        const { data, error } = await supabase
          .from('devices')
          .select('*')
          .eq('id', deviceId)
          .single();

        if (error) throw error;
        return { device: data, error: null };
      }
    } catch (error) {
      return { device: null, error: error as Error };
    }
  },

  /**
   * Get devices for a project (NEW SYSTEM)
   */
  async getDevicesInProject(projectId: string): Promise<{
    devices: Device[];
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('project_id', projectId)
        .order('device_number', { ascending: true });

      if (error) throw error;

      return {
        devices: data || [],
        error: null,
      };
    } catch (error) {
      return {
        devices: [],
        error: error as Error,
      };
    }
  },
};
```

---

## Phase 2: Create UI Components

### Component 1: Projects List

```tsx
// frontend/src/components/projects/ProjectsList.tsx

import { useState, useEffect } from 'react';
import { projectsService } from '@/services/projects.service';
import type { Database } from '@/lib/supabase';

type Project = Database['public']['Tables']['projects']['Row'];

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    const { projects: data, error: err } = await projectsService.getProjects();

    if (err) {
      setError(err.message);
    } else {
      setProjects(data);
    }
    setIsLoading(false);
  };

  if (isLoading) return <div>Loading projects...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="projects-list">
      <h1>Your Greenhouses</h1>

      {projects.length === 0 ? (
        <p>No projects yet. Create your first greenhouse to get started.</p>
      ) : (
        <div className="grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectButton onCreated={() => loadProjects()} />
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
}

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="card">
      <h2>{project.name}</h2>
      <p className="project-id">ID: {project.project_id}</p>
      {project.description && <p className="description">{project.description}</p>}
      <div className="actions">
        <button>View Devices</button>
        <button>Settings</button>
      </div>
    </div>
  );
}

interface CreateProjectButtonProps {
  onCreated: () => void;
}

function CreateProjectButton({ onCreated }: CreateProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { project, error: err } = await projectsService.createProject({
      name,
      description,
    });

    if (err) {
      setError(err.message);
    } else {
      setName('');
      setDescription('');
      setIsOpen(false);
      onCreated();
    }

    setIsLoading(false);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)}>New Greenhouse</button>

      {isOpen && (
        <div className="modal">
          <form onSubmit={handleSubmit}>
            <h2>Create New Greenhouse</h2>

            <input
              type="text"
              placeholder="Greenhouse name (e.g., Main Greenhouse)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              disabled={isLoading}
            />

            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              disabled={isLoading}
              rows={3}
            />

            {error && <p className="error">{error}</p>}

            <div className="actions">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>

            <p className="info">
              Your greenhouse will be assigned an automatic ID (e.g., PROJ1) that you'll
              use when configuring ESP devices.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
```

### Component 2: Device Registration (New System)

```tsx
// frontend/src/components/devices/DeviceRegisterWithProject.tsx

import { useState, useEffect } from 'react';
import { devicesService } from '@/services/devices.service';
import { projectsService } from '@/services/projects.service';
import type { Database } from '@/lib/supabase';

type Project = Database['public']['Tables']['projects']['Row'];

interface DeviceRegisterWithProjectProps {
  projectId: string;
  onDeviceCreated: (deviceId: string) => void;
  onClose: () => void;
}

export function DeviceRegisterWithProject({
  projectId,
  onDeviceCreated,
  onClose,
}: DeviceRegisterWithProjectProps) {
  const [deviceName, setDeviceName] = useState('');
  const [selectedDeviceNumber, setSelectedDeviceNumber] = useState<number | null>(null);
  const [availableDevices, setAvailableDevices] = useState<
    Array<{
      device_number: number;
      device_id: string;
      is_available: boolean;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    // Load project info
    const { project: projectData, error: projectErr } =
      await projectsService.getProject(projectId);
    if (projectErr) {
      setError(projectErr.message);
      setIsLoading(false);
      return;
    }
    setProject(projectData);

    // Load available device IDs
    const { available, error: availErr } =
      await projectsService.getAvailableDeviceIds(projectId);
    if (availErr) {
      setError(availErr.message);
    } else {
      setAvailableDevices(available);
    }

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDeviceNumber) {
      setError('Please select a device number');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { device, error: err } = await devicesService.registerDeviceInProject({
      projectId,
      deviceNumber: selectedDeviceNumber,
      name: deviceName,
    });

    if (err) {
      setError(err.message);
      setIsLoading(false);
    } else {
      onDeviceCreated(device.id);
      onClose();
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!project) return <div className="error">Project not found</div>;

  const availableNumbers = availableDevices
    .filter((d) => d.is_available)
    .map((d) => d.device_number);

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h2>Register New Device</h2>
        <p>Project: {project.project_id} - {project.name}</p>

        <label>
          Device Name
          <input
            type="text"
            placeholder="e.g., Main Temperature Sensor"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            required
            maxLength={100}
            disabled={isLoading}
          />
        </label>

        <label>
          Device ID
          <select
            value={selectedDeviceNumber || ''}
            onChange={(e) => setSelectedDeviceNumber(Number(e.target.value))}
            required
            disabled={isLoading}
          >
            <option value="">Select Device ID...</option>
            {availableNumbers.map((num) => (
              <option key={num} value={num}>
                ESP{num} - ({project.project_id}-ESP{num})
              </option>
            ))}
          </select>
        </label>

        {availableNumbers.length === 0 && (
          <p className="warning">All device IDs in this project are in use. Maximum 20 devices per project.</p>
        )}

        {error && <p className="error">{error}</p>}

        <div className="actions">
          <button type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" disabled={isLoading || !selectedDeviceNumber}>
            {isLoading ? 'Registering...' : 'Register Device'}
          </button>
        </div>

        <p className="info">
          After registration, you'll configure the physical ESP device via its WiFi
          access point. The ESP will use the device ID shown above.
        </p>
      </form>
    </div>
  );
}
```

### Component 3: Devices List with Project Context

```tsx
// frontend/src/components/devices/ProjectDevicesList.tsx

import { useState, useEffect } from 'react';
import { devicesService } from '@/services/devices.service';
import type { Database } from '@/lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];

interface ProjectDevicesListProps {
  projectId: string;
}

export function ProjectDevicesList({ projectId }: ProjectDevicesListProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, [projectId]);

  const loadDevices = async () => {
    setIsLoading(true);
    const { devices: data, error: err } = await devicesService.getDevicesInProject(
      projectId
    );

    if (err) {
      setError(err.message);
    } else {
      setDevices(data);
    }
    setIsLoading(false);
  };

  if (isLoading) return <div>Loading devices...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="devices-list">
      <h2>Devices</h2>

      {devices.length === 0 ? (
        <p>No devices in this project yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td className="device-id">
                  {device.composite_device_id || device.id}
                </td>
                <td>{device.name}</td>
                <td className={`status ${device.connection_status}`}>
                  {device.connection_status}
                </td>
                <td>
                  {device.last_seen_at
                    ? new Date(device.last_seen_at).toLocaleString()
                    : 'Never'}
                </td>
                <td>
                  <button>View</button>
                  <button>Settings</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## Phase 3: Device Configuration Portal (ESP Side)

### HTML Form for ESP Configuration Portal

```html
<!-- Configuration form served by ESP device at 192.168.4.1/index.html -->
<!-- During project-scoped setup, user enters project ID manually -->

<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Serra Device Configuration</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .form-group { margin: 20px 0; }
    input, select { width: 100%; padding: 10px; font-size: 16px; }
    button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
    .info { color: #666; font-size: 14px; margin-top: 5px; }
    .error { color: red; }
    .success { color: green; }
  </style>
</head>
<body>
  <h1>Device Configuration</h1>
  <p>Connect to your home WiFi network and set your device ID</p>

  <form id="configForm">
    <div class="form-group">
      <label for="projectId">Project ID</label>
      <input
        type="text"
        id="projectId"
        name="projectId"
        placeholder="e.g., PROJ1 or proj1"
        required
        maxlength="10"
      >
      <p class="info">Enter the project ID assigned when registering in the webapp (case-insensitive, will be converted to uppercase)</p>
    </div>

    <div class="form-group">
      <label for="deviceNumber">Device Number</label>
      <select id="deviceNumber" name="deviceNumber" required>
        <option value="">Select Device...</option>
        <option value="1">ESP1</option>
        <option value="2">ESP2</option>
        <option value="3">ESP3</option>
        <!-- ... up to 20 ... -->
        <option value="20">ESP20</option>
      </select>
      <p class="info">Select the device number (ESP1-ESP20) that matches your webapp registration</p>
    </div>

    <div class="form-group">
      <label for="ssid">WiFi Network (SSID)</label>
      <input
        type="text"
        id="ssid"
        name="ssid"
        placeholder="Your home WiFi name"
        required
      >
    </div>

    <div class="form-group">
      <label for="password">WiFi Password</label>
      <input
        type="password"
        id="password"
        name="password"
        placeholder="Your home WiFi password"
        required
      >
    </div>

    <div id="message" class="info"></div>

    <button type="submit">Configure Device</button>
  </form>

  <script>
    const form = document.getElementById('configForm');
    const message = document.getElementById('message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const projectId = document.getElementById('projectId').value
        .toUpperCase() // Normalize to uppercase
        .trim();
      const deviceNumber = document.getElementById('deviceNumber').value;
      const ssid = document.getElementById('ssid').value;
      const password = document.getElementById('password').value;

      // Build composite device ID
      const compositeDeviceId = `${projectId}-ESP${deviceNumber}`;

      message.textContent = 'Saving configuration...';
      message.className = 'info';

      try {
        // POST to ESP /configure endpoint
        const response = await fetch('/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            device_number: deviceNumber,
            composite_device_id: compositeDeviceId,
            ssid,
            password,
          }),
        });

        if (!response.ok) {
          throw new Error(`Configuration failed: ${response.statusText}`);
        }

        const data = await response.json();

        message.textContent = `Device configured as ${compositeDeviceId}. Connecting to WiFi...`;
        message.className = 'success';

        // ESP will restart and connect to WiFi
        setTimeout(() => {
          message.textContent = 'Device restarting. You can close this page.';
        }, 2000);
      } catch (error) {
        message.textContent = `Error: ${error.message}`;
        message.className = 'error';
      }
    });
  </script>
</body>
</html>
```

---

## Phase 4: Backward Compatibility Utilities

### Device Identifier Utility

```typescript
// frontend/src/lib/device-identifier.ts

/**
 * Utility for handling both UUID and composite device IDs
 * Provides transparent support for migration from old to new system
 */

export class DeviceIdentifier {
  /**
   * Detect if identifier is composite format (PROJ1-ESP5)
   */
  static isCompositeId(id: string): boolean {
    return /^PROJ\d+-ESP\d+$/.test(id);
  }

  /**
   * Detect if identifier is UUID format
   */
  static isUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Format device ID for display
   * Shows composite ID if available, falls back to UUID
   */
  static format(device: { composite_device_id?: string | null; id: string }): string {
    return device.composite_device_id || device.id;
  }

  /**
   * Format device for breadcrumbs/navigation
   */
  static formatWithProject(device: {
    composite_device_id?: string | null;
    id: string;
    name: string;
  }): string {
    const id = this.format(device);
    return `${id} - ${device.name}`;
  }

  /**
   * Parse composite ID to get project and device number
   * Returns null if not composite format
   */
  static parseCompositeId(
    id: string
  ): { projectId: string; deviceNumber: number } | null {
    const match = /^(PROJ\d+)-ESP(\d+)$/.exec(id);
    if (!match) return null;

    return {
      projectId: match[1],
      deviceNumber: parseInt(match[2], 10),
    };
  }
}

// Usage examples:
//
// const device = { id: 'uuid-123', composite_device_id: 'PROJ1-ESP5', name: 'Temp Sensor' };
//
// DeviceIdentifier.format(device) // → 'PROJ1-ESP5'
// DeviceIdentifier.formatWithProject(device) // → 'PROJ1-ESP5 - Temp Sensor'
// DeviceIdentifier.parseCompositeId('PROJ1-ESP5') // → { projectId: 'PROJ1', deviceNumber: 5 }
```

### Device Query Helper

```typescript
// frontend/src/lib/device-queries.ts

import { supabase, type Database } from './supabase';

type Device = Database['public']['Tables']['devices']['Row'];

/**
 * Query helper that handles both UUID and composite device IDs
 * Automatically detects format and queries appropriate column
 */
export async function queryDeviceByAnyId(deviceId: string): Promise<Device | null> {
  if (deviceId.includes('-') && /^PROJ/.test(deviceId)) {
    // Composite ID format: PROJ1-ESP5
    const { data } = await supabase
      .from('devices')
      .select('*')
      .eq('composite_device_id', deviceId)
      .single();
    return data;
  } else {
    // UUID format
    const { data } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .single();
    return data;
  }
}

/**
 * Realtime subscription that handles both formats
 */
export function subscribeToDevice(
  deviceId: string,
  callback: (device: Device) => void
) {
  const column = deviceId.includes('-') ? 'composite_device_id' : 'id';

  return supabase
    .from('devices')
    .on('*', { event: '*', schema: 'public' }, (payload) => {
      if (payload.new && (payload.new as any)[column] === deviceId) {
        callback(payload.new as Device);
      }
    })
    .subscribe();
}
```

---

## Testing Checklist

### Frontend Testing (Phase 2)

- [ ] Create project with auto-generated ID (test create_project RPC)
- [ ] View project list (verify all user projects shown)
- [ ] Get available device IDs (verify ESP1-20 dropdown)
- [ ] Register device in project (test register_device_with_project RPC)
- [ ] View devices in project (verify devices_in_project query)
- [ ] Device ID format displays correctly (PROJ1-ESP5)

### Component Testing (Phase 2)

- [ ] ProjectsList renders correctly
- [ ] CreateProjectButton opens modal and submits
- [ ] DeviceRegisterWithProject filters available IDs
- [ ] ProjectDevicesList shows devices with composite IDs
- [ ] Error handling shows user-friendly messages

### Integration Testing (Phase 3)

- [ ] ESP device configuration form works
- [ ] Project ID is normalized to uppercase
- [ ] Device number is correctly saved
- [ ] ESP sends heartbeat with composite_device_id
- [ ] Frontend receives heartbeat and updates status to "online"
- [ ] Backward compatibility: old UUID devices still work

### Migration Testing (Phase 3-4)

- [ ] Old UUID-based devices continue working during migration
- [ ] New composite ID devices work immediately
- [ ] Device queries work with either format
- [ ] RLS policies allow access to both old and new devices
- [ ] Heartbeat function accepts both formats

---

## Migration Deployment Steps

### Deploy Phase 2 (Functions Ready)

1. Deploy new SQL functions (Phase 2 migrations)
2. Deploy updated Supabase type definitions
3. Deploy projects service and components
4. **Test**: Create projects, register devices, view in UI
5. Verify no errors in browser console or network tab

### Deploy Phase 3 (Data Migration)

1. Execute Phase 3.0 pre-migration checks
2. Schedule maintenance window (30 minutes)
3. Deploy updated Edge Function (supports both formats)
4. Execute Phase 3.1 migration script
5. Verify Phase 3.0 post-migration checks
6. Deploy frontend updates (composite ID support)

### Deploy Phase 4 (Cleanup)

1. Verify no code still uses api_key columns (7 days after Phase 3)
2. Execute Phase 4.0 removal script
3. Update type definitions to remove api_key fields

---

## Common Patterns

### Pattern 1: Migrating Device Lookup

```typescript
// OLD (Phase 1-2)
const device = await devicesService.getDevice(deviceUUID);

// NEW (Phase 3+)
// Method 1: If you know the format
const device = deviceId.includes('-')
  ? await devicesService.getDeviceByCompositeId(deviceId)
  : await devicesService.getDevice(deviceId);

// Method 2: Let the service figure it out (recommended)
const device = await devicesService.getDeviceByAnyId(deviceId);
```

### Pattern 2: Displaying Device ID

```typescript
// OLD
<span>{device.id}</span> {/* Shows: 550e8400-e29b-41d4-a716-446655440000 */}

// NEW
<span>{DeviceIdentifier.format(device)}</span> {/* Shows: PROJ1-ESP5 or UUID if not migrated */}
```

### Pattern 3: Project-Scoped Operations

```typescript
// OLD: Get all user devices
const devices = await devicesService.getDevices(userId);

// NEW: Get devices in specific project
const devices = await devicesService.getDevicesInProject(projectId);
```

---

## Troubleshooting

### Issue: "Project not found" when registering device

**Cause**: User is trying to register device in project they don't own

**Solution**: Verify project ID belongs to current user
```typescript
const { project } = await projectsService.getProject(projectId);
if (!project) {
  console.error('Project not found or not owned by user');
}
```

### Issue: Device numbers showing as unavailable incorrectly

**Cause**: get_available_device_ids RPC is checking wrong project

**Solution**: Verify projectId is passed correctly
```typescript
const { available } = await projectsService.getAvailableDeviceIds(projectId);
```

### Issue: Device status not updating after heartbeat

**Cause**: Heartbeat using old UUID format, new system uses composite ID

**Solution**: Update Edge Function to accept both formats (see MIGRATION_SCRIPTS.md)

---

## Next Steps

1. Review MIGRATION_STRATEGY.md for complete context
2. Review MIGRATION_SCRIPTS.md for SQL migration order
3. Read this guide for UI/UX implementation
4. Start with Phase 1 database schema deployment
5. Follow Phase 2 with frontend components
6. Execute Phase 3 migration during maintenance window
7. Complete Phase 4 cleanup after 7 days

