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

/** Un cambio de IPC mueve el valor de las tarjetas impagas: además del
 *  historial se invalidan los eventos y los reportes ya cargados. */
function invalidateAfterIpc(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'ipc'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'events'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] });
}

export function useAddIpcEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.addIpcEntry,
    onSuccess: () => invalidateAfterIpc(queryClient),
  });
}

export function useUpdateIpcEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, variationPct }: { id: string; variationPct: number }) =>
      api.updateIpcEntry(id, { variationPct }),
    onSuccess: () => invalidateAfterIpc(queryClient),
  });
}

export function useDeleteIpcEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteIpcEntry(id),
    onSuccess: () => invalidateAfterIpc(queryClient),
  });
}

export function useCardHistory(cardId: string | null) {
  return useQuery({
    queryKey: ['admin', 'cards', cardId, 'history'],
    queryFn: () => api.getCardHistory(cardId!),
    enabled: Boolean(cardId),
    select: (data) => data.history,
  });
}

export function useRecordPayment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ beneficiaryId, input }: { beneficiaryId: string; input: RecordPaymentInput }) =>
      api.recordPayment(beneficiaryId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] });
    },
  });
}

export function useDeletePayment(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'cards'] });
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
