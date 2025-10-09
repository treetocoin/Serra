# Data Model: Actuator Management and Automation Rules

**Date**: 2025-10-09
**Feature**: Actuator Management and Sensor-Actuator Automation
**Database**: Supabase PostgreSQL (extends feature 001 schema)

## Overview

This data model extends the existing greenhouse management system (feature 001) with actuator management and sensor-actuator automation capabilities. It adds 6 new tables for automation rules, conditions, schedules, and execution logs while leveraging existing tables for devices, sensors, and actuators.

---

## Entity Relationship Diagram

```
[Existing from Feature 001]
┌──────────────┐
│   User       │
│  (auth.users)│
└──────┬───────┘
       │ 1
       │
       │ N
┌──────┴──────────┐
│   Device        │
└──────┬──────────┘
       │ 1
       ├──────────┬──────────┐
       │ N        │ N        │ N
┌──────┴──────┐ ┌┴──────────┐┌┴────────┐
│   Sensor    │ │  Actuator ││ Commands│
└──────┬──────┘ └┬──────────┘└─────────┘
       │ 1       │ 1
       │         │
       │         │ [New in Feature 002]
       │         │
       │         │ N
       │    ┌────┴──────────────┐
       │    │ AutomationRule    │
       │    └────┬──────────────┘
       │         │ 1
       │         ├────────────────┬──────────────┬─────────────┐
       │         │ N              │ N            │ 0..1        │ 0..N
       │    ┌────┴────────┐  ┌───┴──────┐  ┌────┴───────┐┌───┴──────────┐
       │    │ RuleAction  │  │RuleCondtn│  │ScheduleRule││RuleExecution │
       │    └─────────────┘  │  Group   │  └────────────┘│    Log       │
       │                     └───┬──────┘                 └──────────────┘
       │                         │ 1
       │                         │ N
       │                    ┌────┴──────────┐
       └────────────────────┤ RuleCondition │
                            └───────────────┘
```

---

## New Entities (Feature 002)

### 1. AutomationRule

Represents a sensor-to-actuator automation rule with priority-based conflict resolution.

**Table**: `automation_rules`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique rule identifier |
| user_id | UUID | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Rule owner |
| name | VARCHAR(255) | NOT NULL | User-defined rule name |
| description | TEXT | NULL | Optional rule description |
| priority | INTEGER | NOT NULL, DEFAULT 0 | Higher number = higher priority for conflict resolution |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Rule enabled/disabled status |
| on_threshold | NUMERIC(10,2) | NULL | Hysteresis ON threshold (if applicable) |
| off_threshold | NUMERIC(10,2) | NULL | Hysteresis OFF threshold (if applicable) |
| current_actuator_state | VARCHAR(20) | NULL, CHECK IN ('on', 'off', 'unknown') | Current state for hysteresis tracking |
| last_state_change_at | TIMESTAMPTZ | NULL | Last actuator state change timestamp |
| min_state_change_interval_seconds | INTEGER | DEFAULT 60 | Minimum time between state changes (anti-oscillation) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Rule creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp |
| trigger_count | INTEGER | NOT NULL, DEFAULT 0 | Total number of times rule has triggered |
| last_triggered_at | TIMESTAMPTZ | NULL | Last trigger timestamp |

**Indexes**:
```sql
CREATE INDEX idx_automation_rules_user_active_priority
ON automation_rules(user_id, is_active, priority DESC)
WHERE is_active = TRUE;

CREATE INDEX idx_automation_rules_last_triggered
ON automation_rules(last_triggered_at DESC);
```

