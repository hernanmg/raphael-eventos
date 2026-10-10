import { Router } from 'express';
import {
  CommissionAdvanceInputSchema,
  EmployeeInputSchema,
  EmployeeTimeEntryInputSchema,
  EventStaffAssignmentInputSchema,
  PayrollConfirmInputSchema,
} from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { requirePlan } from '../../middleware/requirePlan';
import { parseBody } from '../../lib/validate';
import {
  DoorAccessNotAllowedError,
  EmailInUseError,
  NotFoundError,
  assignStaff,
  confirmPayroll,
  createEmployee,
  grantDoorAccess,
  listCommissionAdvances,
  listEmployees,
  listEventStaffAssignments,
  listPayrollEntries,
  listTimeEntries,
  previewPayroll,
  recordCommissionAdvance,
  recordTimeEntry,
  unassignStaff,
  updateEmployee,
} from './staff.service';

export const staffRouter = Router();

// ABM y asignación son Plan Básica; horas/liquidación/comisiones son Pro
// (gateadas ruta por ruta más abajo). Mismo acceso ADMIN/VENDEDOR que el
// resto del panel — Cami y Fede acceden por igual.
staffRouter.use(requireRole('ADMIN', 'VENDEDOR'));

staffRouter.get('/employees', async (req, res, next) => {
  try {
    res.json({ employees: await listEmployees(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/employees', async (req, res, next) => {
  try {
    const input = parseBody(EmployeeInputSchema, req.body, res);
    if (!input) return;
    res.status(201).json({ employee: await createEmployee(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

staffRouter.put('/employees/:id', async (req, res, next) => {
  try {
    const input = parseBody(EmployeeInputSchema, req.body, res);
    if (!input) return;
    res.json({ employee: await updateEmployee(req.tenantId, req.params.id, input) });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Empleado no encontrado' } });
      return;
    }
    if (err instanceof EmailInUseError) {
      res.status(409).json({ error: { message: 'Ese email ya lo usa otra cuenta' } });
      return;
    }
    next(err);
  }
});

// Alta de acceso de puerta o reseteo de su contraseña temporal (Fase 3).
staffRouter.post('/employees/:id/door-access', async (req, res, next) => {
  try {
    res.status(201).json(await grantDoorAccess(req.tenantId, req.params.id));
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Empleado no encontrado' } });
      return;
    }
    if (err instanceof DoorAccessNotAllowedError) {
      res.status(400).json({ error: { message: err.message } });
      return;
    }
    if (err instanceof EmailInUseError) {
      res.status(409).json({
        error: { message: 'Ya existe una cuenta con ese email (por ejemplo, de un cliente)' },
      });
      return;
    }
    next(err);
  }
});

staffRouter.get('/events/:eventId/staff', async (req, res, next) => {
  try {
    res.json({ assignments: await listEventStaffAssignments(req.tenantId, req.params.eventId) });
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/events/:eventId/staff', async (req, res, next) => {
  try {
    const input = parseBody(EventStaffAssignmentInputSchema, req.body, res);
    if (!input) return;
    const assignment = await assignStaff(req.tenantId, req.params.eventId, input);
    res.status(201).json({ assignment });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Empleado no encontrado' } });
      return;
    }
    next(err);
  }
});

staffRouter.delete('/staff-assignments/:id', async (req, res, next) => {
  try {
    await unassignStaff(req.tenantId, req.params.id);
    res.status(204).end();
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Asignación no encontrada' } });
      return;
    }
    next(err);
  }
});

staffRouter.get('/employees/:id/time-entries', requirePlan('PRO'), async (req, res, next) => {
  try {
    res.json({ entries: await listTimeEntries(req.tenantId, req.params.id!) });
  } catch (err) {
    next(err);
  }
});

staffRouter.post('/employees/:id/time-entries', requirePlan('PRO'), async (req, res, next) => {
  try {
    const input = parseBody(EmployeeTimeEntryInputSchema, req.body, res);
    if (!input) return;
    const entry = await recordTimeEntry(req.tenantId, req.params.id!, input);
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
});

staffRouter.get('/employees/:id/payroll', requirePlan('PRO'), async (req, res, next) => {
  try {
    res.json({ entries: await listPayrollEntries(req.tenantId, req.params.id!) });
  } catch (err) {
    next(err);
  }
});

staffRouter.get('/employees/:id/payroll/preview', requirePlan('PRO'), async (req, res, next) => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : '';
    if (!/^\d{4}-\d{2}$/.test(period)) {
      res.status(400).json({ error: { message: 'Elegí el mes (YYYY-MM)' } });
      return;
    }
    res.json({ preview: await previewPayroll(req.tenantId, req.params.id!, period) });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Empleado no encontrado' } });
      return;
    }
    next(err);
  }
});

staffRouter.post('/employees/:id/payroll', requirePlan('PRO'), async (req, res, next) => {
  try {
    const input = parseBody(PayrollConfirmInputSchema, req.body, res);
    if (!input) return;
    const entry = await confirmPayroll(req.tenantId, req.params.id!, input);
    res.status(201).json({ entry });
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { message: 'Empleado no encontrado' } });
      return;
    }
    next(err);
  }
});

staffRouter.get(
  '/employees/:id/commission-advances',
  requirePlan('PRO'),
  async (req, res, next) => {
    try {
      res.json({ advances: await listCommissionAdvances(req.tenantId, req.params.id!) });
    } catch (err) {
      next(err);
    }
  },
);

staffRouter.post(
  '/employees/:id/commission-advances',
  requirePlan('PRO'),
  async (req, res, next) => {
    try {
      const input = parseBody(CommissionAdvanceInputSchema, req.body, res);
      if (!input) return;
      const advance = await recordCommissionAdvance(req.tenantId, req.params.id!, input);
      res.status(201).json({ advance });
    } catch (err) {
      next(err);
    }
  },
);
