export interface Device {
  id: string;                    // UUID (legacy)
  composite_device_id: string;   // "PROJ1-ESP5" (NEW)
  project_id: string;            // "PROJ1" (NEW)
  device_number: number;         // 1-20 (NEW)
  name: string;
  device_key_hash: string | null; // SHA-256 hash (NULL until first heartbeat)
  device_hostname: string | null; // ESP web interface URL
  user_id: string;
  status: 'waiting' | 'online' | 'offline';
  last_seen_at: string | null;
  rssi: number | null;
  ip_address: string | null;
  fw_version: string | null;
  firmware_version: string | null;
  created_at: string;
  updated_at: string;
  registered_at: string;
}

export interface DeviceHeartbeat {
  id: string;                    // Bigint as string
  device_id: string;             // Device UUID
  composite_device_id: string;   // "PROJ1-ESP5"
  rssi: number | null;
  ip_address: string | null;
  fw_version: string | null;
  ts: string;                    // ISO 8601 timestamp
}

export interface AvailableDeviceId {
  device_id: string;             // "ESP5"
  device_number: number;         // 5
}
