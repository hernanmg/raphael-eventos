import { useParams } from 'react-router-dom';
import { useGuestPass } from '../../hooks/useGuests';
import { EVENT_TYPE_LABELS, formatDate } from '../../lib/format';
import { QrCode } from '../../components/guests/QrCode';
import { SalonContact } from '../../components/guests/SalonContact';
import { GuestShell } from './GuestShell';

/**
 * La entrada del invitado (Fase 3): su QR + código corto para la puerta.
 * El QR codifica la URL de esta misma página — escaneado con cualquier
 * cámara abre la entrada, y el escáner de la puerta extrae el token de ahí.
 */
export default function GuestPassPage() {
  const { qrToken = '' } = useParams();
  const { data: pass, isLoading, isError } = useGuestPass(qrToken);

  if (isLoading) {
    return (
      <GuestShell>
        <p className="py-32 text-center text-sm text-muted">Cargando tu entrada…</p>
      </GuestShell>
    );
  }

  if (isError || !pass) {
    return (
      <GuestShell>
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <h1 className="font-serif text-3xl font-semibold">Entrada no encontrada</h1>
          <p className="mt-3 text-sm text-muted">Revisá que el link esté completo.</p>
        </div>
      </GuestShell>
    );
  }

  const cancelled = pass.status === 'CANCELADO';

  return (
    <GuestShell salonName={pass.salon.name}>
      <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-14 text-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[3px] text-gold">
            {EVENT_TYPE_LABELS[pass.event.type]} · Tu entrada
          </span>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight">
            {pass.event.name}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {formatDate(pass.event.eventDate)}
            {pass.event.startTime && ` · ${pass.event.startTime} h`}
          </p>
        </div>

        <div className="w-full rounded-3xl border border-line bg-paper p-6 shadow-sm">
          <p className="font-serif text-xl font-semibold">{pass.fullName}</p>
          {pass.lateEntry && (
            <p className="mt-2 inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
              Entrada después de las 12
            </p>
          )}

          {cancelled ? (
            <div className="mt-6 rounded-2xl bg-red-50 p-5 text-sm text-red-700">
              Esta entrada fue dada de baja y ya no es válida. Si creés que es un error, hablalo con
              quien te invitó.
            </div>
          ) : (
            <>
              <div className="mt-6 flex justify-center">
                <QrCode value={`${window.location.origin}/q/${pass.qrToken}`} />
              </div>
              <p className="mt-5 text-xs uppercase tracking-[2px] text-muted">Código de ingreso</p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-[6px]">
                {pass.entryCode}
              </p>
              <p className="mt-5 text-xs text-muted">
                Mostrá este QR en la puerta. Guardá este link o sacale una captura de pantalla — si
                el QR no se lee, el personal puede ingresar el código a mano.
              </p>
            </>
          )}
        </div>

        <SalonContact salon={pass.salon} />
      </main>
    </GuestShell>
  );
}
