import { hash, verify } from '@node-rs/argon2';

// Parámetros recomendados por OWASP para argon2id (coinciden con los defaults
// del paquete, pero se dejan explícitos para no depender en silencio de que
// no cambien en una futura versión). Compartido entre el servicio de auth y
// el seed, para que el usuario demo se hashee exactamente igual que uno real.
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(hashed: string, password: string): Promise<boolean> {
  return verify(hashed, password);
}