**RLS Policy**:
```sql
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own automation rules"
ON automation_rules FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

**Validation Rules**:
- `name` length: 1-255 characters
- `priority` range: 0-1000 (higher = higher priority)
- `on_threshold` and `off_threshold` must both be set or both be NULL
- If hysteresis: `on_threshold` must be > `off_threshold` for heating, < for cooling
- `min_state_change_interval_seconds` minimum: 10 seconds

**Relationships**:
- One User has many AutomationRules (one-to-many)
- One AutomationRule has many RuleConditionGroups (one-to-many)
- One AutomationRule has many RuleActions (one-to-many)
- One AutomationRule has zero or one ScheduleRule (one-to-one)
- One AutomationRule has many RuleExecutionLogs (one-to-many)

---

### 2. RuleConditionGroup

Represents a group of conditions combined with AND logic. Multiple groups are combined with OR logic.

**Table**: `rule_condition_groups`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique group identifier |
| rule_id | UUID | NOT NULL, REFERENCES automation_rules(id) ON DELETE CASCADE | Parent rule |
| group_order | INTEGER | NOT NULL, DEFAULT 0 | Display order (for UI) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Group creation timestamp |

**Indexes**:
```sql
CREATE INDEX idx_rule_condition_groups_rule
ON rule_condition_groups(rule_id, group_order);
```

**RLS Policy**:
```sql
ALTER TABLE rule_condition_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage groups for their rules"
ON rule_condition_groups FOR ALL
TO authenticated
USING (
  rule_id IN (
    SELECT id FROM automation_rules WHERE user_id = auth.uid()
  )
);
```

**Validation Rules**:
- Unique (rule_id, group_order)
- `group_order` must be >= 0

**Relationships**:
- Many RuleConditionGroups belong to one AutomationRule (many-to-one)
- One RuleConditionGroup has many RuleConditions (one-to-many)

**Logical Interpretation**:
- Conditions within a group are combined with AND
- Groups are combined with OR
- Example: `(cond1 AND cond2) OR (cond3 AND cond4)`

---

### 3. RuleCondition

Represents a single sensor condition (e.g., "temperature > 30").

**Table**: `rule_conditions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique condition identifier |
| group_id | UUID | NOT NULL, REFERENCES rule_condition_groups(id) ON DELETE CASCADE | Parent group |
| sensor_id | UUID | NOT NULL, REFERENCES sensors(id) ON DELETE CASCADE | Sensor to monitor |
| operator | VARCHAR(20) | NOT NULL, CHECK IN ('gt', 'lt', 'gte', 'lte', 'eq', 'neq', 'between') | Comparison operator |
| value | NUMERIC(10,2) | NOT NULL | Threshold value |
| value_max | NUMERIC(10,2) | NULL | Maximum value (for 'between' operator) |
| condition_order | INTEGER | NOT NULL, DEFAULT 0 | Display order within group |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Condition creation timestamp |

**Indexes**:
```sql
CREATE INDEX idx_rule_conditions_group
ON rule_conditions(group_id, condition_order);

CREATE INDEX idx_rule_conditions_sensor
ON rule_conditions(sensor_id);
```

**RLS Policy**:
```sql
ALTER TABLE rule_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage conditions for their rules"
ON rule_conditions FOR ALL
TO authenticated
USING (
  group_id IN (
    SELECT rcg.id FROM rule_condition_groups rcg
    JOIN automation_rules ar ON ar.id = rcg.rule_id
    WHERE ar.user_id = auth.uid()
  )
);
```

**Validation Rules**:
- Unique (group_id, condition_order)
- `operator` enum: 'gt' (>), 'lt' (<), 'gte' (>=), 'lte' (<=), 'eq' (=), 'neq' (!=), 'between'
- If `operator = 'between'`, `value_max` must be NOT NULL and > `value`
- `sensor_id` must belong to a device owned by same user as rule

**Relationships**:
- Many RuleConditions belong to one RuleConditionGroup (many-to-one)
- Many RuleConditions reference one Sensor (many-to-one)

**Operator Mapping**:
| DB Value | Symbol | SQL Equivalent |
|----------|--------|----------------|
| gt | > | value > threshold |
| lt | < | value < threshold |
| gte | >= | value >= threshold |
| lte | <= | value <= threshold |
| eq | = | value = threshold |
| neq | != | value != threshold |
| between | BETWEEN | value BETWEEN threshold AND threshold_max |

