import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminGuestInput,
  EventPublicInfoInput,
  GuestInput,
  GuestRsvpInput,
} from '@raphael-eventos/shared';
import { api } from '../lib/api';

// -- Público (micrositio de invitados, sin sesión) --------------------

export function useInvite(inviteToken: string) {
  return useQuery({
    queryKey: ['public', 'invite', inviteToken],
    queryFn: () => api.getInvite(inviteToken),
    select: (data) => data.invite,
    retry: false,
  });
}

export function useRsvp(inviteToken: string) {
  return useMutation({
    mutationFn: (input: GuestRsvpInput) => api.rsvp(inviteToken, input),
  });
}

export function useGuestPass(qrToken: string) {
  return useQuery({
    queryKey: ['public', 'guest', qrToken],
    queryFn: () => api.getGuestPass(qrToken),
    select: (data) => data.pass,
    retry: false,
  });
}

// -- Portal del titular -------------------------------------------------

const portalGuestsKey = (eventId: string) => ['portal', 'events', eventId, 'guests'] as const;

export function usePortalGuests(eventId: string) {
  return useQuery({
    queryKey: portalGuestsKey(eventId),
    queryFn: () => api.getPortalGuests(eventId),
  });
}

export function useEnsurePortalInviteLink(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.ensurePortalInviteLink(eventId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalGuestsKey(eventId) }),
  });
}

export function useAddPortalGuest(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GuestInput) => api.addPortalGuest(eventId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalGuestsKey(eventId) }),
  });
}

export function useCancelPortalGuest(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => api.cancelPortalGuest(guestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalGuestsKey(eventId) }),
  });
}

// -- Panel admin -------------------------------------------------------

const adminGuestsKey = (eventId: string) => ['admin', 'events', eventId, 'guests'] as const;

export function useAdminGuests(eventId: string) {
  return useQuery({
    queryKey: adminGuestsKey(eventId),
    queryFn: () => api.getAdminGuests(eventId),
  });
}

export function useEnsureAdminInviteLink(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beneficiaryId: string) => api.ensureAdminInviteLink(beneficiaryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminGuestsKey(eventId) }),
  });
}

export function useAddAdminGuest(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminGuestInput) => api.addAdminGuest(eventId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminGuestsKey(eventId) }),
  });
}

export function useCancelAdminGuest(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => api.cancelAdminGuest(guestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminGuestsKey(eventId) }),
  });
}

export function useUpdateEventPublicInfo(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventPublicInfoInput) => api.updateEventPublicInfo(eventId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId] }),
  });
}
