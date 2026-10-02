import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { requireRole } from '../../middleware/requireRole';

// Plantilla de columnas fijas para importar el listado de alumnos de un
// egreso — NO es un importador genérico que intente leer "cualquier Excel
// que suba el admin" (ver CLAUDE.md: la estructura real de los Excel de Fede
// cambia mes a mes). El admin completa esta plantilla hacia adelante, o sube
// una ya armada con estas columnas exactas.
const TEMPLATE_COLUMNS = ['nombre', 'email de contacto', 'teléfono'] as const;

export const importAlumnosRouter = Router();

importAlumnosRouter.use(requireRole('ADMIN', 'VENDEDOR'));

importAlumnosRouter.get('/events/import-alumnos/template', async (_req, res, next) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Alumnos');
    sheet.columns = TEMPLATE_COLUMNS.map((header) => ({ header, key: header, width: 28 }));
    sheet.addRow({
      nombre: 'Juan Pérez',
      'email de contacto': 'familia.perez@ejemplo.com',
      teléfono: '351 000 0000',
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla-alumnos.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

interface ParsedAlumnoRow {
  row: number;
  label: string;
  contactEmail: string;
  contactPhone: string;
  error: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

importAlumnosRouter.post(
  '/events/import-alumnos',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { message: 'Subí un archivo .xlsx' } });
        return;
      }

      const workbook = new ExcelJS.Workbook();
      // exceljs tipa `load` contra su propia copia de @types/node (hoisting
      // en node_modules), nominalmente distinta de la de este workspace —
      // `Buffer as unknown as Buffer` sigue resolviendo al tipo local, así
      // que no alcanza; el buffer en sí es válido en runtime.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ver comentario arriba
      await workbook.xlsx.load(req.file.buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        res.status(400).json({ error: { message: 'El archivo no tiene ninguna hoja' } });
        return;
      }

      // Columna por posición del encabezado (case-insensitive, tolera
      // espacios) — no asume un orden fijo de columnas, solo que existan.
      const headerRow = sheet.getRow(1);
      const columnIndex = new Map<string, number>();
      headerRow.eachCell((cell, colNumber) => {
        const normalized = String(cell.value ?? '')
          .trim()
          .toLowerCase();
        if (normalized) columnIndex.set(normalized, colNumber);
      });

      const missingColumns = TEMPLATE_COLUMNS.filter((col) => !columnIndex.has(col));
      if (missingColumns.length > 0) {
        res.status(400).json({
          error: {
            message: `Faltan columnas en la plantilla: ${missingColumns.join(', ')}. Descargá la plantilla de nuevo si no estás seguro del formato.`,
          },
        });
        return;
      }

      const rows: ParsedAlumnoRow[] = [];
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        const nombre = String(row.getCell(columnIndex.get('nombre')!).value ?? '').trim();
        const email = String(row.getCell(columnIndex.get('email de contacto')!).value ?? '').trim();
        const telefono = String(row.getCell(columnIndex.get('teléfono')!).value ?? '').trim();

        if (!nombre && !email && !telefono) continue; // fila vacía, se ignora

        let error: string | null = null;
        if (!nombre) error = 'Falta el nombre';
        else if (email && !EMAIL_RE.test(email)) error = 'Email inválido';

        rows.push({
          row: rowNumber,
          label: nombre,
          contactEmail: email,
          contactPhone: telefono,
          error,
        });
      }

      if (rows.length === 0) {
        res.status(400).json({ error: { message: 'No encontramos ninguna fila con datos' } });
        return;
      }

      res.json({ rows });
    } catch (err) {
      next(err);
    }
  },
);
