import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LeadIntakeSchema, LeadStatusSchema, UpdateLeadSchema } from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import { createLead, getCalendar, listLeads, updateLead } from './crm.service';

// Endpoint público (el QuoteForm de la landing no tiene sesión) — mismo
// criterio que el rate limit de /auth/login: sin esto, cualquiera puede
// inundar la tabla de leads.
const leadIntakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiadas consultas. Probá de nuevo en unos minutos.' } },
});

export const leadsPublicRouter = Router();

leadsPublicRouter.post('/leads', leadIntakeLimiter, async (req, res, next) => {
  try {
    const input = parseBody(LeadIntakeSchema, req.body, res);
    if (!input) return;
    const lead = await createLead(req.tenantId, input);
    res.status(201).json({ lead });
  } catch (err) {
    next(err);
  }
});

export const crmRouter = Router();

// CRM/calendario: mismo acceso ADMIN/VENDEDOR que el resto del panel — Cami
// y Fede acceden por igual (ver CLAUDE.md).
crmRouter.use(requireRole('ADMIN', 'VENDEDOR'));

crmRouter.get('/leads', async (req, res, next) => {
  try {
    const statusParam = LeadStatusSchema.safeParse(req.query.status);
    const leads = await listLeads(req.tenantId, statusParam.success ? statusParam.data : undefined);
    res.json({ leads });
  } catch (err) {
    next(err);
  }
});

crmRouter.patch('/leads/:id', async (req, res, next) => {
  try {
    const input = parseBody(UpdateLeadSchema, req.body, res);
    if (!input) return;
    const lead = await updateLead(req.tenantId, req.params.id!, input);
    res.json({ lead });
  } catch (err) {
    next(err);
  }
});

crmRouter.get('/calendar', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const entries = await getCalendar(req.tenantId, from, to);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});
