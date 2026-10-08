import { Router } from 'express';
import { getSalonProfile } from './salon.service';

// Público, sin auth: lo consume la landing (y el micrositio de invitados).
// Solo lectura de datos que ya son públicos — no necesita rate limit propio.
export const salonPublicRouter = Router();

salonPublicRouter.get('/salon', async (req, res, next) => {
  try {
    const salon = await getSalonProfile(req.tenantId);
    if (!salon) {
      res.status(404).json({ error: { message: 'Salón no encontrado' } });
      return;
    }
    res.json({ salon });
  } catch (err) {
    next(err);
  }
});
