# Quickstart Guide: Standard Sensor Configuration

**Feature**: 004-deve-funzionare-così
**Audience**: Developers implementing this feature
**Estimated Reading Time**: 10 minutes

## Overview

This guide walks you through implementing sensor configuration functionality that allows users to map standard sensor types (DHT Sopra/Sotto, Soil Moisture 1-5, Water Level) to device ports and automatically route readings to appropriate charts.

## Prerequisites

- Supabase project setup with existing schema
- Frontend running React 19 + TypeScript
- Familiarity with React Query and Recharts

## Architecture at a Glance

```
User configures sensor in UI
    ↓
Frontend: POST /device_sensor_configs
    ↓
Database: Store active config (device_id, port_id, sensor_type)
    ↓
Device sends reading (device_id, port_id, value)
    ↓
Edge Function: Resolve sensor_type from active config
    ↓
Database: INSERT sensor_reading with resolved sensor_type
    ↓
Frontend: Query readings filtered by sensor_type
    ↓
Charts render dynamically based on available sensor types
```

## Step 1: Database Migration (10 minutes)

### 1.1 Run the Migration

```bash
cd supabase
supabase migration new sensor_configuration
```

Copy the contents of `contracts/database-schema.sql` into the new migration file.

### 1.2 Apply Migration

**Local Development:**
```bash
supabase db reset  # Or supabase migration up
```

**Production:**
```bash
supabase db push
```

### 1.3 Verify Schema

```sql
-- Check table exists
SELECT * FROM device_sensor_configs LIMIT 1;

-- Check sensor_readings columns added
\d sensor_readings

-- Test resolve function
SELECT resolve_sensor_type(
  'your-device-uuid',
  'GPIO4'
);  -- Should return 'unconfigured' if no config exists
```

## Step 2: TypeScript Types (5 minutes)

Create `frontend/src/types/sensor-config.types.ts`:

```typescript
// Standard sensor type enumeration
export type SensorType =
  | 'dht_sopra_temp'
  | 'dht_sopra_humidity'
  | 'dht_sotto_temp'
  | 'dht_sotto_humidity'
  | 'soil_moisture_1'
  | 'soil_moisture_2'
  | 'soil_moisture_3'
  | 'soil_moisture_4'
  | 'soil_moisture_5'
  | 'water_level'
  | 'unconfigured';

// Sensor configuration entity
export interface SensorConfig {
  id: string;
  device_id: string;
  sensor_type: SensorType;
  port_id: string;
  configured_at: string;
  is_active: boolean;
}

// Create config payload
export interface CreateSensorConfig {
  device_id: string;
  sensor_type: SensorType;
  port_id: string;
}

// Port validation
export const PORT_ID_REGEX = /^[A-Za-z0-9_-]+$/;
export const PORT_ID_MAX_LENGTH = 50;

export function isValidPortId(portId: string): boolean {
  return (
    portId.length > 0 &&
    portId.length <= PORT_ID_MAX_LENGTH &&
    PORT_ID_REGEX.test(portId)
  );
}

// Sensor type display labels
export const SENSOR_TYPE_LABELS: Record<SensorType, string> = {
  dht_sopra_temp: 'DHT Sopra (Temperature)',
  dht_sopra_humidity: 'DHT Sopra (Humidity)',
  dht_sotto_temp: 'DHT Sotto (Temperature)',
  dht_sotto_humidity: 'DHT Sotto (Humidity)',
  soil_moisture_1: 'Soil Moisture 1',
  soil_moisture_2: 'Soil Moisture 2',
  soil_moisture_3: 'Soil Moisture 3',
  soil_moisture_4: 'Soil Moisture 4',
  soil_moisture_5: 'Soil Moisture 5',
  water_level: 'Water Level',
  unconfigured: 'Unconfigured',
};
```

## Step 3: Supabase Service Layer (15 minutes)

Create `frontend/src/services/sensor-config.service.ts`:

