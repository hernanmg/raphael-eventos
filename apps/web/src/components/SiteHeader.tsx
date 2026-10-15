import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useLogout } from '../hooks/useLogout';

export function SiteHeader() {
  const { data } = useSession();
  const logout = useLogout();
  // En el panel admin en mobile el header queda solo con el logo: Ayuda, Mi
  // portal y Salir están en la hoja "Más" de la barra inferior (AdminTabBar).
  const inAdmin = useLocation().pathname.startsWith('/admin');

  return (
    <header
      className={`flex items-center justify-between border-b border-line bg-paper py-4 print:hidden ${
        inAdmin ? 'px-4 sm:px-6' : 'px-6'
      }`}
    >
      <Link to="/" className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-sm font-bold text-white">
          R.
        </span>
        <span className="whitespace-nowrap font-serif text-lg font-semibold tracking-wide">
          Raphael Eventos
        </span>
      </Link>

      <nav className={`items-center gap-5 text-sm ${inAdmin ? 'hidden md:flex' : 'flex'}`}>
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
              <Link
                to="/admin"
                aria-current={inAdmin ? 'page' : undefined}
                className={inAdmin ? 'font-medium text-ink' : 'text-muted hover:text-ink'}
              >
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
