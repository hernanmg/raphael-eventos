import { useRef, type FormEvent } from 'react';
import type { EventType } from '@raphael-eventos/shared';
import { Reveal } from '../../components/Reveal';
import { useSubmitLead } from '../../hooks/useCrm';

const WHATSAPP_NUMBER = '5493513180810';
const EVENT_TYPES: { label: string; value: EventType }[] = [
  { label: '15 años', value: 'QUINCE' },
  { label: 'Egresados', value: 'EGRESO' },
  { label: 'Boda', value: 'BODA' },
  { label: 'Evento empresarial', value: 'EMPRESARIAL' },
];

export function QuoteForm() {
  const nombreRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const tipoRef = useRef<HTMLSelectElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const submitLead = useSubmitLead();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nombre = nombreRef.current?.value ?? '';
    const telefono = telefonoRef.current?.value ?? '';
    const tipoValue = (tipoRef.current?.value ?? 'QUINCE') as EventType;
    const tipoLabel = EVENT_TYPES.find((t) => t.value === tipoValue)?.label ?? tipoValue;
    const fecha = fechaRef.current?.value;
    const mensaje = mensajeRef.current?.value ?? '';

    // Alimenta el CRM además de abrir WhatsApp — si falla (ej. rate limit),
    // no bloquea el flujo real: WhatsApp sigue siendo el canal que usan hoy.
    submitLead.mutate({
      fullName: nombre,
      phone: telefono,
      eventType: tipoValue,
      interestedDate: fecha || undefined,
      message: mensaje || undefined,
    });

    const texto = `Hola! Soy ${nombre} (${telefono}). Quiero cotizar un evento de *${tipoLabel}*, fecha tentativa: ${
      fecha || 'a definir'
    }. ${mensaje ? 'Detalle: ' + mensaje : ''}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  return (
    <section id="cotizar" className="bg-cream py-24">
      <div className="mx-auto max-w-6xl px-7">
        <Reveal className="mx-auto mb-13 max-w-xl text-center">
          <span className="mb-3.5 block text-xs font-semibold uppercase tracking-[3px] text-gold">
            Cotizá tu evento
          </span>
          <h2 className="font-serif text-[clamp(28px,3.6vw,40px)] font-semibold leading-tight">
            Contanos qué estás organizando
          </h2>
          <p className="mt-3.5 text-[15.5px] text-muted">
            Completá el formulario y te contactamos por WhatsApp para coordinar los detalles.
          </p>
        </Reveal>

        <Reveal>
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-2xl rounded-[22px] border border-line bg-paper p-7 shadow-[0_20px_50px_rgba(20,20,20,.05)] sm:p-11"
          >
            <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
              <Field label="Nombre y apellido" htmlFor="nombre">
                <input id="nombre" ref={nombreRef} type="text" required className="field-input" />
              </Field>
              <Field label="WhatsApp" htmlFor="telefono">
                <input
                  id="telefono"
                  ref={telefonoRef}
                  type="tel"
                  placeholder="351 000 0000"
                  required
                  className="field-input"
                />
              </Field>
              <Field label="Tipo de evento" htmlFor="tipo">
                <select id="tipo" ref={tipoRef} className="field-input">
                  {EVENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha tentativa" htmlFor="fecha">
                <input id="fecha" ref={fechaRef} type="date" className="field-input" />
              </Field>
              <Field label="Contanos un poco más" htmlFor="mensaje" full>
                <textarea
                  id="mensaje"
                  ref={mensajeRef}
                  placeholder="Cantidad de invitados, horario, algo puntual que quieras contarnos..."
                  className="field-input min-h-[90px] resize-y"
                />
              </Field>
            </div>

            <button
              type="submit"
              className="mt-5.5 w-full rounded-full bg-ink px-6 py-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              Enviar por WhatsApp
            </button>
            <p className="mt-3.5 text-center text-xs text-muted">
              Al enviar, se abre WhatsApp con tu consulta ya escrita para que la confirmes y mandes.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
