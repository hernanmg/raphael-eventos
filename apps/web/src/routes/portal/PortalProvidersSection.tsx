import { ProviderCard } from '../../components/providers/ProviderCard';
import { usePortalProviders } from '../../hooks/usePhase4';
import { EVENT_TYPE_LABELS } from '../../lib/format';

/**
 * Proveedores recomendados para los tipos de evento que el cliente tiene
 * contratados (Fase 4). Sin proveedores que apliquen, no se muestra.
 */
export function PortalProvidersSection() {
  const { data } = usePortalProviders();
  if (!data || data.providers.length === 0) return null;
  const types = data.eventTypes.map((t) => EVENT_TYPE_LABELS[t]).join(', ');
  return (
    <section className="mt-12">
      <h2 className="font-serif text-xl font-semibold">Proveedores recomendados</h2>
      <p className="mt-1 text-sm text-muted">Proveedores de confianza del salón para {types}.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} />
        ))}
      </div>
    </section>
  );
}