---

### 4. RuleAction

Represents an action to execute when rule conditions are met.

**Table**: `rule_actions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique action identifier |
| rule_id | UUID | NOT NULL, REFERENCES automation_rules(id) ON DELETE CASCADE | Parent rule |
| actuator_id | UUID | NOT NULL, REFERENCES actuators(id) ON DELETE CASCADE | Target actuator |
| action_type | VARCHAR(20) | NOT NULL, CHECK IN ('on', 'off', 'set_value') | Command type |
| action_value | INTEGER | NULL, CHECK (action_value BETWEEN 0 AND 100) | PWM value (0-100) for 'set_value' |
| action_order | INTEGER | NOT NULL, DEFAULT 0 | Execution order (for multiple actions) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Action creation timestamp |

**Indexes**:
```sql
CREATE INDEX idx_rule_actions_rule
ON rule_actions(rule_id, action_order);

CREATE INDEX idx_rule_actions_actuator
ON rule_actions(actuator_id);
```

**RLS Policy**:
```sql
ALTER TABLE rule_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage actions for their rules"
ON rule_actions FOR ALL
TO authenticated
USING (
  rule_id IN (
    SELECT id FROM automation_rules WHERE user_id = auth.uid()
  )
);
```

**Validation Rules**:
- Unique (rule_id, actuator_id) - prevent duplicate actions on same actuator
- `action_type` enum: 'on', 'off', 'set_value'
- If `action_type = 'set_value'`, `action_value` must be NOT NULL (0-100)
- `actuator_id` must belong to device owned by same user as rule

**Relationships**:
- Many RuleActions belong to one AutomationRule (many-to-one)
- Many RuleActions reference one Actuator (many-to-one)

---

### 5. ScheduleRule

Represents a time-based schedule for triggering automation rules.

**Table**: `schedule_rules`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique schedule identifier |
| automation_rule_id | UUID | NOT NULL, UNIQUE, REFERENCES automation_rules(id) ON DELETE CASCADE | Parent rule (one-to-one) |
| schedule_type | VARCHAR(20) | NOT NULL, CHECK IN ('once', 'daily', 'weekly', 'cron') | Schedule frequency |
| time_of_day | TIME | NOT NULL | Time to execute (e.g., 07:00:00) |
| days_of_week | INTEGER[] | NULL, CHECK (ALL(days_of_week) BETWEEN 0 AND 6) | For 'weekly': 0=Sunday, 6=Saturday |
| cron_expression | VARCHAR(100) | NULL | For 'cron' type: standard cron format |
| timezone | VARCHAR(50) | NOT NULL, DEFAULT 'UTC' | Timezone for schedule |
| next_run_at | TIMESTAMPTZ | NULL | Next scheduled execution |
| last_run_at | TIMESTAMPTZ | NULL | Last execution timestamp |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Schedule creation timestamp |

**Indexes**:
```sql
CREATE INDEX idx_schedule_rules_next_run
ON schedule_rules(next_run_at)
WHERE next_run_at IS NOT NULL;

