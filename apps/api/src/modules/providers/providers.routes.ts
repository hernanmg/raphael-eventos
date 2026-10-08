import { Router, type Response } from 'express';
import multer from 'multer';
import type { EventType } from '@prisma/client';
import { EventTypeSchema, ProviderInputSchema, SponsorInputSchema } from '@raphael-eventos/shared';
import { requirePortalAccess, requireRole } from '../../middleware/requireRole';
import { parseBody } from '../../lib/validate';
import {
  InvalidLogoError,
  LOGO_MAX_BYTES,
  ProviderNotFoundError,
  SponsorNotFoundError,
  createProvider,
  createSponsor,
  deleteProvider,
  deleteSponsor,
  getSponsorLogo,
  listAdminProviders,
  listAdminSponsors,
  listPortalProviders,
  listPublicProviders,
  listPublicSponsors,
  updateProvider,
  updateSponsor,
} from './providers.service';

// Margen sobre el tope de 1 MB para que el error lo dé storeLogo con un
// mensaje propio, no multer con uno genérico.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES * 2 },
});

function handleError(err: unknown, res: Response): boolean {
  if (err instanceof ProviderNotFoundError) {
    res.status(404).json({ error: { message: 'Proveedor no encontrado' } });
    return true;
  }
  if (err instanceof SponsorNotFoundError) {
    res.status(404).json({ error: { message: 'Sponsor no encontrado' } });
    return true;
  }
  if (err instanceof InvalidLogoError) {
    res.status(400).json({ error: { message: err.message } });
    return true;
  }
  return false;
}

// -- Panel (ADMIN/VENDEDOR) ----------------------------------------------------

export const providersAdminRouter = Router();
providersAdminRouter.use(requireRole('ADMIN', 'VENDEDOR'));

providersAdminRouter.get('/providers', async (req, res, next) => {
  try {
    res.json({ providers: await listAdminProviders(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

providersAdminRouter.post('/providers', async (req, res, next) => {
  try {
    const input = parseBody(ProviderInputSchema, req.body, res);
    if (!input) return;
    res.status(201).json({ provider: await createProvider(req.tenantId, input) });
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

providersAdminRouter.put('/providers/:id', async (req, res, next) => {
  try {
    const input = parseBody(ProviderInputSchema, req.body, res);
    if (!input) return;
    res.json({ provider: await updateProvider(req.tenantId, req.params.id!, input) });
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

providersAdminRouter.delete('/providers/:id', async (req, res, next) => {
  try {
    await deleteProvider(req.tenantId, req.params.id!);
    res.status(204).end();
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

providersAdminRouter.get('/sponsors', async (req, res, next) => {
  try {
    res.json({ sponsors: await listAdminSponsors(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

providersAdminRouter.post('/sponsors', upload.single('logo'), async (req, res, next) => {
  try {
    const input = parseBody(SponsorInputSchema, req.body, res);
    if (!input) return;
    if (!req.file) {
      res.status(400).json({ error: { message: 'Subí el logo del sponsor' } });
      return;
    }
    res.status(201).json({ sponsor: await createSponsor(req.tenantId, input, req.file.buffer) });
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

providersAdminRouter.put('/sponsors/:id', upload.single('logo'), async (req, res, next) => {
  try {
    const input = parseBody(SponsorInputSchema, req.body, res);
    if (!input) return;
    const sponsor = await updateSponsor(
      req.tenantId,
      req.params.id!,
      input,
      req.file?.buffer ?? null,
    );
    res.json({ sponsor });
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

providersAdminRouter.delete('/sponsors/:id', async (req, res, next) => {
  try {
    await deleteSponsor(req.tenantId, req.params.id!);
    res.status(204).end();
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

// Vista previa del logo en el panel (incluye sponsors inactivos).
providersAdminRouter.get('/sponsors/:id/logo', async (req, res, next) => {
  try {
    const logo = await getSponsorLogo(req.tenantId, req.params.id!, true);
    res.setHeader('Content-Type', logo.mime);
    // El panel corre en otro origen (otro puerto/dominio que la API).
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(logo.buffer);
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

// -- Público (landing) -----------------------------------------------------------

export const providersPublicRouter = Router();

providersPublicRouter.get('/providers', async (req, res, next) => {
  try {
    const parsed = EventTypeSchema.safeParse(req.query.eventType);
    const eventType = parsed.success ? (parsed.data as EventType) : undefined;
    res.json({ providers: await listPublicProviders(req.tenantId, eventType) });
  } catch (err) {
    next(err);
  }
});

providersPublicRouter.get('/sponsors', async (req, res, next) => {
  try {
    res.json({ sponsors: await listPublicSponsors(req.tenantId) });
  } catch (err) {
    next(err);
  }
});

providersPublicRouter.get('/sponsors/:id/logo', async (req, res, next) => {
  try {
    const logo = await getSponsorLogo(req.tenantId, req.params.id!);
    res.setHeader('Content-Type', logo.mime);
    // La URL lleva ?v=updatedAt: cambia si se reemplaza el logo.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // helmet pone Cross-Origin-Resource-Policy: same-origin por default, y la
    // landing (otro origen) no podría mostrar la imagen.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(logo.buffer);
  } catch (err) {
    if (!handleError(err, res)) next(err);
  }
});

// -- Portal (filtrado por los tipos de evento del cliente) -----------------------

export const providersPortalRouter = Router();
providersPortalRouter.use(requirePortalAccess());

providersPortalRouter.get('/providers', async (req, res, next) => {
  try {
    res.json(await listPortalProviders(req.tenantId, req.session.userId!));
  } catch (err) {
    next(err);
  }
});
