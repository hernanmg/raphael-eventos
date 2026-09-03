import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './test/renderWithProviders';
import App from './App';

describe('App', () => {
  it('la home es la landing: hero + link a login', async () => {
    renderWithProviders(<App />);

    expect(await screen.findByText('Salón de eventos · Córdoba')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' }).length).toBeGreaterThan(0);
  });

  it('/portal redirige a /login cuando no hay sesión activa', async () => {
    renderWithProviders(<App />, { route: '/portal' });

    expect(await screen.findByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeInTheDocument();
  });
});
