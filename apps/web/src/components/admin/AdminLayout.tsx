import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useIsDesktop } from '../../hooks/useIsDesktop';
import { AdminTabBar } from './AdminTabBar';

// Envoltura de las pantallas /admin/* (dentro del Layout general). En mobile
// suma la barra inferior y deja lugar abajo para que no tape el contenido.
// Tiene su propio Suspense para que la barra no desaparezca mientras carga
// en diferido la pantalla siguiente.
export function AdminLayout() {
  const isDesktop = useIsDesktop();

  return (
    <div className={isDesktop ? undefined : 'pb-28 print:pb-0'}>
      <Suspense fallback={<p className="px-6 py-16 text-center text-sm text-muted">Cargando…</p>}>
        <Outlet />
      </Suspense>
      {!isDesktop && <AdminTabBar />}
    </div>
  );
}
