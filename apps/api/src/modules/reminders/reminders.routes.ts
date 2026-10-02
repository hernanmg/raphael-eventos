import { Router } from 'express';
import { ReminderConfigInputSchema } from '@raphael-eventos/shared';
import { requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  getReminderConfig,
  listReminderLogs,
  runReminderSweep,
  updateReminderConfig,
} from './reminders.service';

export const remindersRouter = Router();

remindersRouter.use(requireRole('ADMIN', 'VENDEDOR'));

remindersRouter.get('/reminder-config', async (req, res, next) => {
  try {
    res.json({ config: await getReminderConfig(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

remindersRouter.put('/reminder-config', async (req, res, next) => {
  try {
    const input = parseBody(ReminderConfigInputSchema, req.body, res);
    if (!input) return;
    res.json({ config: await updateReminderConfig(req.tenantId, input) });
  } catch (err) {
    next(err);
  }
});

remindersRouter.get('/reminders/log', async (req, res, next) => {
  try {
    res.json({ logs: await listReminderLogs(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

remindersRouter.post('/reminders/run', async (req, res, next) => {
  try {
    const result = await runReminderSweep(req.tenantId, 'MANUAL');
    res.json({ result });
  } catch (err) {
    next(err);
  }
});
