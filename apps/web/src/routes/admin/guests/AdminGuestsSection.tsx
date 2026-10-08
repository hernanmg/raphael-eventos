import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EventPublicInfoSchema, type EventPublicInfoInput } from '@raphael-eventos/shared';
import {
  useAddAdminGuest,
  useAdminGuests,
  useCancelAdminGuest,
  useEnsureAdminInviteLink,
  useUpdateEventPublicInfo,
} from '../../../hooks/useGuests';
import {
  AttendanceBar,
  GuestForm,
  GuestList,
  InviteLinkBox,
} from '../../../components/guests/GuestManagement';
import { errorText } from '../../../lib/guestLinks';
import { apiUrl } from '../../../lib/api';

/**
 * Invitados + micrositio desde el panel (Fase 3): datos del micrositio
 * (hora, link de fotos), links de invitación por familia/beneficiary, y la
 * lista completa de invitados (sin el recorte por familia del portal).
 */
export function AdminGuestsSection({
  eventId,
  startTime,
  photosUrl,
}: {
  eventId: string;
  startTime: string | null;
  photosUrl: string | null;
}) {
  const { data } = useAdminGuests(eventId);
  const ensureLink = useEnsureAdminInviteLink(eventId);
  const addGuest = useAddAdminGuest(eventId);
  const cancelGuest = useCancelAdminGuest(eventId);
  const multipleBeneficiaries = (data?.beneficiaries.length ?? 0) > 1;

  return (
    <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold">Invitados y micrositio</h2>
        <div className="flex gap-3 text-xs">
          <a
            href={apiUrl(`/api/v1/admin/events/${eventId}/guests/export?format=xlsx`)}
            className="text-muted underline hover:text-ink"
          >
            Exportar Excel
          </a>
          <a
            href={apiUrl(`/api/v1/admin/events/${eventId}/guests/export?format=csv`)}
            className="text-muted underline hover:text-ink"
          >
            CSV
          </a>
        </div>
      </div>

      <PublicInfoForm eventId={eventId} startTime={startTime} photosUrl={photosUrl} />

      {data && (
        <div className="mt-6 flex flex-col gap-4">
          <AttendanceBar attendance={data.attendance} />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">
              {multipleBeneficiaries ? 'Links de invitación por familia' : 'Link de invitación'}
            </p>
            {data.beneficiaries.map((b) => (
              <InviteLinkBox
                key={b.id}
                label={multipleBeneficiaries ? (b.label ?? 'Sin nombre') : undefined}
                inviteToken={b.inviteToken}
                onGenerate={() => ensureLink.mutate(b.id)}
                generating={ensureLink.isPending}
              />
            ))}
            {ensureLink.error && (
              <p className="text-xs text-red-600">{errorText(ensureLink.error)}</p>
            )}
          </div>

          <GuestForm
            pending={addGuest.isPending}
            error={addGuest.error}
            beneficiaries={multipleBeneficiaries ? data.beneficiaries : undefined}
            onSubmit={(input, reset) => addGuest.mutate(input, { onSuccess: reset })}
          />

          <GuestList
            guests={data.guests}
            showBeneficiary={multipleBeneficiaries}
            onCancel={(guestId) => cancelGuest.mutate(guestId)}
            cancelling={cancelGuest.isPending}
          />
        </div>
      )}
    </div>
  );
}

function PublicInfoForm({
  eventId,
  startTime,
  photosUrl,
}: {
  eventId: string;
  startTime: string | null;
  photosUrl: string | null;
}) {
  const update = useUpdateEventPublicInfo(eventId);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<EventPublicInfoInput>({
    resolver: zodResolver(EventPublicInfoSchema),
    values: { startTime: startTime ?? undefined, photosUrl: photosUrl ?? undefined },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => update.mutate(values, { onSuccess: () => reset(values) }))}
      className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end"
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-ink">Hora de inicio</span>
        <input
          type="time"
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          {...register('startTime')}
        />
        {errors.startTime && <span className="text-red-600">{errors.startTime.message}</span>}
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-ink">Link de fotos del fotógrafo (opcional)</span>
        <input
          type="url"
          placeholder="https://photos.google.com/…"
          className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink"
          {...register('photosUrl')}
        />
        {errors.photosUrl && <span className="text-red-600">{errors.photosUrl.message}</span>}
      </label>
      <button
        type="submit"
        disabled={!isDirty || update.isPending}
        className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        Guardar
      </button>
      {update.error && (
        <p className="text-xs text-red-600 sm:col-span-3">{errorText(update.error)}</p>
      )}
    </form>
  );
}
