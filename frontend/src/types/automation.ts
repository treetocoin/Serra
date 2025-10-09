/**
 * TypeScript Type Definitions for Automation Rules System
 * Feature: 002-crea-e-implementa
 * Generated from: supabase-automation-schema.sql
 */

// =====================================================
// Database Enums
// =====================================================

export type OperatorType = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between';
export type ActionType = 'on' | 'off' | 'set_value';
export type ActuatorState = 'on' | 'off' | 'unknown';
export type ScheduleType = 'once' | 'daily' | 'weekly' | 'cron';
export type ExecutionStatus = 'success' | 'failed' | 'skipped';

// =====================================================
// Database Tables
// =====================================================

export interface AutomationRule {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  description?: string;
  priority: number; // 0-1000
  is_active: boolean;

  // Hysteresis support
  on_threshold?: number;
  off_threshold?: number;
  current_actuator_state?: ActuatorState;
  last_state_change_at?: string; // ISO timestamp
  min_state_change_interval_seconds: number; // default 60

  // Metadata
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  trigger_count: number;
  last_triggered_at?: string; // ISO timestamp
}

export interface RuleConditionGroup {
  id: string; // UUID
  rule_id: string; // UUID
  group_order: number;
  created_at: string; // ISO timestamp
}

export interface RuleCondition {
  id: string; // UUID
  group_id: string; // UUID
  sensor_id: string; // UUID
  operator: OperatorType;
  value: number;
  value_max?: number; // Required for 'between' operator
  condition_order: number;
  created_at: string; // ISO timestamp
}

export interface RuleAction {
  id: string; // UUID
  rule_id: string; // UUID
  actuator_id: string; // UUID
  action_type: ActionType;
  action_value?: number; // 0-100, required for 'set_value'
  action_order: number;
  created_at: string; // ISO timestamp
}

export interface ScheduleRule {
  id: string; // UUID
  automation_rule_id: string; // UUID (unique)
  schedule_type: ScheduleType;
  time_of_day: string; // HH:MM:SS format
  days_of_week?: number[]; // 0-6 (0=Sunday, required for 'weekly')
  cron_expression?: string; // Required for 'cron' type
  timezone: string; // IANA timezone, default 'UTC'
  next_run_at?: string; // ISO timestamp
  last_run_at?: string; // ISO timestamp
  created_at: string; // ISO timestamp
}

export interface RuleExecutionLog {
  id: number; // BIGSERIAL
  rule_id: string; // UUID
  sensor_id?: string; // UUID
  sensor_value?: number;
  executed_at: string; // ISO timestamp
  command_id?: string; // UUID
  execution_status: ExecutionStatus;
  error_message?: string;
}

// =====================================================
// Composite Types for UI
// =====================================================

export interface ConditionGroupWithConditions extends RuleConditionGroup {
  conditions: RuleConditionWithSensor[];
}

export interface RuleConditionWithSensor extends RuleCondition {
  sensor_name: string;
  sensor_type: string;
  unit: string;
}

export interface RuleActionWithActuator extends RuleAction {
  actuator_name: string;
  actuator_type: string;
}

export interface CompleteAutomationRule extends AutomationRule {
  condition_groups: ConditionGroupWithConditions[];
  actions: RuleActionWithActuator[];
  schedule?: ScheduleRule;
}

export interface RuleExecutionLogWithDetails extends RuleExecutionLog {
  sensor_name?: string;
  actuator_name?: string;
  command_type?: ActionType;
}

// =====================================================
// API Request/Response Types
// =====================================================

export interface CreateRuleRequest {
  name: string;
  description?: string;
  priority?: number; // default 0
  is_active?: boolean; // default true

  // Hysteresis (optional)
  on_threshold?: number;
  off_threshold?: number;
  min_state_change_interval_seconds?: number; // default 60

  // Conditions (at least one group required)
  condition_groups: {
    group_order: number;
    conditions: {
      sensor_id: string;
      operator: OperatorType;
      value: number;
      value_max?: number; // Required if operator = 'between'
      condition_order: number;
    }[];
  }[];

  // Actions (at least one required)
  actions: {
    actuator_id: string;
    action_type: ActionType;
    action_value?: number; // Required if action_type = 'set_value'
    action_order: number;
  }[];

  // Schedule (optional)
  schedule?: {
    schedule_type: ScheduleType;
    time_of_day: string; // HH:MM:SS
    days_of_week?: number[]; // Required if schedule_type = 'weekly'
    cron_expression?: string; // Required if schedule_type = 'cron'
    timezone?: string; // default 'UTC'
  };
}

export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  priority?: number;
  is_active?: boolean;

  // Note: Updating conditions/actions requires deleting old and creating new
  // due to foreign key cascade
}

export interface RuleListResponse {
  rules: {
    id: string;
    name: string;
    description?: string;
    priority: number;
    is_active: boolean;
    trigger_count: number;
    last_triggered_at?: string;
    condition_summary: string; // e.g., "2 conditions (temp > 30, humidity < 60)"
    action_summary: string; // e.g., "Turn on Fan"
  }[];
  total_count: number;
}

