import { Router } from 'express';
import {
  CreateEventSchema,
  CreateIpcEntrySchema,
  RecordPaymentSchema,
} from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  BeneficiaryNotFoundError,
  ClientNotFoundError,
  EventNotFoundError,
  InvalidAllocationError,
  addIpcEntry,
  createEvent,
  deletePayment,
  getBeneficiaryReport,
  getClientDetail,
  getDashboard,
  getEventDetailForAdmin,
  listClients,
  listIpcHistory,
  recordPayment,
} from './admin.service';
import { getIpcStaleness } from '../../lib/ipc';

export const adminRouter = Router();

// Vendedor == admin en Fase 1: no hay CRM/calendario todavía que los
// diferencie (ver CLAUDE.md).
adminRouter.use(requireRole('ADMIN', 'VENDEDOR'));

adminRouter.get('/dashboard', async (req, res, next) => {
  try {
    const dashboard = await getDashboard(req.tenantId);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/events', async (req, res, next) => {
  try {
    const input = parseBody(CreateEventSchema, req.body, res);
    if (!input) return;

    const event = await createEvent(req.tenantId, req.currentUser!.id, input);
    res.status(201).json({ event: { id: event.id, name: event.name } });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/events/:eventId', async (req, res, next) => {
  try {
    const event = await getEventDetailForAdmin(req.tenantId, req.params.eventId);
    res.json({ event });
  } catch (err) {
    if (err instanceof EventNotFoundError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});

adminRouter.get('/ipc', async (req, res, next) => {
  try {
    const [history, staleness] = await Promise.all([
      listIpcHistory(req.tenantId),
      getIpcStaleness(req.tenantId),
    ]);
    res.json({ history, staleness });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/ipc', async (req, res, next) => {
  try {
    const input = parseBody(CreateIpcEntrySchema, req.body, res);
    if (!input) return;

    const entry = await addIpcEntry(req.tenantId, req.currentUser!.id, input);
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/beneficiaries/:beneficiaryId/payments', async (req, res, next) => {
  try {
    const input = parseBody(RecordPaymentSchema, req.body, res);
    if (!input) return;

    const result = await recordPayment(
      req.tenantId,
      req.params.beneficiaryId!,
      req.currentUser!.id,
      input,
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof BeneficiaryNotFoundError) {
      res.status(404).json({ error: { message: 'No encontramos esa tarjeta/beneficiario' } });
      return;
    }
    if (err instanceof InvalidAllocationError) {
      res.status(400).json({ error: { message: err.message } });
      return;
    }
    next(err);
  }
});

adminRouter.delete('/payments/:paymentId', async (req, res, next) => {
  try {
    await deletePayment(req.tenantId, req.params.paymentId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/beneficiaries/:beneficiaryId/report', async (req, res, next) => {
  try {
    const report = await getBeneficiaryReport(req.tenantId, req.params.beneficiaryId!);
    res.json({ report });
  } catch (err) {
    if (err instanceof BeneficiaryNotFoundError) {
      res.status(404).json({ error: { message: 'No encontramos esa tarjeta/beneficiario' } });
      return;
    }
    next(err);
  }
});

adminRouter.get('/clients', async (req, res, next) => {
  try {
    const clients = await listClients(req.tenantId);
    res.json({ clients });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/clients/:userId', async (req, res, next) => {
  try {
    const client = await getClientDetail(req.tenantId, req.params.userId!);
    res.json({ client });
  } catch (err) {
    if (err instanceof ClientNotFoundError) {
      res.status(404).json({ error: { message: 'No encontramos ese cliente' } });
      return;
    }
    next(err);
  }
});
