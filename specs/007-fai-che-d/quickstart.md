# Quickstart: Cycle Management System

**Feature**: Rinominare Progetto in Ciclo
**Audience**: Developers implementing this feature
**Estimated Time**: 4-6 hours

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Access to Supabase project
- [ ] Familiarity with React 19, TypeScript, React Query
- [ ] Understanding of Supabase RLS policies

## Implementation Checklist

### Phase 1: Database Setup (1-2 hours)

#### 1.1 Create Migrations

Create the following migration files in `/supabase/migrations/`:

```bash
cd /Users/davidecrescentini/00-Progetti/Serra
touch supabase/migrations/20251120_create_cycles_table.sql
touch supabase/migrations/20251120_create_cycle_events_table.sql
touch supabase/migrations/20251120_create_cycle_on_user_signup.sql
touch supabase/migrations/20251120_migrate_legacy_users_cycles.sql
touch supabase/migrations/20251120_update_devices_sensors_with_cycle.sql
```

#### 1.2 Implement Cycles Table

**File**: `supabase/migrations/20251120_create_cycles_table.sql`

```sql
-- Create cycles table
CREATE TABLE IF NOT EXISTS public.cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_weeks INTEGER NOT NULL DEFAULT 12 CHECK (duration_weeks > 0),
  current_week INTEGER NOT NULL DEFAULT 1 CHECK (current_week > 0 AND current_week <= duration_weeks),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX cycles_one_active_per_user
  ON public.cycles(user_id)
  WHERE status = 'active';

CREATE INDEX idx_cycles_user_id ON public.cycles(user_id);
CREATE INDEX idx_cycles_created_at ON public.cycles(created_at);

-- Enable RLS
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own cycles"
  ON public.cycles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cycles"
  ON public.cycles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cycles"
  ON public.cycles FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 1.3 Implement Cycle Events Table

**File**: `supabase/migrations/20251120_create_cycle_events_table.sql`

```sql
-- Create cycle_events table
CREATE TABLE IF NOT EXISTS public.cycle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'duration_updated',
    'week_updated',
    'completed',
    'sensor_reading_associated'
  )),
  metadata JSONB,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cycle_events_cycle_time
  ON public.cycle_events(cycle_id, created_at DESC);

CREATE INDEX idx_cycle_events_type
  ON public.cycle_events(event_type);

CREATE INDEX idx_cycle_events_user_id
  ON public.cycle_events(user_id);

CREATE INDEX idx_cycle_events_metadata
  ON public.cycle_events USING GIN(metadata);

-- Enable RLS
ALTER TABLE public.cycle_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own cycle events"
  ON public.cycle_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert cycle events"
  ON public.cycle_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### 1.4 Create Auto-Cycle Trigger

**File**: `supabase/migrations/20251120_create_cycle_on_user_signup.sql`

```sql
-- Function to create default cycle
CREATE OR REPLACE FUNCTION public.create_default_cycle()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cycles (user_id, duration_weeks, current_week, status)
  VALUES (NEW.id, 12, 1, 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user creation
CREATE TRIGGER on_user_created_create_cycle
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_cycle();

-- Logging triggers for cycle events
CREATE OR REPLACE FUNCTION public.log_cycle_created()
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
    jsonb_build_object('default_duration', NEW.duration_weeks, 'source', 'auto_trigger'),
    NULL,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_cycle_created
  AFTER INSERT ON public.cycles
  FOR EACH ROW EXECUTE FUNCTION public.log_cycle_created();

-- Update trigger
CREATE OR REPLACE FUNCTION public.log_cycle_updated()
RETURNS TRIGGER AS $$
DECLARE
  event_type_val TEXT;
BEGIN
  IF OLD.duration_weeks != NEW.duration_weeks THEN
    event_type_val := 'duration_updated';
  ELSIF OLD.current_week != NEW.current_week THEN
    event_type_val := 'week_updated';
  ELSIF OLD.status != NEW.status AND NEW.status = 'completed' THEN
    event_type_val := 'completed';
  ELSE
    RETURN NEW;
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
  FOR EACH ROW EXECUTE FUNCTION public.log_cycle_updated();
```

