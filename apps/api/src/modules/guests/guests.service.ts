import { randomBytes, randomInt } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  AdminGuestInput,
  AdminGuestsView,
  EventPublicInfoInput,
  GuestAttendance,
  GuestInput,
  GuestPassView,
  GuestRsvpInput,
  GuestSummary,
  InviteView,
  PortalGuestsView,
  PublicEventInfo,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';
import { prisma } from '../../db/prisma';
import { getSalonProfile } from '../salon/salon.service';
import { audit, diffFields } from '../../lib/audit';

export class InviteNotFoundError extends Error {}
export class RsvpClosedError extends Error {}
export class GuestNotFoundError extends Error {}

/**
 * Hora local del salón respecto de UTC. Argentina no tiene horario de
 * verano — fijo en -3. Cuando haya salones en otras zonas, pasa a ser un
 * campo del Tenant.
 */
const SALON_UTC_OFFSET_HOURS = -3;

// Sin caracteres ambiguos (0/O, 1/I): se dicta o se tipea a mano en la puerta.
const ENTRY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ENTRY_CODE_LENGTH = 6;

/** Token del link de invitación (`/i/:inviteToken`): 24 bytes, no adivinable. */
export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Lo que codifica el QR del invitado: 32 bytes, no adivinable. */
function generateQrToken(): string {
  return randomBytes(32).toString('base64url');
}

