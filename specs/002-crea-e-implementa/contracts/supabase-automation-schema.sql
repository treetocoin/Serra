-- =====================================================
-- Supabase Migration: Automation Rules System
-- Feature: 002-crea-e-implementa
-- Description: Add actuator management and sensor-actuator automation
-- Date: 2025-10-09
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. AutomationRules Table
-- =====================================================

CREATE TABLE automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 1000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Hysteresis support
    on_threshold NUMERIC(10,2),
    off_threshold NUMERIC(10,2),
    current_actuator_state VARCHAR(20) CHECK (current_actuator_state IN ('on', 'off', 'unknown')),
    last_state_change_at TIMESTAMPTZ,
    min_state_change_interval_seconds INTEGER DEFAULT 60 CHECK (min_state_change_interval_seconds >= 10),

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trigger_count INTEGER NOT NULL DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT hysteresis_thresholds_both_or_neither
        CHECK ((on_threshold IS NULL AND off_threshold IS NULL) OR (on_threshold IS NOT NULL AND off_threshold IS NOT NULL))
);

-- Indexes
CREATE INDEX idx_automation_rules_user_active_priority
    ON automation_rules(user_id, is_active, priority DESC)
    WHERE is_active = TRUE;

CREATE INDEX idx_automation_rules_last_triggered
    ON automation_rules(last_triggered_at DESC);

-- RLS Policies
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own automation rules"
    ON automation_rules FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_automation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_automation_rules_updated_at();

-- =====================================================
-- 2. RuleConditionGroups Table
-- =====================================================

CREATE TABLE rule_condition_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    group_order INTEGER NOT NULL DEFAULT 0 CHECK (group_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(rule_id, group_order)
);

-- Indexes
CREATE INDEX idx_rule_condition_groups_rule
    ON rule_condition_groups(rule_id, group_order);

