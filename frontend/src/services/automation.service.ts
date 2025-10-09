import { supabase } from '../lib/supabase';
import type {
  AutomationRule,
  CompleteAutomationRule,
  CreateRuleRequest,
  UpdateRuleRequest,
  RuleExecutionLog,
} from '../types/automation';

export const automationService = {
  // List all rules for current user
  async listRules(): Promise<AutomationRule[]> {
    const { data, error } = await supabase
      .from('automation_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get rule with full details (conditions, actions, schedule)
  async getRule(ruleId: string): Promise<CompleteAutomationRule> {
    const { data, error } = await supabase
      .from('automation_rules')
      .select(`
        *,
        condition_groups:rule_condition_groups(
          *,
          conditions:rule_conditions(
            *,
            sensor:sensors(name, sensor_type, unit)
          )
        ),
        actions:rule_actions(
          *,
          actuator:actuators(name, actuator_type)
        ),
        schedule:schedule_rules(*)
      `)
      .eq('id', ruleId)
      .single();

    if (error) throw error;
    return data;
  },

  // Create new rule
  async createRule(request: CreateRuleRequest): Promise<string> {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Create automation rule
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .insert({
        user_id: user.id,
        name: request.name,
        description: request.description,
        priority: request.priority || 0,
        is_active: request.is_active ?? true,
        on_threshold: request.on_threshold,
        off_threshold: request.off_threshold,
        min_state_change_interval_seconds: request.min_state_change_interval_seconds || 60,
      })
      .select()
      .single();

    if (ruleError) throw ruleError;

    // 2. Create condition groups and conditions
    for (const group of request.condition_groups) {
      const { data: groupData, error: groupError } = await supabase
        .from('rule_condition_groups')
        .insert({
          rule_id: rule.id,
          group_order: group.group_order,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const conditions = group.conditions.map(c => ({
        group_id: groupData.id,
        sensor_id: c.sensor_id,
        operator: c.operator,
        value: c.value,
        value_max: c.value_max,
        condition_order: c.condition_order,
      }));

      const { error: condError } = await supabase
        .from('rule_conditions')
        .insert(conditions);

      if (condError) throw condError;
    }

    // 3. Create actions
    const actions = request.actions.map(a => ({
      rule_id: rule.id,
      actuator_id: a.actuator_id,
      action_type: a.action_type,
      action_value: a.action_value,
      action_order: a.action_order,
    }));

    const { error: actionError } = await supabase
      .from('rule_actions')
      .insert(actions);

    if (actionError) throw actionError;

    // 4. Create schedule (if provided)
    if (request.schedule) {
      const { error: schedError } = await supabase
        .from('schedule_rules')
        .insert({
          automation_rule_id: rule.id,
          schedule_type: request.schedule.schedule_type,
          time_of_day: request.schedule.time_of_day,
          days_of_week: request.schedule.days_of_week,
          cron_expression: request.schedule.cron_expression,
          timezone: request.schedule.timezone || 'UTC',
        });

      if (schedError) throw schedError;
    }

    return rule.id;
  },

  // Update rule metadata (name, description, priority, active status)
  async updateRule(ruleId: string, updates: UpdateRuleRequest): Promise<void> {
    const { error } = await supabase
      .from('automation_rules')
      .update(updates)
      .eq('id', ruleId);

    if (error) throw error;
  },

  // Delete rule (cascades to conditions, actions, schedule, logs)
  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await supabase
      .from('automation_rules')
      .delete()
      .eq('id', ruleId);

    if (error) throw error;
  },

  // Get execution history for a rule
  async getExecutionHistory(
    ruleId: string,
    limit: number = 100
  ): Promise<RuleExecutionLog[]> {
    const { data, error } = await supabase
      .from('rule_execution_logs')
      .select(`
        *,
        sensor:sensors(name),
        command:commands(command_type, actuator:actuators(name))
      `)
      .eq('rule_id', ruleId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
