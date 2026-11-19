import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1 } from '../api/client';
import { AuthProvider, useAuth } from './AuthContext';

const BEISPIEL_BENUTZER: BenutzerV1 = {
  id: '11111111-1111-1111-1111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T12:00:00Z',
  einwilligungAm: '2026-11-19T12:00:00Z',
};

function TestKonsument() {
  const { status, benutzer, fehlerMeldung, abmelden, aktualisiereSitzung } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="benutzer">{benutzer?.benutzername ?? 'keiner'}</p>
      <p data-testid="fehler">{fehlerMeldung ?? 'kein-fehler'}</p>
      <button type="button" onClick={() => void abmelden()}>
        Abmelden
      </button>
      <button type="button" onClick={() => void aktualisiereSitzung()}>
        Pruefen
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('setzt Status auf angemeldet bei 200 GET /v1/ich und meldet sauber ueber POST /v1/abmelden ab', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.endsWith('/v1/ich')) {
        return new Response(JSON.stringify(BEISPIEL_BENUTZER), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (request.url.endsWith('/v1/abmelden') && request.method === 'POST') {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });

    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <AuthProvider client={client}>
        <TestKonsument />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('angemeldet');
    });
    expect(screen.getByTestId('benutzer')).toHaveTextContent('max.muster');

    await user.click(screen.getByRole('button', { name: 'Abmelden' }));

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('abgemeldet');
    });
    expect(screen.getByTestId('benutzer')).toHaveTextContent('keiner');
  });

  it('setzt Status auf abgemeldet bei 401 GET /v1/ich', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <AuthProvider client={client}>
        <TestKonsument />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('abgemeldet');
    });
    expect(screen.getByTestId('fehler')).toHaveTextContent('kein-fehler');
  });

  it('setzt Status auf fehler bei Netzwerkfehler oder nicht-JSON-Antwort', async () => {
    const mockFetch = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <AuthProvider client={client}>
        <TestKonsument />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('fehler');
    });
    expect(screen.getByTestId('fehler')).toHaveTextContent(/nicht erreichbar/i);
  });
});
