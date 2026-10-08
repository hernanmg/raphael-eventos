import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Quién está operando, para la auditoría (Fase 4). Viaja en un contexto por
 * request (AsyncLocalStorage) que carga requireRole, en vez de agregar un
 * parámetro `actor` a cada service — la mayoría solo recibe tenantId.
 */
export interface Actor {
  /** null = sistema (crons) o desconocido. */
  userId: string | null;
  /** Foto del nombre/email al momento — el log no depende de un join a User. */
  label: string;
}

export const SYSTEM_ACTOR: Actor = { userId: null, label: 'Sistema (automático)' };

const storage = new AsyncLocalStorage<{ actor: Actor }>();

export function runWithActor<T>(actor: Actor, fn: () => T): T {
  return storage.run({ actor }, fn);
}

export function currentActor(): Actor {
  return storage.getStore()?.actor ?? { userId: null, label: 'Desconocido' };
}

export function actorFromUser(user: { id: string; fullName: string; email: string }): Actor {
  return { userId: user.id, label: `${user.fullName} (${user.email})` };
}
