import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { GuestRsvpSchema, type GuestRsvpInput, type InviteView } from '@raphael-eventos/shared';
import { useInvite, useRsvp } from '../../hooks/useGuests';
import { ApiError } from '../../lib/api';
import { EVENT_TYPE_LABELS, formatDate } from '../../lib/format';
import { eventStartsAt } from '../../lib/eventTime';
import { FormField } from '../../components/FormField';
import { Countdown } from '../../components/guests/Countdown';
import { SalonContact } from '../../components/guests/SalonContact';
import { GuestShell, HERO_BACKGROUND } from './GuestShell';

const closesFormatter = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Argentina/Cordoba',
});

/**
 * Micrositio público del evento + confirmación de asistencia (Fase 3).
 * Sin cuenta: el acceso es por el link de invitación (por beneficiary).
 */
export default function InvitePage() {
  const { inviteToken = '' } = useParams();
  const { data: invite, isLoading, isError } = useInvite(inviteToken);

  if (isLoading) {
    return (
      <GuestShell>
        <p className="py-32 text-center text-sm text-muted">Cargando invitación…</p>
      </GuestShell>
    );
  }

  if (isError || !invite) {
    return (
      <GuestShell>
        <div className="mx-auto max-w-md px-6 py-32 text-center">
          <h1 className="font-serif text-3xl font-semibold">Invitación no encontrada</h1>
          <p className="mt-3 text-sm text-muted">
            El link no existe o el evento ya no está activo. Pedile a quien te invitó que te lo
            vuelva a pasar.
          </p>
        </div>
      </GuestShell>
    );
  }

  const startsAt = eventStartsAt(invite.event.eventDate, invite.event.startTime);

  return (
    <GuestShell salonName={invite.salon.name}>
      <section className="text-white" style={{ backgroundImage: HERO_BACKGROUND }}>
        <div className="mx-auto max-w-3xl px-6 pb-16 pt-20 text-center">
          <span className="text-xs font-semibold uppercase tracking-[3px] text-gold-soft">
            {EVENT_TYPE_LABELS[invite.event.type]} · Estás invitado/a
          </span>
          <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-tight">
            {invite.event.name}
          </h1>
          {invite.invitedBy && (
            <p className="mt-2 text-white/70">Invitación de la familia de {invite.invitedBy}</p>
          )}
          <p className="mt-4 text-lg text-white/85">
            {formatDate(invite.event.eventDate)}
            {invite.event.startTime && ` · ${invite.event.startTime} h`}
          </p>
          {startsAt && (
            <div className="mt-8 flex justify-center">
              <Countdown target={startsAt} />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
        <RsvpCard invite={invite} inviteToken={inviteToken} />

        {(invite.salon.address || invite.salon.mapsUrl) && (
          <section className="rounded-2xl border border-line bg-paper p-6 text-center">
            <h2 className="font-serif text-xl font-semibold">Dónde</h2>
            <p className="mt-2 text-sm text-muted">
              {invite.salon.name}
              {invite.salon.address && ` · ${invite.salon.address}`}
            </p>
            {invite.salon.mapsUrl && (
              <a
                href={invite.salon.mapsUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white"
              >
                Cómo llegar
              </a>
            )}
          </section>
        )}

        {invite.event.photosUrl && (
          <section className="rounded-2xl border border-line bg-paper p-6 text-center">
            <h2 className="font-serif text-xl font-semibold">Fotos del evento</h2>
            <p className="mt-2 text-sm text-muted">Las fotos del fotógrafo, en un solo lugar.</p>
            <a
              href={invite.event.photosUrl}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white"
            >
              Ver fotos
            </a>
          </section>
        )}

        <SalonContact salon={invite.salon} />
      </div>
    </GuestShell>
  );
}

function RsvpCard({ invite, inviteToken }: { invite: InviteView; inviteToken: string }) {
  const navigate = useNavigate();
  const rsvp = useRsvp(inviteToken);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<GuestRsvpInput>({ resolver: zodResolver(GuestRsvpSchema) });

  if (!invite.rsvpOpen) {
    return (
      <section className="rounded-2xl border border-line bg-paper p-6 text-center">
        <h2 className="font-serif text-xl font-semibold">Confirmaciones cerradas</h2>
        <p className="mt-2 text-sm text-muted">
          La confirmación por link ya cerró. Si querés ir, hablalo directamente con quien te invitó.
        </p>
      </section>
    );
  }

  const onSubmit = handleSubmit((values) =>
    rsvp.mutate(values, {
      onSuccess: ({ qrToken }) => navigate(`/q/${qrToken}`),
      onError: (err) =>
        setError('root', {
          message: err instanceof ApiError ? err.message : 'No pudimos registrar tu confirmación',
        }),
    }),
  );

  return (
    <section className="rounded-2xl border border-line bg-paper p-6">
      <h2 className="text-center font-serif text-xl font-semibold">Confirmá tu asistencia</h2>
      <p className="mt-2 text-center text-sm text-muted">
        Al confirmar recibís tu entrada con un código QR para mostrar en la puerta.
        {invite.rsvpClosesAt &&
          ` Podés confirmar hasta el ${closesFormatter.format(
            new Date(new Date(invite.rsvpClosesAt).getTime() - 1),
          )}.`}
      </p>
      <form onSubmit={onSubmit} noValidate className="mx-auto mt-6 flex max-w-sm flex-col gap-4">
        <FormField
          label="Nombre y apellido"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <FormField
          label="Teléfono (opcional)"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <FormField
          label="Email (opcional)"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        {errors.root?.message && (
          <p role="alert" className="text-sm text-red-600">
            {errors.root.message}
          </p>
        )}
        <button
          type="submit"
          disabled={rsvp.isPending}
          className="mt-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {rsvp.isPending ? 'Confirmando…' : 'Confirmar asistencia'}
        </button>
      </form>
    </section>
  );
}
