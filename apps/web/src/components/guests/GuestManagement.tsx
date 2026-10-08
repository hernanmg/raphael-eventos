// Piezas compartidas de gestión de invitados (Fase 3) entre el portal del
// titular (PortalGuestsSection) y el panel admin (AdminGuestsSection).

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AdminGuestInputSchema,
  type AdminGuestInput,
  type GuestAttendance,
  type GuestSummary,
} from '@raphael-eventos/shared';
import { errorText, inviteUrl, passUrl } from '../../lib/guestLinks';
import { QrCode } from './QrCode';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Confirmados del evento entero vs. la meta (mínimo contratado o tarjetas). */
export function AttendanceBar({ attendance }: { attendance: GuestAttendance }) {
  const { confirmed, target, targetSource } = attendance;
  const pct = target ? Math.min(100, Math.round((confirmed / target) * 100)) : 0;
  return (
    <div>
      <p className="text-sm text-ink">
        <span className="text-lg font-semibold">{confirmed}</span> confirmados
        {target !== null && (
          <span className="text-muted">
            {' '}
            de {target} {targetSource === 'MIN_GUESTS' ? '(mínimo contratado)' : '(tarjetas)'}
          </span>
        )}
      </p>
      {target !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** Link de invitación para compartir: copiar, WhatsApp, o mostrar su QR. */
export function InviteLinkBox({
  inviteToken,
  onGenerate,
  generating,
  label,
}: {
  inviteToken: string | null;
  onGenerate: () => void;
  generating: boolean;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!inviteToken) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line p-3">
        <p className="text-sm text-muted">
          {label ? `${label}: ` : ''}todavía no hay link de invitación.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Generar link
        </button>
      </div>
    );
  }

  const url = inviteUrl(inviteToken);
  const share = `https://wa.me/?text=${encodeURIComponent(
    `¡Estás invitado/a! Confirmá tu asistencia acá: ${url}`,
  )}`;

  return (
    <div className="rounded-xl border border-line p-3">
      {label && <p className="text-xs font-semibold text-ink">{label}</p>}
      <p className="mt-1 break-all font-mono text-xs text-muted">{url}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          type="button"
          onClick={async () => setCopied(await copyToClipboard(url))}
          className="rounded-full bg-ink px-3 py-1 font-semibold text-white"
        >
          {copied ? 'Copiado ✓' : 'Copiar link'}
        </button>
        <a href={share} target="_blank" rel="noopener" className="font-semibold text-ink underline">
          Compartir por WhatsApp
        </a>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="text-muted underline hover:text-ink"
        >
          {showQr ? 'Ocultar QR' : 'Ver QR del link'}
        </button>
      </div>
      {showQr && (
        <div className="mt-3">
          <QrCode value={url} size={180} />
        </div>
      )}
    </div>
  );
}

// Valores explícitos para TODOS los campos: un reset parcial
// (`reset({ lateEntry: false })`) deja en pantalla lo que no menciona.
const EMPTY_GUEST_FORM: AdminGuestInput = {
  fullName: '',
  phone: '',
  email: '',
  beneficiaryId: '',
  lateEntry: false,
};

/** Alta manual de un invitado (titular o admin) — queda confirmado con su QR. */
export function GuestForm({
  onSubmit,
  pending,
  error,
  beneficiaries,
}: {
  onSubmit: (input: AdminGuestInput, reset: () => void) => void;
  pending: boolean;
  error: unknown;
  /** Solo admin en egreso: elegir a qué familia/alumno pertenece. */
  beneficiaries?: { id: string; label: string | null }[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminGuestInput>({
    resolver: zodResolver(AdminGuestInputSchema),
    defaultValues: EMPTY_GUEST_FORM,
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => onSubmit(values, () => reset(EMPTY_GUEST_FORM)))}
      className="flex flex-col gap-3 rounded-xl bg-cream p-4"
    >
      <p className="text-sm font-semibold text-ink">Agregar invitado</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Nombre y apellido</span>
          <input
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            {...register('fullName')}
          />
          {errors.fullName && <span className="text-red-600">{errors.fullName.message}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Teléfono (opcional)</span>
          <input
            type="tel"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            {...register('phone')}
          />
          {errors.phone && <span className="text-red-600">{errors.phone.message}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Email (opcional)</span>
          <input
            type="email"
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            {...register('email')}
          />
          {errors.email && <span className="text-red-600">{errors.email.message}</span>}
        </label>
      </div>
      {beneficiaries && beneficiaries.length > 1 && (
        <label className="flex flex-col gap-1 text-xs sm:max-w-xs">
          <span className="font-medium text-ink">Invitado de</span>
          <select
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
            {...register('beneficiaryId')}
          >
            <option value="">General del evento</option>
            {beneficiaries.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label ?? 'Sin nombre'}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" {...register('lateEntry')} />
        Entrada después de las 12
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Agregando…' : 'Agregar'}
        </button>
        {Boolean(error) && <span className="text-xs text-red-600">{errorText(error)}</span>}
      </div>
    </form>
  );
}

const SOURCE_LABELS: Record<GuestSummary['source'], string> = {
  AUTOGESTION: 'por link',
  TITULAR: 'cargado por el titular',
  ADMIN: 'cargado por el salón',
};

export function GuestList({
  guests,
  onCancel,
  cancelling,
  showBeneficiary = false,
}: {
  guests: GuestSummary[];
  onCancel: (guestId: string) => void;
  cancelling: boolean;
  showBeneficiary?: boolean;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (guests.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay invitados confirmados.</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {guests.map((guest) => {
        const cancelled = guest.status === 'CANCELADO';
        return (
          <li
            key={guest.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm ${
              cancelled ? 'opacity-60' : ''
            }`}
          >
            <div>
              <p className={`text-ink ${cancelled ? 'line-through' : ''}`}>
                {guest.fullName}
                {guest.lateEntry && (
                  <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">
                    Después de las 12
                  </span>
                )}
                {cancelled && (
                  <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                    Dado de baja
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                Código {guest.entryCode} · {SOURCE_LABELS[guest.source]}
                {showBeneficiary && guest.beneficiaryLabel && ` · de ${guest.beneficiaryLabel}`}
                {guest.phone && ` · ${guest.phone}`}
              </p>
            </div>
            {!cancelled && (
              <div className="flex items-center gap-3 text-xs">
                <a
                  href={passUrl(guest.qrToken)}
                  target="_blank"
                  rel="noopener"
                  className="text-muted underline hover:text-ink"
                >
                  Ver entrada
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyToClipboard(passUrl(guest.qrToken))) setCopiedId(guest.id);
                  }}
                  className="text-muted underline hover:text-ink"
                >
                  {copiedId === guest.id ? 'Copiado ✓' : 'Copiar entrada'}
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Dar de baja a ${guest.fullName}? Su QR deja de servir para entrar.`,
                      )
                    ) {
                      onCancel(guest.id);
                    }
                  }}
                  className="text-muted hover:text-red-600"
                >
                  Dar de baja
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