CREATE INDEX idx_schedule_rules_type
ON schedule_rules(schedule_type);
```

**RLS Policy**:
```sql
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage schedules for their rules"
ON schedule_rules FOR ALL
TO authenticated
USING (
  automation_rule_id IN (
    SELECT id FROM automation_rules WHERE user_id = auth.uid()
  )
);
```

**Validation Rules**:
- `schedule_type` enum: 'once', 'daily', 'weekly', 'cron'
- If `schedule_type = 'weekly'`, `days_of_week` must be NOT NULL
- If `schedule_type = 'cron'`, `cron_expression` must be NOT NULL and valid
- `timezone` must be valid IANA timezone (e.g., 'America/New_York', 'Europe/Rome')

**Relationships**:
- One ScheduleRule belongs to one AutomationRule (one-to-one)

**Schedule Types**:
| Type | Description | Example |
|------|-------------|---------|
| once | Execute once at specified time | 2025-10-10 07:00:00 |
| daily | Execute every day at specified time | Every day at 07:00 |
| weekly | Execute on specific days at specified time | Mon, Wed, Fri at 07:00 |
| cron | Execute per cron expression | 0 7,19 * * * (7 AM and 7 PM daily) |

---

### 6. RuleExecutionLog

Represents a historical record of rule execution.

**Table**: `rule_execution_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Unique log identifier |
| rule_id | UUID | NOT NULL, REFERENCES automation_rules(id) ON DELETE CASCADE | Rule that executed |
| sensor_id | UUID | NULL, REFERENCES sensors(id) ON DELETE SET NULL | Triggering sensor (if sensor-based) |
| sensor_value | NUMERIC(10,2) | NULL | Sensor value that triggered rule |
| executed_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Execution timestamp |
| command_id | UUID | NULL, REFERENCES commands(id) ON DELETE SET NULL | Command queued by this execution |
| execution_status | VARCHAR(20) | NOT NULL, DEFAULT 'success' | Execution outcome |
| error_message | TEXT | NULL | Error details (if failed) |

**Indexes**:
```sql
CREATE INDEX idx_execution_logs_rule_time
ON rule_execution_logs(rule_id, executed_at DESC);

CREATE INDEX idx_execution_logs_time
ON rule_execution_logs(executed_at DESC);
```

**RLS Policy**:
```sql
ALTER TABLE rule_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view logs for their rules"
ON rule_execution_logs FOR SELECT
TO authenticated
USING (
  rule_id IN (
    SELECT id FROM automation_rules WHERE user_id = auth.uid()
  )
);
```

**Validation Rules**:
- `execution_status` enum: 'success', 'failed', 'skipped'
- Retention policy: Delete logs older than 90 days OR keep only last 1000 per rule

**Relationships**:
- Many RuleExecutionLogs belong to one AutomationRule (many-to-one)
- Many RuleExecutionLogs reference one Sensor (many-to-one, optional)
- Many RuleExecutionLogs reference one Command (many-to-one, optional)

**Retention Policy** (pg_cron job):
```sql
-- Run daily at 2 AM
SELECT cron.schedule(
  'cleanup-execution-logs',
  '0 2 * * *',
  $$
  WITH logs_to_keep AS (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY rule_id ORDER BY executed_at DESC) as rn
      FROM rule_execution_logs
      WHERE executed_at > NOW() - INTERVAL '90 days'
    ) ranked
    WHERE rn <= 1000
  )
  DELETE FROM rule_execution_logs
  WHERE id NOT IN (SELECT id FROM logs_to_keep);
  $$
);
```

---

## Database Functions

### 1. Evaluate Automation Rules (Trigger Function)

```sql
CREATE OR REPLACE FUNCTION evaluate_automation_rules()
RETURNS TRIGGER
SECURITY DEFINER -- Bypass RLS for automation
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  device_user_id UUID;
  rule_matched BOOLEAN;
BEGIN
  -- Get user_id for the device that owns this sensor
  SELECT d.user_id INTO device_user_id
  FROM sensors s
  JOIN devices d ON d.id = s.device_id
  WHERE s.id = NEW.sensor_id;

  -- Iterate through active rules for this user, ordered by priority
  FOR rule IN
    SELECT ar.* FROM automation_rules ar
    WHERE ar.user_id = device_user_id
      AND ar.is_active = TRUE
    ORDER BY ar.priority DESC, ar.created_at DESC
  LOOP
    -- Evaluate rule conditions (calls separate function)
    rule_matched := evaluate_rule_conditions(rule.id, NEW.sensor_id, NEW.value);

    IF rule_matched THEN
      -- Execute rule actions
      PERFORM execute_rule_actions(rule.id);

      -- Update rule statistics
      UPDATE automation_rules
      SET trigger_count = trigger_count + 1,
          last_triggered_at = NOW()
      WHERE id = rule.id;

      -- Log execution
      INSERT INTO rule_execution_logs (rule_id, sensor_id, sensor_value, execution_status)
      VALUES (rule.id, NEW.sensor_id, NEW.value, 'success');

      -- Priority-based conflict resolution: stop after first match
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach trigger to sensor_readings
CREATE TRIGGER trigger_evaluate_automation_rules
  AFTER INSERT ON sensor_readings
  FOR EACH ROW
  EXECUTE FUNCTION evaluate_automation_rules();
```

