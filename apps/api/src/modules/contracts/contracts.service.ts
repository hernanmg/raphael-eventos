import type { EventContractSummary } from '@raphael-eventos/shared';
import { randomBytes } from 'node:crypto';
import { withTenant } from '../../db/withTenant';
import { contractStorage } from '../../lib/storage';
import { audit } from '../../lib/audit';

export class ContractNotFoundError extends Error {}
export class EventNotAccessibleError extends Error {}

/**
 * Clave generada (ASCII seguro): Supabase Storage rechaza claves con
 * caracteres no ASCII, y el nombre original ("Contrato Núñez.pdf") vive en
 * EventContract.fileName para mostrarlo/descargarlo.
 */
function storageKey(tenantId: string, eventId: string): string {
  return `${tenantId}/${eventId}/${randomBytes(12).toString('hex')}.pdf`;
}

export async function getContractMeta(
  tenantId: string,
  eventId: string,
): Promise<EventContractSummary | null> {
  return withTenant(tenantId, async (tx) => {
    const contract = await tx.eventContract.findUnique({ where: { eventId } });
    if (!contract) return null;
    return { fileName: contract.fileName, uploadedAt: contract.uploadedAt.toISOString() };
  });
}

export async function uploadContract(
  tenantId: string,
  eventId: string,
  uploadedById: string,
  fileName: string,
  buffer: Buffer,
): Promise<EventContractSummary> {
  // Primero el archivo nuevo; el viejo se borra recién cuando la base ya
  // apunta al nuevo. Antes se borraba el viejo de entrada: si la subida
  // fallaba, el evento se quedaba sin contrato.
  const key = storageKey(tenantId, eventId);
  await contractStorage.save(key, buffer, 'application/pdf');

  let result: { summary: EventContractSummary; oldKey: string | null };
  try {
    result = await withTenant(tenantId, async (tx) => {
      const existing = await tx.eventContract.findUnique({ where: { eventId } });
      const contract = await tx.eventContract.upsert({
        where: { eventId },
        update: { fileName, storageKey: key, uploadedById, uploadedAt: new Date() },
        create: { tenantId, eventId, fileName, storageKey: key, uploadedById },
      });
      await audit(tx, tenantId, {
        entityType: 'EventContract',
        entityId: contract.id,
        eventId,
        action: existing ? 'UPDATE' : 'CREATE',
        summary: existing
          ? `Contrato reemplazado: "${existing.fileName}" → "${fileName}"`
          : `Contrato subido: "${fileName}"`,
      });
      return {
        summary: { fileName: contract.fileName, uploadedAt: contract.uploadedAt.toISOString() },
        oldKey: existing?.storageKey ?? null,
      };
    });
  } catch (err) {
    await contractStorage.delete(key).catch(() => undefined);
    throw err;
  }
  if (result.oldKey && result.oldKey !== key) {
    await contractStorage.delete(result.oldKey).catch(() => undefined);
  }
  return result.summary;
}

export async function deleteContract(tenantId: string, eventId: string): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    const contract = await tx.eventContract.findUnique({ where: { eventId } });
    if (!contract) return;
    await contractStorage.delete(contract.storageKey);
    await tx.eventContract.delete({ where: { eventId } });
    await audit(tx, tenantId, {
      entityType: 'EventContract',
      entityId: contract.id,
      eventId,
      action: 'DELETE',
      summary: `Contrato borrado: "${contract.fileName}"`,
    });
  });
}

export async function getContractFile(
  tenantId: string,
  eventId: string,
): Promise<{ fileName: string; buffer: Buffer }> {
  return withTenant(tenantId, async (tx) => {
    const contract = await tx.eventContract.findUnique({ where: { eventId } });
    if (!contract) throw new ContractNotFoundError();
    const buffer = await contractStorage.read(contract.storageKey);
    return { fileName: contract.fileName, buffer };
  });
}

/**
 * Solo para el portal cliente: cualquier rol (titular o participante) con
 * algún EventAccount para ese evento puede ver/descargar el contrato — a
 * diferencia del resto de datos financieros, el contrato es del evento
 * entero, no hay información privada de otra familia en juego.
 */
export async function assertPortalAccess(
  tenantId: string,
  userId: string,
  eventId: string,
): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    const link = await tx.eventAccount.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!link) throw new EventNotAccessibleError();
  });
}
