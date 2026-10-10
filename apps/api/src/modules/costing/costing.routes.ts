import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  CostCategoryInputSchema,
  ExpenseInputSchema,
  TenantCostConfigInputSchema,
} from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { requirePlan } from '../../middleware/requirePlan';
import { parseBody } from '../../lib/validate';
import {
  InvalidExpenseError,
  NotFoundError,
  RECEIPT_MAX_BYTES,
  computeEventCosting,
  createCostCategory,
  createExpense,
  deleteCostCategory,
  deleteExpense,
  getCostConfig,
  getExpenseReceipt,
  listCostCategories,
  listExpenses,
  updateCostCategory,
  updateCostConfig,
  updateExpense,
  type ReceiptUpload,
} from './costing.service';

export const costingRouter = Router();

// Costeo es exclusivo del Plan Pro — mismo acceso ADMIN/VENDEDOR que el resto
// del panel admin, sin diferenciación entre Cami y Fede.
costingRouter.use(requireRole('ADMIN', 'VENDEDOR'), requirePlan('PRO'));

// Margen sobre el tope de 10 MB para que el error lo dé el service con un
// mensaje propio, no multer con uno genérico.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RECEIPT_MAX_BYTES * 1.5 },
});

function handleError(err: unknown, res: Response): boolean {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: { message: 'No encontrado' } });
    return true;
  }
  if (err instanceof InvalidExpenseError) {
    res.status(400).json({ error: { message: err.message } });
    return true;
  }
  return false;
}

costingRouter.get('/cost-config', async (req, res, next) => {
  try {
    res.json({ config: await getCostConfig(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

costingRouter.put('/cost-config', async (req, res, next) => {
  try {
    const input = parseBody(TenantCostConfigInputSchema, req.body, res);
    if (!input) return;
    res.json({ config: await updateCostConfig(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

// -- Rubros -------------------------------------------------------------------

costingRouter.get('/cost-categories', async (req, res, next) => {
  try {
    res.json({ categories: await listCostCategories(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/cost-categories', async (req, res, next) => {
  try {
    const input = parseBody(CostCategoryInputSchema, req.body, res);
    if (!input) return;
    res.status(201).json({ category: await createCostCategory(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.put('/cost-categories/:id', async (req, res, next) => {
  try {
    const input = parseBody(CostCategoryInputSchema, req.body, res);
    if (!input) return;
    res.json({ category: await updateCostCategory(req.tenantId, req.params.id!, input) });
  } catch (err) {
    if (handleError(err, res)) return;
    next(err);
  }
});

costingRouter.delete('/cost-categories/:id', async (req, res, next) => {
  try {
    await deleteCostCategory(req.tenantId, req.params.id!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// -- Gastos -------------------------------------------------------------------

/** El form manda multipart: `data` (JSON del gasto) + `receipt` (ticket, opcional). */
function parseExpenseBody(req: Request, res: Response) {
  let body: unknown;
  try {
    body = typeof req.body?.data === 'string' ? JSON.parse(req.body.data) : req.body;
  } catch {
    res.status(400).json({ error: { message: 'Datos del gasto inválidos' } });
    return null;
  }
  return parseBody(ExpenseInputSchema, body, res);
}

function receiptFrom(req: Request): ReceiptUpload | null {
  return req.file ? { buffer: req.file.buffer, originalName: req.file.originalname } : null;
}

costingRouter.get('/expenses', async (req, res, next) => {
  try {
    const q = (key: string) =>
      typeof req.query[key] === 'string' ? (req.query[key] as string) : undefined;
    const month = q('month');
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: { message: 'Mes inválido' } });
      return;
    }
    res.json({
      list: await listExpenses(req.tenantId, {
        eventId: q('eventId'),
        month,
        categoryId: q('categoryId'),
      }),
    });
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/expenses', upload.single('receipt'), async (req, res, next) => {
  try {
    const input = parseExpenseBody(req, res);
    if (!input) return;
    const expense = await createExpense(
      req.tenantId,
      input,
      receiptFrom(req),
      req.currentUser?.id ?? null,
    );
    res.status(201).json({ expense });
  } catch (err) {
    if (handleError(err, res)) return;
    next(err);
  }
});

costingRouter.put('/expenses/:id', upload.single('receipt'), async (req, res, next) => {
  try {
    const input = parseExpenseBody(req, res);
    if (!input) return;
    res.json({
      expense: await updateExpense(req.tenantId, req.params.id!, input, receiptFrom(req)),
    });
  } catch (err) {
    if (handleError(err, res)) return;
    next(err);
  }
});

costingRouter.delete('/expenses/:id', async (req, res, next) => {
  try {
    await deleteExpense(req.tenantId, req.params.id!);
    res.status(204).end();
  } catch (err) {
    if (handleError(err, res)) return;
    next(err);
  }
});

costingRouter.get('/expenses/:id/receipt', async (req, res, next) => {
  try {
    const { buffer, mime, name } = await getExpenseReceipt(req.tenantId, req.params.id!);
    res.setHeader('Content-Type', mime);
    // inline: la foto del ticket se ve en el navegador en vez de descargarse.
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.send(buffer);
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Este gasto no tiene ticket' } });
      return;
    }
    next(err);
  }
});

// -- Costeo del evento --------------------------------------------------------

costingRouter.get('/events/:eventId/costing', async (req, res, next) => {
  try {
    const raw = Number(req.query.guestCount);
    const guestCount =
      req.query.guestCount !== undefined && Number.isFinite(raw) && raw >= 0 ? raw : undefined;
    res.json({ costing: await computeEventCosting(req.tenantId, req.params.eventId!, guestCount) });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});
