import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1, type WorkoutV1 } from '../api/client';
import { AuthProvider } from '../konto/AuthContext';
import { WorkoutsSeite } from './WorkoutsSeite';

const TEST_BENUTZER: BenutzerV1 = {
  id: '11111111-1111-4111-8111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T10:00:00Z',
  einwilligungAm: '2026-11-19T10:00:00Z',
};

const WORKOUTS_BEISPIEL: WorkoutV1[] = [
  {
    id: '22222222-2222-4222-8222-222222222221',
    typ: 'KRAFT',
    titel: 'Oberkörper Kraft',
    startZeit: '2026-11-19T17:00:00Z',
    dauerSekunden: 3600,
    sichtbarkeit: 'PRIVAT',
    herkunft: 'MANUELL',
    erstelltAm: '2026-11-19T17:00:00Z',
    geaendertAm: '2026-11-19T17:00:00Z',
    version: 1,
    uebungen: [
      {
        id: 'u-1',
        position: 0,
        name: 'Bankdrücken',
        saetze: [{ id: 's-1', position: 0, wiederholungen: 8, gewichtKg: 70 }],
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    typ: 'CALISTHENICS',
    titel: 'Statics & Pull',
    startZeit: '2026-11-18T16:00:00Z',
    dauerSekunden: 2700,
    sichtbarkeit: 'OEFFENTLICH',
    herkunft: 'MANUELL',
    erstelltAm: '2026-11-18T16:00:00Z',
    geaendertAm: '2026-11-18T16:00:00Z',
    version: 1,
    uebungen: [
      {
        id: 'u-2',
        position: 0,
        name: 'Front Lever',
        variante: 'Tuck',
        saetze: [{ id: 's-2', position: 0, dauerSekunden: 20 }],
      },
      {
        id: 'u-3',
        position: 1,
        name: 'Klimmzüge',
        saetze: [{ id: 's-3', position: 0, wiederholungen: 10 }],
      },
    ],
  },
];

describe('WorkoutsSeite', () => {
  it('zeigt im abgemeldeten Zustand einen Hinweis mit Link zum Konto', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialStatus="abgemeldet" automatischLaden={false}>
          <WorkoutsSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();
    expect(screen.getByText(/Anmeldung erforderlich/i)).toBeVisible();
    const kontoLink = screen.getByRole('link', { name: /Zum Konto & Anmelden/i });
    expect(kontoLink).toHaveAttribute('href', '/konto');
  });

  it('listet eigene Workouts formatiert auf und filtert nach Typ', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
      const typ = url.searchParams.get('typ');
      const gefiltert = typ
        ? WORKOUTS_BEISPIEL.filter((w) => w.typ === typ)
        : WORKOUTS_BEISPIEL;

      return new Response(JSON.stringify(gefiltert), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const client = erzeugeApiClient({
      baseUrl: 'http://localhost',
      fetch: fetchMock as typeof fetch,
    });

    render(
      <MemoryRouter>
        <AuthProvider client={client} initialBenutzer={TEST_BENUTZER} automatischLaden={false}>
          <WorkoutsSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Oberkörper Kraft')).toBeVisible();
    expect(screen.getByText('Statics & Pull')).toBeVisible();
    expect(screen.getByText('19.11.2026')).toBeVisible();
    expect(screen.getByText('1:00:00')).toHaveAttribute('aria-label', '1 Stunde');
    expect(screen.getByText('45:00')).toHaveAttribute('aria-label', '45 Minuten');
    expect(screen.getByText('1 Übung')).toBeVisible();
    expect(screen.getByText('2 Übungen')).toBeVisible();
    expect(screen.getByText('Privat')).toBeVisible();
    expect(screen.getByText('Öffentlich')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Calisthenics' }));

    await waitFor(() => {
      expect(screen.queryByText('Oberkörper Kraft')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Statics & Pull')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Kraft' }));
    await waitFor(() => {
      expect(screen.queryByText('Statics & Pull')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Oberkörper Kraft')).toBeVisible();
  });
});
