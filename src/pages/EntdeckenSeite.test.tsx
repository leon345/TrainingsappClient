import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1, type GeteiltesWorkoutV1 } from '../api/client';
import { AuthProvider } from '../konto/AuthContext';
import { EntdeckenSeite } from './EntdeckenSeite';

const TEST_BENUTZER: BenutzerV1 = {
  id: '11111111-1111-4111-8111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T10:00:00Z',
  einwilligungAm: '2026-11-19T10:00:00Z',
};

const GETEILTES_WORKOUT: GeteiltesWorkoutV1 = {
  id: '55555555-5555-4555-8555-555555555551',
  ownerId: '44444444-4444-4444-8444-444444444441',
  ownerBenutzername: 'anna.fit',
  typ: 'CALISTHENICS',
  titel: 'Annas Ring-Training',
  startZeit: '2026-11-19T16:00:00Z',
  dauerSekunden: 2700,
  sichtbarkeit: 'PRIVAT',
  herkunft: 'MANUELL',
  erstelltAm: '2026-11-19T16:00:00Z',
  geaendertAm: '2026-11-19T16:00:00Z',
  version: 1,
  eingeladenAm: '2026-11-19T17:00:00Z',
  uebungen: [
    {
      id: 'u-1',
      position: 0,
      name: 'Ring Dips',
      saetze: [{ id: 's-1', position: 0, wiederholungen: 10 }],
    },
  ],
};

function renderEntdecken(fetchMock: typeof fetch, initialStatus?: 'angemeldet' | 'abgemeldet') {
  const client = erzeugeApiClient({
    baseUrl: 'http://localhost',
    fetch: fetchMock,
  });

  return render(
    <MemoryRouter initialEntries={['/entdecken']}>
      <AuthProvider
        client={client}
        initialBenutzer={initialStatus === 'abgemeldet' ? null : TEST_BENUTZER}
        initialStatus={initialStatus}
        automatischLaden={false}
      >
        <Routes>
          <Route path="/entdecken" element={<EntdeckenSeite />} />
          <Route path="/profil/:benutzerId" element={<div>Profil-Ziel</div>} />
          <Route path="/workouts/:id" element={<div>Workout-Detail-Ziel</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('EntdeckenSeite', () => {
  it('zeigt im abgemeldeten Zustand den Anmeldehinweis mit Link zu /konto', () => {
    renderEntdecken(vi.fn() as typeof fetch, 'abgemeldet');

    expect(screen.getByText(/Anmeldung erforderlich/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /Zum Konto & Anmelden/i })).toHaveAttribute(
      'href',
      '/konto',
    );
  });

  it('laedt geteilte Workouts und sucht oeffentliche Profile per exaktem Benutzernamen', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes('/v1/workouts/geteilt')) {
        return new Response(JSON.stringify([GETEILTES_WORKOUT]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/v1/benutzer/suche')) {
        const name = new URL(url).searchParams.get('name');
        if (name === 'anna.fit') {
          return new Response(
            JSON.stringify({
              id: '44444444-4444-4444-8444-444444444441',
              benutzername: 'anna.fit',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ code: 'BENUTZER_NICHT_GEFUNDEN', meldung: 'Benutzer nicht gefunden.' }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(null, { status: 404 });
    });

    renderEntdecken(fetchMock as typeof fetch);

    // Geteilte Workouts prüfen
    expect(await screen.findByText('Annas Ring-Training')).toBeVisible();
    expect(screen.getByText('Von anna.fit')).toBeVisible();
    expect(screen.getByText('45:00')).toBeVisible();

    // Unbekannter Benutzer -> 404 Meldung
    await user.type(screen.getByLabelText(/Benutzername \(exakt\)/i), 'gibts.nicht');
    await user.click(screen.getByRole('button', { name: 'Profil suchen' }));
    expect(await screen.findByText('Benutzer nicht gefunden.')).toBeVisible();

    // Existierender Benutzer -> Link zu /profil/:id
    await user.clear(screen.getByLabelText(/Benutzername \(exakt\)/i));
    await user.type(screen.getByLabelText(/Benutzername \(exakt\)/i), 'Anna.Fit');
    await user.click(screen.getByRole('button', { name: 'Profil suchen' }));

    const profilLink = await screen.findByRole('link', { name: 'Öffentliches Profil ansehen' });
    expect(profilLink).toHaveAttribute('href', '/profil/44444444-4444-4444-8444-444444444441');
  });
});
