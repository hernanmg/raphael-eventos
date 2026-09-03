import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

export function RequireAuth() {
  const { data, isLoading } = useSession();

  if (isLoading) {
    return <p className="px-6 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  if (!data) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
