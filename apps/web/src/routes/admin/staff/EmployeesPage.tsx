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
import { useCostCategories } from '../../../hooks/useCosting';
import { ApiError } from '../../../lib/api';
import { CONTRACT_TYPE_LABELS, VARIABLE_TYPE_LABELS, formatCurrency } from '../../../lib/format';

export default function EmployeesPage() {
  const { data, isLoading, isError } = useEmployees();
  const { data: session } = useSession();
  const create = useCreateEmployee();
  const [formKey, setFormKey] = useState(0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin" className="text-sm text-muted hover:text-ink">
        ← Panel admin
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">Personal</h1>
      <p className="mt-2 text-sm text-muted">
        Empleados y todo lo que cobran: sueldo fijo, valor hora, monto por evento trabajado y
        comisión por evento vendido — todo editable. La asignación a cada evento se hace desde el
        detalle del evento. Un empleado con acceso a la puerta puede hacer el check-in de invitados
        de los eventos donde está asignado.
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

      <div className="mt-10 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-serif text-lg font-semibold">Nuevo empleado</h2>
        <EmployeeForm
          key={formKey}
          submitLabel="Agregar empleado"
          pending={create.isPending}
          error={create.error}
          onSubmit={(values) =>
            // Remontar el form lo deja vacío con todos sus campos (un reset
            // parcial deja en pantalla lo que no menciona).
            create.mutate(values, { onSuccess: () => setFormKey((k) => k + 1) })
          }
        />
      </div>
    </main>
  );
}

const EMPTY_EMPLOYEE: EmployeeInput = {
  fullName: '',
  email: '',
  contractType: 'EN_BLANCO',
  fixedMonthlyAmount: 0,
  hourlyRate: 0,
  variableType: 'NINGUNO',
  variableValue: 0,
  saleCommissionType: 'NINGUNO',
  saleCommissionValue: 0,
  costCategoryId: '',
  active: true,
};

const field = 'rounded-lg border border-line px-3 py-2 outline-none focus:border-ink';

/** Alta y edición de un empleado con todos sus conceptos de pago. */
function EmployeeForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: EmployeeInput;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: EmployeeInput) => void;
  onCancel?: () => void;
}) {
  const { data: categories } = useCostCategories();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(EmployeeInputSchema),
    defaultValues: initial ?? EMPTY_EMPLOYEE,
  });
  const variableType = watch('variableType');
  const saleCommissionType = watch('saleCommissionType');
  const numberErrors = [
    errors.fixedMonthlyAmount,
    errors.hourlyRate,
    errors.variableValue,
    errors.saleCommissionValue,
  ].some(Boolean);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Nombre completo</span>
          <input className={field} {...register('fullName')} />
          {errors.fullName && <span className="text-red-600">{errors.fullName.message}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Email</span>
          <input type="email" className={field} {...register('email')} />
          {errors.email && <span className="text-red-600">{errors.email.message}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Tipo de contratación</span>
          <select className={field} {...register('contractType')}>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Rubro de costeo</span>
          <select className={field} {...register('costCategoryId')}>
            <option value="">Personal (sin rubro)</option>
            {categories?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">Dónde suma su costo en la pantalla de costeo.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Sueldo fijo mensual $</span>
          <input
            type="number"
            step="0.01"
            min={0}
            className={field}
            {...register('fixedMonthlyAmount', { valueAsNumber: true })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Valor hora $</span>
          <input
            type="number"
            step="0.01"
            min={0}
            className={field}
            {...register('hourlyRate', { valueAsNumber: true })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Por evento trabajado</span>
          <select className={field} {...register('variableType')}>
            {Object.entries(VARIABLE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">
            {variableType === 'COMISION_PCT' ? '% del valor del evento' : 'Monto por evento $'}
          </span>
          <input
            type="number"
            step="0.01"
            min={0}
            disabled={variableType === 'NINGUNO'}
            className={`${field} disabled:bg-cream`}
            {...register('variableValue', { valueAsNumber: true })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">Comisión por evento vendido</span>
          <select className={field} {...register('saleCommissionType')}>
            {Object.entries(VARIABLE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-ink">
            {saleCommissionType === 'COMISION_PCT'
              ? '% del valor del evento vendido'
              : 'Monto por evento vendido $'}
          </span>
          <input
            type="number"
            step="0.01"
            min={0}
            disabled={saleCommissionType === 'NINGUNO'}
            className={`${field} disabled:bg-cream`}
            {...register('saleCommissionValue', { valueAsNumber: true })}
          />
        </label>
      </div>
      {numberErrors && <p className="text-red-600">Completá los montos (0 si no aplica).</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-muted hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
      {Boolean(error) && <p className="text-red-600">{errorMessage(error)}</p>}
    </form>
  );
}

function toInput(employee: EmployeeSummary, overrides: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    fullName: employee.fullName,
    email: employee.email ?? '',
    contractType: employee.contractType,
    fixedMonthlyAmount: employee.fixedMonthlyAmount,
    hourlyRate: employee.hourlyRate,
    variableType: employee.variableType,
    variableValue: employee.variableValue,
    saleCommissionType: employee.saleCommissionType,
    saleCommissionValue: employee.saleCommissionValue,
    costCategoryId: employee.costCategoryId ?? '',
    active: employee.active,
    ...overrides,
  };
}

/** Resumen legible de lo que cobra un empleado. */
function compensationSummary(employee: EmployeeSummary): string[] {
  const parts: string[] = [];
  if (employee.fixedMonthlyAmount > 0) {
    parts.push(`fijo ${formatCurrency(employee.fixedMonthlyAmount)}/mes`);
  }
  if (employee.hourlyRate > 0) parts.push(`${formatCurrency(employee.hourlyRate)}/hora`);
  const variable = (type: string, value: number, what: string) =>
    type === 'COMISION_PCT'
      ? `${value}% por evento ${what}`
      : `${formatCurrency(value)} por evento ${what}`;
  if (employee.variableType !== 'NINGUNO') {
    parts.push(variable(employee.variableType, employee.variableValue, 'trabajado'));
  }
  if (employee.saleCommissionType !== 'NINGUNO') {
    parts.push(variable(employee.saleCommissionType, employee.saleCommissionValue, 'vendido'));
  }
  return parts;
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
  const [editing, setEditing] = useState(false);
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
            {[
              CONTRACT_TYPE_LABELS[employee.contractType],
              ...compensationSummary(employee),
              employee.costCategoryName ? `rubro ${employee.costCategoryName}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
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
          <button
            type="button"
            onClick={() => {
              update.reset();
              setEditing((v) => !v);
            }}
            className="text-xs text-muted hover:text-ink"
          >
            {editing ? 'Cerrar' : 'Editar'}
          </button>
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

      {editing && (
        <div className="mt-3 border-t border-line pt-1">
          <EmployeeForm
            initial={toInput(employee)}
            submitLabel="Guardar cambios"
            pending={update.isPending}
            error={update.error}
            onCancel={() => setEditing(false)}
            onSubmit={(values) =>
              update.mutate(
                { id: employee.id, input: { ...values, active: employee.active } },
                { onSuccess: () => setEditing(false) },
              )
            }
          />
        </div>
      )}

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
      {update.error && !editing && (
        <p className="mt-2 text-xs text-red-600">{errorMessage(update.error)}</p>
      )}

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
