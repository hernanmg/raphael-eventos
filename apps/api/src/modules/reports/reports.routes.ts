import { Router, type Request, type Response } from 'express';
import { requireRole } from '../../middleware/requireRole';
import { parseExportFormat, sendExport } from '../../lib/exporter';
import {
  ReportEventNotFoundError,
  cardsExportSheet,
  eventsExportSheet,
  getYearReport,
  guestsExportSheet,
  paymentsExportSheet,
  yearReportSheets,
} from './reports.service';

// Reportes + exportaciones (Fase 4, Plan Básica). Mismo acceso que el resto
// del panel.
export const reportsRouter = Router();
reportsRouter.use(requireRole('ADMIN', 'VENDEDOR'));

function parseYear(req: Request): number {
  const year = Number(req.query.year);
  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : new Date().getUTCFullYear();
}

/** `?eventIds=a,b` — filtro por evento de la card "Eventos". */
function parseEventIds(req: Request): string[] | undefined {
  const raw = req.query.eventIds;
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);
}

function requireFormat(req: Request, res: Response) {
  const format = parseExportFormat(req.query.format);
  if (!format) {
    res.status(400).json({ error: { message: 'Formato inválido: usá xlsx o csv' } });
  }
  return format;
}

reportsRouter.get('/reports/year', async (req, res, next) => {
  try {
    res.json({
      report: await getYearReport(req.tenantId, parseYear(req), parseEventIds(req)),
    });
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/reports/year/export', async (req, res, next) => {
  try {
    const format = requireFormat(req, res);
    if (!format) return;
    const report = await getYearReport(req.tenantId, parseYear(req), parseEventIds(req));
    await sendExport(res, format, `reporte-${report.year}`, yearReportSheets(report));
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/exports/events', async (req, res, next) => {
  try {
    const format = requireFormat(req, res);
    if (!format) return;
    await sendExport(res, format, 'eventos', [await eventsExportSheet(req.tenantId)]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/exports/cards', async (req, res, next) => {
  try {
    const format = requireFormat(req, res);
    if (!format) return;
    await sendExport(res, format, 'tarjetas', [await cardsExportSheet(req.tenantId)]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/exports/payments', async (req, res, next) => {
  try {
    const format = requireFormat(req, res);
    if (!format) return;
    await sendExport(res, format, 'pagos', [await paymentsExportSheet(req.tenantId)]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get('/events/:eventId/guests/export', async (req, res, next) => {
  try {
    const format = requireFormat(req, res);
    if (!format) return;
    const { sheet } = await guestsExportSheet(req.tenantId, req.params.eventId!);
    await sendExport(res, format, 'invitados', [sheet]);
  } catch (err) {
    if (err instanceof ReportEventNotFoundError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});
