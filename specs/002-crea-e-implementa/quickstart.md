# Quick Start: Actuator Management and Automation Rules

**Feature**: 002-crea-e-implementa
**Date**: 2025-10-09
**Prerequisites**: Feature 001 (Greenhouse Management System) must be completed

## Overview

This guide walks you through setting up the actuator management and automation rules feature on your existing Supabase + React greenhouse management system.

---

## Prerequisites

Ensure feature 001 is fully implemented:
- ✅ Supabase project configured
- ✅ Database schema with `devices`, `sensors`, `actuators`, `commands` tables
- ✅ React frontend with authentication
- ✅ Netlify deployment configured

---

## Part 1: Database Setup

### Step 1: Apply Migration

Apply the automation rules schema to your Supabase database:

```bash
# Option A: Using Supabase CLI
cd /Users/davidecrescentini/00-Progetti/Serra
supabase db push --file specs/002-crea-e-implementa/contracts/supabase-automation-schema.sql

# Option B: Using MCP Supabase
# Copy contents of supabase-automation-schema.sql and apply via MCP
```

**What this creates**:
- 6 new tables: `automation_rules`, `rule_condition_groups`, `rule_conditions`, `rule_actions`, `schedule_rules`, `rule_execution_logs`
- 3 database functions: `evaluate_rule_conditions()`, `execute_rule_actions()`, `evaluate_automation_rules()`
- 1 trigger: `trigger_evaluate_automation_rules` on `sensor_readings` table
- RLS policies for all new tables

### Step 2: Enable pg_cron (Optional - For Schedule-Based Rules)

Schedule-based rules require the `pg_cron` extension:

1. Go to **Supabase Dashboard** → Your Project → **Database** → **Extensions**
2. Search for `pg_cron`
3. Click **Enable**

```sql
-- Verify pg_cron is enabled
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
```

### Step 3: Verify Migration

Check that all tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'automation_rules',
    'rule_condition_groups',
    'rule_conditions',
    'rule_actions',
    'schedule_rules',
    'rule_execution_logs'
  );
```

Expected output: 6 rows

### Step 4: (Optional) Create Sample Rule

Test the system with a sample automation rule:

```sql
-- Create a simple rule: "Turn on fan when temperature > 30°C"
DO $$
DECLARE
  user_id UUID;
  rule_id UUID;
  group_id UUID;
  temp_sensor_id UUID;
  fan_actuator_id UUID;
BEGIN
  -- Get your user ID (replace with actual auth.uid())
  SELECT id INTO user_id FROM auth.users WHERE email = 'your-email@example.com';

  -- Get sample sensor and actuator
  SELECT id INTO temp_sensor_id FROM sensors WHERE sensor_type = 'temperature' LIMIT 1;
  SELECT id INTO fan_actuator_id FROM actuators WHERE actuator_type = 'fan' LIMIT 1;

  -- Create rule
  INSERT INTO automation_rules (user_id, name, priority, is_active)
  VALUES (user_id, 'Auto ventilation on high temperature', 10, TRUE)
  RETURNING id INTO rule_id;

  -- Create condition group
  INSERT INTO rule_condition_groups (rule_id, group_order)
  VALUES (rule_id, 0)
  RETURNING id INTO group_id;

  -- Create condition: temperature > 30
  INSERT INTO rule_conditions (group_id, sensor_id, operator, value, condition_order)
  VALUES (group_id, temp_sensor_id, 'gt', 30.0, 0);

  -- Create action: turn on fan
  INSERT INTO rule_actions (rule_id, actuator_id, action_type, action_order)
  VALUES (rule_id, fan_actuator_id, 'on', 0);

  RAISE NOTICE 'Sample rule created: %', rule_id;
END $$;
```

---

## Part 2: Frontend Development

### Step 1: Install Dependencies

No new dependencies needed - uses existing stack from feature 001:
- React 18+
- TypeScript 5+
- @supabase/supabase-js
- React Query (TanStack Query)
- Recharts (for historical data, already installed)

### Step 2: Copy TypeScript Types

Copy the generated types to your frontend:

```bash
cp specs/002-crea-e-implementa/contracts/automation-types.ts frontend/src/types/automation.ts
```

### Step 3: Create Automation Service

Create `/frontend/src/services/automation.service.ts`:

```typescript
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
    // 1. Create automation rule
    const { data: rule, error: ruleError } = await supabase
      .from('automation_rules')
      .insert({
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
```

### Step 4: Create React Query Hooks

Create `/frontend/src/lib/hooks/useAutomationRules.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationService } from '../../services/automation.service';
import type { CreateRuleRequest, UpdateRuleRequest } from '../../types/automation';

export const useAutomationRules = () => {
  return useQuery({
    queryKey: ['automation-rules'],
    queryFn: () => automationService.listRules(),
  });
};

export const useAutomationRule = (ruleId: string | undefined) => {
  return useQuery({
    queryKey: ['automation-rule', ruleId],
    queryFn: () => automationService.getRule(ruleId!),
    enabled: !!ruleId,
  });
};

export const useCreateRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateRuleRequest) => automationService.createRule(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
  });
};