export interface RuleDetailResponse {
  rule: CompleteAutomationRule;
}

export interface RuleExecutionHistoryResponse {
  executions: RuleExecutionLogWithDetails[];
  total_count: number;
  page: number;
  page_size: number;
}

// =====================================================
// Utility Types
// =====================================================

export interface OperatorDisplay {
  value: OperatorType;
  label: string;
  symbol: string;
}

export const OPERATOR_OPTIONS: OperatorDisplay[] = [
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'Greater than or equal', symbol: '>=' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'Less than or equal', symbol: '<=' },
  { value: 'eq', label: 'Equal to', symbol: '=' },
  { value: 'neq', label: 'Not equal to', symbol: '!=' },
  { value: 'between', label: 'Between', symbol: 'BETWEEN' },
];

export interface ActionDisplay {
  value: ActionType;
  label: string;
}

export const ACTION_OPTIONS: ActionDisplay[] = [
  { value: 'on', label: 'Turn ON' },
  { value: 'off', label: 'Turn OFF' },
  { value: 'set_value', label: 'Set Value (PWM)' },
];

export interface ScheduleDisplay {
  value: ScheduleType;
  label: string;
  description: string;
}

export const SCHEDULE_OPTIONS: ScheduleDisplay[] = [
  { value: 'once', label: 'Once', description: 'Execute once at specified time' },
  { value: 'daily', label: 'Daily', description: 'Execute every day at specified time' },
  { value: 'weekly', label: 'Weekly', description: 'Execute on specific days each week' },
  { value: 'cron', label: 'Custom (Cron)', description: 'Advanced: custom cron expression' },
];

export const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

// =====================================================
// Validation Helpers
// =====================================================

export const validateRuleCondition = (condition: Partial<RuleCondition>): string[] => {
  const errors: string[] = [];

  if (!condition.sensor_id) {
    errors.push('Sensor is required');
  }

  if (!condition.operator) {
    errors.push('Operator is required');
  }

  if (condition.value === undefined || condition.value === null) {
    errors.push('Threshold value is required');
  }

  if (condition.operator === 'between' && !condition.value_max) {
    errors.push('Maximum value is required for BETWEEN operator');
  }

  if (condition.operator === 'between' && condition.value_max && condition.value_max <= condition.value!) {
    errors.push('Maximum value must be greater than minimum value');
  }

  return errors;
};

export const validateRuleAction = (action: Partial<RuleAction>): string[] => {
  const errors: string[] = [];

  if (!action.actuator_id) {
    errors.push('Actuator is required');
  }

  if (!action.action_type) {
    errors.push('Action type is required');
  }

  if (action.action_type === 'set_value' && (action.action_value === undefined || action.action_value === null)) {
    errors.push('Value is required for Set Value action');
  }

  if (action.action_value !== undefined && (action.action_value < 0 || action.action_value > 100)) {
    errors.push('Value must be between 0 and 100');
  }

  return errors;
};

export const validateScheduleRule = (schedule: Partial<ScheduleRule>): string[] => {
  const errors: string[] = [];

  if (!schedule.schedule_type) {
    errors.push('Schedule type is required');
  }

  if (!schedule.time_of_day) {
    errors.push('Time of day is required');
  }

  if (schedule.schedule_type === 'weekly' && (!schedule.days_of_week || schedule.days_of_week.length === 0)) {
    errors.push('At least one day of week is required for weekly schedule');
  }

  if (schedule.schedule_type === 'cron' && !schedule.cron_expression) {
    errors.push('Cron expression is required for cron schedule');
  }

  return errors;
};

// =====================================================
// Formatting Helpers
// =====================================================

export const formatConditionDisplay = (condition: RuleConditionWithSensor): string => {
  const operator = OPERATOR_OPTIONS.find(op => op.value === condition.operator);
  const symbol = operator?.symbol || condition.operator;

  if (condition.operator === 'between') {
    return `${condition.sensor_name} ${symbol} ${condition.value} and ${condition.value_max}`;
  }

  return `${condition.sensor_name} ${symbol} ${condition.value} ${condition.unit}`;
};

export const formatActionDisplay = (action: RuleActionWithActuator): string => {
  if (action.action_type === 'set_value') {
    return `Set ${action.actuator_name} to ${action.action_value}%`;
  }

  return `Turn ${action.action_type.toUpperCase()} ${action.actuator_name}`;
};

export const formatScheduleDisplay = (schedule: ScheduleRule): string => {
  if (schedule.schedule_type === 'once') {
    return `Once at ${schedule.time_of_day}`;
  }

  if (schedule.schedule_type === 'daily') {
    return `Daily at ${schedule.time_of_day}`;
  }

  if (schedule.schedule_type === 'weekly') {
    const days = schedule.days_of_week?.map(d =>
      DAY_OF_WEEK_OPTIONS[d]?.short || d
    ).join(', ') || '';
    return `Weekly on ${days} at ${schedule.time_of_day}`;
  }

  if (schedule.schedule_type === 'cron') {
    return `Cron: ${schedule.cron_expression}`;
  }

  return 'Unknown schedule';
};
