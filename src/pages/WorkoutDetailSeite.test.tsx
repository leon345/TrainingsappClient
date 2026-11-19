import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1, type WorkoutV1 } from '../api/client';
import { AuthProvider } from '../konto/AuthContext';
import { WorkoutDetailSeite } from './WorkoutDetailSeite';

const TEST_BENUTZER: BenutzerV1 = {
  id: '11111111-1111-4111-8111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T10:00:00Z',
  einwilligungAm: '2026-11-19T10:00:00Z',
};

const WORKOUT_ID = '22222222-2222-4222-8222-222222222221';

function erzeugeTestWorkout(version = 1, titel = 'Front Lever Fokus'): WorkoutV1 {
  return {
    id: WORKOUT_ID,
    typ: 'CALISTHENICS',
    titel,
    startZeit: '2026-11-19T17:30:00Z',
    dauerSekunden: 2700,
    notiz: 'Saubere Technik',
    sichtbarkeit: 'PRIVAT',
    herkunft: 'MANUELL',
    erstelltAm: '2026-11-19T17:30:00Z',
    geaendertAm: '2026-11-19T18:15:00Z',
    version,
    uebungen: [
      {
        id: 'u-1',
        position: 0,
        name: 'Front Lever',
        variante: 'Tuck',
        saetze: [
          { id: 's-1', position: 0, dauerSekunden: 25, pauseSekunden: 90 },
          { id: 's-2', position: 1, wiederholungen: 6, gewichtKg: 5 },
        ],
      },
    ],
  };
}

function renderDetail(fetchMock: typeof fetch, initialStatus?: 'angemeldet' | 'abgemeldet') {
  const client = erzeugeApiClient({
    baseUrl: 'http://localhost',
    fetch: fetchMock,
  });

  return render(
    <MemoryRouter initialEntries={[`/workouts/${WORKOUT_ID}`]}>
      <AuthProvider
        client={client}
        initialBenutzer={initialStatus === 'abgemeldet' ? null : TEST_BENUTZER}
        initialStatus={initialStatus}
        automatischLaden={false}
      >
        <Routes>
          <Route path="/workouts/:id" element={<WorkoutDetailSeite />} />
          <Route path="/workouts" element={<div>Workouts-Übersicht-Ziel</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('WorkoutDetailSeite', () => {
  it('zeigt Details inkl. Variante und Zeitdauern, behandelt 409-Konflikt mit Neu laden und loescht per Dialog', async () => {
    const user = userEvent.setup();
    let aktuellesWorkout = erzeugeTestWorkout(1, 'Front Lever Fokus');
    let naechsterPutKonflikt = true;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const methode = init?.method ?? (input instanceof Request ? input.method : 'GET');

      if (methode === 'GET') {
        return new Response(JSON.stringify(aktuellesWorkout), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (methode === 'PUT') {
        if (naechsterPutKonflikt) {
          naechsterPutKonflikt = false;
          aktuellesWorkout = erzeugeTestWorkout(2, 'Front Lever (Server-Version)');
          return new Response(
            JSON.stringify({
              code: 'WORKOUT_VERSIONSKONFLIKT',
              meldung: 'Das Workout wurde zwischenzeitlich geändert. Bitte neu laden.',
            }),
            { status: 409, headers: { 'content-type': 'application/json' } },
          );
        }

        const rawBody = input instanceof Request ? await input.text() : String(init?.body ?? '{}');
        const body = JSON.parse(rawBody) as { titel: string; version: number };
        aktuellesWorkout = {
          ...aktuellesWorkout,
          titel: body.titel,
          version: body.version + 1,
        };
        return new Response(JSON.stringify(aktuellesWorkout), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (methode === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    });

    renderDetail(fetchMock as typeof fetch);

    // Detailansicht prüfen
    expect(await screen.findByRole('heading', { level: 1, name: 'Front Lever Fokus' })).toBeVisible();
    expect(screen.getByText('Tuck')).toBeVisible();
    expect(screen.getByText('45:00')).toHaveAttribute('aria-label', '45 Minuten');
    expect(screen.getByText('00:25')).toBeVisible();
    expect(screen.getByText('5 kg')).toBeVisible();

    // Bearbeiten -> 409 Versionskonflikt -> Neu laden -> erneut speichern
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    const titelFeld = screen.getByLabelText(/^Titel/i);
    await user.clear(titelFeld);
    await user.type(titelFeld, 'Geänderter Titel');
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    const konfliktAlert = await screen.findByRole('alert');
    expect(konfliktAlert).toHaveTextContent(/zwischenzeitlich geändert/i);

    await user.click(within(konfliktAlert).getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^Titel/i)).toHaveValue('Front Lever (Server-Version)');
    });

    await user.clear(screen.getByLabelText(/^Titel/i));
    await user.type(screen.getByLabelText(/^Titel/i), 'Finaler Titel');
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Finaler Titel' })).toBeVisible();
    expect(screen.getByText(/Änderungen wurden gespeichert/i)).toBeVisible();

    // Löschen per Bestätigungsdialog
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    const dialog = screen.getByRole('dialog', { name: 'Workout löschen?' });
    expect(dialog).toHaveTextContent('Finaler Titel');

    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByText('Workouts-Übersicht-Ziel')).toBeVisible();
  });

  it('zeigt bei 404 WORKOUT_NICHT_GEFUNDEN eine klare Fehlermeldung', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          code: 'WORKOUT_NICHT_GEFUNDEN',
          meldung: 'Workout wurde nicht gefunden.',
        }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      ),
    );

    renderDetail(fetchMock as typeof fetch);

    expect(await screen.findByRole('heading', { level: 1, name: 'Workout nicht gefunden' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Workout wurde nicht gefunden.');
  });

  it('zeigt im abgemeldeten Zustand den Konto-Hinweis', () => {
    renderDetail(vi.fn() as typeof fetch, 'abgemeldet');
    expect(screen.getByText(/Anmeldung erforderlich/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /Zum Konto & Anmelden/i })).toHaveAttribute('href', '/konto');
  });
});
