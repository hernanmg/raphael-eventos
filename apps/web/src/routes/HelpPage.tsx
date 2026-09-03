import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { helpFeatures } from '../help/features';

export default function HelpPage() {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return helpFeatures;
    return helpFeatures.filter((feature) =>
      [feature.title, feature.purpose, ...(feature.keywords ?? [])].some((text) =>
        text.toLowerCase().includes(q),
      ),
    );
  }, [query]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold">Centro de ayuda</h1>
      <p className="mt-3 text-sm text-muted">
        Raphael Eventos es la plataforma del salón para que cada cliente vea sus eventos, su saldo y
        sus tarjetas actualizadas sin tener que llamar a preguntar — y para que el salón administre
        esa información desde un panel propio. Esta página lista, a medida que las vamos terminando,
        las funcionalidades ya disponibles: para qué sirven y dónde encontrarlas.
      </p>

      <label htmlFor="help-search" className="mt-8 block text-sm font-medium text-ink">
        Buscar una funcionalidad
      </label>
      <input
        id="help-search"
        type="search"
        placeholder="Ej: registro, login…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-2 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
      />

      <ul className="mt-6 flex flex-col gap-4">
        {results.map((feature) => (
          <li key={feature.id} className="rounded-xl border border-line p-4">
            <Link
              to={feature.path}
              className="font-serif text-lg font-semibold text-ink hover:underline"
            >
              {feature.title}
            </Link>
            <p className="mt-1 text-sm text-muted">{feature.purpose}</p>
          </li>
        ))}

        {results.length === 0 && (
          <li className="text-sm text-muted">
            No encontramos funcionalidades que coincidan con tu búsqueda.
          </li>
        )}
      </ul>
    </main>
  );
}
