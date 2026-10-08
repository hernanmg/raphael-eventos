import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import LandingPage from './LandingPage';

// WhatsApp/Instagram/dirección salen de GET /public/salon (Tenant), ya no
// están hardcodeados — el resto de las requests sigue "deslogueado" (401).
function salonFetch(input: RequestInfo | URL) {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.endsWith('/api/v1/public/salon')) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          salon: {
            name: 'Raphael Eventos',
            whatsappNumber: '5493513180810',
            instagramUrl: 'https://www.instagram.com/raphael.eventos/',
            address: 'Córdoba, Argentina',
            mapsUrl: null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }
  return Promise.resolve(
    new Response(JSON.stringify({ error: { message: 'No autenticado' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('LandingPage', () => {
  it('el form de cotización arma el mensaje de WhatsApp y abre wa.me', async () => {
    vi.stubGlobal('fetch', vi.fn(salonFetch));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    // Espera a que cargue el perfil del salón (el número sale de ahí).
    expect(await screen.findByRole('link', { name: 'WhatsApp · 351 318-0810' })).toHaveAttribute(
      'href',
      'https://wa.me/5493513180810',
    );

    await user.type(screen.getByLabelText('Nombre y apellido'), 'Cami Gómez');
    await user.type(screen.getByLabelText('WhatsApp'), '351 555 1234');
    await user.selectOptions(screen.getByLabelText('Tipo de evento'), 'Boda');
    await user.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain('https://wa.me/5493513180810?text=');
    expect(decodeURIComponent(url)).toContain('Cami Gómez');
    expect(decodeURIComponent(url)).toContain('Boda');

    openSpy.mockRestore();
  });

  it('el botón de iniciar sesión del header apunta a /login (ya no abre el modal de demo)', () => {
    renderWithProviders(<LandingPage />);

    const loginLinks = screen.getAllByRole('link', { name: 'Iniciar sesión' });
    expect(loginLinks.length).toBeGreaterThan(0);
    for (const link of loginLinks) {
      expect(link).toHaveAttribute('href', '/login');
    }
  });
});
