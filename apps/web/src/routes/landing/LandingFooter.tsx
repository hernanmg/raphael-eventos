const NAV_LINKS = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#nosotros', label: 'El espacio' },
  { href: '#galeria', label: 'Galería' },
  { href: '#cotizar', label: 'Cotizá tu evento' },
];

export function LandingFooter() {
  return (
    <footer className="bg-ink py-[70px] pb-8 text-white/70">
      <div className="mx-auto max-w-6xl px-7">
        <div className="grid grid-cols-1 gap-8 border-b border-white/10 pb-11 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/10 font-serif text-base font-bold text-white">
                R.
              </span>
              <span className="font-serif text-base tracking-[2.5px] text-white">
                RAPHAEL EVENTOS
              </span>
            </div>
            <p className="mt-3.5 max-w-[280px] text-[13.5px] text-white/55">
              Hacemos que tu evento sea inolvidable. Salón de eventos en Córdoba para 15 años,
              egresados, bodas y eventos empresariales.
            </p>
            <div className="mt-3 flex gap-2.5">
              <a
                href="https://wa.me/5493513180810"
                target="_blank"
                rel="noopener"
                aria-label="WhatsApp"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 12.1C20 16.6 16.3 20.2 11.8 20.2C10.4 20.2 9 19.8 7.8 19.1L4 20.2L5.1 16.5C4.3 15.2 3.9 13.7 3.9 12.1C3.9 7.6 7.6 4 12.1 4C16.5 4 20 7.6 20 12.1Z"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/raphael.eventos/"
                target="_blank"
                rel="noopener"
                aria-label="Instagram"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/20 transition hover:bg-white/10"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="17.2" cy="6.8" r="1" fill="#fff" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-xs uppercase tracking-[1.2px] text-white/40">Navegación</h4>
            <ul className="flex flex-col gap-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-[13.5px] text-white/75 transition hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs uppercase tracking-[1.2px] text-white/40">Contacto</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href="https://wa.me/5493513180810"
                  target="_blank"
                  rel="noopener"
                  className="text-[13.5px] text-white/75 transition hover:text-white"
                >
                  WhatsApp · 351 318-0810
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/raphael.eventos/"
                  target="_blank"
                  rel="noopener"
                  className="text-[13.5px] text-white/75 transition hover:text-white"
                >
                  @raphael.eventos
                </a>
              </li>
              <li className="text-[13.5px] text-white/75">Córdoba, Argentina</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-6.5 text-xs text-white/40">
          <span>© 2026 Raphael Eventos. Todos los derechos reservados.</span>
          <span>Sitio + portal de clientes en una misma plataforma.</span>
        </div>
      </div>
    </footer>
  );
}
