import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import {
  CommissionAdvanceInputSchema,
  EmployeeTimeEntryInputSchema,
  PayrollPeriodInputSchema,
  type CommissionAdvanceInput,
  type EmployeeTimeEntryInput,
  type PayrollPeriodInput,
} from '@raphael-eventos/shared';
import {
  useCommissionAdvances,
  useComputePayroll,
  useEmployees,
  usePayrollEntries,
  useRecordCommissionAdvance,
  useRecordTimeEntry,
  useTimeEntries,
} from '../../../hooks/useStaff';
import { formatCurrency, formatDate } from '../../../lib/format';

export default function PayrollPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { data: employeesData } = useEmployees();
  const employee = employeesData?.employees.find((e) => e.id === employeeId);

  if (!employeeId) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/admin/personal" className="text-sm text-muted hover:text-ink">
        ← Personal
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-semibold">
        Liquidación{employee ? ` — ${employee.fullName}` : ''}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Registro de horas, liquidación por período y comisiones adelantadas a cuenta.
      </p>

      <TimeEntriesSection employeeId={employeeId} />
      <CommissionAdvancesSection employeeId={employeeId} />
      <PayrollSection employeeId={employeeId} />
    </main>
  );
}

function TimeEntriesSection({ employeeId }: { employeeId: string }) {
  const { data } = useTimeEntries(employeeId);
  const record = useRecordTimeEntry(employeeId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<EmployeeTimeEntryInput>({ resolver: zodResolver(EmployeeTimeEntryInputSchema) });

  const onSubmit = handleSubmit((values) => record.mutate(values, { onSuccess: () => reset() }));

  return (
    <section className="mt-8 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-lg font-semibold">Horas trabajadas</h2>
      {data && data.entries.length > 0 && (
        <table className="mt-3 w-full text-left text-sm">
          <tbody>
            {data.entries.slice(0, 15).map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="py-1.5 pr-2 text-muted">{formatDate(entry.date)}</td>
                <td className="py-1.5 pr-2">{entry.hours ?? entry.note ?? '—'}</td>
                <td className="py-1.5 text-muted">{entry.eventName ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="date"
          className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('date')}
        />
        <input
          type="number"
          step="0.5"
          placeholder="Horas"
          className="w-24 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('hours')}
        />
        <input
          placeholder="Nota (ej. feriado)"
          className="w-40 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('note')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Cargar
        </button>
      </form>
    </section>
  );
}

function CommissionAdvancesSection({ employeeId }: { employeeId: string }) {
  const { data } = useCommissionAdvances(employeeId);
  const record = useRecordCommissionAdvance(employeeId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CommissionAdvanceInput>({ resolver: zodResolver(CommissionAdvanceInputSchema) });

  const onSubmit = handleSubmit((values) => record.mutate(values, { onSuccess: () => reset() }));

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-lg font-semibold">Comisiones adelantadas</h2>
      {data && data.advances.length > 0 && (
        <table className="mt-3 w-full text-left text-sm">
          <tbody>
            {data.advances.map((advance) => (
              <tr key={advance.id} className="border-t border-line">
                <td className="py-1.5 pr-2 text-muted">{formatDate(advance.date)}</td>
                <td className="py-1.5 pr-2 font-medium">{formatCurrency(advance.amount)}</td>
                <td className="py-1.5 pr-2 text-muted">
                  {advance.eventName ?? advance.note ?? ''}
                </td>
                <td className="py-1.5 text-right text-xs text-muted">
                  {advance.reconciledInEntryId ? 'Reconciliada' : 'Pendiente'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="date"
          className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('date')}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Monto"
          className="w-28 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('amount', { valueAsNumber: true })}
        />
        <input
          placeholder="Nota"
          className="w-40 rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('note')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Registrar
        </button>
      </form>
    </section>
  );
}

function PayrollSection({ employeeId }: { employeeId: string }) {
  const { data } = usePayrollEntries(employeeId);
  const compute = useComputePayroll(employeeId);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PayrollPeriodInput>({ resolver: zodResolver(PayrollPeriodInputSchema) });

  const onSubmit = handleSubmit((values) => compute.mutate(values));

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <h2 className="font-serif text-lg font-semibold">Liquidación por período</h2>
      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <input
          type="date"
          className="rounded-lg border border-line px-2 py-2 text-sm outline-none focus:border-ink"
          {...register('period')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
        >
          Liquidar mes
        </button>
      </form>

      {data && data.entries.length > 0 && (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="py-1 pr-2">Período</th>
              <th className="py-1 pr-2">Fijo</th>
              <th className="py-1 pr-2">Variable</th>
              <th className="py-1 pr-2">Adelantos</th>
              <th className="py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((entry) => (
              <tr key={entry.id} className="border-t border-line">
                <td className="py-1.5 pr-2">{formatDate(entry.period)}</td>
                <td className="py-1.5 pr-2">{formatCurrency(entry.fixedComponent)}</td>
                <td className="py-1.5 pr-2">{formatCurrency(entry.variableComponent)}</td>
                <td className="py-1.5 pr-2">-{formatCurrency(entry.advancesDeducted)}</td>
                <td className="py-1.5 font-semibold">{formatCurrency(entry.totalPaid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
