import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeadIntakeInput, UpdateLeadInput } from '@raphael-eventos/shared';
import { api } from '../lib/api';

export function useSubmitLead() {
  return useMutation({ mutationFn: (input: LeadIntakeInput) => api.submitLead(input) });
}

export function useLeads(status?: string) {
  return useQuery({
    queryKey: ['admin', 'leads', status ?? 'ALL'],
    queryFn: () => api.listLeads(status),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLeadInput }) =>
      api.updateLead(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
    },
  });
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['admin', 'calendar', from, to],
    queryFn: () => api.getCalendar(from, to),
  });
}
