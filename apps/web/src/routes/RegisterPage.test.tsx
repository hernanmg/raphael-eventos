import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import App from '../App';

describe('RegisterPage', () => {
  it('muestra errores de validación (nombre corto, contraseña corta) sin llamar a la API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/registro' });

    await user.type(screen.getByLabelText('Nombre completo'), 'X');
    await user.type(screen.getByLabelText('Email'), 'cami@example.com');
    await user.type(screen.getByLabelText('Contraseña'), '123');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Ingresá tu nombre completo')).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument();
  });

  it('enlaza a login para quien ya tiene cuenta', async () => {
    renderWithProviders(<App />, { route: '/registro' });

    expect(await screen.findByRole('link', { name: 'Ingresá acá' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
