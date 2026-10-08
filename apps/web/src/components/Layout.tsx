import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SiteHeader />
      <div className="flex-1">
        {/* Las pantallas del panel admin se cargan en diferido (ver App.tsx). */}
        <Suspense fallback={<p className="px-6 py-16 text-center text-sm text-muted">Cargando…</p>}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
