import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams } from 'react-router-dom';
import {
  CommissionAdvanceInputSchema,
  EmployeeTimeEntryInputSchema,
  PayrollConfirmInputSchema,
  type CommissionAdvanceInput,
  type EmployeeTimeEntryInput,
  type PayrollLineKind,
  type PayrollPreview,
} from '@raphael-eventos/shared';
import {
  useCommissionAdvances,
  useConfirmPayroll,
  useEmployees,
  usePayrollEntries,
  usePayrollPreview,
  useRecordCommissionAdvance,
  useRecordTimeEntry,
  useTimeEntries,
} from '../../../hooks/useStaff';
import { ApiError } from '../../../lib/api';
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
        Registro de horas, comisiones adelantadas a cuenta y liquidación del mes: trae sola cada
        concepto que cobra el empleado y se puede editar antes de confirmar.
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

const LINE_KIND_LABELS: Record<PayrollLineKind, string> = {
  FIJO: 'Sueldo fijo',
  HORAS: 'Horas',
  POR_EVENTO: 'Por evento trabajado',
  COMISION: 'Comisión por venta',
  ADELANTO: 'Adelanto (descuenta)',
  OTRO: 'Otro',
};

interface DraftLine {
  kind: PayrollLineKind;
  description: string;
  quantity: string;
  unitAmount: string;
}

function lineAmount(line: DraftLine): number {
  const value = Number(line.quantity.replace(',', '.')) * Number(line.unitAmount.replace(',', '.'));
  if (!Number.isFinite(value)) return 0;
  return line.kind === 'ADELANTO' ? -value : value;
}

/**
 * Liquidación del mes (feedback 2026-10): trae sola una línea por cada
 * concepto cargado del empleado — sueldo fijo, horas × valor hora, monto por
 * evento trabajado (cantidad = eventos del mes), comisión por evento vendido,
 * adelantos — con el cálculo de cada una. Todo editable antes de confirmar.
 * Al confirmar, el fijo + horas pasa a costeo como gasto del mes.
 */
