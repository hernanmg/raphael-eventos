import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CardAdjustmentInput,
  EventType,
  ProviderInput,
  UpdateEventInput,
} from '@raphael-eventos/shared';
import { api } from '../lib/api';

// Hooks de la Fase 4: edición de eventos, ajustes de tarjeta, auditoría,
// proveedores/sponsors y reportes.

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => api.updateEvent(eventId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export function useAdjustCard(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: CardAdjustmentInput }) =>
      api.adjustCard(cardId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] }),
  });
}

export function useAuditLog(params: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => api.getAuditLog(params),
  });
}

export function useEventHistory(eventId: string) {
  return useQuery({
    // Debajo de ['admin','events',eventId]: se refresca con cualquier cambio del evento.
    queryKey: ['admin', 'events', eventId, 'history'],
    queryFn: () => api.getEventHistory(eventId),
  });
}

const providersKey = ['admin', 'providers'] as const;
const sponsorsKey = ['admin', 'sponsors'] as const;

export function useAdminProviders() {
  return useQuery({ queryKey: providersKey, queryFn: api.listAdminProviders });
}

export function useSaveProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ProviderInput }) =>
      id ? api.updateProvider(id, input) : api.createProvider(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providersKey }),
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProvider(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providersKey }),
  });
}

export function useAdminSponsors() {
  return useQuery({ queryKey: sponsorsKey, queryFn: api.listAdminSponsors });
}

export function useSaveSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id: string | null; form: FormData }) => api.saveSponsor(id, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sponsorsKey }),
  });
}

export function useDeleteSponsor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSponsor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sponsorsKey }),
  });
}

export function usePublicProviders(eventType?: EventType) {
  return useQuery({
    queryKey: ['public', 'providers', eventType ?? 'all'],
    queryFn: () => api.getPublicProviders(eventType),
    select: (data) => data.providers,
  });
}

export function usePublicSponsors() {
  return useQuery({
    queryKey: ['public', 'sponsors'],
    queryFn: api.getPublicSponsors,
    select: (data) => data.sponsors,
  });
}

export function usePortalProviders() {
  return useQuery({ queryKey: ['portal', 'providers'], queryFn: api.getPortalProviders });
}

export function useYearReport(year: number) {
  return useQuery({
    queryKey: ['admin', 'reports', year],
    queryFn: () => api.getYearReport(year),
    select: (data) => data.report,
  });
}
