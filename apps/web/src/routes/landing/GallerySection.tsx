import { Reveal } from '../../components/Reveal';
import { useSalonProfile } from '../../hooks/useSalonProfile';
import { instagramHandle } from '../../lib/salon';

const PHOTOS = [
  { label: 'Foto 1', span: 'col-span-2 row-span-2' },
  { label: 'Foto 2', span: '' },
  { label: 'Foto 3', span: '' },
  { label: 'Foto 4', span: '' },
  { label: 'Foto 5', span: '' },
  { label: 'Foto 6', span: 'col-span-2' },
];

export function GallerySection() {
  const { data: salon } = useSalonProfile();
  return (
    <section id="galeria" className="py-24">
      <div className="mx-auto max-w-6xl px-7">
        <Reveal className="mb-13 max-w-xl">
          <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold">
            Galería
          </span>
          <h2 className="font-serif text-[clamp(28px,3.6vw,40px)] font-semibold leading-tight">
            Momentos en Raphael Eventos
          </h2>
          <p className="mt-3.5 text-[15.5px] text-muted">
            Estas son fotos placeholder — se reemplazan fácil por las fotos reales del salón.
          </p>
        </Reveal>

        <Reveal>
          <div className="grid auto-rows-[130px] grid-cols-2 gap-3.5 sm:auto-rows-[150px] sm:grid-cols-4">
            {PHOTOS.map((photo) => (
              <div
                key={photo.label}
                className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-ink/5 to-gold/10 text-[11px] font-semibold uppercase tracking-wide text-muted ${photo.span}`}
              >
                {photo.label}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-7 flex items-center gap-2.5 text-[13.5px] text-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="5"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
          </svg>
          Más fotos y videos en{' '}
          {salon?.instagramUrl && (
            <a
              href={salon.instagramUrl}
              target="_blank"
              rel="noopener"
              className="border-b border-ink font-semibold text-ink"
            >
              {instagramHandle(salon.instagramUrl)}
            </a>
          )}
        </Reveal>
      </div>
    </section>
  );
}
