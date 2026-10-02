import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CalendarEntry } from '@raphael-eventos/shared';
import { useCalendar } from '../../../hooks/useCrm';
import { EVENT_TYPE_LABELS } from '../../../lib/format';

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AvailabilityCalendarPage() {
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const { data, isLoading } = useCalendar(monthStart.toISOString(), monthEnd.toISOString());

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of data?.entries ?? []) {
      const key = entry.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const totalDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from(
      { length: totalDays },
      (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1),
    ),
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Calendario de disponibilidad</h1>
      <p className="mt-2 text-sm text-muted">
        Eventos confirmados (línea sólida) y consultas con seña que tienen una fecha tentativa
        marcada (línea punteada) — evitá comprometer una fecha que ya tiene una consulta avanzada
        encima.
      </p>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
          }
          className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink"
        >
          ← Anterior
        </button>
        <h2 className="font-serif text-lg font-semibold capitalize">
          {MONTH_FORMATTER.format(monthStart)}
        </h2>
        <button
          type="button"
          onClick={() =>
            setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
          }
          className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-ink"
        >
          Siguiente →
        </button>
      </div>

      {isLoading && <p className="mt-6 text-sm text-muted">Cargando…</p>}

      <div className="mt-4 grid grid-cols-7 gap-1.5 text-xs">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center font-semibold uppercase tracking-wide text-muted"
          >
            {day}
          </div>
        ))}
        {cells.map((date, i) =>
          date ? (
            <DayCell key={i} date={date} entries={entriesByDate.get(toISODate(date)) ?? []} />
          ) : (
            <div key={i} />
          ),
        )}
      </div>
    </main>
  );
}

function DayCell({ date, entries }: { date: Date; entries: CalendarEntry[] }) {
  return (
    <div className="min-h-[72px] rounded-lg border border-line p-1.5">
      <p className="text-right text-muted">{date.getDate()}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        {entries.map((entry) => (
          <Link
            key={entry.refId}
            to={entry.kind === 'CONFIRMADO' ? `/admin/eventos/${entry.refId}` : '/admin/consultas'}
            title={`${entry.label} — ${EVENT_TYPE_LABELS[entry.eventType]}`}
            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium transition hover:opacity-80 ${
              entry.kind === 'CONFIRMADO'
                ? 'bg-ink text-white'
                : 'border border-dashed border-gold text-gold'
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
