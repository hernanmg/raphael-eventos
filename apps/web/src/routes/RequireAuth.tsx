import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@raphael-eventos/shared';
import { useSession } from '../hooks/useSession';
import { homePathFor } from '../lib/homePath';

interface RequireAuthProps {
  /** Si se pasa, un usuario con otro rol se redirige a su pantalla de inicio. */
  roles?: Role[];
}

export function RequireAuth({ roles }: RequireAuthProps = {}) {
  const { data, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) {
    return <p className="px-6 py-16 text-center text-sm text-muted">Cargando…</p>;
  }

  if (!data) {
    return <Navigate to="/login" replace />;
  }

  // Contraseña temporal (Fase 3): hasta cambiarla no hay otra pantalla.
  if (data.user.mustChangePassword && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  if (roles && !roles.includes(data.user.role)) {
    return <Navigate to={homePathFor(data.user)} replace />;
  }

  return <Outlet />;
}
