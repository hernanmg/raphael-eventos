import type { Prisma, User } from '@prisma/client';
import { withTenant } from '../../db/withTenant';
import { hashPassword, verifyPassword } from '../../lib/password';

export class EmailAlreadyRegisteredError extends Error {}
export class InvalidCredentialsError extends Error {}

interface RegisterParams {
  tenantId: string;
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export async function registerUser(params: RegisterParams): Promise<User> {
  const { tenantId, email, password, fullName, phone } = params;

  return withTenant(tenantId, async (tx) => {
    const existing = await tx.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await hashPassword(password);

    const user = await tx.user.create({
      data: { tenantId, email, passwordHash, fullName, phone, role: 'CLIENTE' },
    });

    await linkPendingEvents(tx, tenantId, email, user.id);

    return user;
  });
}

/**
 * Alta por email (confirmado con el cliente, ver docs/02 y docs/03): el admin
 * carga el email del contratante al crear el evento (Event.titularEmail) o el
 * de cada alumno en un egreso (EventBeneficiary.contactEmail). Al registrarse,
 * se buscan esas coincidencias dentro del tenant y se generan los
 * EventAccount automáticamente.
 *
 * Nota: hoy no hay pantalla de alta de eventos todavía, así que en la
 * práctica esto no encuentra nada — pero la regla de negocio es la misma el
 * día que exista, y queda cubierta por los tests con fixtures.
 */
async function linkPendingEvents(
  tx: Prisma.TransactionClient,
  tenantId: string,
  email: string,
  userId: string,
): Promise<void> {
  const titularEvents = await tx.event.findMany({
    where: { tenantId, titularEmail: email },
    include: { beneficiaries: true },
  });

  for (const event of titularEvents) {
    const alreadyLinked = await tx.eventAccount.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
    });
    if (alreadyLinked) continue;

    // EGRESO: el titular (colegio/comisión) ve el agregado del evento, no el
    // detalle de pago de cada familia -> beneficiaryId null.
    // QUINCE/BODA/EMPRESARIAL: el titular es el único beneficiary del evento.
    const beneficiaryId = event.type === 'EGRESO' ? null : (event.beneficiaries[0]?.id ?? null);

    await tx.eventAccount.create({
      data: { tenantId, eventId: event.id, userId, beneficiaryId, role: 'TITULAR' },
    });
  }

  const pendingBeneficiaries = await tx.eventBeneficiary.findMany({
    where: { tenantId, contactEmail: email, accountId: null },
  });

  for (const beneficiary of pendingBeneficiaries) {
    await tx.eventBeneficiary.update({
      where: { id: beneficiary.id },
      data: { accountId: userId },
    });

    await tx.eventAccount.create({
      data: {
        tenantId,
        eventId: beneficiary.eventId,
        userId,
        beneficiaryId: beneficiary.id,
        role: 'PARTICIPANTE',
      },
    });
  }
}

interface LoginParams {
  tenantId: string;
  email: string;
  password: string;
}

export async function verifyLogin(params: LoginParams): Promise<User> {
  const { tenantId, email, password } = params;

  return withTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
    if (!user) {
      // Mismo error que una contraseña incorrecta: no revelar si el email existe.
      throw new InvalidCredentialsError();
    }

    const valid = await verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new InvalidCredentialsError();
    }

    return user;
  });
}

export async function getUserById(tenantId: string, userId: string): Promise<User | null> {
  return withTenant(tenantId, (tx) => tx.user.findUnique({ where: { id: userId } }));
}

export function toPublicUser(user: User) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
