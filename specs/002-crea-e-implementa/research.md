# Research: Actuator Management and Automation Rules

**Date**: 2025-10-09
**Feature**: Actuator Management and Sensor-Actuator Automation
**Branch**: `002-crea-e-implementa`

## Overview

This research document explores technical approaches for implementing actuator management and sensor-actuator automation rules within the existing Supabase + React serverless architecture from feature 001.

---

## 1. Rule Evaluation Architecture

### Decision: **PostgreSQL Triggers + Stored Procedures**

**Rationale**:
- **Zero latency**: Triggers execute in <1ms vs Edge Functions with 42-400ms cold starts
- **Data locality**: Rule evaluation happens where data lives (no network hops)
- **ACID guarantees**: Atomic sensor reading + rule evaluation in single transaction
- **Cost efficient**: Included in database compute, no additional Edge Function costs
- **Serverless native**: Fully leverages PostgreSQL compute with zero additional infrastructure

**Implementation Approach**:
1. Create trigger on `sensor_readings` table (AFTER INSERT)
2. Trigger calls PL/pgSQL function `evaluate_automation_rules()`
3. Function queries active rules, evaluates conditions, queues commands
4. Priority-based conflict resolution: higher priority rules evaluated first

**Performance Considerations**:
- Expected latency: 10-70ms for 50 rules (well under 10s budget)
- Trigger overhead: <1ms
- Rule evaluation: 1ms per rule average
- Scales easily to 100+ rules per user

**Alternatives Considered**:
- ❌ **Client-side evaluation**: Cannot guarantee autonomous operation, requires continuous polling
- ❌ **Edge Functions**: 42-400ms cold start latency, HTTP overhead, unnecessary for synchronous data-local task

---

## 2. Rule Condition Data Model

### Decision: **Relational Tables (rule_condition_groups + rule_conditions)**

**Schema Structure**:
```
automation_rules
  └── rule_condition_groups (OR between groups)
        └── rule_conditions (AND within group)
```

**Rationale**:
- **Query performance**: Postgres query planner optimizes joins, predictable execution plans
- **Type safety**: CHECK constraints, foreign keys, column types prevent invalid data
- **RLS compatible**: Row-level security policies cascade naturally through foreign keys
- **UI mapping**: Clean mapping to React component tree (groups = OR blocks, conditions = AND items)
- **Scalability**: For 1-5 conditions per rule, normalized structure is optimal

**Query Pattern Example**:
```sql
-- Evaluate rules with AND/OR logic
WITH group_evaluations AS (
  SELECT rule_id, BOOL_AND(condition_met) AS group_satisfied
  FROM rule_conditions
  GROUP BY rule_id, group_id
)
SELECT rule_id, BOOL_OR(group_satisfied) AS rule_triggered
FROM group_evaluations
GROUP BY rule_id;
```

**Tradeoffs**:
- ✅ Pros: Performance, type safety, RLS compatibility, maintainability
- ⚠️ Cons: Multiple INSERT queries for CRUD (mitigated with transactions)

**Alternatives Considered**:
- ❌ **JSONB single table**: No query optimization, difficult RLS policies, no referential integrity
- ❌ **Flat conditions table**: Cannot express OR logic (dealbreaker)

---

## 3. Hysteresis Implementation

### Decision: **Store state in automation_rules table**

**Schema Addition**:
```sql
ALTER TABLE automation_rules
ADD COLUMN on_threshold NUMERIC,
ADD COLUMN off_threshold NUMERIC,
ADD COLUMN current_actuator_state TEXT,
ADD COLUMN last_state_change_at TIMESTAMPTZ,
ADD COLUMN min_state_change_interval_seconds INTEGER DEFAULT 60;
```

**Rationale**:
- **Simplicity**: Single table update, no additional joins
- **Performance**: Direct state lookup in rule evaluation
- **Serverless friendly**: No persistent background workers needed
- **Atomic updates**: State changes are transactional

**Implementation**:
```sql
CREATE FUNCTION evaluate_hysteresis_rule(rule_id UUID, sensor_value NUMERIC)
RETURNS BOOLEAN AS $$
  -- Check time interval since last change
  -- Apply hysteresis logic (ON at threshold1, OFF at threshold2)
  -- Update current_actuator_state atomically
$$ LANGUAGE plpgsql;
```

**Integration**: Database trigger calls hysteresis evaluation function on sensor data insert

**Alternatives Considered**:
- ❌ **Separate state history table**: Added complexity, slower queries
- ❌ **Infer from commands table**: Unreliable, commands can fail/expire

---

## 4. Schedule-Based Rules

