import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/renderWithProviders';
import LandingPage from './LandingPage';

describe('LandingPage', () => {
  it('el form de cotización arma el mensaje de WhatsApp y abre wa.me', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

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
