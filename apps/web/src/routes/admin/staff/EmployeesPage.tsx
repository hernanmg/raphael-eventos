import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { EmployeeInputSchema, type EmployeeInput } from '@raphael-eventos/shared';
import { useCreateEmployee, useEmployees, useUpdateEmployee } from '../../../hooks/useStaff';
import { useSession } from '../../../hooks/useSession';
import { CONTRACT_TYPE_LABELS, VARIABLE_TYPE_LABELS, formatCurrency } from '../../../lib/format';

export default function EmployeesPage() {
  const { data, isLoading, isError } = useEmployees();
  const { data: session } = useSession();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(EmployeeInputSchema),
    defaultValues: { contractType: 'EN_BLANCO', variableType: 'NINGUNO', active: true },
  });

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => reset({ contractType: 'EN_BLANCO', variableType: 'NINGUNO', active: true }),
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
        evento se hace desde el detalle del evento.
      </p>

      {isLoading && <p className="mt-8 text-sm text-muted">Cargando…</p>}
      {isError && <p className="mt-8 text-sm text-red-600">No pudimos cargar el personal.</p>}

      {data && (
        <ul className="mt-8 flex flex-col gap-2">
          {data.employees.map((employee) => (
            <li key={employee.id} className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{employee.fullName}</p>
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
                </div>
                <div className="flex items-center gap-3">
                  {session?.tenantPlan === 'PRO' && (
                    <Link
                      to={`/admin/personal/${employee.id}/liquidacion`}
                      className="text-xs text-muted hover:text-ink"
                    >
                      Liquidación →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      update.mutate({
                        id: employee.id,
                        input: {
                          fullName: employee.fullName,
                          contractType: employee.contractType as EmployeeInput['contractType'],
                          fixedMonthlyAmount: employee.fixedMonthlyAmount,
                          variableType: employee.variableType as EmployeeInput['variableType'],
                          variableValue: employee.variableValue,
                          active: !employee.active,
                        },
                      })
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      employee.active ? 'bg-cream-2 text-ink' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {employee.active ? 'Activo' : 'De baja'}
                  </button>
                </div>
              </div>
            </li>
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
      </form>
    </main>
  );
}
