import { usePublicSponsors } from '../../hooks/usePhase4';
import { apiUrl } from '../../lib/api';

/** Franja de sponsors (Fase 4): logo + link, sin más gestión. Oculta si no hay. */
export function SponsorsStrip() {
  const { data: sponsors } = usePublicSponsors();
  if (!sponsors || sponsors.length === 0) return null;
  return (
    <section aria-label="Sponsors" className="border-t border-line bg-paper py-12">
      <div className="mx-auto max-w-6xl px-7">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[3px] text-muted">
          Nos acompañan
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {sponsors.map((sponsor) => {
            const logo = (
              <img
                src={apiUrl(sponsor.logoPath)}
                alt={sponsor.name}
                loading="lazy"
                className="h-12 w-auto max-w-[160px] object-contain opacity-80 transition hover:opacity-100"
              />
            );
            return sponsor.linkUrl ? (
              <a key={sponsor.id} href={sponsor.linkUrl} target="_blank" rel="noopener sponsored">
                {logo}
              </a>
            ) : (
              <span key={sponsor.id}>{logo}</span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
