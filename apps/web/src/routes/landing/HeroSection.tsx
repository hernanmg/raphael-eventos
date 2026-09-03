const HERO_BACKGROUND = [
  'radial-gradient(circle at 15% 20%, rgba(163,129,63,.35), transparent 45%)',
  'radial-gradient(circle at 85% 75%, rgba(255,255,255,.08), transparent 40%)',
  'linear-gradient(160deg, #17171a 0%, #0d0d0f 55%, #1a1712 100%)',
].join(', ');

const TAGS = ['15 años', 'Egresados', 'Bodas', 'Empresariales'];

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden text-white"
      style={{ backgroundImage: HERO_BACKGROUND }}
    >
      <div className="relative z-10 mx-auto w-full max-w-6xl px-7 pb-16 pt-32">
        <div className="max-w-xl">
          <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold-soft">
            Salón de eventos · Córdoba
          </span>
          <h1 className="mb-5 font-serif text-[clamp(40px,6vw,68px)] font-semibold leading-[1.08]">
            Hacemos que tu evento sea <em className="text-gold-soft italic">inolvidable</em>.
          </h1>
          <p className="mb-9 max-w-lg text-[17px] text-white/75">
            15 años, egresados, bodas y eventos empresariales, con acompañamiento personalizado
            desde la primera consulta hasta el día de la fiesta.
          </p>
          <div className="mb-14 flex flex-wrap gap-4">
            <a
              href="#cotizar"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Cotizá tu evento
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/[0.06] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
            >
              Ver servicios
            </a>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/25 px-4 py-2 text-xs tracking-wide text-white/85"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-[11px] uppercase tracking-[2px] text-white/55">
        <span>Scroll</span>
        <div className="relative h-[34px] w-px overflow-hidden bg-white/35">
          <div className="absolute left-0 top-0 h-full w-full animate-[scrollLine_1.8s_ease-in-out_infinite] bg-white" />
        </div>
      </div>
    </section>
  );
}
