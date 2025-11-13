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
