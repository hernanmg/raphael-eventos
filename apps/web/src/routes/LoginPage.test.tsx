import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import App from '../App';

describe('LoginPage', () => {
  it('muestra errores de validación sin llegar a pegarle a la API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), 'no-es-un-email');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
  });

  it('con credenciales correctas guarda la sesión y redirige a /portal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/login')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                user: { id: '1', email: 'cami@example.com', fullName: 'Cami', role: 'CLIENTE' },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'No autenticado' } }), { status: 401 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), 'cami@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'unaClaveSegura123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hola, Cami' })).toBeInTheDocument();
    });
  });

  it('con credenciales incorrectas muestra el mensaje de error del servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/login')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: 'Email o contraseña incorrectos' } }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: 'No autenticado' } }), { status: 401 }),
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), 'cami@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Email o contraseña incorrectos')).toBeInTheDocument();
  });
});
