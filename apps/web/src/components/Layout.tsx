import { Outlet } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SiteHeader />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