function randomEntryCode(): string {
  let code = '';
  for (let i = 0; i < ENTRY_CODE_LENGTH; i++) {
    code += ENTRY_CODE_ALPHABET[randomInt(ENTRY_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Código corto único por evento. Se verifica antes de insertar en vez de
 * reintentar ante un P2002: dentro de la transacción de withTenant, un error
 * de unique aborta toda la transacción en Postgres. Con 32^6 (~10^9)
 * combinaciones y unos cientos de invitados por evento, una colisión es
 * prácticamente imposible — el loop es solo por las dudas.
 */
async function uniqueEntryCode(tx: Prisma.TransactionClient, eventId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomEntryCode();
    const taken = await tx.eventGuest.findUnique({
      where: { eventId_entryCode: { eventId, entryCode: code } },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error('No se pudo generar un código de ingreso único');
}

/**
 * Cierre de la confirmación autogestionada: "hasta N días antes del evento"
 * inclusive, en hora del salón — con N=2 y evento el 20, se puede confirmar
 * todo el día 18 y se cierra al empezar el 19. `eventDate` se guarda como
 * medianoche UTC del día del evento.
 */
export function rsvpClosesAt(eventDate: Date | null, closeDaysBefore: number): Date | null {
  if (!eventDate) return null;
  const closes = new Date(eventDate);
  closes.setUTCDate(closes.getUTCDate() - closeDaysBefore + 1);
  closes.setUTCHours(-SALON_UTC_OFFSET_HOURS, 0, 0, 0);
  return closes;
}

function toPublicEvent(event: {
  name: string;
  type: PublicEventInfo['type'];
  eventDate: Date | null;
  startTime: string | null;
  photosUrl: string | null;
}): PublicEventInfo {
  return {
    name: event.name,
    type: event.type,
    eventDate: event.eventDate ? event.eventDate.toISOString() : null,
    startTime: event.startTime,
    photosUrl: event.photosUrl,
  };
}

const PUBLIC_EVENT_SELECT = {
  id: true,
  type: true,
  name: true,
  eventDate: true,
  startTime: true,
  photosUrl: true,
  status: true,
} as const;

async function loadSalon(tenantId: string) {
  const [salon, tenant] = await Promise.all([
    getSalonProfile(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { rsvpCloseDaysBefore: true } }),
  ]);
  if (!salon || !tenant) throw new Error('Tenant no encontrado');
  return { salon, closeDaysBefore: tenant.rsvpCloseDaysBefore };
}

async function findBeneficiaryByInvite(tx: Prisma.TransactionClient, inviteToken: string) {
  const beneficiary = await tx.eventBeneficiary.findUnique({
    where: { inviteToken },
    select: { id: true, label: true, event: { select: PUBLIC_EVENT_SELECT } },
  });
  // Un evento cancelado/finalizado deja de exponer su micrositio.
  if (!beneficiary || beneficiary.event.status !== 'ACTIVO') throw new InviteNotFoundError();
  return beneficiary;
}

/** Micrositio público del link de invitación. */
export async function getInviteView(tenantId: string, inviteToken: string): Promise<InviteView> {
  const { salon, closeDaysBefore } = await loadSalon(tenantId);
  return withTenant(tenantId, async (tx) => {
    const beneficiary = await findBeneficiaryByInvite(tx, inviteToken);
    const closesAt = rsvpClosesAt(beneficiary.event.eventDate, closeDaysBefore);
    return {
      event: toPublicEvent(beneficiary.event),
      salon,
      invitedBy: beneficiary.event.type === 'EGRESO' ? beneficiary.label : null,
      rsvpOpen: closesAt === null || closesAt.getTime() > Date.now(),
      rsvpClosesAt: closesAt ? closesAt.toISOString() : null,
    };
  });
}

interface CreateGuestParams {
  tenantId: string;
  eventId: string;
  beneficiaryId: string | null;
  input: GuestRsvpInput;
  source: 'AUTOGESTION' | 'TITULAR' | 'ADMIN';
  lateEntry?: boolean;
  createdById?: string | null;
}

/**
 * Alta de un invitado ya CONFIRMADO con su QR (`qrToken` + `entryCode`).
 * Único punto de creación — lo reusan el RSVP público y la carga del
 * titular/admin.
 */
export async function createGuest(tx: Prisma.TransactionClient, params: CreateGuestParams) {
  return tx.eventGuest.create({
    data: {
      tenantId: params.tenantId,
      eventId: params.eventId,
      beneficiaryId: params.beneficiaryId,
      fullName: params.input.fullName,
      phone: params.input.phone ?? null,
      email: params.input.email ?? null,
      source: params.source,
      lateEntry: params.lateEntry ?? false,
      qrToken: generateQrToken(),
      entryCode: await uniqueEntryCode(tx, params.eventId),
      createdById: params.createdById ?? null,
    },
  });
}

/**
 * Confirmación autogestionada desde el link. Se cierra
 * `Tenant.rsvpCloseDaysBefore` días antes del evento — las excepciones las
 * carga el titular/admin (sin esa restricción).
 */
export async function rsvpByInvite(
  tenantId: string,
  inviteToken: string,
  input: GuestRsvpInput,
): Promise<{ qrToken: string }> {
  const { closeDaysBefore } = await loadSalon(tenantId);
  return withTenant(tenantId, async (tx) => {
    const beneficiary = await findBeneficiaryByInvite(tx, inviteToken);
    const closesAt = rsvpClosesAt(beneficiary.event.eventDate, closeDaysBefore);
    if (closesAt && closesAt.getTime() <= Date.now()) throw new RsvpClosedError();

    const guest = await createGuest(tx, {
      tenantId,
      eventId: beneficiary.event.id,
      beneficiaryId: beneficiary.id,
      input,
      source: 'AUTOGESTION',
    });
    return { qrToken: guest.qrToken };
  });
}

/** La "entrada" del invitado: datos para mostrar su QR. */
export async function getGuestPass(tenantId: string, qrToken: string): Promise<GuestPassView> {
  const { salon } = await loadSalon(tenantId);
  return withTenant(tenantId, async (tx) => {
    const guest = await tx.eventGuest.findUnique({
      where: { qrToken },
      select: {
        fullName: true,
        status: true,
        lateEntry: true,
        entryCode: true,
        qrToken: true,
        event: { select: PUBLIC_EVENT_SELECT },
      },
    });
    if (!guest) throw new GuestNotFoundError();
    return {
      fullName: guest.fullName,
      status: guest.status,
      lateEntry: guest.lateEntry,
      entryCode: guest.entryCode,
      qrToken: guest.qrToken,
      event: toPublicEvent(guest.event),
      salon,
    };
  });
}

// ---------------------------------------------------------------------------
// Gestión de invitados — titular (portal) y admin.
// ---------------------------------------------------------------------------

export class EventNotFoundError extends Error {}
export class GuestAccessDeniedError extends Error {}
export class InvalidBeneficiaryError extends Error {}

const GUEST_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  email: true,
  status: true,
  source: true,
  lateEntry: true,
  entryCode: true,
  qrToken: true,
  beneficiaryId: true,
  beneficiary: { select: { label: true } },
  confirmedAt: true,
} as const;

type GuestRow = Prisma.EventGuestGetPayload<{ select: typeof GUEST_SELECT }>;

function serializeGuest(row: GuestRow): GuestSummary {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    status: row.status,
    source: row.source,
    lateEntry: row.lateEntry,
    entryCode: row.entryCode,
    qrToken: row.qrToken,
    beneficiaryId: row.beneficiaryId,
    beneficiaryLabel: row.beneficiary?.label ?? null,
    confirmedAt: row.confirmedAt.toISOString(),
  };
}

/**
 * Avance de confirmados del evento ENTERO, calculado en runtime — no hay
 * contador persistido (decisión de Fase 3). Meta: `Event.minGuests`, o la
 * suma de tarjetas cuando es null (mismo default que computeEventCosting).
 */
async function guestAttendance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  event: { id: string; minGuests: number | null },
): Promise<GuestAttendance> {
  const confirmed = await tx.eventGuest.count({
    where: { tenantId, eventId: event.id, status: 'CONFIRMADO' },
  });
  if (event.minGuests !== null) {
    return { confirmed, target: event.minGuests, targetSource: 'MIN_GUESTS' };
  }
  const cards = await tx.eventCard.aggregate({
    where: { tenantId, beneficiary: { eventId: event.id } },
    _sum: { quantity: true },
  });
  const total = cards._sum.quantity ?? 0;
  return total > 0
    ? { confirmed, target: total, targetSource: 'CARDS' }
    : { confirmed, target: null, targetSource: null };
}

async function ensureInviteToken(
  tx: Prisma.TransactionClient,
  beneficiaryId: string,
): Promise<string> {
  const beneficiary = await tx.eventBeneficiary.findUnique({
    where: { id: beneficiaryId },
    select: { inviteToken: true },
  });
  if (!beneficiary) throw new InvalidBeneficiaryError();
  if (beneficiary.inviteToken) return beneficiary.inviteToken;
  const token = generateInviteToken();
  await tx.eventBeneficiary.update({ where: { id: beneficiaryId }, data: { inviteToken: token } });
  return token;
}

/**
 * Vínculo del usuario con el evento. Gestiona invitados quien tiene un
 * beneficiary propio (titular de 15/boda/empresarial, o la familia de un
 * alumno en egreso). El titular de un egreso (beneficiaryId null) solo ve el
 * avance del evento — no listas de invitados de otras familias.
 */
async function portalLink(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  eventId: string,
) {
  const link = await tx.eventAccount.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: {
      beneficiaryId: true,
      event: { select: { id: true, tenantId: true, minGuests: true, status: true } },
    },
  });
  if (!link || link.event.tenantId !== tenantId) throw new EventNotFoundError();
  return link;
}

