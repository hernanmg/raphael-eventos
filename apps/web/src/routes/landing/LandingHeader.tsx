import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSalonProfile } from '../../hooks/useSalonProfile';
import { whatsappUrl } from '../../lib/salon';

const NAV_LINKS = [
  { href: '#servicios', label: 'Servicios' },
  { href: '#nosotros', label: 'El espacio' },
  { href: '#galeria', label: 'Galería' },
];

export function LandingHeader() {
  const { data: salon } = useSalonProfile();
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const textColor = solid || menuOpen ? 'text-ink' : 'text-white';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid ? 'bg-paper/95 py-3.5 shadow-[0_1px_0_var(--color-line)] backdrop-blur' : 'py-5'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-7">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-ink font-serif text-base font-bold text-white">
            R.
          </span>
          <span className={`font-serif text-[15px] font-semibold tracking-[2.5px] ${textColor}`}>
            RAPHAEL EVENTOS
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-[13.5px] font-medium opacity-90 transition hover:opacity-100 ${textColor}`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className={`hidden rounded-full border px-[18px] py-2.5 text-[13px] font-semibold transition md:inline-flex ${
              solid
                ? 'border-ink text-ink hover:bg-ink hover:text-white'
                : 'border-white/55 bg-white/[0.06] text-white backdrop-blur hover:bg-white/15'
            }`}
          >
            Iniciar sesión
          </Link>
          <a
            href="#cotizar"
            className="hidden rounded-full bg-ink px-[18px] py-2.5 text-[13px] font-semibold text-white transition hover:bg-black md:inline-flex"
          >
            Cotizá tu evento
          </a>

          <button
            type="button"
            aria-label="Menú"
            onClick={() => setMenuOpen((open) => !open)}
            className="relative h-5 w-[26px] md:hidden"
          >
            <span
              className={`absolute left-0 right-0 top-0 h-0.5 transition ${solid || menuOpen ? 'bg-ink' : 'bg-white'}`}
            />
            <span
              className={`absolute left-0 right-0 top-[9px] h-0.5 transition ${solid || menuOpen ? 'bg-ink' : 'bg-white'}`}
            />
            <span
              className={`absolute left-0 right-0 top-[18px] h-0.5 transition ${solid || menuOpen ? 'bg-ink' : 'bg-white'}`}
            />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="mt-4 flex flex-col gap-1 border-t border-line bg-paper px-7 py-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-2 text-base text-ink"
            >
              {link.label}
            </a>
          ))}
          <a href="#cotizar" onClick={() => setMenuOpen(false)} className="py-2 text-base text-ink">
            Cotizá tu evento
          </a>
          <Link to="/login" onClick={() => setMenuOpen(false)} className="py-2 text-base text-ink">
            Iniciar sesión
          </Link>
          {salon?.whatsappNumber && (
            <a
              href={whatsappUrl(salon.whatsappNumber)}
              target="_blank"
              rel="noopener"
              className="py-2 text-base text-ink"
            >
              WhatsApp
            </a>
          )}
        </nav>
      )}
    </header>
  );
}
