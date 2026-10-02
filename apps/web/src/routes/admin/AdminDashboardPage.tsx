import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EventType } from '@raphael-eventos/shared';
import { useDashboard, useIpcHistory } from '../../hooks/useAdmin';
import { useSession } from '../../hooks/useSession';
import { EVENT_TYPE_LABELS, formatDate } from '../../lib/format';

type Filter = EventType | 'ALL' | null;

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useDashboard();
  const { data: session } = useSession();
  const { data: ipcData } = useIpcHistory();
  const [filter, setFilter] = useState<Filter>(null);

  const visibleEvents = useMemo(() => {
    const events = data?.dashboard.events ?? [];
    const now = Date.now();

    if (filter === null) {
      return events
        .filter(
          (event) =>
            event.status === 'ACTIVO' &&
            event.eventDate &&
            new Date(event.eventDate).getTime() >= now,
        )
        .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime());
    }

    const filtered = filter === 'ALL' ? events : events.filter((event) => event.type === filter);
    return [...filtered].sort((a, b) => {
      if (!a.eventDate) return 1;
      if (!b.eventDate) return -1;
      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });
  }, [data, filter]);

  const sectionTitle =
    filter === null
      ? 'Próximos eventos'
      : filter === 'ALL'
        ? 'Todos los eventos'
        : `Eventos: ${EVENT_TYPE_LABELS[filter]}`;

  function toggleFilter(next: Filter) {
    setFilter((current) => (current === next ? null : next));
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Panel admin</h1>
          <p className="mt-1 text-sm text-muted">Dashboard de eventos del salón.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/clientes"
            className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
          >
            Clientes
          </Link>
          <Link
            to="/admin/consultas"
            className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
          >
            Consultas
          </Link>
          <Link
            to="/admin/calendario"
            className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
          >
            Calendario
          </Link>
          <Link
            to="/admin/personal"
            className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
          >
            Personal
          </Link>
          <Link
            to="/admin/recordatorios"
            className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
          >
            Recordatorios
          </Link>
          {session?.tenantPlan === 'PRO' && (
            <Link
              to="/admin/costeo/config"
              className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
            >
              Costeo
            </Link>
          )}
          <Link
            to="/admin/ipc"
            className="rounded-full border border-ink px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
          >
            Estado del IPC
          </Link>
          <Link
            to="/admin/eventos/nuevo"
            className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Cargar evento
          </Link>
        </div>
      </div>

      {ipcData?.staleness.stale && (
        <Link
          to="/admin/ipc"
          className="mt-6 block rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 transition hover:border-amber-400"
        >
          {ipcData.staleness.message}
        </Link>
      )}

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar el dashboard.</p>}

      {data && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <StatCard
              label="Total"
              value={data.dashboard.totals.total}
              active={filter === 'ALL'}
              onClick={() => toggleFilter('ALL')}
            />
            <StatCard
              label={EVENT_TYPE_LABELS.QUINCE}
              value={data.dashboard.totals.QUINCE}
              active={filter === 'QUINCE'}
              onClick={() => toggleFilter('QUINCE')}
            />
            <StatCard
              label={EVENT_TYPE_LABELS.EGRESO}
              value={data.dashboard.totals.EGRESO}
              active={filter === 'EGRESO'}
              onClick={() => toggleFilter('EGRESO')}
            />
            <StatCard
              label={EVENT_TYPE_LABELS.BODA}
              value={data.dashboard.totals.BODA}
              active={filter === 'BODA'}
              onClick={() => toggleFilter('BODA')}
            />
            <StatCard
              label={EVENT_TYPE_LABELS.EMPRESARIAL}
              value={data.dashboard.totals.EMPRESARIAL}
              active={filter === 'EMPRESARIAL'}
              onClick={() => toggleFilter('EMPRESARIAL')}
            />
          </div>

          <div className="mb-3 mt-10 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">{sectionTitle}</h2>
            {filter !== null && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="text-sm text-muted hover:text-ink"
              >
                Ver próximos
              </button>
            )}
          </div>

          {visibleEvents.length === 0 ? (
            <p className="text-sm text-muted">No hay eventos para mostrar acá.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/admin/eventos/${event.id}`}
                    className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm transition hover:border-ink"
                  >
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                      <p className="font-medium text-ink">{event.name}</p>
                    </div>
                    <span className="text-muted">{formatDate(event.eventDate)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-center transition ${
        active ? 'border-ink bg-ink' : 'border-line bg-paper hover:border-ink'
      }`}
    >
      <p className={`text-2xl font-semibold ${active ? 'text-white' : 'text-ink'}`}>{value}</p>
      <p
        className={`mt-1 text-xs uppercase tracking-wide ${active ? 'text-white/70' : 'text-muted'}`}
      >
        {label}
      </p>
    </button>
  );
}
