import { Link } from 'react-router-dom';
import { Reveal } from '../../components/Reveal';

export function PortalTeaserSection() {
  return (
    <section className="px-7 py-16">
      <Reveal>
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-9 rounded-[28px] bg-ink px-7 py-10 text-white md:grid-cols-[1.2fr_1fr] md:gap-12 md:px-12 md:py-16">
          <div>
            <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold-soft">
              Para quienes ya contrataron
            </span>
            <h2 className="font-serif text-[clamp(24px,3vw,32px)] font-semibold">
              Tu evento, siempre a mano.
            </h2>
            <p className="mt-4 max-w-md text-[14.5px] text-white/72">
              Una vez que contratás con nosotros, accedés a tu portal personal: ahí ves cuánto
              pagaste, cuánto falta, y el valor actualizado de tu tarjeta — al minuto, sin esperar a
              que te contestemos por WhatsApp.
            </p>
            <div className="mt-7 flex flex-wrap gap-3.5">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-ink transition hover:bg-gold-soft"
              >
                Iniciar sesión
              </Link>
              <a
                href="#cotizar"
                className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/[0.06] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                Todavía no soy cliente
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#1d1d1f] p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-[11.5px] uppercase tracking-wide text-white/55">Evento</span>
              <span className="text-[13.5px] font-semibold">Sofía Pérez · 15 años</span>
            </div>
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-[11.5px] uppercase tracking-wide text-white/55">
                Total contratado
              </span>
              <span className="text-[13.5px] font-semibold">$10.500.000</span>
            </div>
            <div className="mb-3.5 flex items-center justify-between">
              <span className="text-[11.5px] uppercase tracking-wide text-white/55">
                Saldo pendiente
              </span>
              <span className="text-[13.5px] font-semibold">$2.700.000</span>
            </div>
            <div className="mb-1.5 h-[7px] overflow-hidden rounded-md bg-white/12">
              <div className="h-full w-[74%] bg-gold-soft" />
            </div>
            <small className="text-[11px] text-white/45">74% abonado · tarjeta actualizada</small>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
