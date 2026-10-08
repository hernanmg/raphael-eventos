import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
import { computeAggregateFinancials } from '../src/lib/financials';

// Corre como el owner (DATABASE_URL), no como app_user: sembrar el tenant y
// el usuario demo es una tarea de operación/infra, no una request de la app.
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

// Credenciales de prueba para desarrollo local — documentadas en el README.
// No usar este patrón de contraseña fija fuera de dev/demo.
const DEMO_USER = {
  email: 'demo@raphaeleventos.com',
  password: 'Demo1234!',
  fullName: 'Usuario de prueba',
};

// No hay alta de admin self-service (sería un agujero de seguridad
// gravísimo) — las cuentas ADMIN/VENDEDOR se provisionan a mano, acá o
// directo en la base. En Fase 1 vendedor == admin en permisos (ver
// CLAUDE.md), así que un solo usuario admin alcanza para probar el panel.
const ADMIN_USER = {
  email: 'admin@raphaeleventos.com',
  password: 'AdminDemo1234!',
  fullName: 'Admin de prueba',
};

// IDs fijos (no cuid) para que el seed sea idempotente vía upsert, sin tener
// que buscar cada fila por sus campos únicos primero.
const SEED_IDS = {
  eventQuince: 'seed-event-quince-demo',
  beneficiaryQuince: 'seed-beneficiary-quince-demo',
  paymentQuince: 'seed-payment-quince-demo',
  accountQuince: 'seed-account-quince-demo',
  eventEgreso: 'seed-event-egreso-demo',
  beneficiaryEgreso1: 'seed-beneficiary-egreso-demo-1',
  beneficiaryEgreso2: 'seed-beneficiary-egreso-demo-2',
  accountEgreso: 'seed-account-egreso-demo',
  employeePao: 'seed-employee-pao',
  employeeAdri: 'seed-employee-adri',
  assignmentPaoQuince: 'seed-assignment-pao-quince',
} as const;

// Rubros reales tomados del Excel de costeo de Fede (docs/raphael_eventos_costos.xlsx,
// hojas PRECIOS. y COSTOS) — ver CLAUDE.md "Fase 2 — costeo y personal".
const SUPPLY_CATEGORIES = [
  'Verdulería',
  'Pollo',
  'Carnicería',
  'Pescadería',
  'Macro',
  'Panadería',
  'Fiambre',
  'Golosinas',
  'Alcohol',
  'Descartables/Limpieza',
  'Repostería',
  'Sushi',
  'Lavandería',
];
const SERVICE_COST_CATEGORIES = [
  'Mozos',
  'Barra',
  'Bacha',
  'DJ',
  'Fotógrafo',
  'Seguridad',
  'Flecha',
  'Baño',
];
const FIXED_COST_CATEGORIES: { name: string; monthlyAmount: number; guestScaled?: boolean }[] = [
  { name: 'Luz', monthlyAmount: 80000 },
  { name: 'Gas', monthlyAmount: 40000 },
  { name: 'Alquiler', monthlyAmount: 1200000, guestScaled: true },
  { name: 'Piletero', monthlyAmount: 60000 },
  { name: 'Jardinero', monthlyAmount: 60000 },
  { name: 'Limpieza', monthlyAmount: 90000 },
  { name: 'Horas semanales', monthlyAmount: 150000 },
  { name: 'Comisiones', monthlyAmount: 50000 },
  { name: 'Lavandería', monthlyAmount: 40000 },
  { name: 'Canva', monthlyAmount: 15000 },
  { name: 'Meta', monthlyAmount: 60000 },
  { name: 'Contador', monthlyAmount: 70000 },
  { name: 'Seguro', monthlyAmount: 50000 },
];

// Período base (primer día de mes) de las tarjetas demo. El IPC NO lo
// siembra este archivo: antes cargaba dos filas ficticias (2026-06 = 100,
// 2026-09 = 112,4 — 12,4% en 3 meses) que inflaban los saldos; en un deploy
// real eso habría plantado inflación falsa. La serie real sale de
// `npm run ipc:backfill -w apps/api` (datos.gob.ar) después del seed.
const CARDS_BASE_PERIOD = new Date('2026-06-01T00:00:00.000Z');

