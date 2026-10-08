import { randomBytes } from 'node:crypto';
import type { EventType, Prisma } from '@prisma/client';
import type {
  AdminProvider,
  AdminSponsor,
  ProviderInput,
  PublicProvider,
  PublicSponsor,
  SponsorInput,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { audit, diffFields, snapshot } from '../../lib/audit';
import { sponsorLogoStorage } from '../../lib/storage';

export class ProviderNotFoundError extends Error {}
export class SponsorNotFoundError extends Error {}
export class InvalidLogoError extends Error {}

// -- Proveedores ------------------------------------------------------------

type ProviderRow = Prisma.ProviderGetPayload<object>;

/** Público (landing/portal): NUNCA referralPct/referralNote. */
function toPublicProvider(row: ProviderRow): PublicProvider {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    contactName: row.contactName,
    phone: row.phone,
    email: row.email,
    instagramUrl: row.instagramUrl,
    websiteUrl: row.websiteUrl,
    eventTypes: row.eventTypes,
  };
}

function toAdminProvider(row: ProviderRow): AdminProvider {
  return {
    ...toPublicProvider(row),
    referralPct: row.referralPct === null ? null : Number(row.referralPct),
    referralNote: row.referralNote,
    active: row.active,
    sortOrder: row.sortOrder,
  };
}

const PROVIDER_FIELDS = [
  'name',
  'category',
  'description',
  'contactName',
  'phone',
  'email',
  'instagramUrl',
  'websiteUrl',
  'eventTypes',
  'referralPct',
  'referralNote',
  'active',
  'sortOrder',
] as const;

function providerData(input: ProviderInput) {
  return {
    name: input.name,
    category: input.category,
    description: input.description ?? null,
    contactName: input.contactName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    instagramUrl: input.instagramUrl ?? null,
    websiteUrl: input.websiteUrl ?? null,
    eventTypes: input.eventTypes,
    referralPct: input.referralPct ?? null,
    referralNote: input.referralNote ?? null,
    active: input.active,
    sortOrder: input.sortOrder,
  };
}

export async function listAdminProviders(tenantId: string): Promise<AdminProvider[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.provider.findMany({
      where: { tenantId },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toAdminProvider);
  });
}

export async function createProvider(tenantId: string, input: ProviderInput) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.provider.create({ data: { tenantId, ...providerData(input) } });
    await audit(tx, tenantId, {
      entityType: 'Provider',
      entityId: row.id,
      action: 'CREATE',
      summary: `Alta del proveedor ${row.name} (${row.category})`,
      changes: snapshot(row, [...PROVIDER_FIELDS]),
    });
    return toAdminProvider(row);
  });
}

export async function updateProvider(tenantId: string, id: string, input: ProviderInput) {
  return withTenant(tenantId, async (tx) => {
    const before = await tx.provider.findUnique({ where: { id } });
    if (!before || before.tenantId !== tenantId) throw new ProviderNotFoundError();
    const data = providerData(input);
    const row = await tx.provider.update({ where: { id }, data });
    const changes = diffFields(before, data, [...PROVIDER_FIELDS]);
    if (changes) {
      await audit(tx, tenantId, {
        entityType: 'Provider',
        entityId: id,
        action: 'UPDATE',
        summary: `Edición del proveedor ${row.name}`,
        changes,
      });
    }
    return toAdminProvider(row);
  });
}

export async function deleteProvider(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.provider.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) throw new ProviderNotFoundError();
    await tx.provider.delete({ where: { id } });
    await audit(tx, tenantId, {
      entityType: 'Provider',
      entityId: id,
      action: 'DELETE',
      summary: `Baja del proveedor ${row.name}`,
      changes: snapshot(row, [...PROVIDER_FIELDS]),
    });
  });
}

/** Landing: activos, opcionalmente filtrados por tipo de evento. */
export async function listPublicProviders(
  tenantId: string,
  eventType?: EventType,
): Promise<PublicProvider[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.provider.findMany({
      where: { tenantId, active: true, ...(eventType ? { eventTypes: { has: eventType } } : {}) },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toPublicProvider);
  });
}

/**
 * Portal: los proveedores que aplican a los tipos de evento que el cliente
 * tiene contratados (cualquier EventAccount suyo).
 */
