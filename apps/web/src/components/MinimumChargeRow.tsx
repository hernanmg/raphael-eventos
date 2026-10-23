import type { MinimumCharge } from '@raphael-eventos/shared';
import { formatCurrency } from '../lib/format';

/**
 * Fila "faltan N para el mínimo" de una tabla de tarjetas de 5 columnas (Tipo,
 * Cantidad, Pagas, Valor, Subtotal) — portal y reporte imprimible. Lo que
 * falta para el mínimo contratado se cobra a valor Adulto (ver MinimumCharge).
 */
export function MinimumChargeRow({
  charge,
  cellClass,
}: {
  charge: MinimumCharge | null;
  cellClass: string;
}) {
  if (!charge || charge.missing <= 0) return null;
  return (
    <tr className="border-t border-line">
      <td className={cellClass} colSpan={3}>
        Faltan {charge.missing} para el mínimo de {charge.minGuests} invitados
        <span className="block text-xs text-muted">
          {charge.guestCount} cargados (sin contar brindis) · se cobran a valor Adulto
        </span>
      </td>
      <td className={cellClass}>{formatCurrency(charge.unitValue)}</td>
      <td className={`${cellClass} font-medium`}>{formatCurrency(charge.subtotal)}</td>
    </tr>
  );
}
