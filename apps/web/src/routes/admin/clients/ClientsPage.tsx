import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClients } from '../../../hooks/useAdmin';

export default function ClientsPage() {
  const { data, isLoading, isError } = useClients();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const clients = data?.clients ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(
      (client) =>
        client.fullName.toLowerCase().includes(term) || client.email.toLowerCase().includes(term),
    );
  }, [data, search]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Clientes</h1>
      <p className="mt-2 text-sm text-muted">
        Un mismo cliente puede tener más de un evento — acá se ve todo junto en vez de ir evento por
        evento.
      </p>

      <input
        type="search"
        placeholder="Buscar por nombre o email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
      />

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar los clientes.</p>}
      {data && filtered.length === 0 && (
        <p className="mt-8 text-sm text-muted">No hay clientes para mostrar acá.</p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {filtered.map((client) => (
          <li key={client.id}>
            <Link
              to={`/admin/clientes/${client.id}`}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm transition hover:border-ink"
            >
              <div>
                <p className="font-medium text-ink">{client.fullName}</p>
                <p className="text-xs text-muted">{client.email}</p>
              </div>
              <span className="rounded-full bg-cream-2 px-3 py-1 text-xs font-semibold text-ink">
                {client.eventCount} evento{client.eventCount === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
