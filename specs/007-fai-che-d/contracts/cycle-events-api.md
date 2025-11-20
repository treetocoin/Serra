# API Contract: Cycle Events

**Feature**: Cycle Management System - Event Tracking
**Date**: 2025-11-20
**Backend**: Supabase (PostgreSQL + PostgREST)

## Overview

This contract defines the interface for tracking and querying cycle-related events. Events are primarily created via database triggers but can also be tracked manually for application-level events.

## Table Access Patterns

### Get Cycle Events

**Description**: Retrieve event history for a specific cycle

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycle_events')
  .select('*')
  .eq('cycle_id', cycleId)
  .order('created_at', { ascending: false });
```

**TypeScript Signature**:
```typescript
function getCycleEvents(cycleId: string): Promise<CycleEvent[]>
```

**Request**: Cycle ID

**Response** (Success - 200):
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "cycle_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "event_type": "week_updated",
    "metadata": {
      "old_week": 3,
      "new_week": 4
    },
    "previous_state": {
      "current_week": 3,
      "duration_weeks": 12,
      "status": "active"
    },
    "new_state": {
      "current_week": 4,
      "duration_weeks": 12,
      "status": "active"
    },
    "created_at": "2025-11-20T14:30:00Z"
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "cycle_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "event_type": "created",
    "metadata": {
      "default_duration": 12,
      "source": "auto_trigger"
    },
    "previous_state": null,
    "new_state": {
      "duration_weeks": 12,
      "current_week": 1,
      "status": "active"
    },
    "created_at": "2025-11-01T10:00:00Z"
  }
]
```

**RLS**: Enforced automatically (users see only events for their cycles)

---

### Get Events by Type

**Description**: Filter events by specific event type

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycle_events')
  .select('*')
  .eq('cycle_id', cycleId)
  .eq('event_type', 'week_updated')
  .order('created_at', { ascending: false });
```

**TypeScript Signature**:
```typescript
function getCycleEventsByType(
  cycleId: string,
  eventType: CycleEventType
): Promise<CycleEvent[]>
```

**Use Cases**:
- Track week progression velocity: `event_type = 'week_updated'`
- Analyze configuration changes: `event_type = 'duration_updated'`
- Completion rate analysis: `event_type = 'completed'`

---

### Track Event (Manual)

**Description**: Manually insert an event (primarily for application-level events not covered by triggers)

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycle_events')
  .insert({
    cycle_id: cycleId,
    user_id: userId,
    event_type: 'sensor_reading_associated',
    metadata: {
      sensor_id: sensorId,
      reading_count: 150
    },
    previous_state: null,
    new_state: null
  })
  .select()
  .single();
```

**TypeScript Signature**:
```typescript
interface TrackEventInput {
  cycle_id: string;
  event_type: CycleEventType;
  metadata?: Record<string, any>;
  previous_state?: Partial<Cycle> | null;
  new_state?: Partial<Cycle> | null;
}

function trackCycleEvent(input: TrackEventInput): Promise<CycleEvent>
```

**Request Body**:
```json
{
  "cycle_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "sensor_reading_associated",
  "metadata": {
    "sensor_id": "880e8400-e29b-41d4-a716-446655440000",
    "reading_count": 150,
    "sensor_type": "temperature"
  }
}
```

