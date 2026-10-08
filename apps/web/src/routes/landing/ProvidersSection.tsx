import { useState } from 'react';
import type { EventType } from '@raphael-eventos/shared';
import { Reveal } from '../../components/Reveal';
import { ProviderCard } from '../../components/providers/ProviderCard';
import { usePublicProviders } from '../../hooks/usePhase4';
import { EVENT_TYPE_LABELS } from '../../lib/format';

const TABS: (EventType | undefined)[] = [undefined, 'QUINCE', 'EGRESO', 'BODA', 'EMPRESARIAL'];

/**
 * Directorio de proveedores aliados (Fase 4), curado por el salón, con filtro
 * por tipo de evento. Si no hay ninguno cargado, la sección no se muestra.
 */
export function ProvidersSection() {
  const [type, setType] = useState<EventType | undefined>(undefined);
  const { data: all } = usePublicProviders();
  const { data: filtered } = usePublicProviders(type);

  if (!all || all.length === 0) return null;
  const providers = (type ? filtered : all) ?? [];

  return (
    <section id="proveedores" className="bg-paper py-24">
      <div className="mx-auto max-w-6xl px-7">
        <Reveal className="mx-auto mb-10 max-w-xl text-center">
          <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold">
            Proveedores recomendados
          </span>
          <h2 className="font-serif text-[clamp(28px,3.6vw,40px)] font-semibold leading-tight">
            Los que trabajan con nosotros
          </h2>
          <p className="mt-3.5 text-[15.5px] text-muted">
            Fotógrafos, decoración, sonido y más: proveedores de confianza para tu evento.
          </p>
        </Reveal>
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab ?? 'all'}
              type="button"
              onClick={() => setType(tab)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                type === tab
                  ? 'border-ink bg-ink text-white'
                  : 'border-line text-ink hover:border-ink'
              }`}
            >
              {tab ? EVENT_TYPE_LABELS[tab] : 'Todos'}
            </button>
          ))}
        </div>
        {providers.length === 0 ? (
          <p className="text-center text-sm text-muted">
            Todavía no hay proveedores para este tipo de evento.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
