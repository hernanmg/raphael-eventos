import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReminderConfigInput } from '@raphael-eventos/shared';
import { api } from '../lib/api';

export function useReminderConfig() {
  return useQuery({ queryKey: ['admin', 'reminder-config'], queryFn: api.getReminderConfig });
}

export function useUpdateReminderConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReminderConfigInput) => api.updateReminderConfig(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reminder-config'] }),
  });
}

export function useReminderLogs() {
  return useQuery({ queryKey: ['admin', 'reminders', 'log'], queryFn: api.listReminderLogs });
}

export function useRunReminders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.runReminders(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reminders', 'log'] }),
  });
}
