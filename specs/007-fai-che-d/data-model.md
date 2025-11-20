# Data Model: Cycle Management System

**Feature**: Rinominare Progetto in Ciclo
**Date**: 2025-11-20
**Database**: Supabase PostgreSQL

## Entity Overview

This feature introduces two new core entities and modifies existing entities to support cycle tracking:

```
┌─────────────┐
│   User      │
│ (auth.users)│
└──────┬──────┘
       │
       │ 1:N (only 1 active)
       │
       ▼
┌─────────────┐         ┌──────────────┐
│   Cycle     │◄────────│ Cycle Event  │
│             │  1:N    │              │
└──────┬──────┘         └──────────────┘
       │
       │ 1:N
       │
       ├──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼
   ┌────────┐    ┌────────┐    ┌──────────┐  ┌────────────────┐
   │ Device │    │ Sensor │    │ Actuator │  │ Sensor Reading │
   └────────┘    └────────┘    └──────────┘  └────────────────┘
```

## Entities

### 1. Cycle (NEW)

**Purpose**: Represents a cultivation cycle with defined duration and progress tracking.

**Table**: `public.cycles`

**Columns**:

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | `uuid_generate_v4()` | PRIMARY KEY | Unique cycle identifier |
| `user_id` | UUID | NO | - | FOREIGN KEY → `auth.users(id)` ON DELETE CASCADE | Owner of the cycle |
| `duration_weeks` | INTEGER | NO | `12` | CHECK (`duration_weeks` > 0) | Total planned cycle duration in weeks |
| `current_week` | INTEGER | NO | `1` | CHECK (`current_week` > 0 AND `current_week` <= `duration_weeks`) | Current week in the cycle (manual tracking) |
| `status` | TEXT | NO | `'active'` | CHECK (`status` IN ('active', 'completed')) | Cycle lifecycle status |
| `started_at` | TIMESTAMPTZ | NO | `NOW()` | - | When cycle began |
| `completed_at` | TIMESTAMPTZ | YES | `NULL` | - | When cycle reached 100% (set when status → completed) |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | - | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | - | Record last update timestamp |

**Indexes**:
```sql
-- Primary lookup: get active cycle for user
CREATE UNIQUE INDEX idx_cycles_user_active
  ON public.cycles(user_id, status)
  WHERE status = 'active';

-- Audit queries: find cycles by creation time
CREATE INDEX idx_cycles_created_at ON public.cycles(created_at);

-- User history lookup
CREATE INDEX idx_cycles_user_id ON public.cycles(user_id);
```

**Unique Constraints**:
```sql
-- Only one active cycle per user
CREATE UNIQUE INDEX cycles_one_active_per_user
  ON public.cycles(user_id)
  WHERE status = 'active';
```

**RLS Policies**:
```sql
-- Users can view their own cycles
CREATE POLICY "Users can view their own cycles"
  ON public.cycles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own cycles
CREATE POLICY "Users can insert their own cycles"
  ON public.cycles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cycles
CREATE POLICY "Users can update their own cycles"
  ON public.cycles FOR UPDATE
  USING (auth.uid() = user_id);

-- Prevent deletion (use status instead)
-- No DELETE policy defined
```

**Validation Rules** (enforced at database level):
1. `duration_weeks` must be > 0
2. `current_week` must be > 0
3. `current_week` must be <= `duration_weeks`
4. Only one active cycle per user
5. `completed_at` should be NULL when `status` = 'active' (enforced via application logic + trigger)

**State Transitions**:
```
┌────────┐  user creates cycle   ┌────────┐
│  NEW   │─────────────────────►│ ACTIVE │
└────────┘                       └────┬───┘
                                      │
                                      │ user sets current_week = duration_weeks
                                      │ + clicks "complete" button
                                      ▼
                                 ┌───────────┐
                                 │ COMPLETED │
                                 └───────────┘
```

**Business Rules**:
- Auto-created on user registration (trigger)
- Can be completed when `current_week` == `duration_weeks`
- Completing a cycle sets `status` = 'completed' and `completed_at` = NOW()
- Creating new cycle only allowed if no active cycle exists
- Updates to `duration_weeks` or `current_week` trigger event logging

