import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma';
import { withTenant } from '../../db/withTenant';
import { env } from '../../env';
import { indexFactor } from '../../lib/financials';
import { EventNotAccessibleError, getUserEventDetail, listUserEvents } from './portal.service';

// Mismo criterio que auth.test.ts: corre contra el Postgres local real y
// contra el tenant real "raphael-eventos" (no uno aislado), así que el
// cleanup solo toca filas creadas por estos tests (emails @example.com y los
// event/eventBeneficiary/eventCard/payment/ipcIndexValue/eventAccount con id
// prefijado "test-portal-"), nunca el usuario demo ni los eventos demo del
// seed.
//
// IPC: el tenant real tiene su propia serie de IpcIndexValue (backfill de
// datos.gob.ar + cron), única por (tenant, período). Por eso los índices de
// estos tests van en 2099 (último índice del tenant mientras corre el test,
// sin chocar con períodos reales) y las tarjetas "sin ajuste" usan un
// basePeriod en 2100 (posterior a cualquier índice cargado → factor 1),
// mismo truco que admin.test.ts. No dependen de qué IPC haya guardado.
const TEST_EMAIL_DOMAIN = '@example.com';
const TEST_ID_PREFIX = 'test-portal-';

let tenantId: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: env.TENANT_SLUG } });
  tenantId = tenant.id;
});

async function cleanupTestData() {
  await withTenant(tenantId, async (tx) => {
    await tx.eventAccount.deleteMany({ where: { id: { startsWith: TEST_ID_PREFIX } } });
    await tx.payment.deleteMany({ where: { id: { startsWith: TEST_ID_PREFIX } } });
    await tx.eventCard.deleteMany({ where: { id: { startsWith: TEST_ID_PREFIX } } });
    await tx.eventBeneficiary.deleteMany({ where: { id: { startsWith: TEST_ID_PREFIX } } });
    await tx.event.deleteMany({ where: { id: { startsWith: TEST_ID_PREFIX } } });
    await tx.ipcIndexValue.deleteMany({ where: { id: { startsWith: TEST_ID_PREFIX } } });
    await tx.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
  });
}

beforeEach(cleanupTestData);
afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

async function createTestUser(email: string) {
  return withTenant(tenantId, (tx) =>
    tx.user.create({
      data: { tenantId, email, passwordHash: 'x', fullName: 'Test', role: 'CLIENTE' },
    }),
  );
}

describe('portal.service — evento propio (titular de QUINCE)', () => {
  it('calcula tarjetas con el valor actualizado por IPC, saldo y % abonado', async () => {
    const user = await createTestUser('quince@example.com');

    const detail = await withTenant(tenantId, async (tx) => {
      await tx.ipcIndexValue.create({
        data: {
          id: `${TEST_ID_PREFIX}ipc-base`,
          tenantId,
          period: new Date('2099-01-01'),
          indexValue: 100,
          sourcePreviousValue: 98,
          sourceLatestValue: 100,
        },
      });
      await tx.ipcIndexValue.create({
        data: {
          id: `${TEST_ID_PREFIX}ipc-latest`,
          tenantId,
          period: new Date('2099-04-01'),
          indexValue: 110,
          sourcePreviousValue: 105,
          sourceLatestValue: 110,
        },
      });

      const event = await tx.event.create({
        data: {
          id: `${TEST_ID_PREFIX}event-quince`,
          tenantId,
          type: 'QUINCE',
          name: '15 de Test',
          titularEmail: user.email,
        },
      });
      const beneficiary = await tx.eventBeneficiary.create({
        data: { id: `${TEST_ID_PREFIX}beneficiary-quince`, tenantId, eventId: event.id },
      });
      await tx.eventCard.create({
        data: {
          id: `${TEST_ID_PREFIX}card-adulto`,
          tenantId,
          beneficiaryId: beneficiary.id,
          cardType: 'ADULTO',
          quantity: 10,
          baseValue: 1000,
          basePeriod: new Date('2099-01-01'),
        },
      });
      await tx.payment.create({
        data: {
          id: `${TEST_ID_PREFIX}payment-1`,
          tenantId,
          beneficiaryId: beneficiary.id,
          amount: 5500,
          paymentDate: new Date('2026-07-01'),
        },
      });
      await tx.eventAccount.create({
        data: {
          id: `${TEST_ID_PREFIX}account-quince`,
          tenantId,
          eventId: event.id,
          userId: user.id,
          beneficiaryId: beneficiary.id,
          role: 'TITULAR',
        },
      });

      return getUserEventDetail(tenantId, user.id, event.id);
    });

    // 10 tarjetas * 1000 base * (110/100) = 11000
    expect(detail.scope).toBe('own');
    expect(detail.own?.cards).toHaveLength(1);
    expect(detail.own?.cards[0]?.unitValue).toBe(1100);
    expect(detail.own?.cards[0]?.subtotal).toBe(11000);
    expect(detail.own?.totalValue).toBe(11000);
    expect(detail.own?.totalPaid).toBe(5500);
    expect(detail.own?.saldo).toBe(5500);
    expect(detail.own?.percentPaid).toBe(50);
  });

  it('sin ningún IpcIndexValue cargado, el factor es 1 (no rompe la pantalla)', () => {
    expect(indexFactor([], new Date('2026-01-01'))).toBe(1);
  });

  it('una tarjeta con período base posterior al último IPC vale su valor base', async () => {
    const user = await createTestUser('sinipc@example.com');

    const detail = await withTenant(tenantId, async (tx) => {
      const event = await tx.event.create({
        data: { id: `${TEST_ID_PREFIX}event-sinipc`, tenantId, type: 'BODA', name: 'Boda Test' },
      });
      const beneficiary = await tx.eventBeneficiary.create({
        data: { id: `${TEST_ID_PREFIX}beneficiary-sinipc`, tenantId, eventId: event.id },
      });
      await tx.eventCard.create({
        data: {
          id: `${TEST_ID_PREFIX}card-sinipc`,
          tenantId,
          beneficiaryId: beneficiary.id,
          cardType: 'ADULTO',
          quantity: 5,
          baseValue: 2000,
          basePeriod: new Date('2100-01-01'),
        },
      });
      await tx.eventAccount.create({
        data: {
          id: `${TEST_ID_PREFIX}account-sinipc`,
          tenantId,
          eventId: event.id,
          userId: user.id,
          beneficiaryId: beneficiary.id,
          role: 'TITULAR',
        },
      });

      return getUserEventDetail(tenantId, user.id, event.id);
    });

    expect(detail.own?.cards[0]?.unitValue).toBe(2000);
  });
});

