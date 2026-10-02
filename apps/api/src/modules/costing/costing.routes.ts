import { Router } from 'express';
import {
  EventServiceCostInputSchema,
  EventSupplyLineInputSchema,
  FixedCostCategoryInputSchema,
  ServiceCostCategoryInputSchema,
  SupplyCategoryInputSchema,
  TenantCostConfigInputSchema,
} from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { requirePlan } from '../../middleware/requirePlan';
import { parseBody } from '../../lib/validate';
import {
  NotFoundError,
  computeEventCosting,
  createEventServiceCost,
  createEventSupplyLine,
  createFixedCostCategory,
  createServiceCostCategory,
  createSupplyCategory,
  deleteEventServiceCost,
  deleteEventSupplyLine,
  deleteFixedCostCategory,
  deleteServiceCostCategory,
  deleteSupplyCategory,
  getCostConfig,
  listFixedCostCategories,
  listServiceCostCategories,
  listSupplyCategories,
  updateCostConfig,
  updateEventServiceCost,
  updateEventSupplyLine,
  updateFixedCostCategory,
} from './costing.service';

export const costingRouter = Router();

// Costeo es exclusivo del Plan Pro (ver CLAUDE.md "Fase 2 — costeo y
// personal") — mismo acceso ADMIN/VENDEDOR que el resto del panel admin,
// sin diferenciación entre Cami y Fede.
costingRouter.use(requireRole('ADMIN', 'VENDEDOR'), requirePlan('PRO'));

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

costingRouter.get('/supply-categories', async (req, res, next) => {
  try {
    res.json({ categories: await listSupplyCategories(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/supply-categories', async (req, res, next) => {
  try {
    const input = parseBody(SupplyCategoryInputSchema, req.body, res);
    if (!input) return;
    res.status(201).json({ category: await createSupplyCategory(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.delete('/supply-categories/:id', async (req, res, next) => {
  try {
    await deleteSupplyCategory(req.tenantId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

costingRouter.get('/service-cost-categories', async (req, res, next) => {
  try {
    res.json({ categories: await listServiceCostCategories(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/service-cost-categories', async (req, res, next) => {
  try {
    const input = parseBody(ServiceCostCategoryInputSchema, req.body, res);
    if (!input) return;
    res.status(201).json({ category: await createServiceCostCategory(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.delete('/service-cost-categories/:id', async (req, res, next) => {
  try {
    await deleteServiceCostCategory(req.tenantId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

costingRouter.get('/fixed-cost-categories', async (req, res, next) => {
  try {
    res.json({ categories: await listFixedCostCategories(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/fixed-cost-categories', async (req, res, next) => {
  try {
    const input = parseBody(FixedCostCategoryInputSchema, req.body, res);
    if (!input) return;
    res.status(201).json({ category: await createFixedCostCategory(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.put('/fixed-cost-categories/:id', async (req, res, next) => {
  try {
    const input = parseBody(FixedCostCategoryInputSchema, req.body, res);
    if (!input) return;
    res.json({ category: await updateFixedCostCategory(req.tenantId, req.params.id, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.delete('/fixed-cost-categories/:id', async (req, res, next) => {
  try {
    await deleteFixedCostCategory(req.tenantId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/events/:eventId/supply-lines', async (req, res, next) => {
  try {
    const input = parseBody(EventSupplyLineInputSchema, req.body, res);
    if (!input) return;
    res
      .status(201)
      .json({ line: await createEventSupplyLine(req.tenantId, req.params.eventId, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.put('/supply-lines/:id', async (req, res, next) => {
  try {
    const input = parseBody(EventSupplyLineInputSchema, req.body, res);
    if (!input) return;
    res.json({ line: await updateEventSupplyLine(req.tenantId, req.params.id, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.delete('/supply-lines/:id', async (req, res, next) => {
  try {
    await deleteEventSupplyLine(req.tenantId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

costingRouter.post('/events/:eventId/service-costs', async (req, res, next) => {
  try {
    const input = parseBody(EventServiceCostInputSchema, req.body, res);
    if (!input) return;
    res
      .status(201)
      .json({ cost: await createEventServiceCost(req.tenantId, req.params.eventId, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.put('/service-costs/:id', async (req, res, next) => {
  try {
    const input = parseBody(EventServiceCostInputSchema, req.body, res);
    if (!input) return;
    res.json({ cost: await updateEventServiceCost(req.tenantId, req.params.id, input) });
  } catch (err) {
    next(err);
  }
});

costingRouter.delete('/service-costs/:id', async (req, res, next) => {
  try {
    await deleteEventServiceCost(req.tenantId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

costingRouter.get('/events/:eventId/costing', async (req, res, next) => {
  try {
    const guestCount = req.query.guestCount ? Number(req.query.guestCount) : undefined;
    const costing = await computeEventCosting(req.tenantId, req.params.eventId, guestCount);
    res.json({ costing });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});
