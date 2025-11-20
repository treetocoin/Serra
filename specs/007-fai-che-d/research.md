# Research: Cycle Management System

**Feature**: Rinominare Progetto in Ciclo e Gestione Durata Ciclo
**Date**: 2025-11-20
**Status**: Complete

## Overview

This document consolidates research findings and technology decisions for implementing the cycle management feature. All "NEEDS CLARIFICATION" items from the Technical Context have been researched and resolved.

## Key Decisions

### 1. Database Schema Design: Cycles Table

**Decision**: Create `cycles` table with these columns:
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to auth.users)
- `duration_weeks` (INTEGER, default 12, check > 0)
- `current_week` (INTEGER, default 1, check > 0)
- `status` (TEXT, enum: 'active' | 'completed', default 'active')
- `started_at` (TIMESTAMPTZ, default NOW())
- `completed_at` (TIMESTAMPTZ, nullable)
- `created_at` (TIMESTAMPTZ, default NOW())
- `updated_at` (TIMESTAMPTZ, default NOW())

**Rationale**:
- Single active cycle per user enforced via unique constraint on `(user_id, status)` WHERE `status = 'active'`
- Manual week tracking (user updates `current_week`) per spec assumption
- `duration_weeks` and `current_week` validation enforced at database level
- Timestamps enable AI/ML training data (timeline analysis)

**Alternatives Considered**:
- **JSON column for flexible metadata**: Rejected - structured columns better for querying and indexing
- **Separate cycle_history table**: Deferred - out of scope per spec (archivio storico excluded)
- **Auto-increment week based on dates**: Rejected - spec explicitly states manual tracking

**Best Practices Applied**:
- Row Level Security (RLS) policies: users can only access their own cycles
- Check constraints for data validation (duration > 0, current_week > 0, current_week <= duration)
- Timestamps for audit trail
- UUID for distributed system compatibility

### 2. Event Tracking: Cycle Events Audit Log

**Decision**: Create `cycle_events` table for comprehensive event tracking:
- `id` (UUID, primary key)
- `cycle_id` (UUID, foreign key to cycles)
- `user_id` (UUID, foreign key to auth.users, for RLS)
- `event_type` (TEXT, enum: 'created' | 'duration_updated' | 'week_updated' | 'completed' | 'sensor_reading_associated')
- `metadata` (JSONB, flexible event-specific data)
- `previous_state` (JSONB, snapshot before change)
- `new_state` (JSONB, snapshot after change)
- `created_at` (TIMESTAMPTZ, default NOW())

**Rationale**:
- AI/ML training requirement (FR-014, FR-015) needs rich temporal data
- JSONB for flexible metadata while maintaining structured event_type
- State snapshots enable replay/analysis of cycle progression
- Index on `(cycle_id, created_at)` for efficient time-series queries
- Append-only table (no updates/deletes) for audit integrity

**Alternatives Considered**:
- **Application-level logging only**: Rejected - doesn't meet "100% persistence" requirement (SC-007)
- **Separate tables per event type**: Rejected - over-engineering for current scope
- **PostgreSQL triggers for automatic tracking**: Partially adopted - triggers for auto-events (creation), manual calls for user actions

**Best Practices Applied**:
- JSONB for semi-structured data
- Indexed for time-series queries
- RLS policies for data isolation
- Immutable audit trail pattern

### 3. React Component Architecture

**Decision**: Create two main components following existing project patterns:

**CycleProgressBanner** (Dashboard):
- Full-width container (w-full) at top of dashboard
- Shows: "Settimana {current} di {duration} - {percentage}% completato"
- Visual progress bar using Tailwind CSS
- Conditional rendering for 100% completion state (show alert + button)
- Uses `useCycle()` hook for data fetching

**CycleSettings** (Settings Page):
- Form section within existing Settings page
- Two numeric inputs: duration_weeks, current_week
- Client-side validation + helpful error messages (as per clarification Q3)
- Optimistic updates with React Query
- Uses `useCycle()` and `useCycleEvents()` hooks

**Rationale**:
- Matches existing component structure (`frontend/src/components/`)
- Reuses established patterns (React Query, Tailwind, Lucide icons)
- Separation of concerns: presentation (components) vs data (hooks)

**Alternatives Considered**:
- **Single monolithic component**: Rejected - violates single responsibility
- **Context API for cycle data**: Rejected - React Query already handles server state
- **Sidebar placement for indicator**: Rejected - spec clarification specified full-width banner

**Best Practices Applied**:
- Component composition
- Custom hooks for data logic
- TypeScript for type safety
- Responsive design (Tailwind)

### 4. Data Migration Strategy

