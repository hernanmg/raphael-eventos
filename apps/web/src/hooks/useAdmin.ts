import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecordPaymentInput } from '@raphael-eventos/shared';
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

export function useRecordPayment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ beneficiaryId, input }: { beneficiaryId: string; input: RecordPaymentInput }) =>
      api.recordPayment(beneficiaryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] });
    },
  });
}

export function useDeletePayment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] });
    },
  });
}

export function useBeneficiaryReport(beneficiaryId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'beneficiaries', beneficiaryId, 'report'],
    queryFn: () => api.getBeneficiaryReport(beneficiaryId!),
    enabled: Boolean(beneficiaryId),
  });
}

export function useClients() {
  return useQuery({ queryKey: ['admin', 'clients'], queryFn: api.listClients });
}

export function useClientDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'clients', userId],
    queryFn: () => api.getClientDetail(userId!),
    enabled: Boolean(userId),
  });
}
