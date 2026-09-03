import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

// Por default, toda pantalla se testea "deslogueada": SiteHeader llama a
// useSession() en cada render (pega a /api/v1/auth/me), así que sin este stub
// cada test dispararía una request real. Los tests que necesitan simular una
// sesión activa o un login exitoso pisan este stub con vi.stubGlobal('fetch', ...).
function unauthenticatedFetch() {
  return Promise.resolve(
    new Response(JSON.stringify({ error: { message: 'No autenticado' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(unauthenticatedFetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
});