### 2. Evaluate Rule Conditions

```sql
CREATE OR REPLACE FUNCTION evaluate_rule_conditions(
  rule_id_param UUID,
  new_sensor_id UUID,
  new_value NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  group_record RECORD;
  condition_record RECORD;
  group_satisfied BOOLEAN;
  condition_satisfied BOOLEAN;
  current_value NUMERIC;
BEGIN
  -- OR logic between groups: if ANY group is satisfied, rule matches
  FOR group_record IN
    SELECT id FROM rule_condition_groups
    WHERE rule_id = rule_id_param
    ORDER BY group_order
  LOOP
    -- AND logic within group: ALL conditions must be satisfied
    group_satisfied := TRUE;

    FOR condition_record IN
      SELECT * FROM rule_conditions
      WHERE group_id = group_record.id
      ORDER BY condition_order
    LOOP
      -- Get current sensor value
      IF condition_record.sensor_id = new_sensor_id THEN
        current_value := new_value;
      ELSE
        -- Fetch latest value for other sensors
        SELECT value INTO current_value
        FROM sensor_readings
        WHERE sensor_id = condition_record.sensor_id
        ORDER BY time DESC
        LIMIT 1;
      END IF;

      -- Evaluate condition
      condition_satisfied := CASE condition_record.operator
        WHEN 'gt' THEN current_value > condition_record.value
        WHEN 'lt' THEN current_value < condition_record.value
        WHEN 'gte' THEN current_value >= condition_record.value
        WHEN 'lte' THEN current_value <= condition_record.value
        WHEN 'eq' THEN current_value = condition_record.value
        WHEN 'neq' THEN current_value != condition_record.value
        WHEN 'between' THEN current_value BETWEEN condition_record.value AND condition_record.value_max
      END;

      group_satisfied := group_satisfied AND condition_satisfied;

      -- Early exit if condition fails (AND logic)
      EXIT WHEN NOT group_satisfied;
    END LOOP;

    -- If this group is satisfied, rule matches (OR logic)
    IF group_satisfied THEN
      RETURN TRUE;
    END IF;
  END LOOP;

  -- No groups satisfied
  RETURN FALSE;
END;
$$;
```

### 3. Execute Rule Actions

```sql
CREATE OR REPLACE FUNCTION execute_rule_actions(rule_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  action_record RECORD;
  new_command_id UUID;
BEGIN
  FOR action_record IN
    SELECT * FROM rule_actions
    WHERE rule_id = rule_id_param
    ORDER BY action_order
  LOOP
    -- Insert command for actuator
    INSERT INTO commands (actuator_id, command_type, value, status)
    VALUES (
      action_record.actuator_id,
      action_record.action_type,
      action_record.action_value,
      'pending'
    )
    RETURNING id INTO new_command_id;

    -- Update execution log with command_id
    UPDATE rule_execution_logs
    SET command_id = new_command_id
    WHERE id = (SELECT MAX(id) FROM rule_execution_logs WHERE rule_id = rule_id_param);
  END LOOP;
END;
$$;
```

---

## Example Queries

### Create a Rule with Conditions

