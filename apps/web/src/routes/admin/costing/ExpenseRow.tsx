import { useState } from 'react';
import type { ExpenseSummary } from '@raphael-eventos/shared';
import { useDeleteExpense } from '../../../hooks/useCosting';
import { apiUrl } from '../../../lib/api';
import { SUPPLY_UNIT_LABELS, formatCurrency, formatDate } from '../../../lib/format';
import { errorText } from '../../../lib/guestLinks';
import { ExpenseForm } from './ExpenseForm';
import { FormError } from './formErrors';

const AUTO_LABELS: Record<string, string> = {
  STAFF_EVENT: 'auto · personal',
  SALE_COMMISSION: 'auto · comisión de venta',
  PAYROLL: 'auto · liquidación',
};

/**
 * Un gasto: monto, rubro/proveedor, detalle, link al ticket y sus ítems
 * (producto, presentación, cantidad × precio = subtotal). Editable en el
 * lugar con el mismo form de alta.
 */
export function ExpenseRow({
  expense,
  showEvent = false,
  showCategory = true,
  showProvider = true,
}: {
  expense: ExpenseSummary;
  showEvent?: boolean;
  showCategory?: boolean;
  /** false dentro del grupo de un proveedor (el nombre ya está en el encabezado). */
  showProvider?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const remove = useDeleteExpense();

  if (editing) {
    return (
      <li className="py-2">
        <ExpenseForm
          initial={expense}
          eventId={expense.eventId ?? undefined}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const title =
    [
      showCategory ? expense.categoryName : null,
      showProvider ? expense.providerName : null,
      expense.employeeName,
    ]
      .filter(Boolean)
      .join(' · ') ||
    expense.detail ||
    expense.items
      .slice(0, 3)
      .map((i) => i.productName)
      .join(', ') ||
    'Gasto';
  const isPayroll = expense.autoSource === 'PAYROLL';

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {title}
            {expense.autoSource && (
              <span className="ml-2 rounded bg-cream-2 px-1.5 py-0.5 text-xs font-normal">
                {AUTO_LABELS[expense.autoSource]}
                {expense.manuallyEdited ? ' (ajustado a mano)' : ''}
              </span>
            )}
          </p>
          <p className="text-xs text-muted">
            {expense.period ? `Salón · ${expense.period}` : formatDate(expense.date)}
            {showEvent && expense.eventName ? ` · ${expense.eventName}` : ''}
            {expense.detail && title !== expense.detail ? ` · ${expense.detail}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-sm font-semibold text-ink">{formatCurrency(expense.amount)}</span>
          {expense.items.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-muted hover:text-ink"
            >
              {open ? 'Ocultar' : `${expense.items.length} ítem(s)`}
            </button>
          )}
          {expense.receiptName && (
            <a
              href={apiUrl(`/api/v1/admin/expenses/${expense.id}/receipt`)}
              target="_blank"
              rel="noreferrer"
              className="text-gold underline"
            >
              Ticket
            </a>
          )}
          {!isPayroll && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-muted hover:text-ink"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('¿Borrar este gasto?')) remove.mutate(expense.id);
                }}
                className="text-muted hover:text-red-600"
              >
                Quitar
              </button>
            </>
          )}
        </div>
      </div>
      {open && (
        <table className="mt-2 w-full text-left text-xs">
          <tbody>
            {expense.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="py-1 pr-2">
                  {item.productName}
                  {item.renegotiationWarning && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                      cambió el precio
                    </span>
                  )}
                </td>
                <td className="py-1 pr-2 text-muted">{item.presentation ?? ''}</td>
                <td className="py-1 pr-2 text-muted">
                  {item.quantity} {SUPPLY_UNIT_LABELS[item.unit]} × {formatCurrency(item.unitCost)}
                </td>
                <td className="py-1 text-right font-medium">{formatCurrency(item.lineCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <FormError message={remove.error ? errorText(remove.error) : undefined} />
    </li>
  );
}
