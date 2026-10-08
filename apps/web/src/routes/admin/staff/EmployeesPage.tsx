import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  EmployeeInputSchema,
  type DoorAccessResult,
  type EmployeeInput,
  type EmployeeSummary,
} from '@raphael-eventos/shared';
import {
  useCreateEmployee,
  useEmployees,
  useGrantDoorAccess,
  useUpdateEmployee,
} from '../../../hooks/useStaff';
import { useSession } from '../../../hooks/useSession';
import { ApiError } from '../../../lib/api';
import { CONTRACT_TYPE_LABELS, VARIABLE_TYPE_LABELS, formatCurrency } from '../../../lib/format';

export default function EmployeesPage() {
  const { data, isLoading, isError } = useEmployees();
  const { data: session } = useSession();
  const create = useCreateEmployee();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(EmployeeInputSchema),
    defaultValues: { contractType: 'EN_BLANCO', variableType: 'NINGUNO', active: true },
  });

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      // Reset con TODOS los campos: uno parcial deja en pantalla lo que no menciona.
      onSuccess: () =>
        reset({
          fullName: '',
          email: '',
          contractType: 'EN_BLANCO',
          fixedMonthlyAmount: 0,
          variableType: 'NINGUNO',
          variableValue: 0,
          active: true,
        }),
    }),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Personal</h1>
      <p className="mt-2 text-sm text-muted">
        Alta de empleados y su estructura de compensación (fijo + variable). La asignación a cada
        evento se hace desde el detalle del evento. Un empleado con acceso a la puerta puede hacer
        el check-in de invitados de los eventos donde está asignado.
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar el personal.</p>}

      {data && (
        <ul className="mt-8 flex flex-col gap-2">
          {data.employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              showPayrollLink={session?.tenantPlan === 'PRO'}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-10 flex flex-col gap-4 rounded-2xl border border-line bg-paper p-5"
      >
        <h2 className="font-serif text-lg font-semibold">Nuevo empleado</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Nombre completo</span>
            <input
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('fullName')}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              type="email"
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('email')}
            />
            {errors.email && <span className="text-red-600">{errors.email.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Tipo de contratación</span>
            <select
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('contractType')}
            >
              {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Sueldo fijo mensual</span>
            <input
              type="number"
              step="0.01"
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('fixedMonthlyAmount', { valueAsNumber: true })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Tipo de variable</span>
            <select
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('variableType')}
            >
              {Object.entries(VARIABLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">Valor variable ($ o %)</span>
            <input
              type="number"
              step="0.01"
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
              {...register('variableValue', { valueAsNumber: true })}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Agregar empleado
        </button>
        {create.error && (
          <p className="text-sm text-red-600">
            {create.error instanceof ApiError ? create.error.message : 'No pudimos guardar'}
          </p>
        )}
      </form>
    </main>
  );
}

function toInput(employee: EmployeeSummary, overrides: Partial<EmployeeInput>): EmployeeInput {
  return {
    fullName: employee.fullName,
    email: employee.email ?? '',
    contractType: employee.contractType as EmployeeInput['contractType'],
    fixedMonthlyAmount: employee.fixedMonthlyAmount,
    variableType: employee.variableType as EmployeeInput['variableType'],
    variableValue: employee.variableValue,
    active: employee.active,
    ...overrides,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'No pudimos guardar el cambio';
}

function EmployeeRow({
  employee,
  showPayrollLink,
}: {
  employee: EmployeeSummary;
  showPayrollLink: boolean;
}) {
  const update = useUpdateEmployee();
  const grant = useGrantDoorAccess();
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(employee.email ?? '');
  const [access, setAccess] = useState<DoorAccessResult | null>(null);

  const missingEmail = !employee.email;

  const saveEmail = () =>
    update.mutate(
      { id: employee.id, input: toInput(employee, { email: emailDraft.trim() }) },
      { onSuccess: () => setEditingEmail(false) },
    );

  const grantAccess = () => {
    if (
      employee.hasDoorAccess &&
      !window.confirm(
        `¿Generar una nueva contraseña temporal para ${employee.fullName}? La actual deja de funcionar.`,
      )
    ) {
      return;
    }
    grant.mutate(employee.id, { onSuccess: setAccess });
  };

  return (
    <li className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-ink">
            {employee.fullName}
            {employee.hasDoorAccess && (
              <span className="ml-2 rounded-full bg-cream-2 px-2 py-0.5 text-[11px] font-semibold text-ink">
                Acceso puerta
              </span>
            )}
          </p>
          <p className="text-xs text-muted">
            {CONTRACT_TYPE_LABELS[employee.contractType]} ·{' '}
            {VARIABLE_TYPE_LABELS[employee.variableType]}
            {employee.fixedMonthlyAmount > 0 &&
              ` · fijo ${formatCurrency(employee.fixedMonthlyAmount)}/mes`}
            {employee.variableType !== 'NINGUNO' &&
              employee.variableValue > 0 &&
              ` · ${
                employee.variableType === 'COMISION_PCT'
                  ? `${employee.variableValue}%`
                  : formatCurrency(employee.variableValue)
              } por evento`}
          </p>
          {!editingEmail && (
            <p className="mt-1 text-xs">
              {missingEmail ? (
                <span className="text-red-600">Sin email — es obligatorio</span>
              ) : (
                <span className="text-muted">{employee.email}</span>
              )}{' '}
              <button
                type="button"
                onClick={() => setEditingEmail(true)}
                className="text-muted underline hover:text-ink"
              >
                {missingEmail ? 'Cargar email' : 'Cambiar'}
              </button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showPayrollLink && (
            <Link
              to={`/admin/personal/${employee.id}/liquidacion`}
              className="text-xs text-muted hover:text-ink"
            >
              Liquidación →
            </Link>
          )}
          <button
            type="button"
            disabled={missingEmail || update.isPending}
            title={missingEmail ? 'Cargale un email antes de modificarlo' : undefined}
            onClick={() =>
              update.mutate({
                id: employee.id,
                input: toInput(employee, { active: !employee.active }),
              })
            }
            className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
              employee.active ? 'bg-cream-2 text-ink' : 'bg-red-50 text-red-600'
            }`}
          >
            {employee.active ? 'Activo' : 'De baja'}
          </button>
        </div>
      </div>

      {editingEmail && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveEmail();
          }}
        >
          <input
            type="email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            placeholder="email@ejemplo.com"
            className="min-w-56 flex-1 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={update.isPending}
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingEmail(false);
              setEmailDraft(employee.email ?? '');
            }}
            className="text-xs text-muted hover:text-ink"
          >
            Cancelar
          </button>
        </form>
      )}
      {update.error && <p className="mt-2 text-xs text-red-600">{errorMessage(update.error)}</p>}

      {employee.active && !missingEmail && (
        <div className="mt-3 border-t border-line pt-3">
          <button
            type="button"
            onClick={grantAccess}
            disabled={grant.isPending}
            className="text-xs font-semibold text-ink underline disabled:opacity-60"
          >
            {employee.hasDoorAccess
              ? 'Generar nueva contraseña temporal'
              : 'Dar acceso a la puerta (check-in)'}
          </button>
          {grant.error && <p className="mt-2 text-xs text-red-600">{errorMessage(grant.error)}</p>}
        </div>
      )}

      {access && (
        <TemporaryPasswordPanel
          employee={employee}
          access={access}
          onClose={() => setAccess(null)}
        />
      )}
    </li>
  );
}

/**
 * La contraseña temporal se muestra UNA sola vez (no se guarda en claro en
 * ningún lado). No hay envío de email desde el sistema: "Enviar por email"
 * abre el cliente de correo del admin con el mensaje ya armado.
 */
function TemporaryPasswordPanel({
  employee,
  access,
  onClose,
}: {
  employee: EmployeeSummary;
  access: DoorAccessResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const loginUrl = `${window.location.origin}/login`;
  const body = [
    `Hola ${employee.fullName}, ya tenés acceso al check-in de invitados de Raphael Eventos.`,
    '',
    `Ingresá en ${loginUrl}`,
    `Email: ${access.email}`,
    `Contraseña temporal: ${access.temporaryPassword}`,
    '',
    'Al entrar por primera vez te va a pedir que elijas una contraseña propia.',
  ].join('\n');
  const mailto = `mailto:${access.email}?subject=${encodeURIComponent(
    'Tu acceso al check-in — Raphael Eventos',
  )}&body=${encodeURIComponent(body)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(access.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div role="status" className="mt-3 rounded-xl border border-line bg-cream p-4 text-sm">
      <p className="font-medium text-ink">Contraseña temporal de {employee.fullName}</p>
      <p className="mt-1 text-xs text-muted">
        Se muestra solo esta vez. Pasásela en persona o por email: al entrar le va a pedir que elija
        una propia.
      </p>
      <p className="mt-3 text-xs text-muted">Email: {access.email}</p>
      <p className="mt-1 font-mono text-lg tracking-wider text-ink">{access.temporaryPassword}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white"
        >
          {copied ? 'Copiada ✓' : 'Copiar contraseña'}
        </button>
        <a href={mailto} className="text-xs font-semibold text-ink underline">
          Enviar por email
        </a>
        <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink">
          Listo, ocultar
        </button>
      </div>
    </div>
  );
}
