import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CheckInGuestView, CheckInLookupInput } from '@raphael-eventos/shared';
import {
  useCheckInAdmit,
  useCheckInEvent,
  useCheckInLookup,
  useCheckInReject,
} from '../../hooks/useCheckIn';
import { errorText } from '../../lib/guestLinks';
import { formatDate } from '../../lib/format';
import { QrScannerView } from './QrScannerView';

/** El mismo QR recién procesado se ignora este tiempo (sigue frente a la cámara). */
const SAME_QR_COOLDOWN_MS = 6000;

const timeFormatter = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Cordoba',
});

const REENTRY_NOTES = ['Reingreso verificado con DNI', 'Confirmado con el titular'];

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

/**
 * Check-in en la puerta (Fase 3). Escanear o buscar NO registra nada; solo
 * escriben los botones explícitos de admitir/rechazar — así una mala lectura
 * se reintenta sin contar como duplicado. Reingreso: alerta + nota de
 * verificación obligatoria (decisión del cliente).
 */
export default function CheckInScanPage() {
  const { eventId = '' } = useParams();
  const { data: event, isError } = useCheckInEvent(eventId);
  const lookup = useCheckInLookup(eventId);
  const [matches, setMatches] = useState<CheckInGuestView[] | null>(null);
  const [selected, setSelected] = useState<CheckInGuestView | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');

  // Pausa de lecturas mientras hay algo en pantalla o una búsqueda en curso.
  const busyRef = useRef(false);
  const lastQrRef = useRef<{ data: string; at: number } | null>(null);
  busyRef.current = lookup.isPending || selected !== null || matches !== null;

  const runLookup = useCallback(
    (input: CheckInLookupInput) => {
      setFeedback(null);
      lookup.mutate(input, {
        onSuccess: ({ guests }) => {
          if (guests.length === 1) setSelected(guests[0]!);
          else if (guests.length === 0)
            setFeedback({ kind: 'error', text: 'No hay invitados con ese nombre en este evento' });
          else setMatches(guests);
        },
        onError: (err) =>
          setFeedback({ kind: 'error', text: errorText(err, 'No pudimos buscar el invitado') }),
      });
    },
    [lookup],
  );

  const handleScan = useCallback(
    (data: string) => {
      if (busyRef.current) return;
      const last = lastQrRef.current;
      if (last && last.data === data && Date.now() - last.at < SAME_QR_COOLDOWN_MS) return;
      lastQrRef.current = { data, at: Date.now() };
      runLookup({ qr: data });
    },
    [runLookup],
  );

  function closeGuest(message?: Feedback) {
    setSelected(null);
    setMatches(null);
    setFeedback(message ?? null);
    // Reinicia el cooldown desde ahora: el QR sigue frente a la cámara.
    if (lastQrRef.current) lastQrRef.current = { ...lastQrRef.current, at: Date.now() };
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-red-600">
          No encontramos este evento, o no estás asignado/a a él.
        </p>
        <Link to="/checkin" className="mt-4 inline-block text-sm underline">
          Volver a mis eventos
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <div>
        <Link to="/checkin" className="text-sm text-muted hover:text-ink">
          ← Eventos
        </Link>
        {event && (
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-semibold leading-tight">{event.name}</h1>
              <p className="text-xs text-muted">
                {formatDate(event.eventDate)}
                {event.startTime && ` · ${event.startTime} h`}
              </p>
            </div>
            <p className="text-right text-sm">
              <span className="text-2xl font-semibold">{event.admitted}</span>
              <span className="text-muted"> / {event.confirmed}</span>
              <span className="block text-[11px] uppercase tracking-wide text-muted">
                ingresaron
              </span>
            </p>
          </div>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            feedback.kind === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Siempre montado (solo se oculta): desmontarlo apagaba la cámara y
          obligaba a reactivarla después de cada invitado. Mientras hay una
          tarjeta abierta, busyRef descarta las lecturas. */}
      <div className={selected || matches ? 'hidden' : undefined}>
        <QrScannerView onScan={handleScan} />
      </div>

      {selected ? (
        <GuestDecision
          eventId={eventId}
          guest={selected}
          onDone={(message) => closeGuest(message)}
        />
      ) : matches ? (
        <div className="rounded-2xl border border-line bg-paper p-4">
          <p className="text-sm font-semibold">Elegí al invitado</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {matches.map((g) => (
              <li key={g.guestId}>
                <button
                  type="button"
                  onClick={() => {
                    setMatches(null);
                    setSelected(g);
                  }}
                  className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-ink"
                >
                  {g.fullName}
                  <span className="ml-2 text-xs text-muted">
                    {g.entryCode}
                    {g.status === 'CANCELADO' && ' · dado de baja'}
                    {g.admittedCount > 0 && ' · ya ingresó'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => closeGuest()}
            className="mt-3 text-xs text-muted underline"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <>
          {lookup.isPending && <p className="text-center text-sm text-muted">Buscando…</p>}

          <form
            className="flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (code.trim()) runLookup({ code: code.trim() });
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Código de 6 caracteres"
              aria-label="Código de ingreso"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 font-mono tracking-widest outline-none focus:border-ink"
            />
            <button
              type="submit"
              className="rounded-lg bg-ink px-4 text-sm font-semibold text-white"
            >
              Buscar
            </button>
          </form>

          <form
            className="flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (query.trim().length >= 2) runLookup({ query: query.trim() });
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre (si el QR no lee)"
              aria-label="Buscar por nombre"
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2.5 outline-none focus:border-ink"
            />
            <button
              type="submit"
              className="rounded-lg border border-ink px-4 text-sm font-semibold text-ink"
            >
              Buscar
            </button>
          </form>
        </>
      )}
    </main>
  );
}

function GuestDecision({
  eventId,
  guest,
  onDone,
}: {
  eventId: string;
  guest: CheckInGuestView;
  onDone: (message?: Feedback) => void;
}) {
  const admit = useCheckInAdmit(eventId);
  const reject = useCheckInReject(eventId);
  const [note, setNote] = useState('');
  const cancelled = guest.status === 'CANCELADO';
  const isReentry = guest.admittedCount > 0;
  const pending = admit.isPending || reject.isPending;
  const error = admit.error ?? reject.error;

  const doAdmit = () =>
    admit.mutate(
      { guestId: guest.guestId, input: { note: note.trim() || undefined } },
      {
        onSuccess: () =>
          onDone({
            kind: 'ok',
            text: `✓ ${guest.fullName} ${isReentry ? 'reingresó' : 'ingresó'}`,
          }),
      },
    );

  const doReject = () =>
    reject.mutate(
      { guestId: guest.guestId, input: { note: note.trim() || undefined } },
      { onSuccess: () => onDone({ kind: 'error', text: `✗ ${guest.fullName}: rechazado` }) },
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5">
      <div>
        <p className="font-serif text-2xl font-semibold leading-tight">{guest.fullName}</p>
        <p className="text-xs text-muted">
          Código {guest.entryCode}
          {guest.beneficiaryLabel && ` · invitado de ${guest.beneficiaryLabel}`}
        </p>
      </div>

      {guest.lateEntry && (
        <div className="rounded-xl bg-ink px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-gold-soft">
          Entrada después de las 12
        </div>
      )}

      {cancelled ? (
        <>
          <div className="rounded-xl bg-red-100 px-4 py-4 text-center text-base font-bold text-red-700">
            ENTRADA DADA DE BAJA — NO VÁLIDA
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={doReject}
            className="rounded-xl bg-red-600 py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            Registrar rechazo
          </button>
        </>
      ) : isReentry ? (
        <>
          <div className="rounded-xl bg-amber-100 px-4 py-4 text-center text-amber-900">
            <p className="text-lg font-bold">
              YA INGRESÓ a las {timeFormatter.format(new Date(guest.lastAdmittedAt!))}
            </p>
            {guest.admittedCount > 1 && (
              <p className="text-xs">({guest.admittedCount} ingresos registrados)</p>
            )}
            <p className="mt-1 text-xs">
              Verificá su identidad (DNI o con el titular) antes de dejarlo/a reingresar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REENTRY_NOTES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setNote(preset)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  note === preset ? 'border-ink bg-ink text-white' : 'border-line text-ink'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="¿Cómo lo verificaste? (obligatorio)"
            aria-label="Nota de verificación"
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <button
            type="button"
            disabled={pending || note.trim().length < 3}
            onClick={doAdmit}
            className="rounded-xl bg-green-700 py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            Admitir reingreso
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={doReject}
            className="rounded-xl border border-red-600 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            No se pudo verificar — rechazar
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={doAdmit}
            className="rounded-xl bg-green-700 py-4 text-lg font-semibold text-white disabled:opacity-60"
          >
            Admitir
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={doReject}
            className="rounded-xl border border-red-600 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            Rechazar
          </button>
        </>
      )}

      {Boolean(error) && <p className="text-sm text-red-600">{errorText(error)}</p>}

      <button
        type="button"
        onClick={() => onDone()}
        className="text-center text-xs text-muted underline"
      >
        Cerrar sin registrar
      </button>
    </div>
  );
}
