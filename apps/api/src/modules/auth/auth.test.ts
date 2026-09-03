import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../index';
import { prisma } from '../../db/prisma';
import { withTenant } from '../../db/withTenant';
import { env } from '../../env';

// Estos tests pegan contra el Postgres local real (docker compose, puerto
// 5450) para poder verificar RLS de punta a punta, no solo la lógica de la
// app. Requieren `npm run db:up` y el seed corrido antes.
//
// IMPORTANTE: corren contra el mismo tenant "raphael-eventos" que usa el
// seed para crear el usuario demo (ver prisma/seed.ts) — por eso el cleanup
// de acá abajo SOLO borra usuarios con email @example.com (el dominio que
// usan todos los fixtures de este archivo, ver RFC 2606). Un deleteMany({})
// sin filtro se lleva puesto el usuario demo real en cada corrida — pasó de
// verdad y rompió el login local hasta que se resembró.
const TEST_EMAIL_DOMAIN = '@example.com';

let tenantId: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: env.TENANT_SLUG } });
  tenantId = tenant.id;
});

async function cleanupTestData() {
  await withTenant(tenantId, async (tx) => {
    // event/eventBeneficiary/eventAccount no se scopean por email porque hoy
    // nada más que estos tests crea filas ahí (no existe todavía un alta de
    // eventos) — cuando eso exista, escopear estas tres igual que a user.
    await tx.eventAccount.deleteMany({});
    await tx.eventBeneficiary.deleteMany({});
    await tx.event.deleteMany({});
    await tx.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
  });
}

beforeEach(cleanupTestData);

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/register', () => {
  it('crea la cuenta, abre sesión y no expone el hash de la contraseña', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Cami Gómez',
      email: 'cami@example.com',
      password: 'unaClaveSegura123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: 'cami@example.com',
      fullName: 'Cami Gómez',
      role: 'CLIENTE',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rechaza un email duplicado dentro del mismo tenant', async () => {
    const app = createApp();
    const payload = {
      fullName: 'Cami Gómez',
      email: 'duplicado@example.com',
      password: 'unaClaveSegura123',
    };

    await request(app).post('/api/v1/auth/register').send(payload);
    const res = await request(app).post('/api/v1/auth/register').send(payload);

    expect(res.status).toBe(409);
  });

  it('valida el payload con el schema compartido', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ fullName: 'X', email: 'no-es-un-email', password: '123' });

    expect(res.status).toBe(400);
  });

  it('vincula automáticamente el evento donde el admin cargó este email como titular', async () => {
    await withTenant(tenantId, async (tx) => {
      const event = await tx.event.create({
        data: {
          tenantId,
          type: 'QUINCE',
          name: '15 de Martina',
          titularEmail: 'martina@example.com',
        },
      });
      await tx.eventBeneficiary.create({ data: { tenantId, eventId: event.id } });
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Familia Martina',
      email: 'martina@example.com',
      password: 'unaClaveSegura123',
    });

    expect(res.status).toBe(201);

    const links = await withTenant(tenantId, (tx) =>
      tx.eventAccount.findMany({ where: { userId: res.body.user.id } }),
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.role).toBe('TITULAR');
    expect(links[0]?.beneficiaryId).not.toBeNull();
  });

  it('vincula como participante al alumno de un egreso y reclama el beneficiary', async () => {
    let beneficiaryId = '';
    await withTenant(tenantId, async (tx) => {
      const event = await tx.event.create({
        data: { tenantId, type: 'EGRESO', name: 'Egreso 6to A' },
      });
      const beneficiary = await tx.eventBeneficiary.create({
        data: {
          tenantId,
          eventId: event.id,
          label: 'Juan Pérez',
          contactEmail: 'juan@example.com',
        },
      });
      beneficiaryId = beneficiary.id;
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Familia Pérez',
      email: 'juan@example.com',
      password: 'unaClaveSegura123',
    });

    expect(res.status).toBe(201);

    const beneficiary = await withTenant(tenantId, (tx) =>
      tx.eventBeneficiary.findUniqueOrThrow({ where: { id: beneficiaryId } }),
    );
    expect(beneficiary.accountId).toBe(res.body.user.id);

    const links = await withTenant(tenantId, (tx) =>
      tx.eventAccount.findMany({ where: { userId: res.body.user.id } }),
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.role).toBe('PARTICIPANTE');
    expect(links[0]?.beneficiaryId).toBe(beneficiaryId);
  });

  it('el titular de un egreso queda sin beneficiary (ve solo el agregado)', async () => {
    await withTenant(tenantId, async (tx) => {
      await tx.event.create({
        data: {
          tenantId,
          type: 'EGRESO',
          name: 'Egreso 6to B',
          titularEmail: 'colegio@example.com',
        },
      });
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Comisión 6to B',
      email: 'colegio@example.com',
      password: 'unaClaveSegura123',
    });

    const links = await withTenant(tenantId, (tx) =>
      tx.eventAccount.findMany({ where: { userId: res.body.user.id } }),
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.role).toBe('TITULAR');
    expect(links[0]?.beneficiaryId).toBeNull();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('inicia sesión con credenciales correctas', async () => {
    const app = createApp();
    await request(app).post('/api/v1/auth/register').send({
      fullName: 'Cami Gómez',
      email: 'login-ok@example.com',
      password: 'unaClaveSegura123',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login-ok@example.com', password: 'unaClaveSegura123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login-ok@example.com');
  });

  it('rechaza contraseña incorrecta con un mensaje genérico', async () => {
    const app = createApp();
    await request(app).post('/api/v1/auth/register').send({
      fullName: 'Cami Gómez',
      email: 'login-bad@example.com',
      password: 'unaClaveSegura123',
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login-bad@example.com', password: 'incorrecta' });

    expect(res.status).toBe(401);
  });

  it('rechaza un email que no existe con el mismo mensaje genérico', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'no-existe@example.com', password: 'lo-que-sea' });

    expect(res.status).toBe(401);
  });
});

describe('GET/POST /api/v1/auth/me y /logout', () => {
  it('/me responde 401 sin sesión', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('/me responde el usuario logueado usando la cookie de sesión, y /logout la cierra', async () => {
    const app = createApp();
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/register').send({
      fullName: 'Cami Gómez',
      email: 'sesion@example.com',
      password: 'unaClaveSegura123',
    });

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('sesion@example.com');

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(204);

    const meAfter = await agent.get('/api/v1/auth/me');
    expect(meAfter.status).toBe(401);
  });
});