**Decision**: Multi-step migration approach:
1. Create `cycles` and `cycle_events` tables
2. Create trigger function to auto-create cycle on user signup
3. Run one-time migration script to backfill cycles for existing users
4. Add `cycle_id` column to `devices`, `sensors`, `actuators`, `sensor_readings` tables (nullable initially)
5. Update backfill script to associate all historical data with user's first cycle

**Rationale**:
- Phased approach reduces migration risk
- Nullable `cycle_id` allows gradual migration without breaking existing functionality
- Historical data association (clarification Q1) implemented in migration script
- Trigger ensures all future users automatically get cycles

**Alternatives Considered**:
- **Lazy migration (on first login)**: Rejected - clarification Q1 specified batch script
- **Non-nullable cycle_id immediately**: Rejected - too risky, requires atomic multi-table update
- **Separate junction tables**: Rejected - direct foreign key simpler for single active cycle per user

**Best Practices Applied**:
- Backwards-compatible migrations
- Idempotent scripts (can be re-run safely)
- Transaction-wrapped operations
- Rollback procedures documented

### 5. UI Terminology Replacement

**Decision**: Search-and-replace strategy with verification:
- Use IDE/ripgrep to find all instances of "progetto" (case-insensitive)
- Replace in:
  - React component JSX/TSX files
  - Type definitions
  - Comments and documentation
  - No database changes (schema uses English already)
- Verification: automated test to scan for remaining "progetto" instances

**Rationale**:
- Simple, deterministic approach
- SC-004 requires 100% replacement
- Italian in UI layer only (backend is English)

**Alternatives Considered**:
- **i18n/localization library**: Deferred - not required for MVP, can add later
- **Manual search**: Rejected - error-prone, doesn't scale

**Best Practices Applied**:
- Automated verification
- Single source of truth for terminology

### 6. Performance Optimization

**Decision**: Address performance goals through:
- **SC-001 (<1s cycle creation)**: Database trigger executes within transaction, minimal overhead
- **SC-003 (<100ms dashboard load)**: React Query caching + PostgreSQL index on `(user_id, status)`
- **SC-002 (<30s settings save)**: Optimistic updates + debounced validation

**Rationale**:
- Targets are easily achievable with current tech stack
- No special optimizations needed beyond standard practices

**Alternatives Considered**:
- **Edge caching**: Not needed for current scale
- **WebSockets for real-time updates**: Out of scope

**Best Practices Applied**:
- Database indexing
- Client-side caching (React Query)
- Optimistic UI updates

## Technology Stack Confirmation

All technologies confirmed from existing project:
- ✅ TypeScript 5.9.3
- ✅ React 19
- ✅ @supabase/supabase-js ^2.74
- ✅ @tanstack/react-query ^5.90
- ✅ Tailwind CSS ^4.1
- ✅ Lucide React (icons)
- ✅ PostgreSQL (via Supabase)

**No new dependencies required** - feature can be implemented entirely with existing stack.

## Supabase Patterns Research

### RLS Policy Patterns

Standard pattern for `cycles` table:
```sql
-- Users can only see their own cycles
CREATE POLICY "Users can view their own cycles"
  ON public.cycles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own cycles (via trigger primarily)
CREATE POLICY "Users can insert their own cycles"
  ON public.cycles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own cycles
CREATE POLICY "Users can update their own cycles"
  ON public.cycles FOR UPDATE
  USING (auth.uid() = user_id);
```

Similar patterns for `cycle_events` table.

### Trigger Best Practices

Auto-create cycle on user registration:
```sql
CREATE OR REPLACE FUNCTION public.create_default_cycle()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cycles (user_id, duration_weeks, current_week, status)
  VALUES (NEW.id, 12, 1, 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_create_cycle
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_cycle();
```

### React Query Patterns

Standard query pattern for cycles:
```typescript
export function useCycle() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ['cycle', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
```

Mutation pattern for updates:
```typescript
export function useUpdateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ duration_weeks, current_week }) => {
      // Validation
      if (current_week > duration_weeks) {
        throw new Error('La settimana corrente non può superare la durata. Imposta prima una durata maggiore.');
      }

      // Update
      const { data, error } = await supabase
        .from('cycles')
        .update({ duration_weeks, current_week, updated_at: new Date().toISOString() })
        .eq('status', 'active')
        .select()
        .single();

      if (error) throw error;

      // Track event
      await trackCycleEvent({
        cycle_id: data.id,
        event_type: 'week_updated',
        // ... metadata
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cycle']);
    },
  });
}
```

## Open Questions / Future Work

1. **Testing Strategy**: No test framework currently in project - needs discussion
2. **Error Monitoring**: No observability tooling specified - recommend Sentry or similar
3. **Analytics Integration**: Cycle events could feed into analytics platform beyond AI training
4. **Cycle Templates**: Out of scope now, but architecture supports future addition

## Summary

All technical unknowns resolved. Ready to proceed to Phase 1 (data model + contracts generation).
