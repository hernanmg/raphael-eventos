import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import HelpPage from './HelpPage';

describe('HelpPage', () => {
  it('lista todas las funcionalidades por default', () => {
    renderWithProviders(<HelpPage />);

    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis eventos' })).toHaveAttribute('href', '/portal');
    expect(screen.getByRole('link', { name: 'Saldo y tarjetas de un evento' })).toHaveAttribute(
      'href',
      '/portal',
    );
  });

  it('el buscador encuentra "saldo y tarjetas" buscando "ipc"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.type(screen.getByLabelText('Buscar una funcionalidad'), 'ipc');

    expect(screen.getByRole('link', { name: 'Saldo y tarjetas de un evento' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mis eventos' })).not.toBeInTheDocument();
  });

  it('el buscador filtra por título, propósito o keywords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.type(screen.getByLabelText('Buscar una funcionalidad'), 'contraseña');

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument();
  });

  it('muestra un mensaje cuando la búsqueda no matchea nada', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HelpPage />);

    await user.type(screen.getByLabelText('Buscar una funcionalidad'), 'algo-que-no-existe');

    expect(
      screen.getByText('No encontramos funcionalidades que coincidan con tu búsqueda.'),
    ).toBeInTheDocument();
  });
});