export async function listPortalProviders(
  tenantId: string,
  userId: string,
): Promise<{ eventTypes: EventType[]; providers: PublicProvider[] }> {
  return withTenant(tenantId, async (tx) => {
    const accounts = await tx.eventAccount.findMany({
      where: { tenantId, userId, event: { status: { not: 'CANCELADO' } } },
      select: { event: { select: { type: true } } },
    });
    const eventTypes = [...new Set(accounts.map((a) => a.event.type))];
    if (eventTypes.length === 0) return { eventTypes, providers: [] };
    const rows = await tx.provider.findMany({
      where: { tenantId, active: true, eventTypes: { hasSome: eventTypes } },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { eventTypes, providers: rows.map(toPublicProvider) };
  });
}

// -- Sponsors ---------------------------------------------------------------

export const LOGO_MAX_BYTES = 1024 * 1024;

/**
 * PNG/JPG/WEBP verificados por los bytes reales del archivo (el mimetype que
 * manda el navegador se puede falsificar). Sin SVG: puede llevar scripts y se
 * serviría desde el dominio de la API.
 */
export function detectLogoMime(buffer: Buffer): string | null {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length > 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

type SponsorRow = Prisma.SponsorGetPayload<object>;

function toPublicSponsor(row: SponsorRow): PublicSponsor {
  // `updatedAt` en la URL: si se reemplaza el logo, el navegador no usa el viejo en caché.
  return {
    id: row.id,
    name: row.name,
    linkUrl: row.linkUrl,
    logoPath: `/api/v1/public/sponsors/${row.id}/logo?v=${row.updatedAt.getTime()}`,
  };
}

function toAdminSponsor(row: SponsorRow): AdminSponsor {
  return { ...toPublicSponsor(row), active: row.active, sortOrder: row.sortOrder };
}

async function storeLogo(tenantId: string, logo: Buffer) {
  if (logo.length > LOGO_MAX_BYTES)
    throw new InvalidLogoError('El logo no puede pesar más de 1 MB');
  const mime = detectLogoMime(logo);
  if (!mime) throw new InvalidLogoError('El logo tiene que ser una imagen PNG, JPG o WEBP');
  const key = `${tenantId}/${randomBytes(12).toString('hex')}.${EXT[mime]}`;
  await sponsorLogoStorage.save(key, logo);
  return { key, mime };
}

export async function listAdminSponsors(tenantId: string): Promise<AdminSponsor[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.sponsor.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toAdminSponsor);
  });
}

export async function createSponsor(tenantId: string, input: SponsorInput, logo: Buffer) {
  const stored = await storeLogo(tenantId, logo);
  try {
    return await withTenant(tenantId, async (tx) => {
      const row = await tx.sponsor.create({
        data: {
          tenantId,
          name: input.name,
          linkUrl: input.linkUrl ?? null,
          active: input.active,
          sortOrder: input.sortOrder,
          logoKey: stored.key,
          logoMime: stored.mime,
        },
      });
      await audit(tx, tenantId, {
        entityType: 'Sponsor',
        entityId: row.id,
        action: 'CREATE',
        summary: `Alta del sponsor ${row.name}`,
        changes: snapshot(row, ['name', 'linkUrl', 'active', 'sortOrder']),
      });
      return toAdminSponsor(row);
    });
  } catch (err) {
    await sponsorLogoStorage.delete(stored.key);
    throw err;
  }
}

export async function updateSponsor(
  tenantId: string,
  id: string,
  input: SponsorInput,
  logo: Buffer | null,
) {
  const stored = logo ? await storeLogo(tenantId, logo) : null;
  try {
    const { result, oldKey } = await withTenant(tenantId, async (tx) => {
      const before = await tx.sponsor.findUnique({ where: { id } });
      if (!before || before.tenantId !== tenantId) throw new SponsorNotFoundError();
      const data = {
        name: input.name,
        linkUrl: input.linkUrl ?? null,
        active: input.active,
        sortOrder: input.sortOrder,
        ...(stored ? { logoKey: stored.key, logoMime: stored.mime } : {}),
      };
      const row = await tx.sponsor.update({ where: { id }, data });
      const changes = diffFields(before, data, ['name', 'linkUrl', 'active', 'sortOrder']);
      if (changes || stored) {
        await audit(tx, tenantId, {
          entityType: 'Sponsor',
          entityId: id,
          action: 'UPDATE',
          summary: `Edición del sponsor ${row.name}${stored ? ' (logo nuevo)' : ''}`,
          changes,
        });
      }
      return { result: toAdminSponsor(row), oldKey: stored ? before.logoKey : null };
    });
    if (oldKey) await sponsorLogoStorage.delete(oldKey);
    return result;
  } catch (err) {
    if (stored) await sponsorLogoStorage.delete(stored.key);
    throw err;
  }
}

export async function deleteSponsor(tenantId: string, id: string) {
  const key = await withTenant(tenantId, async (tx) => {
    const row = await tx.sponsor.findUnique({ where: { id } });
    if (!row || row.tenantId !== tenantId) throw new SponsorNotFoundError();
    await tx.sponsor.delete({ where: { id } });
    await audit(tx, tenantId, {
      entityType: 'Sponsor',
      entityId: id,
      action: 'DELETE',
      summary: `Baja del sponsor ${row.name}`,
    });
    return row.logoKey;
  });
  await sponsorLogoStorage.delete(key);
}

export async function listPublicSponsors(tenantId: string): Promise<PublicSponsor[]> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx.sponsor.findMany({
      where: { tenantId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toPublicSponsor);
  });
}

/** Logo de un sponsor ACTIVO (los inactivos no se sirven en público). */
export async function getSponsorLogo(tenantId: string, id: string, includeInactive = false) {
  const row = await withTenant(tenantId, (tx) => tx.sponsor.findUnique({ where: { id } }));
  if (!row || row.tenantId !== tenantId || (!row.active && !includeInactive)) {
    throw new SponsorNotFoundError();
  }
  return { mime: row.logoMime, buffer: await sponsorLogoStorage.read(row.logoKey) };
}