---

### 2. Cycle Event (NEW)

**Purpose**: Audit trail of all cycle-related events for AI/ML training and analytics.

**Table**: `public.cycle_events`

**Columns**:

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | UUID | NO | `uuid_generate_v4()` | PRIMARY KEY | Unique event identifier |
| `cycle_id` | UUID | NO | - | FOREIGN KEY → `public.cycles(id)` ON DELETE CASCADE | Associated cycle |
| `user_id` | UUID | NO | - | FOREIGN KEY → `auth.users(id)` ON DELETE CASCADE | Event owner (for RLS) |
| `event_type` | TEXT | NO | - | CHECK (`event_type` IN ('created', 'duration_updated', 'week_updated', 'completed', 'sensor_reading_associated')) | Type of event |
| `metadata` | JSONB | YES | `NULL` | - | Event-specific flexible data |
| `previous_state` | JSONB | YES | `NULL` | - | Snapshot of cycle state before change |
| `new_state` | JSONB | YES | `NULL` | - | Snapshot of cycle state after change |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | - | Event occurrence timestamp |

**Indexes**:
```sql
-- Time-series queries: get events for a cycle ordered by time
CREATE INDEX idx_cycle_events_cycle_time
  ON public.cycle_events(cycle_id, created_at DESC);

-- Analytics queries: events by type
CREATE INDEX idx_cycle_events_type
  ON public.cycle_events(event_type);

-- User access (RLS performance)
CREATE INDEX idx_cycle_events_user_id
  ON public.cycle_events(user_id);

-- JSONB queries (if needed for analytics)
CREATE INDEX idx_cycle_events_metadata
  ON public.cycle_events USING GIN(metadata);
```

**RLS Policies**:
```sql
-- Users can view their own events
CREATE POLICY "Users can view their own cycle events"
  ON public.cycle_events FOR SELECT
  USING (auth.uid() = user_id);

-- Only system/triggers can insert (prevent user tampering)
CREATE POLICY "System can insert cycle events"
  ON public.cycle_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No updates or deletes allowed (append-only audit log)
```

**Event Types**:

| Event Type | Trigger | Metadata Example | Previous State | New State |
|------------|---------|------------------|----------------|-----------|
| `created` | User registration trigger | `{ "default_duration": 12 }` | `null` | `{ "duration_weeks": 12, "current_week": 1, "status": "active" }` |
| `duration_updated` | User changes duration in settings | `{ "old_duration": 12, "new_duration": 16 }` | `{ "duration_weeks": 12, ... }` | `{ "duration_weeks": 16, ... }` |
| `week_updated` | User changes current week | `{ "old_week": 3, "new_week": 4 }` | `{ "current_week": 3, ... }` | `{ "current_week": 4, ... }` |
| `completed` | User marks cycle complete | `{ "completion_date": "2025-11-20T10:30:00Z" }` | `{ "status": "active", ... }` | `{ "status": "completed", "completed_at": "2025-11-20T10:30:00Z", ... }` |
| `sensor_reading_associated` | New sensor reading added with cycle_id | `{ "sensor_id": "uuid", "reading_count": 150 }` | `null` | `null` |

**Data Retention**: Indefinite (needed for AI training). Future: may implement archival strategy.

---

### 3. Modified Entities

#### 3.1 Device (MODIFIED)

**Changes**: Add foreign key to cycle

**New Column**:

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `cycle_id` | UUID | YES (initially) | `NULL` | FOREIGN KEY → `public.cycles(id)` ON DELETE SET NULL | Associated cycle |

**Migration Note**: Initially nullable to allow gradual migration. Backfill script associates with user's first cycle.

**Index**:
```sql
CREATE INDEX idx_devices_cycle_id ON public.devices(cycle_id);
```

---

#### 3.2 Sensor (MODIFIED)

**Changes**: Add foreign key to cycle (inherited from device)

**New Column**:

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `cycle_id` | UUID | YES | `NULL` | FOREIGN KEY → `public.cycles(id)` ON DELETE SET NULL | Associated cycle (copied from device) |

**Index**:
```sql
CREATE INDEX idx_sensors_cycle_id ON public.sensors(cycle_id);
```

---

