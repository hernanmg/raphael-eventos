import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HELP_GROUPS, helpFeatures, type HelpFeature } from '../help/features';

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const { hash } = useLocation();
  // /ayuda#admin-ipc abre esa funcionalidad desplegada (link directo desde otra pantalla).
  const linkedId = hash.slice(1);

  useEffect(() => {
    if (linkedId) document.getElementById(linkedId)?.scrollIntoView({ block: 'start' });
  }, [linkedId]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return helpFeatures;
    return helpFeatures.filter((feature) =>
      [feature.title, feature.purpose, ...(feature.keywords ?? [])].some((text) =>
        text.toLowerCase().includes(q),
      ),
    );
  }, [q]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl font-semibold">Centro de ayuda</h1>
      <p className="mt-3 text-sm text-muted">
        Raphael Eventos es la plataforma del salón para que cada cliente vea sus eventos, su saldo y
        sus tarjetas actualizadas sin tener que llamar a preguntar — y para que el salón administre
        esa información desde un panel propio. Cada funcionalidad tiene una explicación de cómo
        funciona, los pasos para usarla y un ejemplo: tocá "Cómo se usa" para verlos.
      </p>

      <label htmlFor="help-search" className="mt-8 block text-sm font-medium text-ink">
        Buscar una funcionalidad
      </label>
      <input
        id="help-search"
        type="search"
        placeholder="Ej: ipc, pago, invitados…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-2 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
      />

      {results.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No encontramos funcionalidades que coincidan con tu búsqueda.
        </p>
      ) : q ? (
        <ul className="mt-6 flex flex-col gap-4">
          {results.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} open={feature.id === linkedId} />
          ))}
        </ul>
      ) : (
        HELP_GROUPS.map((group) => {
          const features = results.filter((f) => f.group === group.id);
          if (features.length === 0) return null;
          return (
            <section key={group.id} className="mt-10">
              <h2 className="font-serif text-xl font-semibold">{group.title}</h2>
              <p className="mt-1 text-xs text-muted">{group.intro}</p>
              <ul className="mt-4 flex flex-col gap-4">
                {features.map((feature) => (
                  <FeatureCard key={feature.id} feature={feature} open={feature.id === linkedId} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </main>
  );
}

function FeatureCard({ feature, open }: { feature: HelpFeature; open: boolean }) {
  return (
    <li id={feature.id} className="scroll-mt-6 rounded-xl border border-line p-4">
      <Link to={feature.path} className="font-serif text-lg font-semibold text-ink hover:underline">
        {feature.title}
      </Link>
      <p className="mt-1 text-sm text-muted">{feature.purpose}</p>

      <details open={open} className="group mt-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-gold [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Cómo se usa y un ejemplo ▸</span>
          <span className="hidden group-open:inline">Ocultar ▾</span>
        </summary>

        {feature.details && feature.details.length > 0 && (
          <div className="mt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">
              Cómo funciona
            </h3>
            {feature.details.map((paragraph, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink/80">
                {paragraph}
              </p>
            ))}
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">Paso a paso</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink/80">
            {feature.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="mt-4 rounded-lg bg-cream-2 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gold">Ejemplo</h3>
          {feature.example.map((line, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-ink">
              {line}
            </p>
          ))}
        </div>
      </details>
    </li>
  );
}