async function main() {
  const slug = process.env.TENANT_SLUG ?? 'raphael-eventos';

  // Plan PRO: Fede (dueño real) es el caso de uso del módulo de costeo — sin
  // esto, las pantallas nuevas de costeo quedan gateadas y no se pueden
  // probar contra el seed.
  // Perfil público (Fase 3): los mismos datos que la landing tenía
  // hardcodeados. Sin dirección exacta ni link de mapa todavía — la landing
  // solo dice "Córdoba, Argentina"; completar cuando el salón la pase.
  const publicProfile = {
    whatsappNumber: '5493513180810',
    instagramUrl: 'https://www.instagram.com/raphael.eventos/',
    address: 'Córdoba, Argentina',
  };
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { plan: 'PRO', ...publicProfile },
    create: { slug, name: 'Raphael Eventos', plan: 'PRO', ...publicProfile },
  });

  const passwordHash = await hashPassword(DEMO_USER.password);
  const demoUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: DEMO_USER.email } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: DEMO_USER.email,
      passwordHash,
      fullName: DEMO_USER.fullName,
      role: 'CLIENTE',
    },
  });

  const adminPasswordHash = await hashPassword(ADMIN_USER.password);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: ADMIN_USER.email } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: ADMIN_USER.email,
      passwordHash: adminPasswordHash,
      fullName: ADMIN_USER.fullName,
      role: 'ADMIN',
    },
  });

  // Catálogos de costeo (Plan Pro) — mismos rubros reales del Excel de Fede.
  for (const [index, name] of SUPPLY_CATEGORIES.entries()) {
    await prisma.supplyCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name, sortOrder: index },
    });
  }
  for (const name of SERVICE_COST_CATEGORIES) {
    await prisma.serviceCostCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
  }
  for (const category of FIXED_COST_CATEGORIES) {
    await prisma.fixedCostCategory.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: category.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: category.name,
        monthlyAmount: category.monthlyAmount,
        guestScaled: category.guestScaled ?? false,
      },
    });
  }

  // Personal (Plan Básica/Pro) — Pao y Adri son el caso real relatado por
  // Fede (ver CLAUDE.md): Pao cobra comisión, Adri tiene fijo + variable por
  // evento.
  const employeePao = await prisma.employee.upsert({
    where: { id: SEED_IDS.employeePao },
    // Email obligatorio desde Fase 3 (login de puerta) — también en update
    // para completar las filas sembradas antes de que existiera el campo.
    update: { email: 'pao@raphaeleventos.com' },
    create: {
      id: SEED_IDS.employeePao,
      tenantId: tenant.id,
      fullName: 'Pao',
      email: 'pao@raphaeleventos.com',
      contractType: 'MONOTRIBUTO',
      fixedMonthlyAmount: 0,
      variableType: 'COMISION_PCT',
      variableValue: 5,
    },
  });
  await prisma.employee.upsert({
    where: { id: SEED_IDS.employeeAdri },
    update: { email: 'adri@raphaeleventos.com' },
    create: {
      id: SEED_IDS.employeeAdri,
      tenantId: tenant.id,
      fullName: 'Adri',
      email: 'adri@raphaeleventos.com',
      contractType: 'EN_BLANCO',
      fixedMonthlyAmount: 150000,
      variableType: 'MONTO_POR_EVENTO',
      variableValue: 20000,
    },
  });

  // Evento demo #1: QUINCE, demo user = titular (ve su propio desglose de
  // tarjetas, pagos y saldo — "scope own" del portal).
  const eventQuince = await prisma.event.upsert({
    where: { id: SEED_IDS.eventQuince },
    update: {},
    create: {
      id: SEED_IDS.eventQuince,
      tenantId: tenant.id,
      type: 'QUINCE',
      name: '15 de Martina Gómez',
      eventDate: new Date('2026-12-12T00:00:00.000Z'),
      titularEmail: DEMO_USER.email,
      titularName: DEMO_USER.fullName,
    },
  });
  const beneficiaryQuince = await prisma.eventBeneficiary.upsert({
    where: { id: SEED_IDS.beneficiaryQuince },
    update: {},
    create: { id: SEED_IDS.beneficiaryQuince, tenantId: tenant.id, eventId: eventQuince.id },
  });
  const quinceCards: {
    cardType: 'ADULTO' | 'ADOLESCENTE' | 'MENOR' | 'BRINDIS';
    quantity: number;
    baseValue: number;
  }[] = [
    { cardType: 'ADULTO', quantity: 80, baseValue: 15000 },
    { cardType: 'ADOLESCENTE', quantity: 30, baseValue: 10000 },
    { cardType: 'MENOR', quantity: 15, baseValue: 6000 },
    { cardType: 'BRINDIS', quantity: 120, baseValue: 3000 },
  ];
  for (const card of quinceCards) {
    await prisma.eventCard.upsert({
      where: {
        beneficiaryId_cardType: { beneficiaryId: beneficiaryQuince.id, cardType: card.cardType },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        beneficiaryId: beneficiaryQuince.id,
        cardType: card.cardType,
        quantity: card.quantity,
        baseValue: card.baseValue,
        basePeriod: CARDS_BASE_PERIOD,
      },
    });
  }
  await prisma.payment.upsert({
    where: { id: SEED_IDS.paymentQuince },
    update: {},
    create: {
      id: SEED_IDS.paymentQuince,
      tenantId: tenant.id,
      beneficiaryId: beneficiaryQuince.id,
      amount: 900000,
      paymentDate: new Date('2026-07-15T00:00:00.000Z'),
      note: 'Seña inicial',
    },
  });
  await prisma.eventAccount.upsert({
    where: { id: SEED_IDS.accountQuince },
    update: {},
    create: {
      id: SEED_IDS.accountQuince,
      tenantId: tenant.id,
      eventId: eventQuince.id,
      userId: demoUser.id,
      beneficiaryId: beneficiaryQuince.id,
      role: 'TITULAR',
    },
  });

  // Asignación de personal (Pao) al evento demo — replica lo que hace
  // staff.service.ts#assignStaff al asignar un empleado con comisión: genera
  // sola la línea de EventServiceCost correspondiente.
  await prisma.eventStaffAssignment.upsert({
    where: { id: SEED_IDS.assignmentPaoQuince },
    update: {},
    create: {
      id: SEED_IDS.assignmentPaoQuince,
      tenantId: tenant.id,
      eventId: eventQuince.id,
      employeeId: employeePao.id,
    },
  });
  const quinceCardsForFinancials = await prisma.eventCard.findMany({
    where: { beneficiaryId: beneficiaryQuince.id },
  });
  const quincePaymentsForFinancials = await prisma.payment.findMany({
    where: { beneficiaryId: beneficiaryQuince.id },
  });
  const ipcRowsForFinancials = await prisma.ipcIndexValue.findMany({
    where: { tenantId: tenant.id },
    orderBy: { period: 'asc' },
  });
  const { totalValue: quinceTotalValue } = computeAggregateFinancials(
    [{ cards: quinceCardsForFinancials, payments: quincePaymentsForFinancials }],
    ipcRowsForFinancials,
  );
  await prisma.eventServiceCost.upsert({
    where: { id: 'seed-service-cost-pao-quince' },
    update: {},
    create: {
      id: 'seed-service-cost-pao-quince',
      tenantId: tenant.id,
      eventId: eventQuince.id,
      employeeId: employeePao.id,
      autoGenerated: true,
      amount: Number((quinceTotalValue * 0.05).toFixed(2)),
      note: 'Pao',
    },
  });

  // Evento demo #2: EGRESO, demo user = titular (colegio/comisión) — ve solo
  // el agregado de dos alumnos, nunca el detalle de cada familia ("scope
  // aggregate" del portal).
  const eventEgreso = await prisma.event.upsert({
    where: { id: SEED_IDS.eventEgreso },
    update: {},
    create: {
      id: SEED_IDS.eventEgreso,
      tenantId: tenant.id,
      type: 'EGRESO',
      name: 'Egreso 6to A — Colegio San José',
      eventDate: new Date('2026-11-20T00:00:00.000Z'),
      titularEmail: DEMO_USER.email,
      titularName: DEMO_USER.fullName,
      minGuests: 60,
    },
  });
  const egresoBeneficiaries = [
    { id: SEED_IDS.beneficiaryEgreso1, label: 'Juan Pérez', baseValue: 12000 },
    { id: SEED_IDS.beneficiaryEgreso2, label: 'Sofía Ramírez', baseValue: 12000 },
  ];
  for (const beneficiaryData of egresoBeneficiaries) {
    const beneficiary = await prisma.eventBeneficiary.upsert({
      where: { id: beneficiaryData.id },
      update: {},
      create: {
        id: beneficiaryData.id,
        tenantId: tenant.id,
        eventId: eventEgreso.id,
        label: beneficiaryData.label,
      },
    });
    await prisma.eventCard.upsert({
      where: { beneficiaryId_cardType: { beneficiaryId: beneficiary.id, cardType: 'ADULTO' } },
      update: {},
      create: {
        tenantId: tenant.id,
        beneficiaryId: beneficiary.id,
        cardType: 'ADULTO',
        quantity: 25,
        baseValue: beneficiaryData.baseValue,
        basePeriod: CARDS_BASE_PERIOD,
      },
    });
  }
  await prisma.eventAccount.upsert({
    where: { id: SEED_IDS.accountEgreso },
    update: {},
    create: {
      id: SEED_IDS.accountEgreso,
      tenantId: tenant.id,
      eventId: eventEgreso.id,
      userId: demoUser.id,
      beneficiaryId: null,
      role: 'TITULAR',
    },
  });

  console.log(`Tenant listo: ${tenant.name} (${tenant.id})`);
  console.log(`Usuario demo: ${DEMO_USER.email} / ${DEMO_USER.password}`);
  console.log(`Usuario admin: ${ADMIN_USER.email} / ${ADMIN_USER.password}`);
  console.log(`Eventos demo: "${eventQuince.name}" (propio) y "${eventEgreso.name}" (agregado)`);
  console.log(
    'IPC: el seed no lo carga — corré `npm run ipc:backfill -w apps/api` para traer la serie real de datos.gob.ar.',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
