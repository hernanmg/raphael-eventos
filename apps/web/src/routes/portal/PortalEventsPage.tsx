import { Link } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { useEvents } from '../../hooks/useEvents';
import { EventSummaryCard } from './EventSummaryCard';

export default function PortalEventsPage() {
  const { data: session } = useSession();
  const { data, isLoading, isError } = useEvents();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold">Hola, {session?.user.fullName}</h1>
      <p className="mt-2 text-sm text-muted">
        Estos son los eventos vinculados a tu cuenta, con el saldo y el valor actualizado por IPC de
        cada uno.
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando tus eventos…</p>}

      {isError && (
        <p className="mt-8 text-sm text-red-600">
          No pudimos cargar tus eventos. Probá de nuevo en un rato.
        </p>
      )}

      {data && data.events.length === 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-paper p-6 text-sm text-muted">
          Todavía no tenés eventos vinculados a tu cuenta. Cuando el salón cargue tu evento con este
          mismo email, va a aparecer acá automáticamente.
        </div>
      )}

      {data && data.events.length > 0 && (
        <div className="mt-8 flex flex-col gap-4">
          {data.events.map((event) => (
            <EventSummaryCard key={event.eventId} event={event} />
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-muted">
        ¿Buscás otra cosa?{' '}
        <Link to="/ayuda" className="text-ink underline">
          Mirá la Ayuda
        </Link>
        .
      </p>
    </main>
  );
}