**Response** (Success - 201):
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "cycle_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "event_type": "sensor_reading_associated",
  "metadata": {
    "sensor_id": "880e8400-e29b-41d4-a716-446655440000",
    "reading_count": 150,
    "sensor_type": "temperature"
  },
  "previous_state": null,
  "new_state": null,
  "created_at": "2025-11-20T15:00:00Z"
}
```

**When to Use Manual Tracking**:
- Sensor reading ingestion (associate reading with cycle)
- Custom application events not covered by database triggers
- External integrations (e.g., weather API correlation)

**When NOT to Use** (Auto-tracked by Triggers):
- Cycle creation (`created`)
- Cycle updates (`duration_updated`, `week_updated`)
- Cycle completion (`completed`)

---

## Event Types Reference

### 1. `created`

**Trigger**: User registration or manual cycle creation

**Metadata Example**:
```json
{
  "default_duration": 12,
  "source": "auto_trigger" | "manual"
}
```

**Previous State**: `null` (no previous cycle state)

**New State**:
```json
{
  "duration_weeks": 12,
  "current_week": 1,
  "status": "active"
}
```

---

### 2. `duration_updated`

**Trigger**: User changes `duration_weeks` in settings

**Metadata Example**:
```json
{
  "old_duration": 12,
  "new_duration": 16,
  "updated_by": "user" | "system"
}
```

**Previous State**:
```json
{
  "duration_weeks": 12,
  "current_week": 4,
  "status": "active"
}
```

**New State**:
```json
{
  "duration_weeks": 16,
  "current_week": 4,
  "status": "active"
}
```

---

### 3. `week_updated`

**Trigger**: User changes `current_week` in settings

**Metadata Example**:
```json
{
  "old_week": 3,
  "new_week": 4,
  "updated_by": "user"
}
```

**Previous State**:
```json
{
  "current_week": 3,
  "duration_weeks": 12,
  "status": "active"
}
```

**New State**:
```json
{
  "current_week": 4,
  "duration_weeks": 12,
  "status": "active"
}
```

---

### 4. `completed`

**Trigger**: User marks cycle as complete (status → 'completed')

**Metadata Example**:
```json
{
  "completion_date": "2025-11-20T10:00:00Z",
  "final_week": 12,
  "final_duration": 12,
  "completed_on_time": true
}
```

**Previous State**:
```json
{
  "status": "active",
  "current_week": 12,
  "duration_weeks": 12,
  "completed_at": null
}
```

**New State**:
```json
{
  "status": "completed",
  "current_week": 12,
  "duration_weeks": 12,
  "completed_at": "2025-11-20T10:00:00Z"
}
```

---

### 5. `sensor_reading_associated`

**Trigger**: New sensor reading ingested with `cycle_id`

**Metadata Example**:
```json
{
  "sensor_id": "880e8400-e29b-41d4-a716-446655440000",
  "sensor_type": "temperature",
  "reading_count": 150,
  "reading_timestamp": "2025-11-20T14:30:00Z",
  "value": 24.5,
  "unit": "°C"
}
```

**Previous State**: `null`

**New State**: `null`

**Note**: This event type tracks correlation between sensor data and cycle phase, not cycle state changes.

---

## Database Triggers

### On Cycle Created

**Trigger Function**:
```sql
CREATE OR REPLACE FUNCTION log_cycle_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cycle_events (
    cycle_id,
    user_id,
    event_type,
    metadata,
    previous_state,
    new_state
  ) VALUES (
    NEW.id,
    NEW.user_id,
    'created',
    jsonb_build_object(
      'default_duration', NEW.duration_weeks,
      'source', 'auto_trigger'
    ),
    NULL,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_cycle_created
  AFTER INSERT ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION log_cycle_created();
```

---

### On Cycle Updated

**Trigger Function**:
```sql
CREATE OR REPLACE FUNCTION log_cycle_updated()
RETURNS TRIGGER AS $$
DECLARE
  event_type_val TEXT;
BEGIN
  -- Determine event type based on what changed
  IF OLD.duration_weeks != NEW.duration_weeks THEN
    event_type_val := 'duration_updated';
  ELSIF OLD.current_week != NEW.current_week THEN
    event_type_val := 'week_updated';
  ELSIF OLD.status != NEW.status AND NEW.status = 'completed' THEN
    event_type_val := 'completed';
  ELSE
    RETURN NEW; -- No significant change, skip logging
  END IF;

  INSERT INTO public.cycle_events (
    cycle_id,
    user_id,
    event_type,
    metadata,
    previous_state,
    new_state
  ) VALUES (
    NEW.id,
    NEW.user_id,
    event_type_val,
    CASE event_type_val
      WHEN 'duration_updated' THEN jsonb_build_object('old_duration', OLD.duration_weeks, 'new_duration', NEW.duration_weeks)
      WHEN 'week_updated' THEN jsonb_build_object('old_week', OLD.current_week, 'new_week', NEW.current_week)
      WHEN 'completed' THEN jsonb_build_object('completion_date', NEW.completed_at, 'final_week', NEW.current_week)
      ELSE '{}'::jsonb
    END,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_cycle_updated
  AFTER UPDATE ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION log_cycle_updated();
```

---

## Analytics Queries

### Cycle Progression Velocity

**Description**: Average time between week updates

**SQL**:
```sql
SELECT
  cycle_id,
  AVG(EXTRACT(EPOCH FROM (lead(created_at) OVER (PARTITION BY cycle_id ORDER BY created_at) - created_at))) AS avg_seconds_per_week
FROM cycle_events
WHERE event_type = 'week_updated'
GROUP BY cycle_id;
```

**Supabase RPC Wrapper** (Optional):
```typescript
const { data } = await supabase.rpc('get_cycle_progression_velocity', { cycle_id });
```

---

### Event Count by Type

**Description**: Distribution of event types for a cycle

**SQL**:
```sql
SELECT event_type, COUNT(*) as count
FROM cycle_events
WHERE cycle_id = '550e8400-e29b-41d4-a716-446655440000'
GROUP BY event_type
ORDER BY count DESC;
```

---

## React Hook Example

```typescript
// hooks/useCycleEvents.ts
export function useCycleEvents(cycleId?: string) {
  return useQuery({
    queryKey: ['cycle-events', cycleId],
    queryFn: async () => {
      if (!cycleId) return [];

      const { data, error } = await supabase
        .from('cycle_events')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CycleEvent[];
    },
    enabled: !!cycleId,
  });
}

export function useTrackCycleEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TrackEventInput) => {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('cycle_events')
        .insert({
          ...input,
          user_id: user.user!.id
        })
        .select()
        .single();

      if (error) throw error;
      return data as CycleEvent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['cycle-events', data.cycle_id]);
    },
  });
}
```

---

## Testing Checklist

- [ ] Event created on cycle creation (trigger)
- [ ] Event created on duration update (trigger)
- [ ] Event created on week update (trigger)
- [ ] Event created on cycle completion (trigger)
- [ ] Manual event tracking (sensor reading association)
- [ ] Event metadata correctly populated
- [ ] Previous/new state snapshots accurate
- [ ] RLS: User A cannot see User B's events
- [ ] Analytics queries return correct aggregations
- [ ] Event timestamp accuracy (<1s latency from action)

---

## Data Retention & Privacy

**Retention Policy**: Indefinite (required for AI/ML training)

**Future Considerations**:
- Archive old events to cold storage after N years
- Anonymization for ML training (remove user_id while keeping cycle patterns)
- GDPR compliance: Delete events when user deletes account