```typescript
import { supabase } from '@/lib/supabase';
import type { SensorConfig, CreateSensorConfig } from '@/types/sensor-config.types';

export const sensorConfigService = {
  // Fetch active configs for a device
  async getActiveConfigs(deviceId: string): Promise<SensorConfig[]> {
    const { data, error } = await supabase
      .from('device_sensor_configs')
      .select('*')
      .eq('device_id', deviceId)
      .eq('is_active', true)
      .order('sensor_type', { ascending: true });

    if (error) throw error;
    return data as SensorConfig[];
  },

  // Create new configuration
  async createConfig(config: CreateSensorConfig): Promise<SensorConfig> {
    // Check for existing active config on same port
    const { data: existing } = await supabase
      .from('device_sensor_configs')
      .select('id')
      .eq('device_id', config.device_id)
      .eq('port_id', config.port_id)
      .eq('is_active', true)
      .single();

    if (existing) {
      throw new Error(`Port ${config.port_id} already configured for this device`);
    }

    const { data, error } = await supabase
      .from('device_sensor_configs')
      .insert(config)
      .select()
      .single();

    if (error) throw error;
    return data as SensorConfig;
  },

  // Deactivate configuration (soft delete)
  async deactivateConfig(configId: string): Promise<void> {
    const { error } = await supabase
      .from('device_sensor_configs')
      .update({ is_active: false })
      .eq('id', configId);

    if (error) throw error;
  },

  // Update configuration (deactivate old + create new)
  async updateConfig(
    oldConfigId: string,
    newConfig: CreateSensorConfig
  ): Promise<SensorConfig> {
    await this.deactivateConfig(oldConfigId);
    return this.createConfig(newConfig);
  },
};
```

## Step 4: React Query Hooks (10 minutes)

Create `frontend/src/hooks/useSensorConfig.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sensorConfigService } from '@/services/sensor-config.service';
import type { CreateSensorConfig } from '@/types/sensor-config.types';

// Query key factory
export const sensorConfigKeys = {
  all: ['sensor-configs'] as const,
  byDevice: (deviceId: string) => ['sensor-configs', deviceId] as const,
};

// Fetch active configs for device
export function useSensorConfigs(deviceId: string) {
  return useQuery({
    queryKey: sensorConfigKeys.byDevice(deviceId),
    queryFn: () => sensorConfigService.getActiveConfigs(deviceId),
    staleTime: 60000, // 1 minute
    enabled: !!deviceId,
  });
}

// Create new config
export function useCreateSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: CreateSensorConfig) =>
      sensorConfigService.createConfig(config),
    onSuccess: (data) => {
      // Invalidate device configs to refetch
      queryClient.invalidateQueries({
        queryKey: sensorConfigKeys.byDevice(data.device_id),
      });
    },
  });
}

// Deactivate config
export function useDeactivateSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, deviceId }: { configId: string; deviceId: string }) =>
      sensorConfigService.deactivateConfig(configId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: sensorConfigKeys.byDevice(variables.deviceId),
      });
    },
  });
}
```

## Step 5: Configuration UI Component (20 minutes)

Create `frontend/src/components/devices/SensorConfigForm.tsx`:

```typescript
import { useState } from 'react';
import { useCreateSensorConfig } from '@/hooks/useSensorConfig';
import { SENSOR_TYPE_LABELS, isValidPortId } from '@/types/sensor-config.types';
import type { SensorType } from '@/types/sensor-config.types';

interface Props {
  deviceId: string;
  onSuccess?: () => void;
}

export function SensorConfigForm({ deviceId, onSuccess }: Props) {
  const [sensorType, setSensorType] = useState<SensorType>('dht_sopra_temp');
  const [portId, setPortId] = useState('');
  const [error, setError] = useState('');

  const createConfig = useCreateSensorConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate port ID
    if (!isValidPortId(portId)) {
      setError('Port ID must be alphanumeric with - or _ only (max 50 chars)');
      return;
    }

    try {
      await createConfig.mutateAsync({
        device_id: deviceId,
        sensor_type: sensorType,
        port_id: portId,
      });

      // Reset form
      setPortId('');
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create configuration');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sensor-type" className="block text-sm font-medium">
          Sensor Type
        </label>
        <select
          id="sensor-type"
          value={sensorType}
          onChange={(e) => setSensorType(e.target.value as SensorType)}
          className="mt-1 block w-full rounded-md border-gray-300"
        >
          {Object.entries(SENSOR_TYPE_LABELS)
            .filter(([key]) => key !== 'unconfigured')
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label htmlFor="port-id" className="block text-sm font-medium">
          Port ID
        </label>
        <input
          id="port-id"
          type="text"
          value={portId}
          onChange={(e) => setPortId(e.target.value)}
          placeholder="e.g., GPIO4, A0"
          className="mt-1 block w-full rounded-md border-gray-300"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Alphanumeric with dash or underscore only
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={createConfig.isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
      >
        {createConfig.isPending ? 'Adding...' : 'Add Sensor'}
      </button>
    </form>
  );
}
```

## Step 6: Display Configs in Device Detail (10 minutes)

Enhance `frontend/src/pages/DeviceDetail.page.tsx`:

```typescript
import { useSensorConfigs, useDeactivateSensorConfig } from '@/hooks/useSensorConfig';
import { SensorConfigForm } from '@/components/devices/SensorConfigForm';
import { SENSOR_TYPE_LABELS } from '@/types/sensor-config.types';

function DeviceDetailPage({ deviceId }: { deviceId: string }) {
  const { data: configs, isLoading } = useSensorConfigs(deviceId);
  const deactivateConfig = useDeactivateSensorConfig();

  const handleRemove = (configId: string) => {
    if (confirm('Remove this sensor configuration?')) {
      deactivateConfig.mutate({ configId, deviceId });
    }
  };

  return (
    <div>
      <h2>Sensor Configuration</h2>

      {/* Display existing configs */}
      {configs && configs.length > 0 && (
        <div className="space-y-2 mb-4">
          {configs.map((config) => (
            <div key={config.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <strong>{SENSOR_TYPE_LABELS[config.sensor_type]}</strong>
                <span className="ml-2 text-sm text-gray-600">on {config.port_id}</span>
              </div>
              <button
                onClick={() => handleRemove(config.id)}
                className="text-red-600 text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new config */}
      <SensorConfigForm deviceId={deviceId} />
    </div>
  );
}
```

## Step 7: Update Chart Components (15 minutes)

Modify `frontend/src/components/charts/TemperatureChart.tsx`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';

interface Props {
  deviceId: string;
}