#### 1.5 Legacy User Migration

**File**: `supabase/migrations/20251120_migrate_legacy_users_cycles.sql`

```sql
-- Create cycles for existing users
INSERT INTO public.cycles (user_id, duration_weeks, current_week, status)
SELECT
  u.id,
  12,
  1,
  'active'
FROM auth.users u
LEFT JOIN public.cycles c ON c.user_id = u.id AND c.status = 'active'
WHERE c.id IS NULL;  -- Only create if no active cycle exists
```

#### 1.6 Add cycle_id to Existing Tables

**File**: `supabase/migrations/20251120_update_devices_sensors_with_cycle.sql`

```sql
-- Add cycle_id to devices
ALTER TABLE public.devices
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_cycle_id ON public.devices(cycle_id);

-- Add cycle_id to sensors
ALTER TABLE public.sensors
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sensors_cycle_id ON public.sensors(cycle_id);

-- Add cycle_id to actuators (if table exists)
ALTER TABLE public.actuators
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_actuators_cycle_id ON public.actuators(cycle_id);

-- Add cycle_id to sensor_readings
ALTER TABLE public.sensor_readings
ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.cycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sensor_readings_cycle_id
  ON public.sensor_readings(cycle_id, timestamp DESC);

-- Backfill cycle_id for existing data
UPDATE public.devices d
SET cycle_id = (
  SELECT c.id
  FROM public.cycles c
  WHERE c.user_id = d.user_id AND c.status = 'active'
  LIMIT 1
)
WHERE d.cycle_id IS NULL;

UPDATE public.sensors s
SET cycle_id = (
  SELECT d.cycle_id
  FROM public.devices d
  WHERE d.id = s.device_id
)
WHERE s.cycle_id IS NULL;

UPDATE public.actuators a
SET cycle_id = (
  SELECT c.id
  FROM public.cycles c
  JOIN public.devices d ON d.user_id = c.user_id
  WHERE c.status = 'active'
  LIMIT 1
)
WHERE a.cycle_id IS NULL;

UPDATE public.sensor_readings sr
SET cycle_id = (
  SELECT s.cycle_id
  FROM public.sensors s
  WHERE s.id = sr.sensor_id
)
WHERE sr.cycle_id IS NULL;
```

#### 1.7 Apply Migrations

```bash
# Using Supabase CLI (if available)
supabase db push

# OR manually via Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Copy/paste each migration file content
# 3. Execute in order (20251120_create_cycles_table.sql first, etc.)
```

---

### Phase 2: Frontend Types (30 minutes)

#### 2.1 Create Cycle Types

**File**: `frontend/src/types/cycle.ts`

```typescript
export type CycleStatus = 'active' | 'completed';

export interface Cycle {
  id: string;
  user_id: string;
  duration_weeks: number;
  current_week: number;
  status: CycleStatus;
  started_at: string;
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

export interface CycleWithProgress extends Cycle {
  progress_percentage: number;
  is_complete: boolean;
}

export interface UpdateCycleInput {
  duration_weeks?: number;
  current_week?: number;
}

export interface CycleValidationError {
  field: 'duration_weeks' | 'current_week';
  message: string;
}
```

#### 2.2 Update Database Types

**File**: `frontend/src/types/database.ts`

```typescript
// Add to existing Database interface
export interface Database {
  public: {
    Tables: {
      // ... existing tables
      cycles: {
        Row: Cycle;
        Insert: Omit<Cycle, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Cycle, 'id' | 'user_id' | 'created_at'>>;
      };
      cycle_events: {
        Row: CycleEvent;
        Insert: Omit<CycleEvent, 'id' | 'created_at'>;
        Update: never; // Append-only table
      };
    };
  };
}
```

---

### Phase 3: React Hooks (1 hour)

#### 3.1 Create useCycle Hook

