import type { Prisma, User } from '@prisma/client';
import type {
  CheckInAdmitInput,
  CheckInEventSummary,
  CheckInEventView,
  CheckInGuestView,
  CheckInLookupInput,
  CheckInRejectInput,
} from '@raphael-eventos/shared';
import { withTenant } from '../../db/withTenant';

export class CheckInEventNotFoundError extends Error {}
export class CheckInGuestNotFoundError extends Error {}
/** El QR existe pero es de otro evento — se avisa explícito en la puerta. */
export class WrongEventError extends Error {}
export class GuestCancelledError extends Error {}
export class ReentryNoteRequiredError extends Error {}

/** Mínimo de caracteres de la nota de verificación de un reingreso. */
const REENTRY_NOTE_MIN = 3;

/**
 * Eventos sobre los que el usuario puede hacer check-in de invitados (Fase 3).
 * PUERTA: solo los eventos donde su Employee tiene un EventStaffAssignment.
 * ADMIN/VENDEDOR: cualquier evento del tenant. En ambos casos, desde ayer en
 * adelante (un evento que cruza la medianoche sigue apareciendo) más los que
 * no tienen fecha cargada.
 */
export async function listCheckInEvents(
  tenantId: string,
  user: User,
): Promise<CheckInEventSummary[]> {
  return withTenant(tenantId, async (tx) => {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 1);
    since.setUTCHours(0, 0, 0, 0);

    let restrictToIds: string[] | undefined;
    if (user.role === 'PUERTA') {
      restrictToIds = await assignedEventIds(tx, user.id);
    }

    const events = await tx.event.findMany({
      where: {
        tenantId,
        status: 'ACTIVO',
        ...(restrictToIds ? { id: { in: restrictToIds } } : {}),
        OR: [{ eventDate: null }, { eventDate: { gte: since } }],
      },
      select: { id: true, name: true, type: true, eventDate: true, startTime: true },
      orderBy: { eventDate: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      eventDate: e.eventDate ? e.eventDate.toISOString() : null,
      startTime: e.startTime,
    }));
  });
}

async function assignedEventIds(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
  const employee = await tx.employee.findUnique({
    where: { userId },
    select: { assignments: { select: { eventId: true } } },
  });
  return employee?.assignments.map((a) => a.eventId) ?? [];
}

/**
 * Regla de acceso por evento — explícita, no "si no está en la lista no lo
 * ve": PUERTA solo opera sobre eventos asignados; el staff, sobre cualquiera.
 */
async function assertEventAccess(
  tx: Prisma.TransactionClient,
  tenantId: string,
  user: User,
  eventId: string,
) {
  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      type: true,
      eventDate: true,
      startTime: true,
    },
  });
  if (!event || event.tenantId !== tenantId) throw new CheckInEventNotFoundError();
  if (user.role === 'PUERTA' && !(await assignedEventIds(tx, user.id)).includes(eventId)) {
    // Mismo 404 que un evento inexistente: no confirma que exista.
    throw new CheckInEventNotFoundError();
  }
  return event;
}

export async function getCheckInEvent(
  tenantId: string,
  user: User,
  eventId: string,
): Promise<CheckInEventView> {
  return withTenant(tenantId, async (tx) => {
    const event = await assertEventAccess(tx, tenantId, user, eventId);
    const [confirmed, admitted] = await Promise.all([
      tx.eventGuest.count({ where: { tenantId, eventId, status: 'CONFIRMADO' } }),
      tx.guestCheckIn.groupBy({
        by: ['guestId'],
        where: { tenantId, eventId, result: 'ADMITIDO' },
      }),
    ]);
    return {
      id: event.id,
      name: event.name,
      type: event.type,
      eventDate: event.eventDate ? event.eventDate.toISOString() : null,
      startTime: event.startTime,
      confirmed,
      admitted: admitted.length,
    };
  });
}

const CHECKIN_GUEST_SELECT = {
  id: true,
  eventId: true,
  fullName: true,
  status: true,
  lateEntry: true,
  entryCode: true,
  beneficiary: { select: { label: true } },
  checkIns: {
    where: { result: 'ADMITIDO' },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  },
} as const;

type CheckInGuestRow = Prisma.EventGuestGetPayload<{ select: typeof CHECKIN_GUEST_SELECT }>;