export async function getPortalGuests(
  tenantId: string,
  userId: string,
  eventId: string,
): Promise<PortalGuestsView> {
  return withTenant(tenantId, async (tx) => {
    const link = await portalLink(tx, tenantId, userId, eventId);
    const attendance = await guestAttendance(tx, tenantId, link.event);
    if (!link.beneficiaryId) {
      return { canManage: false, inviteToken: null, guests: [], attendance };
    }
    const [beneficiary, guests] = await Promise.all([
      tx.eventBeneficiary.findUnique({
        where: { id: link.beneficiaryId },
        select: { inviteToken: true },
      }),
      tx.eventGuest.findMany({
        where: { tenantId, eventId, beneficiaryId: link.beneficiaryId },
        select: GUEST_SELECT,
        orderBy: { confirmedAt: 'desc' },
      }),
    ]);
    return {
      canManage: true,
      inviteToken: beneficiary?.inviteToken ?? null,
      guests: guests.map(serializeGuest),
      attendance,
    };
  });
}

async function requireManageableLink(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  eventId: string,
) {
  const link = await portalLink(tx, tenantId, userId, eventId);
  if (!link.beneficiaryId) throw new GuestAccessDeniedError();
  return { ...link, beneficiaryId: link.beneficiaryId };
}

export async function ensurePortalInviteLink(tenantId: string, userId: string, eventId: string) {
  return withTenant(tenantId, async (tx) => {
    const link = await requireManageableLink(tx, tenantId, userId, eventId);
    return { inviteToken: await ensureInviteToken(tx, link.beneficiaryId) };
  });
}

async function loadGuestSummary(tx: Prisma.TransactionClient, guestId: string) {
  const row = await tx.eventGuest.findUniqueOrThrow({
    where: { id: guestId },
    select: GUEST_SELECT,
  });
  return serializeGuest(row);
}

/** Alta por el titular: sin el cierre de N días (las excepciones las maneja él). */
export async function addPortalGuest(
  tenantId: string,
  userId: string,
  eventId: string,
  input: GuestInput,
): Promise<GuestSummary> {
  return withTenant(tenantId, async (tx) => {
    const link = await requireManageableLink(tx, tenantId, userId, eventId);
    if (link.event.status !== 'ACTIVO') throw new GuestAccessDeniedError();
    const guest = await createGuest(tx, {
      tenantId,
      eventId,
      beneficiaryId: link.beneficiaryId,
      input,
      source: 'TITULAR',
      lateEntry: input.lateEntry,
      createdById: userId,
    });
    return loadGuestSummary(tx, guest.id);
  });
}

