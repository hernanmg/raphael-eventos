import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UpdateEventSchema,
  type AdminEventDetail,
  type UpdateEventInput,
} from '@raphael-eventos/shared';
import { useUpdateEvent } from '../../../hooks/usePhase4';
import { useEmployees } from '../../../hooks/useStaff';
import { errorText } from '../../../lib/guestLinks';
import { EVENT_STATUS_LABELS } from '../../../lib/format';

/**
 * Edición de datos y estado del evento (Fase 4). Todo queda en la auditoría.
 * El tipo no se edita. Cambiar el email del titular re-vincula el portal.
 */
export function EventEditSection({ event }: { event: AdminEventDetail }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateEvent(event.id);
  const { data: employeesData } = useEmployees();
  const sellers =
    employeesData?.employees.filter((e) => e.active || e.id === event.soldByEmployeeId) ?? [];
  const initial: UpdateEventInput = {
    name: event.name,
    eventDate: event.eventDate ? event.eventDate.slice(0, 10) : undefined,
    titularName: event.titularName ?? undefined,
    titularEmail: event.titularEmail ?? '',
    titularPhone: event.titularPhone ?? undefined,
    minGuests: event.minGuests ?? undefined,
    status: event.status,
    soldByEmployeeId: event.soldByEmployeeId ?? undefined,
    soldAt: event.soldAt ? event.soldAt.slice(0, 10) : undefined,
  };
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateEventInput>({ resolver: zodResolver(UpdateEventSchema), values: initial });

  const titularChanged = watch('titularEmail') !== (event.titularEmail ?? '');
  const status = watch('status');

  const onSubmit = handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: () => {
        reset(values);
        setOpen(false);
      },
    });
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full border border-ink px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white"
      >
        Editar evento
      </button>
    );
  }

  const field = 'rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink';

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5"
    >
      <p className="font-serif text-lg font-semibold">Editar evento</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="font-medium text-ink">Nombre</span>
          <input className={field} {...register('name')} />
          {errors.name && <span className="text-red-600">{errors.name.message}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Fecha</span>
          <input type="date" className={field} {...register('eventDate')} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Estado</span>
          <select className={field} {...register('status')}>
            {/* La baja va por "Cancelar evento" (pide motivo y devolución); acá
                solo se puede reactivar un evento ya cancelado. */}
            {Object.entries(EVENT_STATUS_LABELS)
              .filter(([value]) => value !== 'CANCELADO' || event.status === 'CANCELADO')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Titular</span>
          <input className={field} {...register('titularName')} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Email del titular</span>
          <input type="email" className={field} {...register('titularEmail')} />
          {errors.titularEmail && (
            <span className="text-red-600">{errors.titularEmail.message}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Teléfono del titular</span>
          <input type="tel" className={field} {...register('titularPhone')} />
          {errors.titularPhone && (
            <span className="text-red-600">{errors.titularPhone.message}</span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Vendido por</span>
          <select className={field} {...register('soldByEmployeeId')}>
            <option value="">— Nadie / venta directa —</option>
            {sellers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">Fecha de venta (mes de la comisión)</span>
          <input type="date" className={field} {...register('soldAt')} />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink">
            {event.type === 'EGRESO'
              ? 'Mínimo de invitados (informativo)'
              : 'Mínimo de invitados (lo que falte se cobra a valor Adulto)'}
          </span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={field}
            {...register('minGuests')}
          />
        </label>
      </div>

      {titularChanged && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Cambiar el email del titular le saca el acceso al portal al titular actual y se lo da al
          nuevo (si ya tiene cuenta; si no, al registrarse con ese email).
        </p>
      )}
      {event.status === 'CANCELADO' && status !== 'CANCELADO' && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Reactivar el evento borra el motivo y la devolución de la baja (quedan en el historial).
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!isDirty || update.isPending}
          className="rounded-full bg-ink px-5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset(initial);
            setOpen(false);
          }}
          className="text-xs text-muted hover:text-ink"
        >
          Cancelar
        </button>
        {update.error && <span className="text-xs text-red-600">{errorText(update.error)}</span>}
      </div>
    </form>
  );
}