function PayrollSection({ employeeId }: { employeeId: string }) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const { data: preview, isFetching } = usePayrollPreview(employeeId, period);
  const { data: history } = usePayrollEntries(employeeId);
  const confirm = useConfirmPayroll(employeeId);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!preview) return;
    setLines(
      preview.lines.map((l) => ({
        kind: l.kind,
        description: l.description,
        quantity: String(l.quantity),
        unitAmount: String(l.unitAmount),
      })),
    );
    setNote(preview.existing?.note ?? '');
    setError(undefined);
  }, [preview]);

  const update = (index: number, patch: Partial<DraftLine>) =>
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const total = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  const fixedPart = lines
    .filter((l) => ['FIJO', 'HORAS', 'OTRO'].includes(l.kind))
    .reduce((sum, l) => sum + lineAmount(l), 0);

  const submit = () => {
    const input = {
      period,
      note,
      lines: lines.map((l) => ({
        kind: l.kind,
        description: l.description,
        quantity: l.quantity.replace(',', '.'),
        unitAmount: l.unitAmount.replace(',', '.'),
      })),
    };
    const parsed = PayrollConfirmInputSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        /expected number|nan/i.test(issue?.message ?? '')
          ? 'Completá cantidades y montos con números'
          : issue?.message,
      );
      return;
    }
    if (
      preview?.existing &&
      !window.confirm('Ya hay una liquidación confirmada para este mes. ¿Reemplazarla?')
    ) {
      return;
    }
    setError(undefined);
    confirm.mutate(parsed.data);
  };

  const cell = 'rounded border border-line px-2 py-1 text-sm outline-none focus:border-ink';

  return (
    <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold">Liquidación del mes</h2>
        <label className="flex items-center gap-2 text-sm">
          Mes
          <input
            type="month"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              confirm.reset();
            }}
            className={cell}
          />
        </label>
      </div>
      {preview?.existing && (
        <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs text-muted">
          Este mes ya tiene una liquidación confirmada ({formatCurrency(preview.existing.totalPaid)}
          ). Abajo están los valores sugeridos de nuevo: si confirmás, la reemplaza.
        </p>
      )}
      {isFetching && !preview && <p className="mt-3 text-sm text-muted">Calculando…</p>}

      {preview && (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1 pr-2">Concepto</th>
                  <th className="py-1 pr-2">Detalle</th>
                  <th className="py-1 pr-2">Cantidad</th>
                  <th className="py-1 pr-2">Unitario $</th>
                  <th className="py-1 pr-2 text-right">Resultado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-t border-line">
                    <td className="py-1.5 pr-2">
                      <select
                        value={line.kind}
                        onChange={(e) => update(index, { kind: e.target.value as PayrollLineKind })}
                        className={cell}
                      >
                        {Object.entries(LINE_KIND_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        value={line.description}
                        onChange={(e) => update(index, { description: e.target.value })}
                        className={`${cell} w-full`}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => update(index, { quantity: e.target.value })}
                        className={`${cell} w-20`}
                        aria-label="Cantidad"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        inputMode="decimal"
                        value={line.unitAmount}
                        onChange={(e) => update(index, { unitAmount: e.target.value })}
                        className={`${cell} w-28`}
                        aria-label="Unitario"
                      />
                    </td>
                    <td
                      className={`py-1.5 pr-2 text-right font-medium ${
                        line.kind === 'ADELANTO' ? 'text-red-700' : ''
                      }`}
                    >
                      {formatCurrency(lineAmount(line))}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((rows) => rows.filter((_, i) => i !== index))}
                        className="text-xs text-muted hover:text-red-600"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-ink">
                  <td colSpan={4} className="py-2 pr-2 font-semibold">
                    Total a pagar
                  </td>
                  <td className="py-2 pr-2 text-right text-base font-semibold">
                    {formatCurrency(total)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              setLines((rows) => [
                ...rows,
                { kind: 'OTRO', description: '', quantity: '1', unitAmount: '0' },
              ])
            }
            className="mt-2 text-xs text-gold hover:underline"
          >
            + Agregar línea
          </button>

          <PayrollReference reference={preview.reference} />

          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="text-xs text-muted">Nota (opcional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={cell} />
          </label>
          <p className="mt-3 text-xs text-muted">
            Al confirmar, el fijo + horas ({formatCurrency(fixedPart)}) se suma al costeo como gasto
            del salón de este mes. Lo por evento y las comisiones ya están en el costeo de cada
            evento.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={confirm.isPending}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
            >
              {preview.existing ? 'Re-liquidar mes' : 'Confirmar liquidación'}
            </button>
            {confirm.isSuccess && (
              <span className="text-xs text-emerald-700">Liquidación guardada</span>
            )}
          </div>
          {(error || confirm.error) && (
            <p className="mt-2 text-xs text-red-600">
              {error ??
                (confirm.error instanceof ApiError ? confirm.error.message : 'No pudimos guardar')}
            </p>
          )}
        </>
      )}

      {history && history.entries.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold">Liquidaciones confirmadas</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {history.entries.map((entry) => (
              <li key={entry.id} className="py-2">
                <div className="flex justify-between">
                  <span>{formatMonth(entry.period)}</span>
                  <span className="font-semibold">{formatCurrency(entry.totalPaid)}</span>
                </div>
                {entry.lines.length > 0 && (
                  <ul className="mt-1 text-xs text-muted">
                    {entry.lines.map((line) => (
                      <li key={line.id} className="flex justify-between">
                        <span>
                          {line.description}: {line.quantity} × {formatCurrency(line.unitAmount)}
                        </span>
                        <span>{formatCurrency(line.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {entry.expenseAmount !== null && (
                  <p className="mt-1 text-xs text-emerald-700">
                    En costeo: {formatCurrency(entry.expenseAmount)} como gasto del mes
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function formatMonth(iso: string): string {
  const label = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** De dónde salen las cantidades sugeridas, y qué tienen cargado los eventos. */
function PayrollReference({ reference }: { reference: PayrollPreview['reference'] }) {
  const { eventsWorked, eventsSold, advances, hours, hourlyRate } = reference;
  if (!eventsWorked.length && !eventsSold.length && !advances.length && hours === 0) return null;
  return (
    <div className="mt-4 grid gap-3 rounded-xl bg-cream p-3 text-xs sm:grid-cols-2">
      {hours > 0 && (
        <p>
          <span className="font-semibold">Horas cargadas:</span> {hours} h ×{' '}
          {formatCurrency(hourlyRate)}
        </p>
      )}
      {eventsWorked.length > 0 && (
        <div>
          <p className="font-semibold">Eventos trabajados ({eventsWorked.length})</p>
          {eventsWorked.map((e) => (
            <p key={e.id} className="text-muted">
              {e.name} · {formatDate(e.date)} · en costeo {formatCurrency(e.costedAmount)}
            </p>
          ))}
        </div>
      )}
      {eventsSold.length > 0 && (
        <div>
          <p className="font-semibold">Eventos vendidos ({eventsSold.length})</p>
          {eventsSold.map((e) => (
            <p key={e.id} className="text-muted">
              {e.name} · vendido {formatDate(e.soldAt)} · en costeo {formatCurrency(e.costedAmount)}
            </p>
          ))}
        </div>
      )}
      {advances.length > 0 && (
        <div>
          <p className="font-semibold">Adelantos a descontar</p>
          {advances.map((a) => (
            <p key={a.id} className="text-muted">
              {formatDate(a.date)} · {formatCurrency(a.amount)}
              {a.note ? ` · ${a.note}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
