import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import App from '../../App';

// Se renderiza <App/> (no el componente solo) porque EventDetailPage depende
// de useParams() para leer :eventId — eso solo se resuelve dentro del árbol
// de <Routes> real, no envolviendo el componente a mano con MemoryRouter.
function mockFetch(eventDetail: unknown) {
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
      // Sección de invitados (Fase 3): se pide aparte del detalle.
      if (url.includes('/guests')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              canManage: false,
              inviteToken: null,
              guests: [],
              attendance: { confirmed: 12, target: 60, targetSource: 'MIN_GUESTS' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/portal/events/')) {
        return Promise.resolve(
          new Response(JSON.stringify({ event: eventDetail }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response('not found', { status: 404 }));
    }),
  );
}

describe('EventDetailPage', () => {
  it('scope "own": muestra el desglose de tarjetas y los pagos', async () => {
    mockFetch({
      eventId: 'ev1',
      type: 'QUINCE',
      name: '15 de Martina',
      eventDate: '2026-12-12T00:00:00.000Z',
      status: 'ACTIVO',
      role: 'TITULAR',
      scope: 'own',
      minGuests: null,
      own: {
        label: null,
        cards: [{ id: 'c1', cardType: 'ADULTO', quantity: 10, unitValue: 1000, subtotal: 10000 }],
        payments: [
          { id: 'p1', amount: 4000, paymentDate: '2026-07-01T00:00:00.000Z', note: 'Seña' },
        ],
        totalValue: 10000,
        totalPaid: 4000,
        saldo: 6000,
        percentPaid: 40,
      },
    });

    renderWithProviders(<App />, { route: '/portal/eventos/ev1' });

    expect(await screen.findByText('15 de Martina')).toBeInTheDocument();
    expect(screen.getByText('Adulto')).toBeInTheDocument();
    expect(screen.getByText('Seña')).toBeInTheDocument();
  });

  it('scope "aggregate": muestra el total general, no el detalle por familia', async () => {
    mockFetch({
      eventId: 'ev2',
      type: 'EGRESO',
      name: 'Egreso 6to A',
      eventDate: null,
      status: 'ACTIVO',
      role: 'TITULAR',
      scope: 'aggregate',
      minGuests: 60,
      aggregate: {
        beneficiaryCount: 2,
        totalValue: 24000,
        totalPaid: 0,
        saldo: 24000,
        percentPaid: 0,
      },
    });

    renderWithProviders(<App />, { route: '/portal/eventos/ev2' });

    expect(await screen.findByText('Egreso 6to A')).toBeInTheDocument();
    expect(screen.getByText(/detalle de pago de cada familia queda privado/)).toBeInTheDocument();
    expect(screen.getByText('Mínimo de invitados contratado: 60')).toBeInTheDocument();
    // Avance real de confirmados (PortalGuestsSection), no la cantidad de alumnos.
    expect(await screen.findByText(/de 60 \(mínimo contratado\)/)).toBeInTheDocument();
  });
});
