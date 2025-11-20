# API Contract: Cycles

**Feature**: Cycle Management System
**Date**: 2025-11-20
**Backend**: Supabase (PostgreSQL + PostgREST)

## Overview

This contract defines the interface for interacting with cycles via Supabase. All operations use Supabase client library with automatic RLS enforcement.

## Table Access Patterns

### Get Active Cycle

**Description**: Retrieve the user's currently active cycle

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycles')
  .select('*')
  .eq('user_id', userId)
  .eq('status', 'active')
  .single();
```

**TypeScript Signature**:
```typescript
function getActiveCycle(userId: string): Promise<Cycle>
```

**Request**: Automatic via RLS (uses `auth.uid()`)

**Response** (Success - 200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "duration_weeks": 12,
  "current_week": 4,
  "status": "active",
  "started_at": "2025-11-01T10:00:00Z",
  "completed_at": null,
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-15T14:30:00Z"
}
```

**Response** (No Active Cycle - 406):
```json
{
  "code": "PGRST116",
  "details": null,
  "hint": null,
  "message": "The result contains 0 rows"
}
```

**Error Handling**:
- No active cycle exists → Create one via `createCycle()`
- Multiple active cycles (data integrity issue) → Admin intervention needed

**RLS**: Enforced automatically (users see only their cycles)

---

### Update Cycle

**Description**: Update duration or current week of active cycle

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycles')
  .update({
    duration_weeks: newDuration,
    current_week: newWeek,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('status', 'active')
  .select()
  .single();
```

**TypeScript Signature**:
```typescript
interface UpdateCycleInput {
  duration_weeks?: number;
  current_week?: number;
}

function updateCycle(input: UpdateCycleInput): Promise<Cycle>
```

**Request Body**:
```json
{
  "duration_weeks": 16,
  "current_week": 5
}
```

**Validation Rules** (Client-side + Database):
1. `duration_weeks` must be > 0
2. `current_week` must be > 0
3. `current_week` must be <= `duration_weeks`

**Response** (Success - 200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "duration_weeks": 16,
  "current_week": 5,
  "status": "active",
  "started_at": "2025-11-01T10:00:00Z",
  "completed_at": null,
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-20T09:15:00Z"
}
```

**Error Responses**:

**Validation Error (422)**:
```json
{
  "code": "23514",
  "message": "new row for relation \"cycles\" violates check constraint \"cycles_current_week_check\"",
  "details": "Failing row contains (..., current_week=15, duration_weeks=12, ...)"
}
```

**User-Friendly Error Messages** (Client-Side Mapping):
```typescript
// Map database errors to user-friendly messages
const errorMessages: Record<string, string> = {
  'cycles_current_week_check': 'La settimana corrente non può superare la durata. Imposta prima una durata maggiore.',
  'cycles_duration_weeks_check': 'La durata deve essere almeno 1 settimana. Inserisci un numero positivo.',
};
```

**Side Effects**:
- Triggers `on_cycle_updated` function → inserts event into `cycle_events`
- Invalidates React Query cache for `['cycle', userId]`

---

### Complete Cycle

**Description**: Mark the current cycle as completed and allow creation of new cycle

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycles')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
  .eq('status', 'active')
  .select()
  .single();
```

**TypeScript Signature**:
```typescript
function completeCycle(): Promise<Cycle>
```

**Request**: No body (uses authenticated user)

**Response** (Success - 200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "duration_weeks": 12,
  "current_week": 12,
  "status": "completed",
  "started_at": "2025-11-01T10:00:00Z",
  "completed_at": "2025-11-20T10:00:00Z",
  "created_at": "2025-11-01T10:00:00Z",
  "updated_at": "2025-11-20T10:00:00Z"
}
```

**Preconditions**:
- User has an active cycle
- Recommended (not enforced): `current_week` == `duration_weeks`

**Side Effects**:
- Triggers `on_cycle_completed` function → inserts 'completed' event
- Allows user to create new active cycle

---

### Create Cycle

**Description**: Create a new active cycle (only allowed if no active cycle exists)

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycles')
  .insert({
    user_id: userId,
    duration_weeks: 12, // default
    current_week: 1,    // default
    status: 'active'
  })
  .select()
  .single();
```

**TypeScript Signature**:
```typescript
interface CreateCycleInput {
  duration_weeks?: number; // default: 12
  current_week?: number;    // default: 1
}

function createCycle(input?: CreateCycleInput): Promise<Cycle>
```

**Request Body** (Optional):
```json
{
  "duration_weeks": 16,
  "current_week": 1
}
```

**Response** (Success - 201):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "user_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "duration_weeks": 16,
  "current_week": 1,
  "status": "active",
  "started_at": "2025-11-20T10:00:00Z",
  "completed_at": null,
  "created_at": "2025-11-20T10:00:00Z",
  "updated_at": "2025-11-20T10:00:00Z"
}
```

**Error Response** (Active Cycle Already Exists - 409):
```json
{
  "code": "23505",
  "message": "duplicate key value violates unique constraint \"cycles_one_active_per_user\"",
  "details": "Key (user_id)=(a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11) already exists."
}
```

**Client-Side Error Handling**:
```typescript
if (error?.code === '23505') {
  throw new Error('Hai già un ciclo attivo. Completa il ciclo corrente prima di crearne uno nuovo.');
}
```

**Side Effects**:
- Triggers `on_cycle_created` function → inserts 'created' event
- New cycle becomes active cycle for queries

---

### Get Cycle History

**Description**: Retrieve all cycles (active + completed) for analytics

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .from('cycles')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**TypeScript Signature**:
```typescript
function getCycleHistory(userId: string): Promise<Cycle[]>
```

**Response** (Success - 200):
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "status": "active",
    "started_at": "2025-11-20T10:00:00Z",
    "completed_at": null,
    ...
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "started_at": "2025-08-01T10:00:00Z",
    "completed_at": "2025-10-24T18:30:00Z",
    ...
  }
]
```

**Pagination** (Future):
```typescript
.range(0, 9) // First 10 cycles
```

---

## Supabase RPC Functions

### Calculate Cycle Progress

**Description**: Server-side function to compute progress percentage

**SQL Function**:
```sql
CREATE OR REPLACE FUNCTION get_cycle_progress(cycle_id UUID)
RETURNS TABLE (
  cycle_id UUID,
  progress_percentage NUMERIC,
  is_complete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS cycle_id,
    ROUND((c.current_week::NUMERIC / c.duration_weeks::NUMERIC) * 100, 2) AS progress_percentage,
    (c.current_week = c.duration_weeks) AS is_complete
  FROM cycles c
  WHERE c.id = cycle_id;
END;
$$ LANGUAGE plpgsql;
```

**Supabase Query**:
```typescript
const { data, error } = await supabase
  .rpc('get_cycle_progress', { cycle_id: cycleId });
```

**Response**:
```json
{
  "cycle_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress_percentage": 33.33,
  "is_complete": false
}
```

**Note**: Can also be computed client-side for simplicity. RPC function provided for consistency.

---

## Real-time Subscriptions (Optional Enhancement)

**Description**: Subscribe to cycle changes for multi-device sync

**Supabase Subscription**:
```typescript
const subscription = supabase
  .channel('cycle-changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'cycles',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Cycle updated:', payload.new);
      // Invalidate React Query cache
      queryClient.invalidateQueries(['cycle']);
    }
  )
  .subscribe();
