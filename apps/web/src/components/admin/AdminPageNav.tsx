import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';
import { AdminIcon } from './AdminIcon';
import { locateAdminPage, visibleItems } from './adminNav';

// Encabezado de navegación de cada pantalla interna del panel: migas de pan
// ("Inicio / Finanzas / Gastos") y, en desktop, pestañas con las pantallas
// hermanas del mismo grupo. Reemplaza los viejos "← Panel admin".
export function AdminPageNav() {
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const isPro = session?.tenantPlan === 'PRO';
  const { group, item, detail } = locateAdminPage(pathname);
  const tabs = group && !detail ? visibleItems(group, isPro) : [];

  const crumbs: { label: string; to?: string }[] = [{ label: 'Inicio', to: '/admin' }];
  if (group) crumbs.push({ label: group.title });
  if (item) crumbs.push({ label: item.label, to: detail ? item.to : undefined });
  if (detail) crumbs.push({ label: detail });

  return (
    <nav aria-label="Ubicación en el panel" className="print:hidden">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && (
                <li aria-hidden="true" className="text-line">
                  <AdminIcon name="chevronRight" className="h-3.5 w-3.5 text-muted/60" />
                </li>
              )}
              <li>
                {crumb.to && !last ? (
                  <Link
                    to={crumb.to}
                    className="underline decoration-line underline-offset-4 transition hover:text-ink hover:decoration-ink"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? 'page' : undefined}
                    className={last ? 'font-medium text-ink' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>

      {tabs.length > 1 && (
        <div className="mt-4 hidden gap-1 overflow-x-auto border-b border-line md:flex">
          {tabs.map((tab) => {
            const active = tab.to === item?.to;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition ${
                  active
                    ? 'border-gold font-semibold text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <AdminIcon name={tab.icon} className={`h-4 w-4 ${active ? 'text-gold-ink' : ''}`} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