describe('portal.service — titular de EGRESO (agregado, sin detalle por familia)', () => {
  it('suma los totales de todos los beneficiaries pero no expone el detalle de cada uno', async () => {
    const user = await createTestUser('egreso-titular@example.com');

    const detail = await withTenant(tenantId, async (tx) => {
      const event = await tx.event.create({
        data: {
          id: `${TEST_ID_PREFIX}event-egreso`,
          tenantId,
          type: 'EGRESO',
          name: 'Egreso Test',
          titularEmail: user.email,
        },
      });

      for (const [suffix, amount] of [
        ['1', 1000],
        ['2', 2000],
      ] as const) {
        const beneficiary = await tx.eventBeneficiary.create({
          data: {
            id: `${TEST_ID_PREFIX}beneficiary-egreso-${suffix}`,
            tenantId,
            eventId: event.id,
            label: `Alumno ${suffix}`,
          },
        });
        await tx.eventCard.create({
          data: {
            id: `${TEST_ID_PREFIX}card-egreso-${suffix}`,
            tenantId,
            beneficiaryId: beneficiary.id,
            cardType: 'ADULTO',
            quantity: 1,
            baseValue: amount,
            basePeriod: new Date('2100-01-01'),
          },
        });
      }

      await tx.eventAccount.create({
        data: {
          id: `${TEST_ID_PREFIX}account-egreso-titular`,
          tenantId,
          eventId: event.id,
          userId: user.id,
          beneficiaryId: null,
          role: 'TITULAR',
        },
      });

      return getUserEventDetail(tenantId, user.id, event.id);
    });

    expect(detail.scope).toBe('aggregate');
    expect(detail.aggregate?.beneficiaryCount).toBe(2);
    expect(detail.aggregate?.totalValue).toBe(3000); // 1000 + 2000, basePeriod 2100 -> factor 1
    expect(detail.own).toBeUndefined();
  });
});

describe('portal.service — privacidad y acceso', () => {
  it('un usuario sin EventAccount para el evento no puede ver su detalle', async () => {
    const owner = await createTestUser('owner@example.com');
    const stranger = await createTestUser('stranger@example.com');

    const eventId = await withTenant(tenantId, async (tx) => {
      const event = await tx.event.create({
        data: { id: `${TEST_ID_PREFIX}event-privado`, tenantId, type: 'QUINCE', name: 'Privado' },
      });
      const beneficiary = await tx.eventBeneficiary.create({
        data: { id: `${TEST_ID_PREFIX}beneficiary-privado`, tenantId, eventId: event.id },
      });
      await tx.eventAccount.create({
        data: {
          id: `${TEST_ID_PREFIX}account-privado`,
          tenantId,
          eventId: event.id,
          userId: owner.id,
          beneficiaryId: beneficiary.id,
          role: 'TITULAR',
        },
      });
      return event.id;
    });

    await expect(getUserEventDetail(tenantId, stranger.id, eventId)).rejects.toThrow(
      EventNotAccessibleError,
    );
  });

  it('listUserEvents solo devuelve los eventos del usuario logueado', async () => {
    const user = await createTestUser('propios@example.com');
    const events = await listUserEvents(tenantId, user.id);
    expect(events).toEqual([]);
  });
});
