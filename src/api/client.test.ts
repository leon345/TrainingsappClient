import { describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, extrahiereFehlermeldung, istFehlerV1 } from './client';

describe('apiClient (openapi-fetch)', () => {
  it('ruft GET /v1/info typisiert mit credentials same-origin auf', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          name: 'trainingsapp-server',
          version: '0.1.0',
          zeitstempel: '2026-11-19T12:00:00Z',
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
      version: '0.1.0',
      zeitstempel: '2026-11-19T12:00:00Z',
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
    expect(extrahiereFehlermeldung(ergebnis.error)).toBe('Anmeldung erforderlich.');
  });

  it('liefert eine sinnvolle Standardmeldung fuer unbekannte Fehler', () => {
    expect(istFehlerV1(null)).toBe(false);
    expect(istFehlerV1({ code: 'OHNE_MELDUNG' })).toBe(false);
    expect(extrahiereFehlermeldung(new Error('Zeitueberschreitung'))).toBe('Zeitueberschreitung');
    expect(extrahiereFehlermeldung({ unerwartet: true })).toBe(
      'Unbekannter Fehler bei der Serveranfrage.',
    );
  });
});
