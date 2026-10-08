import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CheckInAdmitInput,
  CheckInLookupInput,
  CheckInRejectInput,
} from '@raphael-eventos/shared';
import { api } from '../lib/api';

const eventKey = (eventId: string) => ['checkin', 'events', eventId] as const;

export function useCheckInEvent(eventId: string) {
  return useQuery({
    queryKey: eventKey(eventId),
    queryFn: () => api.getCheckInEvent(eventId),
    select: (data) => data.event,
    retry: false,
  });
}

/** Solo lectura: no registra nada en el servidor. */
export function useCheckInLookup(eventId: string) {
  return useMutation({
    mutationFn: (input: CheckInLookupInput) => api.checkInLookup(eventId, input),
  });
}

export function useCheckInAdmit(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, input }: { guestId: string; input: CheckInAdmitInput }) =>
      api.checkInAdmit(eventId, guestId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKey(eventId) }),
  });
}

export function useCheckInReject(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, input }: { guestId: string; input: CheckInRejectInput }) =>
      api.checkInReject(eventId, guestId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKey(eventId) }),
  });
}
