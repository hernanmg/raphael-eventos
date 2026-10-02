import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useAdminContract(eventId: string) {
  return useQuery({
    queryKey: ['admin', 'events', eventId, 'contract'],
    queryFn: () => api.getAdminContract(eventId),
  });
}

export function useUploadContract(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadContract(eventId, file),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'contract'] }),
  });
}

export function useDeleteContract(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteContract(eventId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'contract'] }),
  });
}

export function usePortalContract(eventId: string) {
  return useQuery({
    queryKey: ['portal', 'events', eventId, 'contract'],
    queryFn: () => api.getPortalContract(eventId),
  });
}
