import type { SalonProfile } from '@raphael-eventos/shared';
import { instagramHandle, whatsappUrl } from '../../lib/salon';

/** Botones de contacto del salón para las pantallas públicas de invitados. */
export function SalonContact({ salon }: { salon: SalonProfile }) {
  if (!salon.whatsappNumber && !salon.instagramUrl) return null;
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {salon.whatsappNumber && (
        <a
          href={whatsappUrl(salon.whatsappNumber)}
          target="_blank"
          rel="noopener"
          className="rounded-full border border-ink px-5 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
        >
          WhatsApp del salón
        </a>
      )}
      {salon.instagramUrl && (
        <a
          href={salon.instagramUrl}
          target="_blank"
          rel="noopener"
          className="rounded-full border border-ink px-5 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-white"
        >
          Instagram {instagramHandle(salon.instagramUrl)}
        </a>
      )}
    </div>
  );
}
