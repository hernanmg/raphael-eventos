import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLeads } from '../../hooks/useCrm';
import { useLogout } from '../../hooks/useLogout';
import { useSession } from '../../hooks/useSession';
import { AdminIcon, type AdminIconName } from './AdminIcon';
import { ADMIN_NAV, visibleItems } from './adminNav';

// Barra inferior del panel admin en mobile (las 4 secciones de uso diario +
// "Más"). El resto de las pantallas, Ayuda, Mi portal y Salir viven en la
// hoja "Más", porque en el celular el header queda solo con el logo.
const PINNED = ['/admin/calendario', '/admin/eventos/nuevo', '/admin/consultas'];

function currentTab(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '');
  if (path === '/admin') return '/admin';
  const pinned = PINNED.find((to) => path === to || path.startsWith(`${to}/`));
  if (pinned) return pinned;
  // El detalle de un evento se abre desde el inicio.
  if (path.startsWith('/admin/eventos/')) return '/admin';
  return null;
}

export function AdminTabBar() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: newLeads } = useLeads('NUEVO');
  const hasNewLeads = (newLeads?.leads.length ?? 0) > 0;
  const current = currentTab(pathname);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => setMoreOpen(false), [pathname]);

  return (
    <>
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 px-1">
          <TabLink to="/admin" icon="home" label="Inicio" active={current === '/admin'} />
          <TabLink
            to="/admin/calendario"
            icon="calendar"
            label="Calendario"
            active={current === '/admin/calendario'}
          />
          <li className="flex justify-center">
            <Link
              to="/admin/eventos/nuevo"
              aria-current={current === '/admin/eventos/nuevo' ? 'page' : undefined}
              className="flex min-h-14 flex-col items-center justify-end gap-1 pb-1.5 text-[11px] font-medium text-muted"
            >
              <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-gold/40 ring-4 ring-cream">
                <AdminIcon name="plus" className="h-6 w-6" />
              </span>
              Evento
            </Link>
          </li>
          <TabLink
            to="/admin/consultas"
            icon="mail"
            label="Consultas"
            active={current === '/admin/consultas'}
            dot={hasNewLeads}
          />
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-controls="admin-more-sheet"
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[11px] ${
                current === null || moreOpen ? 'font-semibold text-ink' : 'font-medium text-muted'
              }`}
            >
              <AdminIcon
                name="more"
                className={`h-6 w-6 ${current === null || moreOpen ? 'text-gold-ink' : ''}`}
              />
              Más
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && <MoreSheet onClose={closeMore} />}
    </>
  );
}

function TabLink({
  to,
  icon,
  label,
  active,
  dot = false,
}: {
  to: string;
  icon: AdminIconName;
  label: string;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        aria-current={active ? 'page' : undefined}
        className={`relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${
          active ? 'font-semibold text-ink' : 'font-medium text-muted'
        }`}
      >
        <AdminIcon name={icon} className={`h-6 w-6 ${active ? 'text-gold-ink' : ''}`} />
        {label}
        {dot && (
          <span className="absolute right-[calc(50%-15px)] top-2 h-2.5 w-2.5 rounded-full border-2 border-paper bg-gold">
            <span className="sr-only">(hay consultas nuevas)</span>
          </span>
        )}
      </Link>
    </li>
  );
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const isPro = session?.tenantPlan === 'PRO';
  const logout = useLogout();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const groups = ADMIN_NAV.map((group) => ({
    ...group,
    items: visibleItems(group, isPro).filter((item) => !PINNED.includes(item.to)),
  })).filter((group) => group.items.length > 0);

  return (
    <div
      id="admin-more-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Más secciones del panel"
      className="fixed inset-0 z-40 print:hidden"
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-paper px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        <div className="mt-3 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Más secciones</h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition hover:bg-cream hover:text-ink"
          >
            <AdminIcon name="x" />
          </button>
        </div>

        {groups.map((group) => (
          <section key={group.id} className="mt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {group.title}
            </h3>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SheetTile to={item.to} icon={item.icon} label={item.label} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cuenta</h3>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            <li>
              <SheetTile to="/ayuda" icon="help" label="Ayuda" />
            </li>
            <li>
              <SheetTile to="/portal" icon="user" label="Mi portal" />
            </li>
            <li>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="flex h-full min-h-[76px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-cream px-2 py-3 text-center text-xs font-medium transition hover:bg-cream-2 disabled:opacity-60"
              >
                <AdminIcon name="logout" className="h-5 w-5 text-gold-ink" />
                Salir
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function SheetTile({ to, icon, label }: { to: string; icon: AdminIconName; label: string }) {
  return (
    <Link
      to={to}
      className="flex h-full min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-cream px-2 py-3 text-center text-xs font-medium transition hover:bg-cream-2"
    >
      <AdminIcon name={icon} className="h-5 w-5 text-gold-ink" />
      {label}
    </Link>
  );
}
