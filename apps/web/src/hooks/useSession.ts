import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export const SESSION_QUERY_KEY = ['session'] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: api.me,
    staleTime: 60_000,
  });
}
