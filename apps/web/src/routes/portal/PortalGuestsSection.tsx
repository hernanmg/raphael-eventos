import {
  useAddPortalGuest,
  useCancelPortalGuest,
  useEnsurePortalInviteLink,
  usePortalGuests,
} from '../../hooks/useGuests';
import {
  AttendanceBar,
  GuestForm,
  GuestList,
  InviteLinkBox,
} from '../../components/guests/GuestManagement';
import { errorText } from '../../lib/guestLinks';

/**
 * Invitados desde el portal (Fase 3). Quien tiene un beneficiary propio
 * (titular de 15/boda/empresarial, familia de un alumno en egreso) comparte
 * su link y administra su lista; el titular de un egreso solo ve el avance.
 */
export function PortalGuestsSection({ eventId }: { eventId: string }) {
  const { data, isLoading, isError } = usePortalGuests(eventId);
  const ensureLink = useEnsurePortalInviteLink(eventId);
  const addGuest = useAddPortalGuest(eventId);
  const cancelGuest = useCancelPortalGuest(eventId);

  if (isLoading) return null;
  if (isError || !data) {
    return <p className="mt-8 text-sm text-red-600">No pudimos cargar los invitados.</p>;
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-xl font-semibold">Invitados</h2>
      <div className="mt-3">
        <AttendanceBar attendance={data.attendance} />
      </div>

      {!data.canManage ? (
        <p className="mt-3 text-sm text-muted">
          Cada familia comparte su propio link de invitación y administra su lista — acá ves el
          avance total del evento.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm text-muted">
              Compartí este link: cada invitado confirma con su nombre y recibe su entrada con QR.
              Las confirmaciones por link cierran unos días antes del evento — después podés seguir
              cargando invitados vos desde acá.
            </p>
            <InviteLinkBox
              inviteToken={data.inviteToken}
              onGenerate={() => ensureLink.mutate()}
              generating={ensureLink.isPending}
            />
            {ensureLink.error && (
              <p className="mt-1 text-xs text-red-600">{errorText(ensureLink.error)}</p>
            )}
          </div>

          <GuestForm
            pending={addGuest.isPending}
            error={addGuest.error}
            onSubmit={({ beneficiaryId: _ignored, ...input }, reset) =>
              addGuest.mutate(input, { onSuccess: reset })
            }
          />

          <GuestList
            guests={data.guests}
            onCancel={(guestId) => cancelGuest.mutate(guestId)}
            cancelling={cancelGuest.isPending}
          />
        </div>
      )}
    </section>
  );
}
