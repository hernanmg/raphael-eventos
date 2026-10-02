import type { EventContractSummary } from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { contractStorage } from '../../lib/storage';

export class ContractNotFoundError extends Error {}
export class EventNotAccessibleError extends Error {}

function storageKey(tenantId: string, eventId: string, fileName: string): string {
  return `${tenantId}/${eventId}/${fileName}`;
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
  return withTenant(tenantId, async (tx) => {
    const existing = await tx.eventContract.findUnique({ where: { eventId } });
    if (existing) {
      await contractStorage.delete(existing.storageKey);
    }

    const key = storageKey(tenantId, eventId, fileName);
    await contractStorage.save(key, buffer);

    const contract = await tx.eventContract.upsert({
      where: { eventId },
      update: { fileName, storageKey: key, uploadedById, uploadedAt: new Date() },
      create: { tenantId, eventId, fileName, storageKey: key, uploadedById },
    });
    return { fileName: contract.fileName, uploadedAt: contract.uploadedAt.toISOString() };
  });
}

export async function deleteContract(tenantId: string, eventId: string): Promise<void> {
  return withTenant(tenantId, async (tx) => {
    const contract = await tx.eventContract.findUnique({ where: { eventId } });
    if (!contract) return;
    await contractStorage.delete(contract.storageKey);
    await tx.eventContract.delete({ where: { eventId } });
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
