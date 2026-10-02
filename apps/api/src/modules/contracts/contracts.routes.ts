import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../../middleware/requireRole';
import { requireAuth } from '../../middleware/requireAuth';
import {
  ContractNotFoundError,
  EventNotAccessibleError,
  assertPortalAccess,
  deleteContract,
  getContractFile,
  getContractMeta,
  uploadContract,
} from './contracts.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Solo se aceptan archivos PDF'));
      return;
    }
    cb(null, true);
  },
});

export const contractsAdminRouter = Router();
contractsAdminRouter.use(requireRole('ADMIN', 'VENDEDOR'));

contractsAdminRouter.get('/events/:eventId/contract', async (req, res, next) => {
  try {
    const contract = await getContractMeta(req.tenantId, req.params.eventId!);
    res.json({ contract });
  } catch (err) {
    next(err);
  }
});

contractsAdminRouter.post(
  '/events/:eventId/contract',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: { message: 'Subí un archivo PDF' } });
        return;
      }
      const contract = await uploadContract(
        req.tenantId,
        req.params.eventId!,
        req.currentUser!.id,
        req.file.originalname,
        req.file.buffer,
      );
      res.status(201).json({ contract });
    } catch (err) {
      next(err);
    }
  },
);

contractsAdminRouter.delete('/events/:eventId/contract', async (req, res, next) => {
  try {
    await deleteContract(req.tenantId, req.params.eventId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

contractsAdminRouter.get('/events/:eventId/contract/file', async (req, res, next) => {
  try {
    const { fileName, buffer } = await getContractFile(req.tenantId, req.params.eventId!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    if (err instanceof ContractNotFoundError) {
      res.status(404).json({ error: { message: 'No hay contrato cargado' } });
      return;
    }
    next(err);
  }
});

export const contractsPortalRouter = Router();
contractsPortalRouter.use(requireAuth);

contractsPortalRouter.get('/events/:eventId/contract', async (req, res, next) => {
  try {
    await assertPortalAccess(req.tenantId, req.session.userId!, req.params.eventId!);
    const contract = await getContractMeta(req.tenantId, req.params.eventId!);
    res.json({ contract });
  } catch (err) {
    if (err instanceof EventNotAccessibleError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    next(err);
  }
});

contractsPortalRouter.get('/events/:eventId/contract/file', async (req, res, next) => {
  try {
    await assertPortalAccess(req.tenantId, req.session.userId!, req.params.eventId!);
    const { fileName, buffer } = await getContractFile(req.tenantId, req.params.eventId!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    if (err instanceof EventNotAccessibleError) {
      res.status(404).json({ error: { message: 'Evento no encontrado' } });
      return;
    }
    if (err instanceof ContractNotFoundError) {
      res.status(404).json({ error: { message: 'No hay contrato cargado' } });
      return;
    }
    next(err);
  }
});