export const useUpdateRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, updates }: { ruleId: string; updates: UpdateRuleRequest }) =>
      automationService.updateRule(ruleId, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      queryClient.invalidateQueries({ queryKey: ['automation-rule', variables.ruleId] });
    },
  });
};

export const useDeleteRule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => automationService.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    },
  });
};

export const useRuleExecutionHistory = (ruleId: string | undefined) => {
  return useQuery({
    queryKey: ['rule-execution-history', ruleId],
    queryFn: () => automationService.getExecutionHistory(ruleId!),
    enabled: !!ruleId,
  });
};
```

### Step 5: Create Pages and Components

**Actuators Page** (`/frontend/src/pages/Actuators.page.tsx`):

```typescript
import React from 'react';
import { ActuatorManager } from '../components/actuators/ActuatorManager';

export const ActuatorsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Gestione Attuatori</h1>
      <ActuatorManager />
    </div>
  );
};
```

**Automation Page** (`/frontend/src/pages/Automation.page.tsx`):

```typescript
import React, { useState } from 'react';
import { RuleList } from '../components/automation/RuleList';
import { RuleEditor } from '../components/automation/RuleEditor';

export const AutomationPage: React.FC = () => {
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Regole di Automazione</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="btn btn-primary"
        >
          + Nuova Regola
        </button>
      </div>

      <RuleList
        onSelectRule={setSelectedRuleId}
        onCreateRule={() => setIsCreating(true)}
      />

      {(selectedRuleId || isCreating) && (
        <RuleEditor
          ruleId={selectedRuleId}
          onClose={() => {
            setSelectedRuleId(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
};
```

### Step 6: Update App Routing

Add new routes to your main `App.tsx`:

```typescript
import { AutomationPage } from './pages/Automation.page';
import { ActuatorsPage } from './pages/Actuators.page';

// Inside your Routes:
<Route path="/actuators" element={<ActuatorsPage />} />
<Route path="/automation" element={<AutomationPage />} />
```

---

## Part 3: Testing

### Test 1: Create Automation Rule

1. Navigate to `/automation`
2. Click "Nuova Regola"
3. Configure:
   - Name: "Auto ventilation"
   - Condition: Temperature > 30°C
   - Action: Turn ON Fan
   - Priority: 10
4. Save rule

### Test 2: Trigger Rule

1. Insert sensor data that meets condition:

```sql
INSERT INTO sensor_readings (sensor_id, value, time)
VALUES (
  '{your_temp_sensor_id}',
  35.0,  -- Exceeds 30°C threshold
  NOW()
);
```

2. Check that command was queued:

```sql
SELECT * FROM commands
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

3. Check execution log:

```sql
SELECT * FROM rule_execution_logs
ORDER BY executed_at DESC
LIMIT 5;
```

### Test 3: View Execution History

1. Navigate to automation rule detail
2. View "Storico Esecuzioni" tab
3. Verify execution appears with sensor value and timestamp

---

## Part 4: Deployment

### Deploy to Netlify

```bash
cd frontend
npm run build

# Deploy via Netlify CLI
netlify deploy --prod
```

### Verify Production

1. Navigate to your production URL
2. Test automation rule creation
3. Verify database trigger works in production

---

## Troubleshooting

### Issue: Trigger not firing

**Check**:
```sql
-- Verify trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_evaluate_automation_rules';

-- Check trigger function
SELECT proname FROM pg_proc WHERE proname = 'evaluate_automation_rules';
```

**Solution**: Re-run migration script

### Issue: RLS blocking rule evaluation

**Check**: Trigger function has `SECURITY DEFINER` attribute

```sql
SELECT proname, prosecdef FROM pg_proc
WHERE proname = 'evaluate_automation_rules';
-- prosecdef should be true
```

### Issue: Rule not matching despite conditions met

**Debug**:
```sql
-- Manually test condition evaluation
SELECT evaluate_rule_conditions('{rule_id}', '{sensor_id}', 35.0);
-- Should return TRUE if conditions met
```

---

## Next Steps

1. **Implement Components**: Build React components for RuleList, RuleEditor, ConditionBuilder
2. **Add Hysteresis UI**: Create UI for configuring on/off thresholds
3. **Schedule-Based Rules**: Deploy Edge Function for scheduled rules
4. **Execution History**: Build charts for rule execution trends
5. **Priority Management**: Add drag-and-drop priority reordering

---

## References

- **Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Database Schema**: [contracts/supabase-automation-schema.sql](./contracts/supabase-automation-schema.sql)
- **TypeScript Types**: [contracts/automation-types.ts](./contracts/automation-types.ts)
- **Feature 001 Quick Start**: [../001-voglio-fare-una/quickstart.md](../001-voglio-fare-una/quickstart.md)

---

## Support

For issues or questions:
- Review [data-model.md](./data-model.md) for database structure
- Check [research.md](./research.md) for architectural decisions
- Test database functions directly via SQL before debugging frontend
