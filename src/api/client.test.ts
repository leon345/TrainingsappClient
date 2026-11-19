import { describe, expect, it, vi } from 'vitest';
import {
  erzeugeApiClient,
  extrahiereFehlermeldung,
  istBenutzerV1,
  istFehlerV1,
  istTimerEinstellungV1,
  istWorkoutV1,
} from './client';

describe('apiClient (openapi-fetch)', () => {
  it('ruft GET /v1/info typisiert mit credentials same-origin auf', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          name: 'trainingsapp-server',
          version: '0.1.0-SNAPSHOT',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const client = erzeugeApiClient({
      baseUrl: 'http://localhost:4173',
      fetch: mockFetch,
    });
    const ergebnis = await client.GET('/v1/info');

    expect(ergebnis.error).toBeUndefined();
    expect(ergebnis.data).toEqual({
      name: 'trainingsapp-server',
      version: '0.1.0-SNAPSHOT',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const request = mockFetch.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (request instanceof Request) {
      expect(request.url).toMatch(/\/v1\/info$/);
      expect(request.credentials).toBe('same-origin');
    }
  });

  it('wertet FehlerV1 bei 401 sauber aus', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          code: 'NICHT_ANGEMELDET',
          meldung: 'Anmeldung erforderlich.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const client = erzeugeApiClient({
      baseUrl: 'http://localhost:4173',
      fetch: mockFetch,
    });
    const ergebnis = await client.GET('/v1/info');

    expect(ergebnis.data).toBeUndefined();
    expect(ergebnis.response.status).toBe(401);
    expect(istFehlerV1(ergebnis.error)).toBe(true);
    expect(extrahiereFehlermeldung(ergebnis.error, undefined, ergebnis.response)).toBe(
      'Anmeldung erforderlich.',
    );
  });

  it('beruecksichtigt HTTP 429 mit Retry-After-Header bei FehlerV1 und ohne Body', async () => {
    const antwortMitBody = new Response(
      JSON.stringify({
        code: 'ZU_VIELE_ANFRAGEN',
        meldung: 'Zu viele Versuche.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '45',
        },
      },
    );

    expect(
      extrahiereFehlermeldung(
        { code: 'ZU_VIELE_ANFRAGEN', meldung: 'Zu viele Versuche.' },
        undefined,
        antwortMitBody,
      ),
    ).toBe('Zu viele Versuche. Bitte warte 45 Sekunden und versuche es erneut.');

    const antwortOhneBody = new Response(null, {
      status: 429,
      headers: { 'Retry-After': '1' },
    });
    expect(extrahiereFehlermeldung(undefined, undefined, antwortOhneBody)).toBe(
      'Zu viele Anfragen. Bitte warte 1 Sekunde und versuche es erneut.',
    );
  });

  it('unterstuetzt typisiertes GET und PUT /v1/timer/einstellung', async () => {
    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.method === 'GET') {
        return new Response(
          JSON.stringify({ trainingSekunden: 45, pauseSekunden: 15, gespeichert: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      const body = (await request.json()) as { trainingSekunden: number; pauseSekunden: number };
      return new Response(JSON.stringify({ ...body, gespeichert: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = erzeugeApiClient({
      baseUrl: 'http://localhost:4173',
      fetch: mockFetch,
    });

    const geladen = await client.GET('/v1/timer/einstellung');
    expect(istTimerEinstellungV1(geladen.data)).toBe(true);
    expect(geladen.data).toEqual({ trainingSekunden: 45, pauseSekunden: 15, gespeichert: true });

    const gespeichert = await client.PUT('/v1/timer/einstellung', {
      body: { trainingSekunden: 60, pauseSekunden: 20 },
    });
    expect(gespeichert.data).toEqual({
      trainingSekunden: 60,
      pauseSekunden: 20,
      gespeichert: true,
    });
  });

  it('prueft BenutzerV1-Struktur und liefert sinnvolle Fallback-Meldungen', () => {
    expect(istFehlerV1(null)).toBe(false);
    expect(istFehlerV1({ code: 'OHNE_MELDUNG' })).toBe(false);
    expect(
      istBenutzerV1({
        id: '11111111-1111-1111-1111-111111111111',
        benutzername: 'max.muster',
        rolle: 'USER',
        erstelltAm: '2026-11-19T12:00:00Z',
        einwilligungAm: '2026-11-19T12:00:00Z',
      }),
    ).toBe(true);
    expect(istBenutzerV1('<html></html>')).toBe(false);
    expect(extrahiereFehlermeldung(new Error('Zeitueberschreitung'))).toBe('Zeitueberschreitung');
    expect(extrahiereFehlermeldung(new TypeError('Failed to fetch'))).toBe(
      'Der Server ist derzeit nicht erreichbar. Bitte prüfe deine Verbindung.',
    );
    expect(extrahiereFehlermeldung({ unerwartet: true })).toBe(
      'Unbekannter Fehler bei der Serveranfrage.',
    );
  });

  it('unterstuetzt typisierte /v1/workouts-Aufrufe und prueft WorkoutV1-Struktur', async () => {
    const beispielWorkout = {
      id: '22222222-2222-4222-8222-222222222222',
      typ: 'CALISTHENICS' as const,
      titel: 'Oberkörper Calisthenics',
      startZeit: '2026-11-19T18:00:00Z',
      dauerSekunden: 2700,
      notiz: 'Gute Spannung',
      sichtbarkeit: 'PRIVAT' as const,
      herkunft: 'MANUELL' as const,
      uebungen: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          position: 0,
          name: 'Front Lever',
          variante: 'Tuck',
          saetze: [
            {
              id: '44444444-4444-4444-8444-444444444444',
              position: 0,
              dauerSekunden: 20,
              pauseSekunden: 90,
            },
          ],
        },
      ],
      erstelltAm: '2026-11-19T18:00:00Z',
      geaendertAm: '2026-11-19T18:00:00Z',
      version: 0,
    };

    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.method === 'GET' && request.url.includes('typ=CALISTHENICS')) {
        return new Response(JSON.stringify([beispielWorkout]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(beispielWorkout), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = erzeugeApiClient({
      baseUrl: 'http://localhost:4173',
      fetch: mockFetch,
    });

    const liste = await client.GET('/v1/workouts', {
      params: { query: { typ: 'CALISTHENICS' } },
    });
    expect(liste.response.status).toBe(200);
    expect(liste.data).toHaveLength(1);
    expect(istWorkoutV1(liste.data?.[0])).toBe(true);
    expect(istWorkoutV1({ id: 'nur-id' })).toBe(false);
  });
});
