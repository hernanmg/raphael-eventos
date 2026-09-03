import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import PortalEventsPage from './PortalEventsPage';

function mockFetch(events: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/me')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: '1',
                email: 'demo@raphaeleventos.com',
                fullName: 'Demo',
                role: 'CLIENTE',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/portal/events')) {
        return Promise.resolve(
          new Response(JSON.stringify({ events }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response('not found', { status: 404 }));
    }),
  );
}

describe('PortalEventsPage', () => {
  it('muestra el estado vacío cuando el usuario no tiene eventos vinculados', async () => {
    mockFetch([]);
    renderWithProviders(<PortalEventsPage />);

    expect(await screen.findByText(/Todavía no tenés eventos vinculados/)).toBeInTheDocument();
  });

  it('lista los eventos con su saldo y % abonado, con link al detalle', async () => {
    mockFetch([
      {
        eventId: 'ev1',
        type: 'QUINCE',
        name: '15 de Martina',
        eventDate: '2026-12-12T00:00:00.000Z',
        status: 'ACTIVO',
        role: 'TITULAR',
        scope: 'own',
        totalValue: 100000,
        totalPaid: 40000,
        saldo: 60000,
        percentPaid: 40,
        minGuests: null,
      },
    ]);
    renderWithProviders(<PortalEventsPage />);

    expect(await screen.findByText('15 de Martina')).toBeInTheDocument();
    expect(screen.getByText('40% abonado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /15 de Martina/ })).toHaveAttribute(
      'href',
      '/portal/eventos/ev1',
    );
  });
});