**File**: `frontend/src/hooks/useCycle.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Cycle, UpdateCycleInput, CycleWithProgress } from '../types/cycle';

export function useCycle() {
  return useQuery({
    queryKey: ['cycle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No active cycle found - should have been created by trigger
          throw new Error('Nessun ciclo attivo trovato.');
        }
        throw error;
      }

      return data as Cycle;
    },
  });
}

export function useCycleWithProgress() {
  const { data: cycle, ...rest } = useCycle();

  const cycleWithProgress: CycleWithProgress | undefined = cycle
    ? {
        ...cycle,
        progress_percentage: Math.round((cycle.current_week / cycle.duration_weeks) * 100),
        is_complete: cycle.current_week === cycle.duration_weeks,
      }
    : undefined;

  return { data: cycleWithProgress, ...rest };
}

export function useUpdateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCycleInput) => {
      // Client-side validation
      if (input.current_week !== undefined && input.duration_weeks !== undefined) {
        if (input.current_week > input.duration_weeks) {
          throw new Error(
            'La settimana corrente non può superare la durata. Imposta prima una durata maggiore.'
          );
        }
      }

      if (input.duration_weeks !== undefined && input.duration_weeks <= 0) {
        throw new Error('La durata deve essere almeno 1 settimana. Inserisci un numero positivo.');
      }

      if (input.current_week !== undefined && input.current_week <= 0) {
        throw new Error('La settimana deve essere almeno 1. Inserisci un numero positivo.');
      }

      const { data, error } = await supabase
        .from('cycles')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'active')
        .select()
        .single();

      if (error) throw error;
      return data as Cycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cycle']);
    },
  });
}

export function useCompleteCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error} = await supabase
        .from('cycles')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('status', 'active')
        .select()
        .single();

      if (error) throw error;
      return data as Cycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cycle']);
    },
  });
}

export function useCreateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: { duration_weeks?: number }) => {
      const { data, error } = await supabase
        .from('cycles')
        .insert({
          duration_weeks: input?.duration_weeks || 12,
          current_week: 1,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            'Hai già un ciclo attivo. Completa il ciclo corrente prima di crearne uno nuovo.'
          );
        }
        throw error;
      }

      return data as Cycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cycle']);
    },
  });
}
```

#### 3.2 Create useCycleEvents Hook

**File**: `frontend/src/hooks/useCycleEvents.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CycleEvent } from '../types/cycle';

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
```

---

### Phase 4: UI Components (2-3 hours)

#### 4.1 CycleProgressBanner Component

**File**: `frontend/src/components/dashboard/CycleProgressBanner.tsx`

