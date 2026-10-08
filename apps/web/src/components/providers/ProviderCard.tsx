import type { PublicProvider } from '@raphael-eventos/shared';
import { instagramHandle } from '../../lib/salon';

/** Tarjeta de proveedor aliado — landing y portal (nunca datos de comisión). */
export function ProviderCard({ provider }: { provider: PublicProvider }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-paper p-5">
      <span className="text-[11px] font-semibold uppercase tracking-[2px] text-gold">
        {provider.category}
      </span>
      <p className="mt-1 font-serif text-lg font-semibold text-ink">{provider.name}</p>
      {provider.description && <p className="mt-1 text-sm text-muted">{provider.description}</p>}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-3 text-sm">
        {provider.contactName && <span className="text-muted">{provider.contactName}</span>}
        {provider.phone && (
          <a href={`tel:${provider.phone.replace(/[^\d+]/g, '')}`} className="text-ink underline">
            {provider.phone}
          </a>
        )}
        {provider.email && (
          <a href={`mailto:${provider.email}`} className="text-ink underline">
            {provider.email}
          </a>
        )}
        {provider.instagramUrl && (
          <a
            href={provider.instagramUrl}
            target="_blank"
            rel="noopener"
            className="text-ink underline"
          >
            {instagramHandle(provider.instagramUrl)}
          </a>
        )}
        {provider.websiteUrl && (
          <a
            href={provider.websiteUrl}
            target="_blank"
            rel="noopener"
            className="text-ink underline"
          >
            Sitio web
          </a>
        )}
      </div>
    </div>
  );
}
