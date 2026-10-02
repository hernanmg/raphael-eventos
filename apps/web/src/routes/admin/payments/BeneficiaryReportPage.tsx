import { useParams } from 'react-router-dom';
import { useBeneficiaryReport } from '../../../hooks/useAdmin';
import {
  CARD_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  formatCurrency,
  formatDate,
} from '../../../lib/format';

/**
 * Vista imprimible (Ctrl+P) para cuando un cliente pide el detalle de su
 * cuenta — Cami/Fede la abren y se la muestran/mandan a mano. Sin
 * Layout/SiteHeader a propósito: es un documento, no una pantalla de la app.
 */
export default function BeneficiaryReportPage() {
  const { beneficiaryId } = useParams<{ beneficiaryId: string }>();
  const { data, isLoading, isError } = useBeneficiaryReport(beneficiaryId);

  if (isLoading) return <p className="p-10 text-sm text-muted">Cargando…</p>;
  if (isError || !data)
    return <p className="p-10 text-sm text-red-600">No pudimos generar el reporte.</p>;

  const { report } = data;

  return (
    <main className="mx-auto max-w-2xl px-8 py-10 print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <h1 className="font-serif text-2xl font-semibold">Raphael Eventos</h1>
      <p className="mt-1 text-sm text-muted">
        {EVENT_TYPE_LABELS[report.eventType]} — {report.eventName}
      </p>
      {report.beneficiaryLabel && (
        <p className="text-sm text-muted">Alumno/a: {report.beneficiaryLabel}</p>
      )}
      <p className="mt-1 text-xs text-muted">Generado el {formatDate(report.generatedAt)}</p>

      <table className="mt-6 w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2">Tipo</th>
            <th className="py-2">Cant.</th>
            <th className="py-2">Pagas</th>
            <th className="py-2">Valor actual</th>
            <th className="py-2">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {report.cards.map((card) => (
            <tr key={card.id} className="border-b border-line">
              <td className="py-2">{CARD_TYPE_LABELS[card.cardType]}</td>
              <td className="py-2">{card.quantity}</td>
              <td className="py-2">
                {card.quantityPaid} / {card.quantity}
              </td>
              <td className="py-2">{formatCurrency(card.unitValue)}</td>
              <td className="py-2 font-medium">{formatCurrency(card.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span>{formatCurrency(report.totalValue)}</span>
      </div>

      <h2 className="mb-2 mt-8 font-serif text-lg font-semibold">Pagos</h2>
      {report.payments.length === 0 ? (
        <p className="text-sm text-muted">Sin pagos registrados.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody>
            {report.payments.map((payment) => (
              <tr key={payment.id} className="border-b border-line">
                <td className="py-1.5">{formatDate(payment.paymentDate)}</td>
                <td className="py-1.5 text-muted">{payment.note}</td>
                <td className="py-1.5 text-right font-medium">{formatCurrency(payment.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-6 flex flex-col gap-1 rounded-xl border border-line p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Total</span>
          <span>{formatCurrency(report.totalValue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Abonado</span>
          <span>{formatCurrency(report.totalPaid)}</span>
        </div>
        <div className="flex justify-between font-semibold text-ink">
          <span>Saldo pendiente</span>
          <span>{formatCurrency(report.saldo)}</span>
        </div>
      </div>
    </main>
  );
}