```typescript
import { AlertCircle } from 'lucide-react';
import { useCycleWithProgress, useCompleteCycle, useCreateCycle } from '../../hooks/useCycle';

export function CycleProgressBanner() {
  const { data: cycle, isLoading } = useCycleWithProgress();
  const completeCycle = useCompleteCycle();
  const createCycle = useCreateCycle();

  if (isLoading) {
    return (
      <div className="w-full bg-gray-100 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-gray-300 rounded w-1/3"></div>
      </div>
    );
  }

  if (!cycle) {
    return null; // Should not happen - users always have a cycle
  }

  const isComplete = cycle.is_complete;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Ciclo di Coltivazione
          </h3>
          <p className="text-sm text-gray-600">
            Settimana {cycle.current_week} di {cycle.duration_weeks}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-green-600">
            {cycle.progress_percentage}%
          </span>
          <p className="text-sm text-gray-600">completato</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className="bg-green-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${cycle.progress_percentage}%` }}
        />
      </div>

      {/* Completion Alert */}
      {isComplete && cycle.status === 'active' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-900">
              Ciclo Completato!
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Hai raggiunto la settimana finale del ciclo. Vuoi iniziare un nuovo ciclo?
            </p>
          </div>
          <button
            onClick={() => {
              if (confirm('Completare questo ciclo e iniziarne uno nuovo?')) {
                completeCycle.mutate(undefined, {
                  onSuccess: () => createCycle.mutate(),
                });
              }
            }}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            disabled={completeCycle.isPending || createCycle.isPending}
          >
            Inizia Nuovo Ciclo
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 4.2 CycleSettings Component

**File**: `frontend/src/components/settings/CycleSettings.tsx`

```typescript
import { useState } from 'react';
import { useCycle, useUpdateCycle } from '../../hooks/useCycle';

export function CycleSettings() {
  const { data: cycle, isLoading } = useCycle();
  const updateCycle = useUpdateCycle();

  const [duration, setDuration] = useState(cycle?.duration_weeks || 12);
  const [currentWeek, setCurrentWeek] = useState(cycle?.current_week || 1);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateCycle.mutateAsync({
        duration_weeks: duration,
        current_week: currentWeek,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    }
  };

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Configurazione Ciclo
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Durata Ciclo (settimane)
          </label>
          <input
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Settimana Corrente
          </label>
          <input
            type="number"
            min="1"
            max={duration}
            value={currentWeek}
            onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">
            Aggiorna manualmente la settimana corrente del tuo ciclo
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={updateCycle.isPending}
          className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {updateCycle.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </form>
    </div>
  );
}
```

#### 4.3 Update Dashboard Page

**File**: `frontend/src/pages/Dashboard.tsx`

```typescript
import { CycleProgressBanner } from '../components/dashboard/CycleProgressBanner';

export function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-6">
      {/* Add banner at top */}
      <CycleProgressBanner />

      {/* Existing dashboard content */}
      {/* ... */}
    </div>
  );
}
```

#### 4.4 Update Settings Page

**File**: `frontend/src/pages/Settings.tsx`

```typescript
import { CycleSettings } from '../components/settings/CycleSettings';

export function Settings() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Impostazioni</h1>

      {/* Add cycle settings section */}
      <CycleSettings />

      {/* Existing settings content */}
      {/* ... */}
    </div>
  );
}
```

---

### Phase 5: UI Terminology Replacement (30 minutes)

```bash
# Find all instances of "progetto" (case-insensitive)
cd frontend/src
grep -ri "progetto" .

# Replace manually in files:
# - Components JSX/TSX
# - Type definitions
# - Comments
# - String literals

# Verification: search again to ensure 100% replacement
grep -ri "progetto" .
```

---

## Testing

### Manual Testing Checklist

- [ ] New user registration creates cycle automatically
- [ ] Dashboard banner displays correct progress
- [ ] Settings page allows duration/week updates
- [ ] Validation prevents current_week > duration
- [ ] Validation prevents negative/zero values
- [ ] 100% completion shows alert + button
- [ ] Complete cycle → create new cycle workflow
- [ ] All "progetto" references replaced with "Ciclo"
- [ ] Cycle events logged in database
- [ ] RLS prevents cross-user data access

### Database Verification

```sql
-- Check cycles created
SELECT * FROM public.cycles;

-- Check events logged
SELECT * FROM public.cycle_events ORDER BY created_at DESC;

-- Verify RLS (should only see own cycles)
SELECT * FROM public.cycles WHERE user_id = auth.uid();
```

---

## Deployment

```bash
# 1. Apply migrations (already done)

# 2. Build frontend
cd frontend
npm run build

# 3. Deploy (Netlify/Vercel)
# Follow existing deployment process

# 4. Verify production
# - Test new user registration
# - Test existing users have cycles
# - Test cycle updates
```

---

## Troubleshooting

**Issue**: Existing users don't have cycles
**Solution**: Run migration `20251120_migrate_legacy_users_cycles.sql` manually

**Issue**: "current_week > duration" error despite validation
**Solution**: Check client-side validation logic, ensure state sync

**Issue**: Cycle events not being created
**Solution**: Verify triggers are installed, check Supabase logs

**Issue**: RLS blocking queries
**Solution**: Verify `auth.uid()` is available, check session token

---

## Next Steps

After completing this feature:
1. Monitor cycle event data for analytics
2. Plan AI/ML training pipeline
3. Consider adding cycle templates (out of scope for MVP)
4. Implement automated week progression (future feature)
