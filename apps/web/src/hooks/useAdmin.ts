import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: api.getDashboard,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export function useAdminEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'events', eventId],
    queryFn: () => api.getAdminEventDetail(eventId!),
    enabled: Boolean(eventId),
  });
}

export function useIpcHistory() {
  return useQuery({
    queryKey: ['admin', 'ipc'],
    queryFn: api.listIpcHistory,
  });
}

export function useAddIpcEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addIpcEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ipc'] });
    },
  });
}
