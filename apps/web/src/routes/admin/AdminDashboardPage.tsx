import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminEventListItem, EventType, YearReport } from '@raphael-eventos/shared';
import { useDashboard, useIpcHistory } from '../../hooks/useAdmin';
import { useLeads } from '../../hooks/useCrm';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { useYearReport } from '../../hooks/usePhase4';
import { useSession } from '../../hooks/useSession';
import { AdminIcon } from '../../components/admin/AdminIcon';
import { ADMIN_NAV, visibleItems, type AdminNavItem } from '../../components/admin/adminNav';
import { EVENT_TYPE_LABELS, formatCurrency, formatDate } from '../../lib/format';
import { formatPeriodMonth, formatVariation } from '../../lib/ipc';

// CANCELLED: los cancelados solo aparecen con su card, nunca en el resto.
type Filter = EventType | 'ALL' | 'CANCELLED' | null;

// Desktop: dashboard como "hub de módulos" (cards agrupadas por área).
// Mobile: tablero tipo bento; la navegación vive en la barra inferior
// (AdminTabBar). Los datos extra (cobranza del año, consultas nuevas) salen de
// los endpoints que ya usan Reportes y Consultas — sin endpoint nuevo.
export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useDashboard();
  const { data: session } = useSession();
  const { data: ipcData } = useIpcHistory();
  const { data: newLeadsData } = useLeads('NUEVO');
  const year = new Date().getFullYear();
  const { data: report } = useYearReport(year);
  const isDesktop = useIsDesktop();
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

    const filtered =
      filter === 'CANCELLED'
        ? events.filter((event) => event.status === 'CANCELADO')
        : events.filter(
            (event) => event.status !== 'CANCELADO' && (filter === 'ALL' || event.type === filter),
          );
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
        : filter === 'CANCELLED'
          ? 'Eventos cancelados'
          : `Eventos: ${EVENT_TYPE_LABELS[filter]}`;

  function toggleFilter(next: Filter) {
    setFilter((current) => (current === next ? null : next));
  }

  const isPro = session?.tenantPlan === 'PRO';
  const newLeads = newLeadsData?.leads.length;
  const ipcStale = ipcData?.staleness.stale ?? false;
  const latestIpc = ipcData?.history[0];
  const ipcSummary = latestIpc
    ? `${formatPeriodMonth(latestIpc.period)} ${formatVariation(latestIpc.sourceLatestValue)}`
    : undefined;

  const statCards = data && (
    <div
      className={
        isDesktop
          ? 'grid grid-cols-6 gap-3'
          : '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]'
      }
    >
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
      <StatCard
        label="Cancelados"
        value={data.dashboard.totals.cancelled}
        active={filter === 'CANCELLED'}
        onClick={() => toggleFilter('CANCELLED')}
      />
    </div>
  );

  const eventsSection = data && (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
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
        <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">
          No hay eventos para mostrar acá.
        </p>
      ) : (
        <ul className="rounded-2xl border border-line bg-paper px-4 shadow-card sm:px-5">
          {visibleEvents.map((event) => (
            <li key={event.id} className="border-t border-line first:border-t-0">
              <EventRow event={event} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const ipcBanner = ipcStale && (
    <Link
      to="/admin/ipc"
      className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 transition hover:border-amber-400"
    >
      <AdminIcon name="alert" className="mt-0.5 h-5 w-5" />
      <span>{ipcData?.staleness.message}</span>
    </Link>
  );

  const status = (
    <>
      {isLoading && <p className="text-sm text-muted">Cargando…</p>}
      {isError && <p className="text-sm text-red-600">No pudimos cargar el dashboard.</p>}
    </>
  );

  if (!isDesktop) {
    return (
      <main className="flex flex-col gap-5 px-4 pb-8 pt-6">
        <div>
          <h1 className="font-serif text-[26px] font-semibold leading-tight">
            {greeting()}
            {session?.user.fullName ? `, ${session.user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">{todayLabel()}</p>
        </div>

        {ipcBanner}

        <div className="grid grid-cols-2 gap-3">
          <CollectionTile report={report} year={year} />
          <Link
            to="/admin/consultas"
            className="flex flex-col gap-2 rounded-3xl border border-line bg-paper p-4 shadow-card"
          >
            <TileHeader label="Consultas" />
            <span className="font-serif text-3xl font-semibold leading-none">
              {newLeads ?? '–'}
            </span>
            <span className="text-xs text-muted">
              {newLeads === 1 ? 'nueva, sin responder' : 'nuevas, sin responder'}
            </span>
          </Link>
          <Link
            to="/admin/ipc"
            className="flex flex-col gap-2 rounded-3xl border border-line bg-paper p-4 shadow-card"
          >
            <TileHeader label="IPC" />
            <IpcChip stale={ipcStale} loaded={!!ipcData} />
            <span className="text-xs text-muted first-letter:uppercase">
              {ipcStale ? 'Falta el dato del último mes' : (ipcSummary ?? '')}
            </span>
          </Link>
        </div>

        {status}
        {statCards}
        {eventsSection}
        {report && <OccupancyTile report={report} />}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pb-16 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Panel admin</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="first-letter:uppercase">{todayLabel()}</span>
            <IpcChip stale={ipcStale} loaded={!!ipcData} />
          </p>
        </div>
        <Link
          to="/admin/eventos/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
        >
          <AdminIcon name="plus" className="h-4 w-4" />
          Cargar evento
        </Link>
      </div>

      {ipcBanner}
      {status}
      {statCards}
      {eventsSection}

      {ADMIN_NAV.map((group) => {
        const items = visibleItems(group, isPro);
        return (
          <section key={group.id} aria-labelledby={`grupo-${group.id}`}>
            <h2 id={`grupo-${group.id}`} className="mb-3 font-serif text-xl font-semibold">
              {group.title}
            </h2>
            <ul className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <li key={item.to}>
                  <ModuleCard
                    item={item}
                    meta={moduleMeta(item.to, { newLeads, ipcStale, ipcSummary, report })}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
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
      aria-pressed={active}
      className={`flex shrink-0 items-baseline gap-2.5 rounded-2xl border px-4 py-3 text-left transition md:py-3.5 ${
        active ? 'border-ink bg-ink' : 'border-line bg-paper hover:border-ink'
      }`}
    >
      <span className={`text-2xl font-semibold tabular-nums ${active ? 'text-white' : 'text-ink'}`}>
        {value}
      </span>
      <span
        className={`whitespace-nowrap text-xs font-semibold uppercase tracking-wide ${
          active ? 'text-white/70' : 'text-muted'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

const dayFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', timeZone: 'UTC' });
const monthFormatter = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' });

function EventRow({ event }: { event: AdminEventListItem }) {
  const date = event.eventDate ? new Date(event.eventDate) : null;
  return (
    <Link to={`/admin/eventos/${event.id}`} className="group flex items-center gap-4 py-3 text-sm">
      <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-cream py-1.5">
        <span className="font-serif text-lg font-semibold leading-tight">
          {date ? dayFormatter.format(date) : '–'}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {date ? monthFormatter.format(date).replace('.', '') : 's/f'}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gold-ink">
          {EVENT_TYPE_LABELS[event.type]}
        </span>
        <span className="block truncate font-medium text-ink">{event.name}</span>
      </span>
      <span className="hidden text-muted sm:block">{formatDate(event.eventDate)}</span>
      <AdminIcon
        name="chevronRight"
        className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink motion-reduce:transform-none"
      />
    </Link>
  );
}

function IpcChip({ stale, loaded }: { stale: boolean; loaded: boolean }) {
  if (!loaded) return null;
  return stale ? (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      <AdminIcon name="alert" className="h-3.5 w-3.5" />
      IPC desactualizado
    </span>
  ) : (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
      <AdminIcon name="check" className="h-3.5 w-3.5" />
      IPC al día
    </span>
  );
}

type Meta = { text: string; tone: 'hot' | 'ok' | 'warn' | 'plain' } | null;

function moduleMeta(
  to: string,
  ctx: { newLeads?: number; ipcStale: boolean; ipcSummary?: string; report?: YearReport },
): Meta {
  switch (to) {
    case '/admin/consultas':
      if (ctx.newLeads === undefined) return null;
      return ctx.newLeads > 0
        ? { text: `${ctx.newLeads} ${ctx.newLeads === 1 ? 'nueva' : 'nuevas'}`, tone: 'hot' }
        : { text: 'Sin consultas nuevas', tone: 'plain' };
    case '/admin/ipc':
      if (ctx.ipcStale) return { text: 'Desactualizado', tone: 'warn' };
      if (!ctx.ipcSummary) return null;
      return { text: `Al día · ${ctx.ipcSummary}`, tone: 'ok' };
    case '/admin/reportes': {
      const committed = ctx.report?.totals.committed ?? 0;
      if (!ctx.report || committed <= 0) return null;
      const pct = (ctx.report.totals.collectedForEvents / committed) * 100;
      return {
        text: `Cobrado ${pct.toFixed(1).replace('.', ',')}% en ${ctx.report.year}`,
        tone: 'plain',
      };
    }
    default:
      return null;
  }
}

const META_TONE: Record<NonNullable<Meta>['tone'], string> = {
  hot: 'text-gold-ink',
  ok: 'text-emerald-800',
  warn: 'text-amber-800',
  plain: 'text-muted',
};

function ModuleCard({ item, meta }: { item: AdminNavItem; meta: Meta }) {
  return (
    <Link
      to={item.to}
      className="group flex h-full min-h-[150px] flex-col gap-3 rounded-2xl border border-line bg-paper p-5 shadow-card transition hover:-translate-y-0.5 hover:border-gold-soft hover:shadow-card-hover motion-reduce:transform-none"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream text-gold-ink transition group-hover:bg-gold-soft">
        <AdminIcon name={item.icon} />
      </span>
      <span>
        <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {item.label}
          {item.proOnly && (
            <span className="rounded-full bg-ink px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
              Pro
            </span>
          )}
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-muted">{item.description}</span>
      </span>
      {meta && (
        <span
          className={`mt-auto inline-flex items-center gap-1.5 text-xs font-semibold ${META_TONE[meta.tone]}`}
        >
          {meta.tone === 'hot' && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
          {meta.tone === 'ok' && <AdminIcon name="check" className="h-3.5 w-3.5" />}
          {meta.tone === 'warn' && <AdminIcon name="alert" className="h-3.5 w-3.5" />}
          {meta.text}
        </span>
      )}
    </Link>
  );
}

function TileHeader({ label, dark = false }: { label: string; dark?: boolean }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span
        className={`text-[11px] font-semibold uppercase tracking-wider ${dark ? 'text-cream/65' : 'text-muted'}`}
      >
        {label}
      </span>
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border ${
          dark ? 'border-white/20 text-cream' : 'border-line text-muted'
        }`}
      >
        <AdminIcon name="chevronRight" className="h-3.5 w-3.5" />
      </span>
    </span>
  );
}

function CollectionTile({ report, year }: { report?: YearReport; year: number }) {
  const committed = report?.totals.committed ?? 0;
  const collected = report?.totals.collectedForEvents ?? 0;
  const pending = Math.max(committed - collected, 0);
  const pct = committed > 0 ? (collected / committed) * 100 : 0;

  return (
    <Link
      to="/admin/reportes"
      className="col-span-2 flex flex-col gap-3 rounded-3xl bg-ink p-5 text-cream shadow-card"
    >
      <TileHeader label={`Por cobrar · eventos ${year}`} dark />
      <span className="font-serif text-[32px] font-semibold leading-none text-gold-soft tabular-nums">
        {report ? formatCurrency(pending) : '…'}
      </span>
      {report && committed > 0 ? (
        <>
          <span className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <span
              className="block h-full rounded-full bg-gold"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </span>
          <span className="text-xs text-cream/70">
            Cobrado {formatCurrency(collected)} de {formatCurrency(committed)} (
            {pct.toFixed(1).replace('.', ',')}%)
          </span>
        </>
      ) : (
        report && <span className="text-xs text-cream/70">Sin eventos cargados este año.</span>
      )}
    </Link>
  );
}

const MONTH_INITIALS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function OccupancyTile({ report }: { report: YearReport }) {
  const max = Math.max(1, ...report.months.map((month) => month.events));
  return (
    <Link
      to="/admin/reportes"
      className="flex flex-col gap-4 rounded-3xl border border-line bg-paper p-4 shadow-card"
    >
      <TileHeader label={`Ocupación ${report.year} · eventos por mes`} />
      <ul className="grid h-24 grid-cols-12 items-end gap-1.5">
        {report.months.map((month, index) => (
          <li key={month.month} className="flex h-full flex-col items-center justify-end gap-1">
            <span
              role="img"
              aria-label={`${MONTH_NAMES[index]}: ${month.events} ${month.events === 1 ? 'evento' : 'eventos'}`}
              className={`block w-full rounded-t-md rounded-b-sm ${month.events > 0 ? 'bg-gold' : 'bg-cream-2'}`}
              style={{ height: `${month.events > 0 ? (month.events / max) * 80 + 10 : 8}%` }}
            />
            <span aria-hidden="true" className="text-[10px] font-semibold text-muted">
              {MONTH_INITIALS[index]}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 13) return 'Buen día';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const todayFormatter = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function todayLabel(): string {
  return todayFormatter.format(new Date());
}
