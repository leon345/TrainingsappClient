import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1, type WorkoutV1 } from '../api/client';
import { AuthProvider } from '../konto/AuthContext';
import { ProfilSeite } from './ProfilSeite';

const TEST_BENUTZER: BenutzerV1 = {
  id: '11111111-1111-4111-8111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T10:00:00Z',
  einwilligungAm: '2026-11-19T10:00:00Z',
};

const PROFIL_ID = '44444444-4444-4444-8444-444444444441';

const OEFFENTLICHES_WORKOUT: WorkoutV1 = {
  id: '66666666-6666-4666-8666-666666666661',
  typ: 'KRAFT',
  titel: 'Öffentliches Beintraining',
  startZeit: '2026-11-19T15:00:00Z',
  dauerSekunden: 3600,
  sichtbarkeit: 'OEFFENTLICH',
  herkunft: 'MANUELL',
  erstelltAm: '2026-11-19T15:00:00Z',
  geaendertAm: '2026-11-19T15:00:00Z',
  version: 1,
  uebungen: [
    {
      id: 'u-1',
      position: 0,
      name: 'Kniebeugen',
      saetze: [{ id: 's-1', position: 0, wiederholungen: 5, gewichtKg: 100 }],
    },
  ],
};

function renderProfil(fetchMock: typeof fetch, initialStatus?: 'angemeldet' | 'abgemeldet') {
  const client = erzeugeApiClient({
    baseUrl: 'http://localhost',
    fetch: fetchMock,
  });

  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: `/profil/${PROFIL_ID}`, state: { benutzername: 'anna.fit' } },
      ]}
    >
      <AuthProvider
        client={client}
        initialBenutzer={initialStatus === 'abgemeldet' ? null : TEST_BENUTZER}
        initialStatus={initialStatus}
        automatischLaden={false}
      >
        <Routes>
          <Route path="/profil/:benutzerId" element={<ProfilSeite />} />
          <Route path="/workouts/:id" element={<div>Workout-Detail</div>} />
          <Route path="/entdecken" element={<div>Entdecken</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProfilSeite', () => {
  it('zeigt im abgemeldeten Zustand den Anmeldehinweis', () => {
    renderProfil(vi.fn() as typeof fetch, 'abgemeldet');
    expect(screen.getByText(/Anmeldung erforderlich/i)).toBeVisible();
  });

  it('zeigt oeffentliche Workouts eines Profils mit Link zum Workout', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([OEFFENTLICHES_WORKOUT]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderProfil(fetchMock as typeof fetch);

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil: anna.fit' })).toBeVisible();
    expect(await screen.findByText('Öffentliches Beintraining')).toBeVisible();
    expect(screen.getByText('1:00:00')).toBeVisible();
    expect(screen.getByRole('link', { name: /Öffentliches Beintraining/i })).toHaveAttribute(
      'href',
      `/workouts/${OEFFENTLICHES_WORKOUT.id}`,
    );
  });

  it('zeigt einen klaren Leerzustand bei Profil ohne oeffentliche Workouts', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    renderProfil(fetchMock as typeof fetch);

    expect(
      await screen.findByText(/aktuell keine öffentlichen Workouts freigegeben/i),
    ).toBeVisible();
  });

  it('zeigt bei 404 und 403 klare Hinweise', async () => {
    const fetch404 = vi.fn(async () =>
      new Response(
        JSON.stringify({ code: 'BENUTZER_NICHT_GEFUNDEN', meldung: 'Profil existiert nicht.' }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { unmount } = renderProfil(fetch404 as typeof fetch);
    expect(await screen.findByRole('heading', { level: 2, name: 'Profil nicht gefunden' })).toBeVisible();
    expect(screen.getByText('Profil existiert nicht.')).toBeVisible();
    unmount();

    const fetch403 = vi.fn(async () => new Response(null, { status: 403 }));
    renderProfil(fetch403 as typeof fetch);
    expect(await screen.findByText(/keine Berechtigung/i)).toBeVisible();
  });
});
