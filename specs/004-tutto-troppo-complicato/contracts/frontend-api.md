# Frontend API Contract

**Feature**: 004-tutto-troppo-complicato
**Date**: 2025-11-12
**Version**: 1.0.0

## Overview

This document defines the TypeScript API interfaces for the Serra frontend to interact with Supabase RPC functions and tables for project and device management.

---

## Type Definitions

### Core Types

```typescript
// Project entity
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

// Device entity
export interface Device {
  id: string;                    // UUID (legacy)
  composite_device_id: string;   // "PROJ1-ESP5"
  project_id: string;            // "PROJ1"
  device_number: number;         // 1-20
  name: string;                  // User-provided name
  device_key: string;            // 64 hex chars (only returned on creation)
  device_key_hash: string;       // SHA-256 hash
  user_id: string;               // Owner UUID
  status: 'waiting' | 'online' | 'offline';
  last_seen_at: string | null;   // ISO 8601 timestamp
  rssi: number | null;           // WiFi signal strength
  ip_address: string | null;     // Device IP
  fw_version: string | null;     // Firmware version
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}

// Available device ID
export interface AvailableDeviceId {
  device_id: string;             // "ESP5"
  device_number: number;         // 5
}

// Device heartbeat
export interface DeviceHeartbeat {
  id: string;                    // Bigint as string
  device_id: string;             // Device UUID
  composite_device_id: string;   // "PROJ1-ESP5"
  rssi: number | null;
  ip_address: string | null;
  fw_version: string | null;
  ts: string;                    // ISO 8601 timestamp
}
```

---

## Projects Service

### `projectsService.ts`

```typescript
import { supabase } from '@/lib/supabase';
import type { Project } from '@/types/project.types';

export const projectsService = {
  /**
   * Get all projects for the authenticated user
   */
  async getProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new project
   */
  async createProject(
    name: string,
    description?: string
  ): Promise<{ project_id: string; id: string; created_at: string }> {
    const { data, error } = await supabase.rpc('create_project', {
      p_name: name,
      p_description: description || null
    });

    if (error) {
      // Handle unique constraint violation
      if (error.message.includes('already exists')) {
        throw new Error(`Project name "${name}" is already taken. Please choose a different name.`);
      }
      throw error;
    }

    return data[0];
  },

  /**
   * Update project details
   */
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
        throw new Error(`Project name "${updates.name}" is already taken. Please choose a different name.`);
      }
      throw error;
    }

    return data;
  },

  /**
   * Delete a project and all its devices
   */
  async deleteProject(projectId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_project', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Check if user has only one project (for deletion warning)
   */
  async hasOnlyOneProject(): Promise<boolean> {
    const { data, error } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;
    return (data?.length ?? 0) === 1;
  }
};
```

---

## Devices Service (Updated)

### `devicesService.ts`

```typescript
import { supabase } from '@/lib/supabase';
import type { Device, AvailableDeviceId } from '@/types/device.types';

export const devicesService = {
  /**
   * Get all devices for a project
   */
  async getProjectDevices(projectId: string): Promise<Device[]> {
    const { data, error } = await supabase.rpc('get_project_devices', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Get available device IDs for a project (ESP1-ESP20)
   */
  async getAvailableDeviceIds(projectId: string): Promise<AvailableDeviceId[]> {
    const { data, error } = await supabase.rpc('get_available_device_ids', {
      p_project_id: projectId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Register a new device in a project
   */
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
      // Handle unique constraint violation
      if (error.message.includes('already registered')) {
        throw new Error(`Device ESP${deviceNumber} is already registered in this project.`);
      }
      throw error;
    }

    return data[0];
  },

  /**
   * Get a single device by composite ID
   */
  async getDevice(compositeDeviceId: string): Promise<Device> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('composite_device_id', compositeDeviceId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update device details
   */
  async updateDevice(
    compositeDeviceId: string,
    updates: { name?: string }
  ): Promise<Device> {
    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('composite_device_id', compositeDeviceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a device
   */
  async deleteDevice(compositeDeviceId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('delete_device', {
      p_composite_device_id: compositeDeviceId
    });

    if (error) throw error;
    return data;
  },

  /**
   * Get recent heartbeats for a device
   */
  async getDeviceHeartbeats(
    compositeDeviceId: string,
    limit: number = 100
  ): Promise<DeviceHeartbeat[]> {
    const { data, error } = await supabase
      .from('device_heartbeats')
      .select('*')
      .eq('composite_device_id', compositeDeviceId)
      .order('ts', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Get connection status based on last_seen_at
   * (Client-side computation for UI feedback)
   */
  getConnectionStatus(lastSeenAt: string | null): 'online' | 'offline' | 'never' {
    if (!lastSeenAt) return 'never';

    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    // 2 minutes = 120 seconds (matches backend offline detection)
    return diffSeconds < 120 ? 'online' : 'offline';
  }
};
```

