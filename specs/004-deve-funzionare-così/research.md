# Research: Standard Sensor Configuration and Dynamic Charting

**Feature**: 004-deve-funzionare-così
**Date**: 2025-11-13
**Status**: Complete

## Research Questions

This document consolidates research findings for technical decisions needed to implement the sensor configuration feature.

---

## R1: Database Schema Design for Sensor Configuration

**Question**: How should we structure the sensor configuration table to support the snapshot approach (permanent sensor type association) while allowing port reassignments?

**Decision**: Create a `device_sensor_configs` table with temporal tracking

**Rationale**:
- The snapshot approach requires storing sensor type with each reading, not just in configuration
- Historical configuration changes should be auditable (even though audit trail is out of scope, the schema should support future enhancement)
- Port reassignments must not affect historical data
- Unique constraint on (device_id, port_id) prevents duplicate assignments (FR-008)

**Schema Design**:
```sql
CREATE TABLE device_sensor_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sensor_type TEXT NOT NULL CHECK (sensor_type IN (
    'dht_sopra_temp', 'dht_sopra_humidity',
    'dht_sotto_temp', 'dht_sotto_humidity',
    'soil_moisture_1', 'soil_moisture_2', 'soil_moisture_3',
    'soil_moisture_4', 'soil_moisture_5',
    'water_level'
  )),
  port_id TEXT NOT NULL CHECK (port_id ~ '^[A-Za-z0-9_-]+$'),
  configured_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  CONSTRAINT unique_active_port_per_device UNIQUE (device_id, port_id, is_active)
  -- Note: This allows historical configs (is_active=false) but enforces unique active config per port
);

CREATE INDEX idx_device_sensor_configs_device ON device_sensor_configs(device_id);
CREATE INDEX idx_device_sensor_configs_active ON device_sensor_configs(device_id, is_active) WHERE is_active = TRUE;
```

**Alternatives Considered**:
1. **Single current config only**: Rejected because it doesn't preserve configuration history and makes troubleshooting difficult
2. **Separate tables for each sensor type**: Rejected due to unnecessary complexity and schema bloat
3. **JSON column in devices table**: Rejected because it complicates querying and validation

**Implementation Notes**:
- When user changes configuration, set old config `is_active = FALSE` and insert new config with `is_active = TRUE`
- `sensor_readings` table will store `sensor_type` directly (denormalized) to implement snapshot approach
- RLS policies will extend device-based access (users can only configure sensors for their devices)

---

## R2: Sensor Reading Storage Strategy (Snapshot Approach)

**Question**: How do we permanently associate readings with sensor types when configuration can change?

**Decision**: Add `sensor_type` column to `sensor_readings` table, populated at write time from active configuration

