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
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (methode === 'GET' && url.includes('/einladungen')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

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

  it('schaltet Sichtbarkeit um, sucht und laedt Benutzer ein und entfernt Einladungen', async () => {
    const user = userEvent.setup();
    let aktuellesWorkout = erzeugeTestWorkout(1, 'Front Lever Fokus');
    let einladungen = [
      {
        id: '33333333-3333-4333-8333-333333333331',
        workoutId: WORKOUT_ID,
        eingeladenerId: '44444444-4444-4444-8444-444444444441',
        eingeladenerBenutzername: 'anna.fit',
        status: 'AKTIV' as const,
        erstelltAm: '2026-11-19T12:00:00Z',
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const methode = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (methode === 'GET' && url.includes('/einladungen')) {
        return new Response(JSON.stringify(einladungen), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (methode === 'GET' && url.includes('/v1/benutzer/suche')) {
        const parsed = new URL(url);
        const name = parsed.searchParams.get('name');
        if (name === 'lisa.kraft') {
          return new Response(
            JSON.stringify({
              id: '44444444-4444-4444-8444-444444444442',
              benutzername: 'lisa.kraft',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ code: 'BENUTZER_NICHT_GEFUNDEN', meldung: 'Benutzer nicht gefunden.' }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        );
      }

      if (methode === 'GET') {
        return new Response(JSON.stringify(aktuellesWorkout), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (methode === 'PATCH' && url.includes('/sichtbarkeit')) {
        const rawBody = input instanceof Request ? await input.text() : String(init?.body ?? '{}');
        const body = JSON.parse(rawBody) as { sichtbarkeit: 'PRIVAT' | 'OEFFENTLICH' };
        aktuellesWorkout = {
          ...aktuellesWorkout,
          sichtbarkeit: body.sichtbarkeit,
          version: aktuellesWorkout.version + 1,
        };
        return new Response(JSON.stringify(aktuellesWorkout), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (methode === 'POST' && url.includes('/einladungen')) {
        const neu = {
          id: '33333333-3333-4333-8333-333333333332',
          workoutId: WORKOUT_ID,
          eingeladenerId: '44444444-4444-4444-8444-444444444442',
          eingeladenerBenutzername: 'lisa.kraft',
          status: 'AKTIV' as const,
          erstelltAm: '2026-11-19T14:00:00Z',
        };
        einladungen = [...einladungen, neu];
        return new Response(JSON.stringify(neu), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (methode === 'DELETE' && url.includes('/einladungen/')) {
        einladungen = einladungen.filter((e) => !url.endsWith(e.eingeladenerId));
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 404 });
    });

    renderDetail(fetchMock as typeof fetch);

    expect(await screen.findByRole('heading', { level: 1, name: 'Front Lever Fokus' })).toBeVisible();
    expect(screen.getByText('anna.fit')).toBeVisible();

    // Sichtbarkeit auf Öffentlich umschalten
    await user.click(screen.getByRole('button', { name: 'Öffentlich' }));
    expect(await screen.findByText(/auf „Öffentlich“ geändert/i)).toBeVisible();

    // Einladungsdialog öffnen -> unbekannter Name liefert 404
    await user.click(screen.getByRole('button', { name: 'Benutzer einladen' }));
    const dialog = screen.getByRole('dialog', { name: 'Benutzer einladen' });
    await user.type(within(dialog).getByLabelText(/Benutzername \(exakt\)/i), 'unbekannt.user');
    await user.click(within(dialog).getByRole('button', { name: 'Suchen' }));
    expect(await within(dialog).findByText('Benutzer nicht gefunden.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Einladen' })).toBeDisabled();

    // Existierenden Benutzer suchen -> Vorschau prüfen -> einladen
    await user.clear(within(dialog).getByLabelText(/Benutzername \(exakt\)/i));
    await user.type(within(dialog).getByLabelText(/Benutzername \(exakt\)/i), 'Lisa.Kraft');
    await user.click(within(dialog).getByRole('button', { name: 'Suchen' }));
    expect(await within(dialog).findByText('lisa.kraft')).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Einladen' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Benutzer einladen' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('lisa.kraft')).toBeVisible();

    // Einladung entfernen
    await user.click(screen.getByRole('button', { name: 'Einladung für anna.fit entfernen' }));
    await waitFor(() => {
      expect(screen.queryByText('anna.fit')).not.toBeInTheDocument();
    });
  });

  it('zeigt fremde lesbare Workouts sauber schreibgeschuetzt ohne Bearbeiten- oder Einladen-Steuerung', async () => {
    const fremdesWorkout = erzeugeTestWorkout(1, 'Fremdes Geteiltes Workout');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/einladungen')) {
        return new Response(null, { status: 403 });
      }
      return new Response(JSON.stringify(fremdesWorkout), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    renderDetail(fetchMock as typeof fetch);

    expect(await screen.findByRole('heading', { level: 1, name: 'Fremdes Geteiltes Workout' })).toBeVisible();
    expect(screen.getByText('Schreibgeschützt')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Benutzer einladen' })).not.toBeInTheDocument();
  });
});