function toGuestView(row: CheckInGuestRow): CheckInGuestView {
  return {
    guestId: row.id,
    fullName: row.fullName,
    status: row.status,
    lateEntry: row.lateEntry,
    entryCode: row.entryCode,
    beneficiaryLabel: row.beneficiary?.label ?? null,
    lastAdmittedAt: row.checkIns[0]?.createdAt.toISOString() ?? null,
    admittedCount: row.checkIns.length,
  };
}

/**
 * El QR codifica la URL de la entrada (`<origin>/q/<qrToken>`); también se
 * acepta el token suelto. Cualquier otra cosa no matchea nada.
 */
function extractQrToken(raw: string): string {
  const match = raw.match(/\/q\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/);
  return match ? match[1]! : raw.trim();
}

/**
 * Búsqueda de solo lectura — no escribe nada, así una mala lectura de la
 * cámara se reintenta las veces que haga falta sin contar como duplicado.
 */
export async function lookupGuests(
  tenantId: string,
  user: User,
  eventId: string,
  input: CheckInLookupInput,
): Promise<CheckInGuestView[]> {
  return withTenant(tenantId, async (tx) => {
    await assertEventAccess(tx, tenantId, user, eventId);

    if (input.qr) {
      const guest = await tx.eventGuest.findUnique({
        where: { qrToken: extractQrToken(input.qr) },
        select: CHECKIN_GUEST_SELECT,
      });
      if (!guest) throw new CheckInGuestNotFoundError();
      if (guest.eventId !== eventId) throw new WrongEventError();
      return [toGuestView(guest)];
    }

    if (input.code) {
      const guest = await tx.eventGuest.findUnique({
        where: { eventId_entryCode: { eventId, entryCode: input.code } },
        select: CHECKIN_GUEST_SELECT,
      });
      if (!guest) throw new CheckInGuestNotFoundError();
      return [toGuestView(guest)];
    }

    const guests = await tx.eventGuest.findMany({
      where: {
        tenantId,
        eventId,
        fullName: { contains: input.query!, mode: 'insensitive' },
      },
      select: CHECKIN_GUEST_SELECT,
      orderBy: { fullName: 'asc' },
      take: 20,
    });
    return guests.map(toGuestView);
  });
}

async function loadGuestForAction(
  tx: Prisma.TransactionClient,
  tenantId: string,
  user: User,
  eventId: string,
  guestId: string,
) {
  await assertEventAccess(tx, tenantId, user, eventId);
  const guest = await tx.eventGuest.findUnique({
    where: { id: guestId },
    select: CHECKIN_GUEST_SELECT,
  });
  if (!guest || guest.eventId !== eventId) throw new CheckInGuestNotFoundError();
  return guest;
}

/**
 * Admitir: primer ingreso con un toque. Si ya había un ADMITIDO previo es un
 * reingreso real y requiere nota de verificación manual (DNI, confirmación
 * con el titular) — decisión del cliente. Una entrada dada de baja no se
 * admite: el personal registra el rechazo.
 */
export async function admitGuest(
  tenantId: string,
  user: User,
  eventId: string,
  guestId: string,
  input: CheckInAdmitInput,
): Promise<CheckInGuestView> {
  return withTenant(tenantId, async (tx) => {
    const guest = await loadGuestForAction(tx, tenantId, user, eventId, guestId);
    if (guest.status === 'CANCELADO') throw new GuestCancelledError();
    const note = input.note?.trim() || null;
    if (guest.checkIns.length > 0 && (!note || note.length < REENTRY_NOTE_MIN)) {
      throw new ReentryNoteRequiredError();
    }
    await tx.guestCheckIn.create({
      data: { tenantId, eventId, guestId, scannedById: user.id, result: 'ADMITIDO', note },
    });
    const updated = await tx.eventGuest.findUniqueOrThrow({
      where: { id: guestId },
      select: CHECKIN_GUEST_SELECT,
    });
    return toGuestView(updated);
  });
}

/** Rechazo explícito (ej. reingreso sin poder verificar, o entrada dada de baja). */
export async function rejectGuest(
  tenantId: string,
  user: User,
  eventId: string,
  guestId: string,
  input: CheckInRejectInput,
): Promise<void> {
  await withTenant(tenantId, async (tx) => {
    await loadGuestForAction(tx, tenantId, user, eventId, guestId);
    await tx.guestCheckIn.create({
      data: {
        tenantId,
        eventId,
        guestId,
        scannedById: user.id,
        result: 'RECHAZADO',
        note: input.note?.trim() || null,
      },
    });
  });
}
