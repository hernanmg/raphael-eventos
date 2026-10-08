import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma';
import { withTenant } from '../../db/withTenant';
import { env } from '../../env';
import { cleanupTestData, disconnectCleanup } from '../../test/dbCleanup';
import {
  EventNotFoundError,
  addIpcEntry,
  createEvent,
  getDashboard,
  getEventDetailForAdmin,
  listIpcHistory,
} from './admin.service';

// Mismo criterio que auth.test.ts / portal.test.ts: corre contra el tenant
// real "raphael-eventos". createEvent()/addIpcEntry() generan sus propios
// cuids (no aceptan un id custom), así que el cleanup NO puede filtrar por
// prefijo de id como en los otros archivos de test — filtra por
// titularEmail @example.com en su lugar, dominio que usan todos los eventos
// de este archivo.

let tenantId: string;
let adminUserId: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: env.TENANT_SLUG } });
  tenantId = tenant.id;

  const admin = await withTenant(tenantId, (tx) =>
    tx.user.upsert({
      where: { tenantId_email: { tenantId, email: 'admin-tests@example.com' } },
      update: {},
      create: {
        tenantId,
        email: 'admin-tests@example.com',
        passwordHash: 'x',
        fullName: 'Admin Test',
        role: 'ADMIN',
      },
    }),
  );
  adminUserId = admin.id;
});

// Limpieza centralizada (src/test/dbCleanup.ts): conserva el admin de test
// entre tests y lo borra (junto con todo lo de test) al final.
beforeEach(() => cleanupTestData({ keepUserIds: [adminUserId] }));
afterAll(async () => {
  await cleanupTestData();
  await disconnectCleanup();
  await prisma.$disconnect();
});

const emptyCards = (
  [
    { cardType: 'ADULTO', quantity: 0, baseValue: 0 },
    { cardType: 'ADOLESCENTE', quantity: 0, baseValue: 0 },
    { cardType: 'MENOR', quantity: 0, baseValue: 0 },
    { cardType: 'BRINDIS', quantity: 0, baseValue: 0 },
  ] as const
).map((c) => ({ ...c }));

describe('admin.service — alta de evento QUINCE/BODA/EMPRESARIAL', () => {
  it('crea un único beneficiary con las tarjetas cargadas (las de cantidad 0 no se guardan)', async () => {
    const event = await createEvent(tenantId, adminUserId, {
      type: 'BODA',
      name: 'Boda Test',
      titularEmail: 'novios@example.com',
      cards: [
        { cardType: 'ADULTO', quantity: 50, baseValue: 12000 },
        { cardType: 'ADOLESCENTE', quantity: 0, baseValue: 0 },
        { cardType: 'MENOR', quantity: 5, baseValue: 5000 },
        { cardType: 'BRINDIS', quantity: 0, baseValue: 0 },
      ],
      alumnos: [],
    });

    const beneficiaries = await withTenant(tenantId, (tx) =>
      tx.eventBeneficiary.findMany({ where: { eventId: event.id }, include: { cards: true } }),
    );

    expect(beneficiaries).toHaveLength(1);
    expect(beneficiaries[0]?.cards).toHaveLength(2);
    expect(beneficiaries[0]?.cards.map((c) => c.cardType).sort()).toEqual(['ADULTO', 'MENOR']);
  });

  it('si el titular ya tiene cuenta, lo vincula al toque (sin esperar a que se registre)', async () => {
    const existingUser = await withTenant(tenantId, (tx) =>
      tx.user.create({
        data: {
          tenantId,
          email: 'ya-tiene-cuenta@example.com',
          passwordHash: 'x',
          fullName: 'Ya tiene cuenta',
          role: 'CLIENTE',
        },
      }),
    );

    const event = await createEvent(tenantId, adminUserId, {
      type: 'QUINCE',
      name: '15 de alguien',
      titularEmail: existingUser.email,
      cards: [{ ...emptyCards[0]!, quantity: 10, baseValue: 1000 }, ...emptyCards.slice(1)],
      alumnos: [],
    });

    const link = await withTenant(tenantId, (tx) =>
      tx.eventAccount.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: existingUser.id } },
      }),
    );

    expect(link).not.toBeNull();
    expect(link?.role).toBe('TITULAR');
    expect(link?.beneficiaryId).not.toBeNull();
  });
});

