import type { ReactNode } from 'react';

// Mismo fondo que el hero de la landing (routes/landing/HeroSection.tsx).
export const HERO_BACKGROUND = [
  'radial-gradient(circle at 15% 20%, rgba(163,129,63,.35), transparent 45%)',
  'radial-gradient(circle at 85% 75%, rgba(255,255,255,.08), transparent 40%)',
  'linear-gradient(160deg, #17171a 0%, #0d0d0f 55%, #1a1712 100%)',
].join(', ');

/**
 * Marco de las pantallas públicas de invitados (micrositio, entrada con QR).
 * No usa el Layout/SiteHeader de la app: el invitado no tiene cuenta, no le
 * sirven "Ingresar"/"Ayuda" — misma lógica que la landing.
 */
export function GuestShell({ salonName, children }: { salonName?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      {children}
      {salonName && (
        <footer className="py-10 text-center text-xs text-muted">
          <span className="font-serif text-sm font-semibold text-ink">{salonName}</span>
        </footer>
      )}
    </div>
  );
}
