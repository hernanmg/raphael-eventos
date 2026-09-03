import { Reveal } from '../../components/Reveal';

const SERVICES = [
  {
    label: 'Foto · 15 años',
    title: '15 años',
    description:
      'La fiesta que tu hija va a recordar toda la vida, con seguimiento del contrato y las tarjetas al día durante todo el proceso.',
    icon: (
      <path
        d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    ),
  },
  {
    label: 'Foto · Egresados',
    title: 'Egresados',
    description:
      'Coordinamos con el colegio o la comisión organizadora, y cada familia sigue el estado de su alumno de forma clara.',
    icon: (
      <>
        <path d="M4 20V10L12 4L20 10V20" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 20V14H15V20" stroke="currentColor" strokeWidth="1.4" />
      </>
    ),
  },
  {
    label: 'Foto · Bodas',
    title: 'Bodas',
    description:
      'Un espacio propio para celebrar el sí, con atención dedicada a cada detalle de la organización.',
    icon: (
      <path
        d="M12 21C12 21 4 14.5 4 9.2C4 6.3 6.3 4 9.1 4C10.7 4 12 4.8 12 4.8C12 4.8 13.3 4 14.9 4C17.7 4 20 6.3 20 9.2C20 14.5 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    ),
  },
  {
    label: 'Foto · Empresariales',
    title: 'Empresariales',
    description:
      'Lanzamientos, aniversarios y eventos corporativos, con la logística resuelta de punta a punta.',
    icon: (
      <>
        <rect x="4" y="10" width="16" height="10" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M9 10V6C9 4.9 9.9 4 11 4H13C14.1 4 15 4.9 15 6V10"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </>
    ),
  },
];

export function ServicesSection() {
  return (
    <section id="servicios" className="bg-cream py-24">
      <div className="mx-auto max-w-6xl px-7">
        <Reveal className="mb-13 max-w-xl">
          <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold">
            Qué hacemos
          </span>
          <h2 className="font-serif text-[clamp(28px,3.6vw,40px)] font-semibold leading-tight">
            Un salón, cuatro formas de celebrar
          </h2>
          <p className="mt-3.5 text-[15.5px] text-muted">
            Cada tipo de evento tiene su propia dinámica — la organizamos a medida en cada caso.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <Reveal key={service.title}>
              <div className="h-full overflow-hidden rounded-2xl border border-line bg-paper transition hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(20,20,20,.08)]">
                <div className="relative flex aspect-4/3 w-full items-center justify-center bg-gradient-to-br from-ink/[0.06] to-gold/10 text-muted">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="absolute h-[38%] w-[38%] opacity-20"
                  >
                    {service.icon}
                  </svg>
                  <span className="relative z-10 text-[11px] font-semibold uppercase tracking-wide">
                    {service.label}
                  </span>
                </div>
                <div className="p-5 pb-6">
                  <h3 className="mb-2 text-lg font-semibold">{service.title}</h3>
                  <p className="text-[13.5px] text-muted">{service.description}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