### Decision: **Supabase Edge Functions + pg_cron**

**Schema Addition**:
```sql
CREATE TABLE schedule_rules (
  automation_rule_id UUID REFERENCES automation_rules(id),
  schedule_type TEXT, -- 'once', 'daily', 'weekly', 'cron'
  time_of_day TIME,
  days_of_week INTEGER[],
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ
);
```

**Rationale**:
- **Native Supabase**: No external cron services needed
- **Reliable**: pg_cron included in all Supabase plans (free tier too)
- **Serverless**: Edge Functions scale automatically
- **Timezone aware**: Store UTC, convert for display

**Implementation**:
1. Edge Function `/supabase/functions/execute-scheduled-rules/index.ts` queries due schedules
2. pg_cron triggers function every minute: `SELECT cron.schedule('* * * * *', 'http_post(...)')`
3. Function executes actions, calculates next_run_at, updates schedule

**Performance**:
- Precision: ±1 minute (sufficient for greenhouse)
- Scalability: 200 req/sec Edge Function limit (adequate)

**Alternatives Considered**:
- ❌ **Client-side polling**: Unreliable (only works when client open)
- ❌ **Pure database triggers**: No time-based trigger mechanism in Postgres
- ❌ **External cron service**: Added infrastructure, breaks serverless model

---

## 5. Rule Execution Logs

### Decision: **Simple logs table with retention policy**

**Schema**:
```sql
CREATE TABLE rule_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  rule_id UUID REFERENCES automation_rules(id),
  sensor_id UUID,
  sensor_value NUMERIC,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  command_id UUID REFERENCES commands(id),
  execution_status TEXT
);

-- Retention: 90 days or 1000 executions per rule
CREATE INDEX idx_execution_logs_rule_time
ON rule_execution_logs(rule_id, executed_at DESC);
```

**Rationale**:
- **Simple**: Standard table, easy to query
- **Sufficient**: Stores triggering sensor values for debugging
- **Retention**: pg_cron cleanup job deletes old logs
- **No TimescaleDB needed**: Not available on free Supabase tier

**Query for UI**:
```sql
-- Last 10 executions for a rule
SELECT * FROM rule_execution_logs
WHERE rule_id = $1
ORDER BY executed_at DESC
LIMIT 10;
```

**Alternatives Considered**:
- ⏸️ **TimescaleDB hypertable**: Not available on Supabase free tier
- ❌ **Separate execution details table**: Over-engineered for this use case

---

## 6. Priority-Based Conflict Resolution

### Implementation Strategy

**Database Support**:
```sql
ALTER TABLE automation_rules ADD COLUMN priority INTEGER DEFAULT 0;

-- Query rules by priority (higher number = higher priority)
SELECT * FROM automation_rules
WHERE user_id = $1 AND is_active = TRUE
ORDER BY priority DESC, created_at DESC;
```

**Evaluation Logic**:
```sql
-- In trigger function
FOR rule IN
  SELECT * FROM automation_rules
  WHERE user_id = device_user_id AND is_active = TRUE
  ORDER BY priority DESC, created_at DESC
LOOP
  IF evaluate_conditions(rule) THEN
    queue_command(rule);
    EXIT; -- First matching rule wins (highest priority)
  END IF;
END LOOP;
```

**Tiebreaker**: If multiple rules have same priority, most recently created wins (creation timestamp)

---

## 7. Technology Stack Summary

### Extends Feature 001 Stack

**No Changes**:
- Frontend: React 18+ with TypeScript, Vite
- Database: Supabase (PostgreSQL + RLS)
- Authentication: Supabase Auth
- Deployment: Netlify (frontend)
- Testing: Vitest + React Testing Library

**New Additions**:
- **PL/pgSQL functions**: For rule evaluation
- **Database triggers**: On sensor_readings table
- **Edge Functions**: For scheduled rules (1 function)
- **pg_cron**: For triggering scheduled evaluations

### Architecture Benefits

- **Zero new infrastructure**: Everything within Supabase + Netlify
- **Minimal added complexity**: 3 new tables, 2 PL/pgSQL functions, 1 Edge Function
- **Serverless throughout**: No backend servers to manage
- **Cost effective**: All features included in free/pro tiers

---

## 8. Performance Expectations

### Rule Evaluation (Sensor-Based)

| Metric | Target | Expected |
|--------|--------|----------|
| Trigger latency | <10s | <100ms |
| 50 rules evaluation | <10s | 10-70ms |
| Condition query | - | 2-5ms |
| Command insertion | - | 2-10ms |

### Schedule-Based Rules

