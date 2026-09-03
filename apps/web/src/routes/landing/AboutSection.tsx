import { Reveal } from '../../components/Reveal';

const POINTS = [
  'Atención personalizada durante toda la organización del evento.',
  'Seguimiento online de tu contrato, pagos y tarjetas — sin tener que llamar para preguntar.',
  'Un mismo espacio adaptable a 15 años, egresados, bodas y eventos de empresa.',
];

export function AboutSection() {
  return (
    <section id="nosotros" className="py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-9 px-7 md:grid-cols-2 md:gap-16">
        <Reveal>
          <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold">
            El espacio
          </span>
          <h2 className="font-serif text-[clamp(26px,3.4vw,36px)] font-semibold leading-[1.2]">
            Un salón pensado para acompañarte en cada etapa
          </h2>
          <p className="mt-4 max-w-md text-[15px] text-muted">
            En Raphael Eventos organizamos tu fiesta de principio a fin: desde la primera consulta
            hasta el día del evento, con un mismo equipo siguiendo cada detalle.
          </p>
          <ul className="mt-6.5 flex flex-col gap-4">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3.5 text-[14.5px] text-[#333]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mt-0.5 shrink-0"
                >
                  <path
                    d="M4 12L9 17L20 6"
                    stroke="var(--color-gold)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {point}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal>
          <div className="flex aspect-5/4 items-center justify-center rounded-[20px] bg-gradient-to-br from-ink/5 to-gold/10 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Foto del salón
          </div>
        </Reveal>
      </div>
    </section>
  );
}
