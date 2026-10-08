import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useLogout } from '../hooks/useLogout';

export function SiteHeader() {
  const { data } = useSession();
  const logout = useLogout();

  return (
    <header className="flex items-center justify-between border-b border-line bg-paper px-6 py-4">
      <Link to="/" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-sm font-bold text-white">
          R.
        </span>
        <span className="font-serif text-lg font-semibold tracking-wide">Raphael Eventos</span>
      </Link>

      <nav className="flex items-center gap-5 text-sm">
        <Link to="/ayuda" className="text-muted hover:text-ink">
          Ayuda
        </Link>

        {data?.user ? (
          <>
            {data.user.role === 'PUERTA' ? (
              <Link to="/checkin" className="text-muted hover:text-ink">
                Check-in
              </Link>
            ) : (
              <Link to="/portal" className="text-muted hover:text-ink">
                Mi portal
              </Link>
            )}
            {(data.user.role === 'ADMIN' || data.user.role === 'VENDEDOR') && (
              <Link to="/admin" className="text-muted hover:text-ink">
                Panel admin
              </Link>
            )}
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded-full bg-ink px-4 py-2 text-white transition hover:bg-black disabled:opacity-60"
            >
              Salir
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-muted hover:text-ink">
              Ingresar
            </Link>
            <Link
              to="/registro"
              className="rounded-full bg-ink px-4 py-2 text-white transition hover:bg-black"
            >
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