```

**Use Case**: User updates cycle on desktop, mobile app reflects change instantly.

**Note**: Optional - basic polling with React Query `refetchInterval` may suffice for MVP.

---

## Error Codes Summary

| Code | PostgreSQL Meaning | User-Friendly Message |
|------|-------------------|----------------------|
| `23505` | Unique constraint violation | "Hai già un ciclo attivo. Completa il ciclo corrente prima di crearne uno nuovo." |
| `23514` | Check constraint violation (current_week > duration) | "La settimana corrente non può superare la durata. Imposta prima una durata maggiore." |
| `23514` | Check constraint violation (duration <= 0) | "La durata deve essere almeno 1 settimana. Inserisci un numero positivo." |
| `PGRST116` | No rows returned (empty result) | "Nessun ciclo attivo trovato. Crea un nuovo ciclo per iniziare." |
| `42501` | RLS policy violation (insufficient permissions) | "Non hai il permesso di accedere a questo ciclo." |

---

## Testing Checklist

- [ ] Create cycle on user registration (trigger)
- [ ] Get active cycle (existing user)
- [ ] Update cycle duration (valid range)
- [ ] Update current week (valid range)
- [ ] Update current week > duration (validation error)
- [ ] Update duration < current week (validation error)
- [ ] Complete cycle (status transition)
- [ ] Create new cycle after completion
- [ ] Attempt to create cycle with active one (conflict error)
- [ ] RLS: User A cannot access User B's cycles
- [ ] Cycle events generated for all operations

---

## React Query Integration Example

```typescript
// hooks/useCycle.ts
export function useCycle() {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ['cycle', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycles')
        .select('*')
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No active cycle, create one
          return createCycle();
        }
        throw error;
      }

      return data as Cycle;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateCycle() {
  const queryClient = useQueryClient();
  const { trackEvent } = useCycleEvents();

  return useMutation({
    mutationFn: async (input: UpdateCycleInput) => {
      // Client-side validation
      if (input.current_week && input.duration_weeks) {
        if (input.current_week > input.duration_weeks) {
          throw new Error('La settimana corrente non può superare la durata. Imposta prima una durata maggiore.');
        }
      }

      const { data, error } = await supabase
        .from('cycles')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('status', 'active')
        .select()
        .single();

      if (error) throw error;

      // Track event (handled by database trigger, but can also track client-side)
      // await trackEvent(...)

      return data as Cycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cycle']);
    },
  });
}
```