**Rationale**:
- FR-015 requires permanent association (configuration changes don't relabel data)
- Denormalization is acceptable here because sensor type is immutable per reading
- Join-based approach would require complex temporal queries and hurt performance
- Storage overhead is minimal (TEXT column, ~10-20 bytes per reading)

**Modified Schema**:
```sql
-- Extend existing sensor_readings table
ALTER TABLE sensor_readings
ADD COLUMN sensor_type TEXT,
ADD COLUMN port_id TEXT;

CREATE INDEX idx_sensor_readings_type ON sensor_readings(sensor_type);
CREATE INDEX idx_sensor_readings_device_type ON sensor_readings(device_id, sensor_type);
```

**Write-Time Resolution Logic** (implemented in Edge Function or frontend):
```typescript
async function insertReading(deviceId: string, portId: string, value: number) {
  // 1. Lookup active configuration for device + port
  const config = await supabase
    .from('device_sensor_configs')
    .select('sensor_type')
    .eq('device_id', deviceId)
    .eq('port_id', portId)
    .eq('is_active', true)
    .single();

  if (!config) {
    // Edge case: unconfigured port (see R3)
    throw new Error('Port not configured');
  }

  // 2. Insert reading with resolved sensor_type
  await supabase.from('sensor_readings').insert({
    device_id: deviceId,
    port_id: portId,
    sensor_type: config.sensor_type,
    value: value,
    timestamp: new Date()
  });
}
```

**Alternatives Considered**:
1. **Join-based queries**: Rejected due to performance concerns with time-series data and temporal complexity
2. **Separate readings table per sensor type**: Rejected due to schema explosion and query complexity
3. **Store config_id FK**: Rejected because it requires joins and doesn't clearly express immutability

---

## R3: Handling Unconfigured Port Readings

**Question**: What should happen when a device sends readings from a port that hasn't been configured in the webapp?

**Decision**: Store readings in a generic "unconfigured" category and notify user

**Rationale**:
- Data loss is unacceptable (users may configure port after device starts sending)
- Auto-configuration risks incorrect sensor type assignment
- User notification enables proactive configuration without data loss

**Implementation**:
```sql
-- Add special sensor_type for unconfigured ports
ALTER TABLE device_sensor_configs
DROP CONSTRAINT device_sensor_configs_sensor_type_check;

ALTER TABLE device_sensor_configs
ADD CONSTRAINT device_sensor_configs_sensor_type_check
CHECK (sensor_type IN (
  'dht_sopra_temp', 'dht_sopra_humidity',
  'dht_sotto_temp', 'dht_sotto_humidity',
  'soil_moisture_1', 'soil_moisture_2', 'soil_moisture_3',
  'soil_moisture_4', 'soil_moisture_5',
  'water_level',
  'unconfigured'  -- NEW
));

-- Modify write logic to handle unconfigured
async function insertReading(deviceId: string, portId: string, value: number) {
  const config = await supabase
    .from('device_sensor_configs')
    .select('sensor_type')
    .eq('device_id', deviceId)
    .eq('port_id', portId)
    .eq('is_active', true)
    .single();

  const sensorType = config?.sensor_type || 'unconfigured';

  await supabase.from('sensor_readings').insert({
    device_id: deviceId,
    port_id: portId,
    sensor_type: sensorType,
    value: value,
    timestamp: new Date()
  });

  if (sensorType === 'unconfigured') {
    // Trigger notification (out of scope for this feature, but prepared)
    console.warn(`Unconfigured port ${portId} on device ${deviceId}`);
  }
}
```

**Alternatives Considered**:
1. **Reject readings**: Rejected because it causes data loss and poor UX
2. **Auto-create config**: Rejected because system can't infer sensor type correctly
3. **Silent storage with no indicator**: Rejected because user has no visibility into the issue

---

## R4: Recharts Multi-Line Visualization Pattern

**Question**: How do we implement combined Temperature/Humidity charts with ceiling/ground differentiation using Recharts?

**Decision**: Use Recharts `<Line>` components with different `dataKey` and `stroke` properties within a single `<LineChart>`

**Rationale**:
- Recharts natively supports multiple lines on one chart
- Color coding provides clear visual differentiation (FR-012)
- Legend automatically generated from `<Line name="...">` props
- Maintains consistency with existing charting infrastructure

**Implementation Pattern**:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function TemperatureChart({ data }: { data: SensorReading[] }) {
  // Transform readings into chart format
  const chartData = transformToChartFormat(data);

  return (
    <LineChart data={chartData}>
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
  );
}

function transformToChartFormat(readings: SensorReading[]) {
  // Group readings by timestamp, pivoting sensor_type to columns
  const grouped = readings.reduce((acc, reading) => {
    const key = reading.timestamp.toISOString();
    if (!acc[key]) acc[key] = { timestamp: key };
    acc[key][reading.sensor_type] = reading.value;
    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped);
}
```

**Dynamic Chart Visibility** (FR-006, FR-007):
```tsx
function Dashboard({ deviceId }: { deviceId: string }) {
  const { data: readings } = useQuery(['sensor-readings', deviceId], fetchReadings);

  const hasTemperatureData = readings?.some(r =>
    r.sensor_type === 'dht_sopra_temp' || r.sensor_type === 'dht_sotto_temp'
  );

  const hasHumidityData = readings?.some(r =>
    r.sensor_type === 'dht_sopra_humidity' || r.sensor_type === 'dht_sotto_humidity'
  );

  return (
    <>
      {hasTemperatureData && <TemperatureChart data={readings} />}
      {hasHumidityData && <HumidityChart data={readings} />}
      {/* Render other charts conditionally... */}
    </>
  );
}
```

**Alternatives Considered**:
1. **Separate charts stacked vertically**: Rejected because it wastes space and makes comparison difficult
2. **ApexCharts library**: Rejected to maintain consistency with existing Recharts usage
3. **Manual canvas drawing**: Rejected due to complexity and maintenance burden

---

## R5: React Query Caching Strategy for Sensor Config

**Question**: How should we structure React Query queries/mutations for sensor configuration CRUD operations?

**Decision**: Use query keys with device scope and optimistic updates for configuration changes

**Rationale**:
- Configuration is device-specific, so cache keys should reflect that hierarchy
- Optimistic updates improve perceived performance (SC-001: <3 min configuration)
- React Query already in use (@tanstack/react-query ^5.90)
- Invalidation on device change ensures consistency

**Implementation Pattern**:
```typescript
// Query key factory
const sensorConfigKeys = {
  all: ['sensor-configs'] as const,
  byDevice: (deviceId: string) => ['sensor-configs', deviceId] as const,
};

// Hook for fetching configs
function useSensorConfigs(deviceId: string) {
  return useQuery({
    queryKey: sensorConfigKeys.byDevice(deviceId),
    queryFn: () => fetchSensorConfigs(deviceId),
    staleTime: 60000, // 1 minute (configs change infrequently)
  });
}

// Hook for updating config with optimistic update
function useUpdateSensorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: SensorConfig) => updateSensorConfig(config),
    onMutate: async (newConfig) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: sensorConfigKeys.byDevice(newConfig.device_id)
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData(
        sensorConfigKeys.byDevice(newConfig.device_id)
      );

      // Optimistically update
      queryClient.setQueryData(
        sensorConfigKeys.byDevice(newConfig.device_id),
        (old: SensorConfig[]) =>
          old.map(c => c.id === newConfig.id ? newConfig : c)
      );

      return { previous };
    },
    onError: (err, newConfig, context) => {
      // Rollback on error
      queryClient.setQueryData(
        sensorConfigKeys.byDevice(newConfig.device_id),
        context?.previous
      );
    },
    onSettled: (data, error, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: sensorConfigKeys.byDevice(variables.device_id)
      });
    },
  });
}
```

**Alternatives Considered**:
1. **Global config query without device scoping**: Rejected because it fetches unnecessary data and complicates invalidation
2. **No optimistic updates**: Rejected because it impacts user experience (SC-001)
3. **SWR library**: Rejected to maintain consistency with existing React Query usage

---

## R6: Port Identifier Validation Strategy

**Question**: How do we validate port identifiers (FR-014) across frontend and backend?

**Decision**: Use shared regex pattern with both client-side and database-level validation

**Rationale**:
- Defense in depth: both frontend and backend validation
- Consistent error messages improve UX
- Regex in DB CHECK constraint provides final enforcement
- TypeScript type guards enable compile-time safety

**Implementation**:

**Shared validation (frontend types)**:
```typescript
// frontend/src/types/sensor-config.types.ts
export const PORT_ID_REGEX = /^[A-Za-z0-9_-]+$/;
export const PORT_ID_MAX_LENGTH = 50;