| Metric | Target | Expected |
|--------|--------|----------|
| Execution precision | ±5min | ±1min |
| Concurrent schedules | 50 | 200+ |
| Edge Function latency | - | 50-200ms |

### Database Storage

| Entity | Records/User | Storage/Record | Total |
|--------|--------------|----------------|-------|
| automation_rules | 10-50 | 1KB | 10-50KB |
| rule_conditions | 50-250 | 0.5KB | 25-125KB |
| rule_execution_logs | 1000 (retained) | 0.3KB | 300KB |

**Total per user**: ~350KB (negligible)

---

## 9. Security Considerations

### Row Level Security (RLS)

All automation tables protected by RLS:
```sql
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rules"
ON automation_rules FOR ALL
USING (user_id = auth.uid());

-- Cascade through foreign keys
CREATE POLICY "Users manage own conditions"
ON rule_conditions FOR ALL
USING (
  group_id IN (
    SELECT id FROM rule_condition_groups
    WHERE rule_id IN (
      SELECT id FROM automation_rules WHERE user_id = auth.uid()
    )
  )
);
```

### Trigger Security

Triggers execute as `SECURITY DEFINER` to bypass RLS for automation:
```sql
CREATE FUNCTION evaluate_automation_rules()
RETURNS TRIGGER
SECURITY DEFINER -- Bypass RLS
AS $$ ... $$;
```

This is safe because:
- Function internally filters by user_id
- No user input in trigger execution
- Foreign keys enforce referential integrity

---

## 10. Migration Path

### Phase 1: Database Schema (Week 1)
1. Create `automation_rules`, `rule_condition_groups`, `rule_conditions` tables
2. Create `rule_actions`, `rule_execution_logs`, `schedule_rules` tables
3. Add RLS policies
4. Create indexes

### Phase 2: Rule Evaluation (Week 1-2)
1. Implement `evaluate_automation_rules()` PL/pgSQL function
2. Create trigger on `sensor_readings` table
3. Add `evaluate_hysteresis_rule()` function
4. Test with sample rules

### Phase 3: Scheduled Rules (Week 2)
1. Deploy Edge Function `execute-scheduled-rules`
2. Configure pg_cron job
3. Test daily/weekly schedules

### Phase 4: Frontend (Week 2-3)
1. Build Actuators.page with management UI
2. Build Automation.page with rule editor
3. Implement ConditionBuilder component
4. Add RuleHistory display
5. Add priority management UI

### Phase 5: Testing & Optimization (Week 3-4)
1. Load test with 50+ rules per user
2. Monitor trigger performance
3. Add execution log retention policies
4. Document best practices

---

## 11. Key Design Decisions Summary

| Decision Point | Choice | Rationale |
|----------------|--------|-----------|
| Rule Evaluation | Postgres Triggers | Zero latency, data locality, ACID guarantees |
| Condition Model | Relational Tables | Performance, type safety, RLS compatibility |
| Hysteresis | State in automation_rules | Simplicity, performance, serverless friendly |
| Schedules | Edge Function + pg_cron | Native Supabase, reliable, no external deps |
| Execution Logs | Simple table + retention | Sufficient for debugging, easy to query |
| Conflict Resolution | Priority + timestamp | User control, deterministic behavior |

---

## 12. References

### Supabase Documentation
- Database Triggers: https://supabase.com/docs/guides/database/postgres/triggers
- Edge Functions: https://supabase.com/docs/guides/functions
- pg_cron Extension: https://supabase.com/docs/guides/database/extensions/pg_cron
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security

### PostgreSQL Documentation
- PL/pgSQL Functions: https://www.postgresql.org/docs/current/plpgsql.html
- Triggers: https://www.postgresql.org/docs/current/sql-createtrigger.html
- Boolean Aggregates: https://www.postgresql.org/docs/current/functions-aggregate.html

### Performance Research
- PostgreSQL Trigger Performance: https://infinitelambda.com/postgresql-triggers/
- Supabase Edge Functions Performance: https://supabase.com/blog/persistent-storage-for-faster-edge-functions

---

## Conclusion

All technical unknowns resolved. The automation system will:
- Use PostgreSQL triggers for sensor-based rule evaluation (<100ms latency)
- Store conditions in relational tables for performance and type safety
- Implement hysteresis via state columns in automation_rules table
- Use Edge Functions + pg_cron for scheduled rules (±1min precision)
- Log executions in simple table with 90-day retention

This approach extends the existing serverless architecture with zero new infrastructure while delivering all required features within performance budgets.

**Next Phase**: Generate data-model.md and contracts/ based on these research findings.
