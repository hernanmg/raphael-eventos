import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useEvents() {
  return useQuery({
    queryKey: ['portal', 'events'],
    queryFn: api.listEvents,
  });
}

export function useEventDetail(eventId: string | undefined) {
  return useQuery({
    queryKey: ['portal', 'events', eventId],
    queryFn: () => api.getEventDetail(eventId!),
    enabled: Boolean(eventId),
  });
}
