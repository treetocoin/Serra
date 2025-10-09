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
