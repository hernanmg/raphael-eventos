import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Perfil público del salón (WhatsApp, Instagram, dirección). Cambia muy de
 * vez en cuando — se pide una vez por sesión de navegación.
 */
export function useSalonProfile() {
  return useQuery({
    queryKey: ['public', 'salon'],
    queryFn: api.getSalonProfile,
    staleTime: Infinity,
    select: (data) => data.salon,
  });
}
