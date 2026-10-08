import ExcelJS from 'exceljs';
import type { Response } from 'express';

/**
 * Exportaciones a XLSX/CSV (Fase 4) — una sola definición de columnas por
 * tabla, dos formatos de salida.
 */
export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | Date | null;
  /** Ancho en caracteres (solo XLSX). */
  width?: number;
  /** Formato numérico de Excel, ej. '"$"#,##0.00' o '0%'. */
  numFmt?: string;
}

export interface ExportSheet<T> {
  name: string;
  columns: ExportColumn<T>[];
  rows: T[];
}

export const MONEY_FMT = '"$"#,##0.00';

export type ExportFormat = 'xlsx' | 'csv';

export function parseExportFormat(value: unknown): ExportFormat | null {
  return value === 'xlsx' || value === 'csv' ? value : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function toXlsx(sheets: ExportSheet<any>[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Raphael Eventos';
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.columns = sheet.columns.map((col) => ({
      header: col.header,
      width: col.width ?? Math.max(12, col.header.length + 2),
      style: col.numFmt ? { numFmt: col.numFmt } : {},
    }));
    for (const row of sheet.rows) {
      ws.addRow(sheet.columns.map((col) => col.value(row)));
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

function csvCell(value: string | number | boolean | Date | null): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString().slice(0, 10);
  // Coma decimal: Excel en es-AR la interpreta como número.
  else if (typeof value === 'number') text = String(value).replace('.', ',');
  else text = String(value);
  // Evita inyección de fórmulas al abrir el CSV en Excel.
  if (/^[=+\-@]/.test(text) && typeof value !== 'number') text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV con `;` y BOM UTF-8 — es lo que Excel en español abre bien con doble
 * click (con `,` mete todo en una columna, y sin BOM rompe los acentos).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCsv(sheet: ExportSheet<any>): Buffer {
  const lines = [
    sheet.columns.map((col) => csvCell(col.header)).join(';'),
    ...sheet.rows.map((row) => sheet.columns.map((col) => csvCell(col.value(row))).join(';')),
  ];
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf-8');
}

/** CSV exporta solo la primera hoja (un CSV es una sola tabla). */
export async function sendExport(
  res: Response,
  format: ExportFormat,
  fileBase: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: ExportSheet<any>[],
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'xlsx') {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileBase}-${date}.xlsx"`);
    res.send(await toXlsx(sheets));
    return;
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileBase}-${date}.csv"`);
  res.send(toCsv(sheets[0]!));
}