export function TemperatureChart({ deviceId }: Props) {
  const { data: readings } = useQuery({
    queryKey: ['sensor-readings', deviceId, 'temperature'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('timestamp, sensor_type, value')
        .eq('device_id', deviceId)
        .in('sensor_type', ['dht_sopra_temp', 'dht_sotto_temp'])
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (!readings || readings.length === 0) {
    return null;  // Hide chart if no data (FR-006, FR-007)
  }

  // Transform to chart format
  const chartData = transformToChartFormat(readings);

  return (
    <div>
      <h3>Temperature</h3>
      <LineChart width={600} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis label={{ value: 'Temperature (°C)', angle: -90 }} />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="dht_sopra_temp"
          name="Ceiling"
          stroke="#ff7300"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="dht_sotto_temp"
          name="Ground"
          stroke="#387908"
          dot={false}
        />
      </LineChart>
    </div>
  );
}

function transformToChartFormat(readings: any[]) {
  const grouped = readings.reduce((acc, reading) => {
    const key = new Date(reading.timestamp).toLocaleTimeString();
    if (!acc[key]) acc[key] = { timestamp: key };
    acc[key][reading.sensor_type] = reading.value;
    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped);
}
```

## Step 8: Update Reading Ingestion (Edge Function) (20 minutes)

Create or modify device reading endpoint to resolve sensor_type:

```typescript
// supabase/functions/insert-reading/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { device_id, port_id, value, unit } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Resolve sensor_type from active config
  const { data: sensorType } = await supabase.rpc('resolve_sensor_type', {
    p_device_id: device_id,
    p_port_id: port_id,
  });

  // Insert reading with resolved sensor_type
  const { data, error } = await supabase
    .from('sensor_readings')
    .insert({
      device_id,
      port_id,
      sensor_type: sensorType || 'unconfigured',
      value,
      unit,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 201 });
});
```

## Step 9: Testing (15 minutes)

### 9.1 Manual Test Flow

1. Navigate to device detail page
2. Click "Configure Sensors"
3. Select "DHT Sopra (Temperature)" and enter "GPIO4"
4. Click "Add Sensor"
5. Verify config appears in list
6. Send test reading from device (or use Supabase SQL editor):
   ```sql
   INSERT INTO sensor_readings (device_id, port_id, sensor_type, value, unit, timestamp)
   VALUES (
     'your-device-uuid',
     'GPIO4',
     'dht_sopra_temp',
     25.5,
     '°C',
     NOW()
   );
   ```
7. Verify Temperature chart appears on dashboard
8. Try changing config (remove GPIO4, add GPIO5)
9. Verify old readings still show as "Ceiling" temperature

### 9.2 Automated Tests

Create `frontend/tests/components/SensorConfigForm.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SensorConfigForm } from '@/components/devices/SensorConfigForm';

test('validates port ID format', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SensorConfigForm deviceId="test-device" />
    </QueryClientProvider>
  );

  const portInput = screen.getByLabelText(/Port ID/i);
  const submitButton = screen.getByRole('button', { name: /Add Sensor/i });

  // Invalid port ID
  fireEvent.change(portInput, { target: { value: 'GPIO@4' } });
  fireEvent.click(submitButton);

  await waitFor(() => {
    expect(screen.getByText(/must be alphanumeric/i)).toBeInTheDocument();
  });

  // Valid port ID
  fireEvent.change(portInput, { target: { value: 'GPIO4' } });
  // Should not show error
});
```

## Step 10: Deployment Checklist

- [ ] Database migration applied to production
- [ ] RLS policies tested with production auth tokens
- [ ] Edge Function deployed (if used)
- [ ] Frontend build succeeds with no TypeScript errors
- [ ] Test with real ESP32/ESP8266 device sending readings
- [ ] Verify charts appear/disappear correctly based on data
- [ ] Test configuration CRUD operations in production
- [ ] Validate port ID uniqueness constraint
- [ ] Check unconfigured port handling (logs warning)
- [ ] Performance test with 1000+ sensor readings

## Troubleshooting

### Charts not appearing
- Check browser console for errors
- Verify readings exist: `SELECT * FROM sensor_readings WHERE device_id = '...'`
- Ensure sensor_type is set (not NULL)
- Check time range filter (default 24 hours)

### "Port already configured" error
- Check for active config: `SELECT * FROM device_sensor_configs WHERE device_id = '...' AND is_active = TRUE`
- Verify unique index: `\di idx_device_sensor_configs_unique_active_port`

### Readings show as "unconfigured"
- Verify active config exists for port
- Check resolve_sensor_type function: `SELECT resolve_sensor_type('device-id', 'GPIO4')`
- Ensure Edge Function calls resolve before insert

## Next Steps

After completing this quickstart:

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement tasks in priority order (P1 → P2 → P3)
3. Write integration tests for data flow
4. Update user documentation
5. Deploy to staging environment
6. Conduct user acceptance testing

## Reference

- **Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **API Contracts**: [contracts/api-endpoints.yaml](./contracts/api-endpoints.yaml)
- **Database Schema**: [contracts/database-schema.sql](./contracts/database-schema.sql)