---

## React Query Hooks

### `useProjects.ts`

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

### `useProjectDevices.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesService } from '@/services/devices.service';

export const useProjectDevices = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId, 'devices'],
    queryFn: () => devicesService.getProjectDevices(projectId),
    staleTime: 20000, // 20 seconds
    refetchInterval: 30000, // Poll every 30s for status updates
    enabled: !!projectId,
  });
};

export const useAvailableDeviceIds = (projectId: string) => {
  return useQuery({
    queryKey: ['projects', projectId, 'available-device-ids'],
    queryFn: () => devicesService.getAvailableDeviceIds(projectId),
    staleTime: 10000, // 10 seconds
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
      const projectId = compositeDeviceId.split('-')[0]; // Extract "PROJ1" from "PROJ1-ESP5"
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'devices'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'available-device-ids'] });
    },
  });
};
```

---

## Error Handling

### Standard Error Response

```typescript
interface ApiError {
  message: string;
  code?: string;
  details?: string;
}

// Example usage in component
try {
  await projectsService.createProject(name);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('already taken')) {
      // Show user-friendly error
      toast.error('Project name is already taken. Please choose a different name.');
    } else {
      // Generic error
      toast.error('Failed to create project. Please try again.');
      console.error(error);
    }
  }
}
```

### Specific Error Cases

| Operation | Error Condition | User Message |
|-----------|----------------|--------------|
| Create Project | Duplicate name | "Project name is already taken. Please choose a different name." |
| Create Project | Sequence overflow | "Maximum project limit reached. Please contact support." |
| Register Device | Device number already used | "Device ESP5 is already registered in this project." |
| Register Device | Invalid device number | "Device number must be between 1 and 20." |
| Delete Project | Last project warning | "This is your last project. Deleting it will remove all devices. Continue?" |
| Delete Device | Device not found | "Device not found or you don't have permission to delete it." |

---

## Usage Examples

### Create a Project

```typescript
import { useCreateProject } from '@/lib/hooks/useProjects';
import { toast } from 'sonner';

function CreateProjectButton() {
  const { mutate: createProject, isPending } = useCreateProject();

  const handleCreate = () => {
    createProject(
      { name: 'My Greenhouse', description: 'Main production greenhouse' },
      {
        onSuccess: (data) => {
          toast.success(`Project ${data.project_id} created successfully!`);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <button onClick={handleCreate} disabled={isPending}>
      {isPending ? 'Creating...' : 'Create Project'}
    </button>
  );
}
```

### Register a Device

```typescript
import { useRegisterDevice, useAvailableDeviceIds } from '@/lib/hooks/useProjectDevices';
import { toast } from 'sonner';

function RegisterDeviceForm({ projectId }: { projectId: string }) {
  const { data: availableIds } = useAvailableDeviceIds(projectId);
  const { mutate: registerDevice, isPending } = useRegisterDevice();
  const [deviceNumber, setDeviceNumber] = useState<number>(1);
  const [deviceName, setDeviceName] = useState('');

  const handleRegister = () => {
    registerDevice(
      { name: deviceName, projectId, deviceNumber },
      {
        onSuccess: (data) => {
          toast.success(`Device ${data.composite_device_id} registered successfully!`);
          // Show device_key to user for ESP configuration
          console.log('Device Key:', data.device_key);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
      <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
      <select value={deviceNumber} onChange={(e) => setDeviceNumber(Number(e.target.value))}>
        {availableIds?.map((id) => (
          <option key={id.device_number} value={id.device_number}>
            {id.device_id}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isPending || !availableIds?.length}>
        Register Device
      </button>
    </form>
  );
}
```

### Delete Project with Warning

```typescript
import { useDeleteProject } from '@/lib/hooks/useProjects';
import { projectsService } from '@/services/projects.service';

function DeleteProjectButton({ projectId }: { projectId: string }) {
  const { mutate: deleteProject } = useDeleteProject();

  const handleDelete = async () => {
    // Check if this is the last project
    const isLastProject = await projectsService.hasOnlyOneProject();

    const message = isLastProject
      ? 'This is your last project. Deleting it will remove all devices. Continue?'
      : 'Are you sure you want to delete this project and all its devices?';

    if (window.confirm(message)) {
      deleteProject(projectId, {
        onSuccess: () => {
          toast.success('Project deleted successfully');
        },
      });
    }
  };

  return <button onClick={handleDelete}>Delete Project</button>;
}
```

---

## Summary

This frontend API provides:

1. **Type-safe interfaces** for all entities (Project, Device, AvailableDeviceId, etc.)
2. **Service layer** abstracting Supabase RPC calls and direct table access
3. **React Query hooks** for automatic caching, refetching, and state management
4. **Error handling** with user-friendly messages for common error cases
5. **Usage examples** demonstrating proper integration patterns

All services enforce authentication via Supabase RLS policies and provide consistent error handling across the application.