async function cancelGuest(tx: Prisma.TransactionClient, guestId: string) {
  await tx.eventGuest.update({
    where: { id: guestId },
    data: { status: 'CANCELADO', cancelledAt: new Date() },
  });
}

/** Baja por el titular: solo invitados de su propio beneficiary. */
export async function cancelPortalGuest(tenantId: string, userId: string, guestId: string) {
  return withTenant(tenantId, async (tx) => {
    const guest = await tx.eventGuest.findUnique({
      where: { id: guestId },
      select: { eventId: true, beneficiaryId: true },
    });
    if (!guest) throw new GuestNotFoundError();
    const link = await requireManageableLink(tx, tenantId, userId, guest.eventId);
    if (guest.beneficiaryId !== link.beneficiaryId) throw new GuestNotFoundError();
    await cancelGuest(tx, guestId);
  });
}

async function loadAdminEvent(tx: Prisma.TransactionClient, tenantId: string, eventId: string) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: { id: true, tenantId: true, minGuests: true },
  });
  if (!event || event.tenantId !== tenantId) throw new EventNotFoundError();
  return event;
}

/** Vista del staff: todos los invitados del evento (sin recorte por familia). */
export async function getAdminGuests(tenantId: string, eventId: string): Promise<AdminGuestsView> {
  return withTenant(tenantId, async (tx) => {
    const event = await loadAdminEvent(tx, tenantId, eventId);
    const [beneficiaries, guests, attendance] = await Promise.all([
      tx.eventBeneficiary.findMany({
        where: { tenantId, eventId },
        select: { id: true, label: true, inviteToken: true },
        orderBy: { createdAt: 'asc' },
      }),
      tx.eventGuest.findMany({
        where: { tenantId, eventId },
        select: GUEST_SELECT,
        orderBy: { confirmedAt: 'desc' },
      }),
      guestAttendance(tx, tenantId, event),
    ]);
    return { beneficiaries, guests: guests.map(serializeGuest), attendance };
  });
}

export async function ensureAdminInviteLink(tenantId: string, beneficiaryId: string) {
  return withTenant(tenantId, async (tx) => ({
    inviteToken: await ensureInviteToken(tx, beneficiaryId),
  }));
}

export async function addAdminGuest(
  tenantId: string,
  eventId: string,
  userId: string,
  input: AdminGuestInput,
): Promise<GuestSummary> {
  return withTenant(tenantId, async (tx) => {
    await loadAdminEvent(tx, tenantId, eventId);
    let beneficiaryId: string | null = input.beneficiaryId ?? null;
    if (beneficiaryId) {
      const beneficiary = await tx.eventBeneficiary.findUnique({
        where: { id: beneficiaryId },
        select: { eventId: true },
      });
      if (!beneficiary || beneficiary.eventId !== eventId) throw new InvalidBeneficiaryError();
    } else {
      // 15/boda/empresarial: hay un único beneficiary — el invitado es de ahí.
      const all = await tx.eventBeneficiary.findMany({
        where: { tenantId, eventId },
        select: { id: true },
        take: 2,
      });
      beneficiaryId = all.length === 1 ? all[0]!.id : null;
    }
    const guest = await createGuest(tx, {
      tenantId,
      eventId,
      beneficiaryId,
      input,
      source: 'ADMIN',
      lateEntry: input.lateEntry,
      createdById: userId,
    });
    return loadGuestSummary(tx, guest.id);
  });
}

export async function cancelAdminGuest(tenantId: string, guestId: string) {
  return withTenant(tenantId, async (tx) => {
    const guest = await tx.eventGuest.findUnique({ where: { id: guestId }, select: { id: true } });
    if (!guest) throw new GuestNotFoundError();
    await cancelGuest(tx, guestId);
  });
}

export async function updateEventPublicInfo(
  tenantId: string,
  eventId: string,
  input: EventPublicInfoInput,
) {
  return withTenant(tenantId, async (tx) => {
    await loadAdminEvent(tx, tenantId, eventId);
    const before = await tx.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { startTime: true, photosUrl: true, name: true },
    });
    const data = { startTime: input.startTime ?? null, photosUrl: input.photosUrl ?? null };
    const updated = await tx.event.update({
      where: { id: eventId },
      data,
      select: { startTime: true, photosUrl: true },
    });
    const changes = diffFields(before, data, ['startTime', 'photosUrl']);
    if (changes) {
      await audit(tx, tenantId, {
        entityType: 'Event',
        entityId: eventId,
        eventId,
        action: 'UPDATE',
        summary: `Micrositio de "${before.name}": hora/fotos`,
        changes,
      });
    }
    return updated;
  });
}