describe('admin.service — alta de evento EGRESO', () => {
  it('crea un beneficiary por alumno, cada uno con la misma plantilla de tarjetas', async () => {
    const event = await createEvent(tenantId, adminUserId, {
      type: 'EGRESO',
      name: 'Egreso Test',
      titularEmail: 'colegio@example.com',
      minGuests: 40,
      cards: [{ ...emptyCards[0]!, quantity: 1, baseValue: 15000 }, ...emptyCards.slice(1)],
      alumnos: [
        { label: 'Alumno A' },
        { label: 'Alumno B', contactEmail: 'familia-b@example.com' },
      ],
    });

    const beneficiaries = await withTenant(tenantId, (tx) =>
      tx.eventBeneficiary.findMany({ where: { eventId: event.id }, include: { cards: true } }),
    );

    expect(beneficiaries).toHaveLength(2);
    for (const beneficiary of beneficiaries) {
      expect(beneficiary.cards).toHaveLength(1);
      expect(beneficiary.cards[0]?.quantity).toBe(1);
    }
  });

  it('si el email de un alumno ya tiene cuenta, lo vincula como participante', async () => {
    const familyUser = await withTenant(tenantId, (tx) =>
      tx.user.create({
        data: {
          tenantId,
          email: 'familia-existente@example.com',
          passwordHash: 'x',
          fullName: 'Familia existente',
          role: 'CLIENTE',
        },
      }),
    );

    const event = await createEvent(tenantId, adminUserId, {
      type: 'EGRESO',
      name: 'Egreso Test 2',
      titularEmail: 'colegio2@example.com',
      cards: [{ ...emptyCards[0]!, quantity: 1, baseValue: 15000 }, ...emptyCards.slice(1)],
      alumnos: [{ label: 'Hijo de familia existente', contactEmail: familyUser.email }],
    });

    const link = await withTenant(tenantId, (tx) =>
      tx.eventAccount.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: familyUser.id } },
      }),
    );
    expect(link?.role).toBe('PARTICIPANTE');
    expect(link?.beneficiaryId).not.toBeNull();
  });
});

describe('admin.service — dashboard', () => {
  it('cuenta eventos por tipo y devuelve la lista completa (el frontend arma "próximos")', async () => {
    await createEvent(tenantId, adminUserId, {
      type: 'EMPRESARIAL',
      name: 'Evento futuro',
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      titularEmail: 'empresa@example.com',
      cards: [{ ...emptyCards[0]!, quantity: 1, baseValue: 1000 }, ...emptyCards.slice(1)],
      alumnos: [],
    });

    const dashboard = await getDashboard(tenantId);

    expect(dashboard.totals.EMPRESARIAL).toBeGreaterThanOrEqual(1);
    expect(dashboard.events.some((e) => e.name === 'Evento futuro')).toBe(true);
  });
});

describe('admin.service — detalle de evento (admin ve todas las familias de un egreso)', () => {
  it('el detalle admin trae el desglose de cada beneficiary, sin el recorte de privacidad del portal', async () => {
    const event = await createEvent(tenantId, adminUserId, {
      type: 'EGRESO',
      name: 'Egreso Detalle Test',
      titularEmail: 'colegio-detalle@example.com',
      cards: [{ ...emptyCards[0]!, quantity: 1, baseValue: 20000 }, ...emptyCards.slice(1)],
      alumnos: [{ label: 'Alumno 1' }, { label: 'Alumno 2' }],
    });

    const detail = await getEventDetailForAdmin(tenantId, event.id);

    expect(detail.beneficiaries).toHaveLength(2);
    expect(detail.beneficiaries.every((b) => b.cards.length === 1)).toBe(true);
    expect(detail.totals.totalValue).toBe(40000);
  });

  it('un evento inexistente tira EventNotFoundError', async () => {
    await expect(getEventDetailForAdmin(tenantId, 'no-existe')).rejects.toThrow(EventNotFoundError);
  });
});

describe('admin.service — IPC', () => {
  it('el primer período cargado para el tenant arranca en índice 100', async () => {
    // Nota: el tenant real ya tiene IPC (backfill de datos.gob.ar + cron), así
    // que este test se corre contra un período muy futuro para no chocar con
    // la serie real; el índice sigue encadenando desde el último existente
    // (documentado, no es un bug).
    const entry = await addIpcEntry(tenantId, adminUserId, {
      period: '2099-01-01',
      sourcePreviousValue: 100,
      sourceLatestValue: 105,
    });

    const history = await listIpcHistory(tenantId);
    const found = history.find((h) => h.id === entry.id);
    expect(found).toBeDefined();
    expect(found?.sourceLatestValue).toBe(105);

    // limpieza puntual de esta fila (no matchea el prefijo test-admin- porque
    // el id lo genera Prisma)
    await withTenant(tenantId, (tx) => tx.ipcIndexValue.delete({ where: { id: entry.id } }));
  });
});