export function isValidPortId(portId: string): boolean {
  return (
    portId.length > 0 &&
    portId.length <= PORT_ID_MAX_LENGTH &&
    PORT_ID_REGEX.test(portId)
  );
}

export type PortId = string & { __brand: 'PortId' };

export function validatePortId(portId: string): PortId {
  if (!isValidPortId(portId)) {
    throw new Error(
      `Invalid port identifier: must be alphanumeric with - or _ only (max ${PORT_ID_MAX_LENGTH} chars)`
    );
  }
  return portId as PortId;
}
```

**Database constraint** (already shown in R1):
```sql
port_id TEXT NOT NULL CHECK (port_id ~ '^[A-Za-z0-9_-]+$')
```

**Form validation** (React Hook Form example):
```tsx
import { useForm } from 'react-hook-form';

function SensorConfigForm() {
  const { register, formState: { errors } } = useForm();

  return (
    <input
      {...register('port_id', {
        required: 'Port ID is required',
        pattern: {
          value: PORT_ID_REGEX,
          message: 'Port ID must be alphanumeric with - or _ only'
        },
        maxLength: {
          value: PORT_ID_MAX_LENGTH,
          message: `Port ID must be ${PORT_ID_MAX_LENGTH} characters or less`
        }
      })}
    />
  );
}
```

**Alternatives Considered**:
1. **Frontend validation only**: Rejected because malicious clients can bypass
2. **Different rules frontend vs backend**: Rejected because inconsistency causes confusion
3. **No length limit**: Rejected to prevent abuse and ensure database performance

---

## R7: Testing Strategy for Dynamic Chart Visibility

**Question**: How do we test that charts appear only when data exists (FR-006, FR-007)?

**Decision**: Use React Testing Library with mock data scenarios covering all visibility states

**Rationale**:
- React Testing Library aligns with user-centric testing (tests what users see)
- Mock data allows deterministic testing of conditional rendering
- Integration tests cover end-to-end data flow (query → render)
- Vitest provides fast test execution for iterative development

**Test Structure**:
```typescript
// tests/components/Dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '@/components/Dashboard';