#### 3.3 Actuator (MODIFIED)

**Changes**: Add foreign key to cycle

**New Column**:

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `cycle_id` | UUID | YES | `NULL` | FOREIGN KEY → `public.cycles(id)` ON DELETE SET NULL | Associated cycle |

**Index**:
```sql
CREATE INDEX idx_actuators_cycle_id ON public.actuators(cycle_id);
```

---

#### 3.4 Sensor Reading (MODIFIED)

**Changes**: Add foreign key to cycle for event tracking

**New Column**:

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `cycle_id` | UUID | YES | `NULL` | FOREIGN KEY → `public.cycles(id)` ON DELETE SET NULL | Associated cycle (for historical analysis) |

**Index**:
```sql
-- Efficient cycle-based queries
CREATE INDEX idx_sensor_readings_cycle_id ON public.sensor_readings(cycle_id, timestamp DESC);
```

---

## Data Flow

### User Registration Flow
```
1. User completes registration in auth.users
2. Trigger: on_user_created_create_cycle fires
3. INSERT into cycles (user_id, defaults)
4. INSERT into cycle_events (event_type = 'created')
```

### Update Cycle Settings Flow
```
1. User submits form (duration_weeks, current_week)
2. Client validation: current_week <= duration_weeks
3. Application calls supabase.from('cycles').update(...)
4. Database check constraint validates
5. Trigger: on_cycle_updated fires
6. INSERT into cycle_events (event_type = 'duration_updated' or 'week_updated')
7. Return success to client
8. React Query invalidates cache
```

### Sensor Reading Ingestion Flow (Modified)
```
1. Device sends sensor reading
2. Application determines cycle_id from user's active cycle
3. INSERT into sensor_readings (... cycle_id)
4. Trigger: on_sensor_reading_inserted fires (optional)
5. INSERT into cycle_events (event_type = 'sensor_reading_associated')
```

---

## TypeScript Types

**Frontend Type Definitions** (`frontend/src/types/cycle.ts`):

```typescript
export type CycleStatus = 'active' | 'completed';

export interface Cycle {
  id: string;
  user_id: string;
  duration_weeks: number;
  current_week: number;
  status: CycleStatus;
  started_at: string; // ISO 8601 timestamp
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CycleEventType =
  | 'created'
  | 'duration_updated'
  | 'week_updated'
  | 'completed'
  | 'sensor_reading_associated';

export interface CycleEvent {
  id: string;
  cycle_id: string;
  user_id: string;
  event_type: CycleEventType;
  metadata: Record<string, any> | null;
  previous_state: Partial<Cycle> | null;
  new_state: Partial<Cycle> | null;
  created_at: string;
}

// Domain computed properties
export interface CycleWithProgress extends Cycle {
  progress_percentage: number; // Computed: (current_week / duration_weeks) * 100
  is_complete: boolean; // Computed: current_week === duration_weeks
}

// Form validation types
export interface UpdateCycleInput {
  duration_weeks: number;
  current_week: number;
}

export interface CycleValidationError {
  field: 'duration_weeks' | 'current_week';
  message: string;
}
```

---

## Migration Order

Execute migrations in this order:

1. `20251120_create_cycles_table.sql`
2. `20251120_create_cycle_events_table.sql`
3. `20251120_create_cycle_on_user_signup.sql` (trigger)
4. `20251120_migrate_legacy_users_cycles.sql` (one-time backfill)
5. `20251120_update_devices_sensors_with_cycle.sql` (add cycle_id columns)

**Rollback Plan**: Execute in reverse order, use transaction-wrapped migrations.

---

## Analytics & AI/ML Considerations

The `cycle_events` table is designed for time-series analysis and ML training:

**Queryable Dimensions**:
- Cycle duration patterns (distribution of duration_weeks)
- Week progression velocity (time between week updates)
- Completion rates (% of cycles that reach completed status)
- Seasonal patterns (started_at timestamps)
- Sensor reading correlation with cycle phase (join sensor_readings on cycle_id)

**Future Enhancements** (Out of Scope):
- Materialized views for aggregated metrics
- Partitioning cycle_events by date for scalability
- Export to data warehouse (BigQuery, Snowflake) for ML pipelines
