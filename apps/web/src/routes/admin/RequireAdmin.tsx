import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

const ADMIN_ROLES = ['ADMIN', 'VENDEDOR'];

export function RequireAdmin() {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return <p className="px-6 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  if (!data) {
    return <Navigate to="/login" replace />;
  }

  if (!ADMIN_ROLES.includes(data.user.role)) {
    return <Navigate to="/portal" replace />;
  }

  return <Outlet />;
}
