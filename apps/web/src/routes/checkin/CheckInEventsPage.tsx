import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { EVENT_TYPE_LABELS, formatDate } from '../../lib/format';
import { useSession } from '../../hooks/useSession';

/**
 * Entrada al check-in de invitados (Fase 3). Un empleado PUERTA ve solo los
 * eventos donde está asignado; el staff del panel ve todos los próximos.
 * Cada evento abre su pantalla de escaneo (`/checkin/:eventId`).
 */
export default function CheckInEventsPage() {
  const { data: session } = useSession();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['checkin', 'events'],
    queryFn: api.listCheckInEvents,
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold">Check-in</h1>
      <p className="mt-2 text-sm text-muted">
        {session?.user.role === 'PUERTA'
          ? 'Eventos donde estás asignado/a.'
          : 'Próximos eventos del salón.'}
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar los eventos.</p>}

      {data && data.events.length === 0 && (
        <p className="mt-8 rounded-2xl border border-line p-5 text-sm text-muted">
          No tenés eventos asignados próximamente. Si te toca trabajar en uno, pedile al salón que
          te asigne desde el detalle del evento.
        </p>
      )}

      {data && data.events.length > 0 && (
        <ul className="mt-8 flex flex-col gap-2">
          {data.events.map((event) => (
            <li key={event.id}>
              <Link
                to={`/checkin/${event.id}`}
                className="block rounded-2xl border border-line p-4 transition hover:border-ink"
              >
                <p className="font-medium text-ink">{event.name}</p>
                <p className="text-xs text-muted">
                  {EVENT_TYPE_LABELS[event.type]} · {formatDate(event.eventDate)}
                  {event.startTime && ` · ${event.startTime} h`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
