import type { PublicUser } from '@raphael-eventos/shared';

/**
 * A dónde va un usuario después de loguearse (o si cae en una pantalla que
 * no le corresponde): contraseña temporal sin cambiar → cambiarla primero;
 * empleado de puerta → check-in; el resto → su portal.
 */
export function homePathFor(user: PublicUser): string {
  if (user.mustChangePassword) return '/cambiar-contrasena';
  if (user.role === 'PUERTA') return '/checkin';
  return '/portal';
}
