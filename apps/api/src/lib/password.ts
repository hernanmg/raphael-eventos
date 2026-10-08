import { randomInt } from 'node:crypto';
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

// Sin caracteres ambiguos (0/O, 1/l/I): se dicta en persona o se copia a un mail.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Contraseña temporal para el acceso de un empleado PUERTA (Fase 3). 12
 * caracteres de un alfabeto de 56 (~70 bits) con crypto.randomInt — de un
 * solo uso: el usuario queda con mustChangePassword hasta reemplazarla.
 */
export function generateTemporaryPassword(length = 12): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}
