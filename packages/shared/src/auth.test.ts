import { describe, expect, it } from 'vitest';
import { LoginSchema, RegisterSchema } from './auth';

describe('RegisterSchema', () => {
  it('normaliza el email a minúsculas', () => {
    const parsed = RegisterSchema.parse({
      fullName: 'Cami Gómez',
      email: 'Cami@RaphaelEventos.com',
      password: 'unaClaveSegura123',
    });
    expect(parsed.email).toBe('cami@raphaeleventos.com');
  });

  it('rechaza contraseñas cortas', () => {
    expect(() =>
      RegisterSchema.parse({ fullName: 'Cami', email: 'cami@x.com', password: '123' }),
    ).toThrow();
  });

  it('acepta phone vacío (como llega de un <input> sin tocar) y lo deja undefined', () => {
    const parsed = RegisterSchema.parse({
      fullName: 'Cami Gómez',
      email: 'cami@x.com',
      phone: '',
      password: 'unaClaveSegura123',
    });
    expect(parsed.phone).toBeUndefined();
  });

  it('sigue rechazando un phone corto cuando sí se cargó algo', () => {
    expect(() =>
      RegisterSchema.parse({
        fullName: 'Cami Gómez',
        email: 'cami@x.com',
        phone: '123',
        password: 'unaClaveSegura123',
      }),
    ).toThrow();
  });
});

describe('LoginSchema', () => {
  it('exige email válido', () => {
    expect(() => LoginSchema.parse({ email: 'no-es-un-email', password: 'x' })).toThrow();
  });
});