-- RLS Policies
ALTER TABLE rule_condition_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage groups for their rules"
    ON rule_condition_groups FOR ALL
    TO authenticated
    USING (
        rule_id IN (
            SELECT id FROM automation_rules WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- 3. RuleConditions Table
-- =====================================================

CREATE TABLE rule_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES rule_condition_groups(id) ON DELETE CASCADE,
    sensor_id UUID NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    operator VARCHAR(20) NOT NULL CHECK (operator IN ('gt', 'lt', 'gte', 'lte', 'eq', 'neq', 'between')),
    value NUMERIC(10,2) NOT NULL,
    value_max NUMERIC(10,2),
    condition_order INTEGER NOT NULL DEFAULT 0 CHECK (condition_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(group_id, condition_order),

    -- Constraint: value_max required for 'between' operator
    CONSTRAINT between_operator_requires_value_max
        CHECK ((operator = 'between' AND value_max IS NOT NULL AND value_max > value) OR (operator != 'between'))
);

-- Indexes
CREATE INDEX idx_rule_conditions_group
    ON rule_conditions(group_id, condition_order);

CREATE INDEX idx_rule_conditions_sensor
    ON rule_conditions(sensor_id);

-- RLS Policies
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

-- =====================================================
-- 4. RuleActions Table
-- =====================================================

CREATE TABLE rule_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    actuator_id UUID NOT NULL REFERENCES actuators(id) ON DELETE CASCADE,
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('on', 'off', 'set_value')),
    action_value INTEGER CHECK (action_value BETWEEN 0 AND 100),
    action_order INTEGER NOT NULL DEFAULT 0 CHECK (action_order >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(rule_id, actuator_id),

    -- Constraint: action_value required for 'set_value' type
    CONSTRAINT set_value_requires_action_value
        CHECK ((action_type = 'set_value' AND action_value IS NOT NULL) OR (action_type != 'set_value'))
);

-- Indexes
CREATE INDEX idx_rule_actions_rule
    ON rule_actions(rule_id, action_order);

CREATE INDEX idx_rule_actions_actuator
    ON rule_actions(actuator_id);

-- RLS Policies
ALTER TABLE rule_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage actions for their rules"
    ON rule_actions FOR ALL
    TO authenticated
    USING (
        rule_id IN (
            SELECT id FROM automation_rules WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- 5. ScheduleRules Table
-- =====================================================

CREATE TABLE schedule_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_rule_id UUID NOT NULL UNIQUE REFERENCES automation_rules(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly', 'cron')),
    time_of_day TIME NOT NULL,
    days_of_week INTEGER[] CHECK (
        days_of_week IS NULL OR
        (array_length(days_of_week, 1) > 0 AND
         (SELECT bool_and(day BETWEEN 0 AND 6) FROM unnest(days_of_week) AS day))
    ),
    cron_expression VARCHAR(100),
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT weekly_requires_days
        CHECK ((schedule_type = 'weekly' AND days_of_week IS NOT NULL) OR (schedule_type != 'weekly')),
    CONSTRAINT cron_requires_expression
        CHECK ((schedule_type = 'cron' AND cron_expression IS NOT NULL) OR (schedule_type != 'cron'))
);

-- Indexes
CREATE INDEX idx_schedule_rules_next_run
    ON schedule_rules(next_run_at)
    WHERE next_run_at IS NOT NULL;

CREATE INDEX idx_schedule_rules_type
    ON schedule_rules(schedule_type);

-- RLS Policies
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage schedules for their rules"
    ON schedule_rules FOR ALL
    TO authenticated
    USING (
        automation_rule_id IN (
            SELECT id FROM automation_rules WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- 6. RuleExecutionLogs Table
-- =====================================================

CREATE TABLE rule_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    sensor_id UUID REFERENCES sensors(id) ON DELETE SET NULL,
    sensor_value NUMERIC(10,2),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    command_id UUID REFERENCES commands(id) ON DELETE SET NULL,
    execution_status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (execution_status IN ('success', 'failed', 'skipped')),
    error_message TEXT
);

-- Indexes
CREATE INDEX idx_execution_logs_rule_time
    ON rule_execution_logs(rule_id, executed_at DESC);

CREATE INDEX idx_execution_logs_time
    ON rule_execution_logs(executed_at DESC);

-- RLS Policies
ALTER TABLE rule_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view logs for their rules"
    ON rule_execution_logs FOR SELECT
    TO authenticated
    USING (
        rule_id IN (
            SELECT id FROM automation_rules WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- 7. Rule Evaluation Functions
-- =====================================================

-- Helper function: Evaluate rule conditions (AND/OR logic)
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

-- Helper function: Execute rule actions
CREATE OR REPLACE FUNCTION execute_rule_actions(rule_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    action_record RECORD;
    new_command_id UUID;
    latest_log_id BIGINT;
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

        -- Update execution log with command_id (most recent log for this rule)
        SELECT MAX(id) INTO latest_log_id
        FROM rule_execution_logs
        WHERE rule_id = rule_id_param;

        IF latest_log_id IS NOT NULL THEN
            UPDATE rule_execution_logs
            SET command_id = new_command_id
            WHERE id = latest_log_id;
        END IF;
    END LOOP;
END;
$$;

-- Main trigger function: Evaluate automation rules
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
        -- Evaluate rule conditions
        rule_matched := evaluate_rule_conditions(rule.id, NEW.sensor_id, NEW.value);

        IF rule_matched THEN
            -- Log execution (before executing actions)
            INSERT INTO rule_execution_logs (rule_id, sensor_id, sensor_value, execution_status)
            VALUES (rule.id, NEW.sensor_id, NEW.value, 'success');

            -- Execute rule actions
            PERFORM execute_rule_actions(rule.id);

            -- Update rule statistics
            UPDATE automation_rules
            SET trigger_count = trigger_count + 1,
                last_triggered_at = NOW()
            WHERE id = rule.id;

            -- Priority-based conflict resolution: stop after first match
            EXIT;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- Attach trigger to sensor_readings table
CREATE TRIGGER trigger_evaluate_automation_rules
    AFTER INSERT ON sensor_readings
    FOR EACH ROW
    EXECUTE FUNCTION evaluate_automation_rules();

-- =====================================================
-- 8. Cleanup Jobs (pg_cron)
-- =====================================================

-- Note: pg_cron must be enabled on Supabase project
-- Run via Supabase Dashboard > Database > Extensions > pg_cron

-- Cleanup execution logs (run daily at 2 AM UTC)
/*
SELECT cron.schedule(
    'cleanup-execution-logs',
    '0 2 * * *', -- Daily at 2 AM
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
*/

-- =====================================================
-- 9. Seed Data (Optional - for testing)
-- =====================================================

-- Example: Create a sample automation rule
/*
DO $$
DECLARE
    sample_user_id UUID;
    sample_rule_id UUID;
    sample_group_id UUID;
    sample_temp_sensor_id UUID;
    sample_fan_actuator_id UUID;
BEGIN
    -- Get sample user (assumes user exists)
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;

    -- Get sample sensors/actuators (assumes they exist from feature 001)
    SELECT id INTO sample_temp_sensor_id FROM sensors WHERE sensor_type = 'temperature' AND user_id = sample_user_id LIMIT 1;
    SELECT id INTO sample_fan_actuator_id FROM actuators WHERE actuator_type = 'fan' AND user_id = sample_user_id LIMIT 1;

    IF sample_user_id IS NOT NULL AND sample_temp_sensor_id IS NOT NULL AND sample_fan_actuator_id IS NOT NULL THEN
        -- Create rule
        INSERT INTO automation_rules (user_id, name, description, priority, is_active)
        VALUES (sample_user_id, 'Auto ventilation on high temperature', 'Turn on fan when temperature exceeds 30°C', 10, TRUE)
        RETURNING id INTO sample_rule_id;

        -- Create condition group
        INSERT INTO rule_condition_groups (rule_id, group_order)
        VALUES (sample_rule_id, 0)
        RETURNING id INTO sample_group_id;

        -- Create condition
        INSERT INTO rule_conditions (group_id, sensor_id, operator, value, condition_order)
        VALUES (sample_group_id, sample_temp_sensor_id, 'gt', 30.0, 0);

        -- Create action
        INSERT INTO rule_actions (rule_id, actuator_id, action_type, action_order)
        VALUES (sample_rule_id, sample_fan_actuator_id, 'on', 0);

        RAISE NOTICE 'Sample automation rule created successfully';
    ELSE
        RAISE NOTICE 'Sample data not created - missing user, sensors, or actuators';
    END IF;
END $$;
*/

-- =====================================================
-- Migration Complete
-- =====================================================

COMMENT ON TABLE automation_rules IS 'Sensor-to-actuator automation rules with priority-based conflict resolution';
COMMENT ON TABLE rule_condition_groups IS 'Groups of conditions combined with AND logic (groups ORed together)';
COMMENT ON TABLE rule_conditions IS 'Individual sensor conditions (operator + threshold)';
COMMENT ON TABLE rule_actions IS 'Actions to execute when rule conditions are met';
COMMENT ON TABLE schedule_rules IS 'Time-based schedules for automation rules';
COMMENT ON TABLE rule_execution_logs IS 'Historical record of rule executions (90-day retention)';