describe('Dashboard - Dynamic Chart Visibility', () => {
  it('shows Temperature chart when DHT Sopra or DHT Sotto data exists', () => {
    const mockReadings = [
      { sensor_type: 'dht_sopra_temp', value: 25, timestamp: new Date() },
    ];

    render(<Dashboard deviceId="test-device" />, {
      wrapper: createQueryWrapper(mockReadings),
    });

    expect(screen.getByText(/Temperature/i)).toBeInTheDocument();
  });

  it('hides Temperature chart when no temperature data exists', () => {
    const mockReadings = [
      { sensor_type: 'water_level', value: 80, timestamp: new Date() },
    ];

    render(<Dashboard deviceId="test-device" />, {
      wrapper: createQueryWrapper(mockReadings),
    });

    expect(screen.queryByText(/Temperature/i)).not.toBeInTheDocument();
  });

  it('shows multiple charts when multiple sensor types have data', () => {
    const mockReadings = [
      { sensor_type: 'dht_sopra_temp', value: 25, timestamp: new Date() },
      { sensor_type: 'soil_moisture_1', value: 45, timestamp: new Date() },
      { sensor_type: 'water_level', value: 80, timestamp: new Date() },
    ];

    render(<Dashboard deviceId="test-device" />, {
      wrapper: createQueryWrapper(mockReadings),
    });

    expect(screen.getByText(/Temperature/i)).toBeInTheDocument();
    expect(screen.getByText(/Soil Moisture 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Water Level/i)).toBeInTheDocument();
  });
});

function createQueryWrapper(mockData: any[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Mock fetch function
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => mockData,
  } as Response);

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**Integration Test** (data flow):
```typescript
// tests/integration/sensor-routing.test.tsx
describe('Sensor Reading Routing', () => {
  it('routes DHT Sopra readings to Temperature chart', async () => {
    // 1. Configure sensor
    await configureSensor('device-1', 'GPIO4', 'dht_sopra_temp');

    // 2. Send reading
    await sendReading('device-1', 'GPIO4', 25.5);

    // 3. Verify chart displays reading
    render(<Dashboard deviceId="device-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Temperature/i)).toBeInTheDocument();
      expect(screen.getByText(/25.5/)).toBeInTheDocument();
    });
  });
});
```

**Alternatives Considered**:
1. **Enzyme**: Rejected because it's deprecated and doesn't support React 18+
2. **Manual DOM manipulation**: Rejected due to fragility and poor maintainability
3. **E2E only (Playwright/Cypress)**: Rejected because unit/integration tests provide faster feedback

---

## Summary of Decisions

| Area | Decision | Primary Rationale |
|------|----------|-------------------|
| Database Schema | Temporal configuration table with `is_active` flag | Supports snapshot approach and future audit trail |
| Reading Storage | Denormalized `sensor_type` in readings table | Permanent association (FR-015), query performance |
| Unconfigured Ports | Store as "unconfigured" type, log warning | Prevents data loss, enables late configuration |
| Chart Visualization | Recharts multi-line with color coding | Consistency with existing infrastructure |
| State Management | React Query with optimistic updates | Performance (SC-001), consistency with codebase |
| Validation | Shared regex, frontend + DB enforcement | Defense in depth, consistent UX |
| Testing | RTL + Vitest with mock data scenarios | User-centric, fast feedback loop |

## Open Questions for Implementation Phase

None. All technical decisions resolved.

---

**Research Complete**: Ready for Phase 1 (Design & Contracts)