```sql
-- 1. Create rule
INSERT INTO automation_rules (user_id, name, description, priority, is_active)
VALUES (
  '{user_id}',
  'Auto irrigation on heat or dry soil',
  'Turn on pump when temperature > 30 AND humidity < 60, OR when soil moisture < 20',
  10,
  TRUE
)
RETURNING id; -- Returns: {rule_id}

-- 2. Create condition group 1: (temp > 30 AND humidity < 60)
INSERT INTO rule_condition_groups (rule_id, group_order)
VALUES ('{rule_id}', 0)
RETURNING id; -- Returns: {group1_id}

INSERT INTO rule_conditions (group_id, sensor_id, operator, value, condition_order) VALUES
  ('{group1_id}', '{temp_sensor_id}', 'gt', 30.0, 0),
  ('{group1_id}', '{humid_sensor_id}', 'lt', 60.0, 1);

-- 3. Create condition group 2: (soil_moisture < 20)
INSERT INTO rule_condition_groups (rule_id, group_order)
VALUES ('{rule_id}', 1)
RETURNING id; -- Returns: {group2_id}

INSERT INTO rule_conditions (group_id, sensor_id, operator, value, condition_order)
VALUES ('{group2_id}', '{soil_sensor_id}', 'lt', 20.0, 0);

-- 4. Create action: turn on pump
INSERT INTO rule_actions (rule_id, actuator_id, action_type, action_order)
VALUES ('{rule_id}', '{pump_actuator_id}', 'on', 0);
```

### Fetch Rule for UI Display

```sql
-- Get complete rule with all conditions and actions
SELECT
  ar.id,
  ar.name,
  ar.description,
  ar.priority,
  ar.is_active,
  ar.trigger_count,
  ar.last_triggered_at,
  jsonb_agg(DISTINCT jsonb_build_object(
    'group_id', rcg.id,
    'group_order', rcg.group_order,
    'conditions', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', rc.id,
        'sensor_id', rc.sensor_id,
        'sensor_name', s.name,
        'operator', rc.operator,
        'value', rc.value,
        'value_max', rc.value_max
      ) ORDER BY rc.condition_order)
      FROM rule_conditions rc
      JOIN sensors s ON s.id = rc.sensor_id
      WHERE rc.group_id = rcg.id
    )
  ) ORDER BY rcg.group_order) AS condition_groups,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'id', ra.id,
      'actuator_id', ra.actuator_id,
      'actuator_name', a.name,
      'action_type', ra.action_type,
      'action_value', ra.action_value
    ) ORDER BY ra.action_order)
    FROM rule_actions ra
    JOIN actuators a ON a.id = ra.actuator_id
    WHERE ra.rule_id = ar.id
  ) AS actions
FROM automation_rules ar
LEFT JOIN rule_condition_groups rcg ON rcg.rule_id = ar.id
WHERE ar.id = '{rule_id}'
GROUP BY ar.id;
```

### Get Rule Execution History

```sql
SELECT
  rel.id,
  rel.executed_at,
  s.name AS sensor_name,
  rel.sensor_value,
  rel.execution_status,
  c.command_type,
  a.name AS actuator_name
FROM rule_execution_logs rel
LEFT JOIN sensors s ON s.id = rel.sensor_id
LEFT JOIN commands c ON c.id = rel.command_id
LEFT JOIN actuators a ON a.id = c.actuator_id
WHERE rel.rule_id = '{rule_id}'
ORDER BY rel.executed_at DESC
LIMIT 100;
```

---

## Summary

This data model provides:
- ✅ Flexible AND/OR condition logic via relational tables
- ✅ Priority-based conflict resolution
- ✅ Hysteresis support for anti-oscillation
- ✅ Schedule-based automation (separate table)
- ✅ Execution history with retention policy
- ✅ Row-level security for multi-tenant isolation
- ✅ Efficient queries with strategic indexes
- ✅ Database-triggered evaluation (<100ms latency)

**Total new tables**: 6 (automation_rules, rule_condition_groups, rule_conditions, rule_actions, schedule_rules, rule_execution_logs)

**Total new functions**: 3 (evaluate_automation_rules, evaluate_rule_conditions, execute_rule_actions)

**Next Step**: Generate API contracts in `/contracts/` directory.
