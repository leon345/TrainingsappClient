import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1, type PasskeyV1 } from '../api/client';
import { AuthProvider } from '../konto/AuthContext';
import { KontoSeite } from './KontoSeite';

const TEST_BENUTZER: BenutzerV1 = {
  id: '11111111-1111-1111-1111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T10:00:00Z',
  einwilligungAm: '2026-11-19T10:00:00Z',
};

const PASSKEY_1: PasskeyV1 = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  bezeichnung: 'Passkey 1',
  erstelltAm: '2026-11-19',
};

const PASSKEY_2: PasskeyV1 = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  bezeichnung: '<b>Smartphone</b>',
  erstelltAm: '2026-11-19',
  zuletztVerwendetAm: '2026-11-20',
};

function installiereWebAuthnMock() {
  const createMock = vi.fn(async () => ({
    id: 'cred-neu-1',
    type: 'public-key',
    toJSON: () => ({
      id: 'cred-neu-1',
      rawId: 'cred-neu-1',
      type: 'public-key',
      response: {
        clientDataJSON: 'Y2xpZW50RGF0YQ',
        attestationObject: 'YXR0ZXN0YXRpb24',
      },
    }),
  }));

  const getMock = vi.fn(async () => ({
    id: 'cred-login-1',
    type: 'public-key',
    toJSON: () => ({
      id: 'cred-login-1',
      rawId: 'cred-login-1',
      type: 'public-key',
      response: {
        clientDataJSON: 'Y2xpZW50RGF0YQ',
        authenticatorData: 'YXV0aERhdGE',
        signature: 'c2lnbmF0dXJl',
        userHandle: 'dXNlckhhbmRsZQ',
      },
    }),
  }));

  class MockPkc {
    static parseCreationOptionsFromJSON = vi.fn((opt) => opt);
    static parseRequestOptionsFromJSON = vi.fn((opt) => opt);
  }

  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    writable: true,
    value: MockPkc,
  });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    writable: true,
    value: {
      create: createMock,
      get: getMock,
    },
  });

  return { createMock, getMock };
}

function jsonAntwort(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

describe('KontoSeite (Passkey-UI & Passkey-Verwaltung)', () => {
  const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
  const originalPublicKeyCredential = Object.getOwnPropertyDescriptor(
    globalThis,
    'PublicKeyCredential',
  );

  beforeEach(() => {
    installiereWebAuthnMock();
  });

  afterEach(() => {
    if (originalCredentials) {
      Object.defineProperty(navigator, 'credentials', originalCredentials);
    } else {
      Reflect.deleteProperty(navigator, 'credentials');
    }
    if (originalPublicKeyCredential) {
      Object.defineProperty(globalThis, 'PublicKeyCredential', originalPublicKeyCredential);
    } else {
      Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
    }
  });

  it('zeigt klaren Hinweis und deaktiviert Passkey-Buttons, wenn WebAuthn fehlt', () => {
    Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: vi.fn() });

    render(
      <MemoryRouter>
        <AuthProvider client={client} initialStatus="abgemeldet" automatischLaden={false}>
          <KontoSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Passkeys werden in diesem Browser nicht unterstützt/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mit Passkey registrieren' })).toBeDisabled();
  });

  it('erzwingt Einwilligung & gueltigen Benutzernamen und zeigt nach Registrierung den 2.-Passkey-Hinweis', async () => {
    const user = userEvent.setup();
    const anfragen: Array<{ pfad: string; body?: unknown }> = [];

    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const pfad = new URL(request.url).pathname;
      const body =
        request.method !== 'GET' && request.method !== 'DELETE'
          ? await request.clone().json().catch(() => undefined)
          : undefined;
      anfragen.push({ pfad, body });

      if (pfad === '/v1/registrieren/optionen') {
        return jsonAntwort({ optionen: { challenge: 'reg-challenge', rp: { name: 'Trainingsapp' } } });
      }
      if (pfad === '/v1/registrieren') {
        return jsonAntwort(TEST_BENUTZER, 201);
      }
      if (pfad === '/v1/passkeys') {
        return jsonAntwort([PASSKEY_1]);
      }
      return new Response(null, { status: 404 });
    });

    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <MemoryRouter>
        <AuthProvider client={client} initialStatus="abgemeldet" automatischLaden={false}>
          <KontoSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    const nameFeld = screen.getByLabelText(/^Benutzername/i, {
      selector: '#registrieren-benutzername',
    });
    const registrierenButton = screen.getByRole('button', { name: 'Mit Passkey registrieren' });

    // Ohne Einwilligung und mit ungültigem Namen -> keine API-Anfrage
    await user.type(nameFeld, 'a');
    await user.click(registrierenButton);
    expect(anfragen).toHaveLength(0);
    expect(screen.getByText(/zwischen 3 und 32 Zeichen/i)).toBeVisible();
    expect(screen.getByText(/ausdrückliche Einwilligung/i)).toBeVisible();

    // Gültiger Benutzername (gemischte Groß-/Kleinschreibung) + Einwilligung
    await user.clear(nameFeld);
    await user.type(nameFeld, 'Max.Muster');
    await user.click(screen.getByRole('checkbox', { name: /Ich willige ausdrücklich/i }));
    await user.click(registrierenButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'max.muster' })).toBeVisible();
    });

    // Benutzername wurde kleingeschrieben mit einwilligungErteilt: true gesendet
    expect(anfragen[0]).toEqual({
      pfad: '/v1/registrieren/optionen',
      body: { benutzername: 'max.muster', einwilligungErteilt: true },
    });
    expect(anfragen[1]?.pfad).toBe('/v1/registrieren');
    expect((anfragen[1]?.body as Record<string, unknown>)?.benutzername).toBe('max.muster');

    // Prominenter 2.-Passkey-Hinweis nach Registrierung sichtbar
    expect(screen.getByText(/Zweiten Passkey als Ersatz hinterlegen/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Zweiten Passkey hinzufügen' })).toBeVisible();
  });

  it('unterstuetzt Anmeldung ohne Benutzernamen (discoverable) sowie mit optionalem Benutzernamen', async () => {
    const user = userEvent.setup();
    const anmeldeOptionenBodies: unknown[] = [];

    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const pfad = new URL(request.url).pathname;

      if (pfad === '/v1/anmelden/optionen') {
        anmeldeOptionenBodies.push(await request.clone().json());
        return jsonAntwort({ optionen: { challenge: 'login-challenge' } });
      }
      if (pfad === '/v1/anmelden') {
        return jsonAntwort(TEST_BENUTZER);
      }
      if (pfad === '/v1/passkeys') {
        return jsonAntwort([PASSKEY_1, PASSKEY_2]);
      }
      if (pfad === '/v1/abmelden') {
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });

    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <MemoryRouter>
        <AuthProvider client={client} initialStatus="abgemeldet" automatischLaden={false}>
          <KontoSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    // 1) Discoverable Anmeldung ohne Benutzernamen
    await user.click(screen.getByRole('button', { name: 'Mit Passkey anmelden' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'max.muster' })).toBeVisible();
    });
    expect(anmeldeOptionenBodies[0]).toEqual({});

    // Abmelden
    await user.click(screen.getByRole('button', { name: 'Abmelden' }));
    await waitFor(() => {
      expect(screen.getByText(/erfolgreich abgemeldet/i)).toBeVisible();
    });

    // 2) Anmeldung mit Benutzernamen
    await user.type(screen.getByLabelText(/Benutzername \(optional\)/i), 'Max.Muster');
    await user.click(screen.getByRole('button', { name: 'Mit Benutzername anmelden' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'max.muster' })).toBeVisible();
    });
    expect(anmeldeOptionenBodies[1]).toEqual({ benutzername: 'max.muster' });
  });

  it('verwaltet Passkeys (Text-Escaping, Hinzufuegen, Umbenennen, Loeschen & Schutz letzter Passkey)', async () => {
    const user = userEvent.setup();
    let gespeichertePasskeys: PasskeyV1[] = [PASSKEY_1];

    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const pfad = new URL(request.url).pathname;

      if (pfad === '/v1/passkeys' && request.method === 'GET') {
        return jsonAntwort(gespeichertePasskeys);
      }
      if (pfad === '/v1/passkeys/optionen' && request.method === 'POST') {
        return jsonAntwort({ optionen: { challenge: 'add-challenge' } });
      }
      if (pfad === '/v1/passkeys' && request.method === 'POST') {
        gespeichertePasskeys = [...gespeichertePasskeys, PASSKEY_2];
        return jsonAntwort(PASSKEY_2, 201);
      }
      if (pfad === `/v1/passkeys/${PASSKEY_2.id}` && request.method === 'PATCH') {
        const body = (await request.clone().json()) as { bezeichnung: string };
        const aktualisiert: PasskeyV1 = { ...PASSKEY_2, bezeichnung: body.bezeichnung };
        gespeichertePasskeys = gespeichertePasskeys.map((p) =>
          p.id === PASSKEY_2.id ? aktualisiert : p,
        );
        return jsonAntwort(aktualisiert);
      }
      if (pfad === `/v1/passkeys/${PASSKEY_2.id}` && request.method === 'DELETE') {
        gespeichertePasskeys = gespeichertePasskeys.filter((p) => p.id !== PASSKEY_2.id);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    });

    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <MemoryRouter>
        <AuthProvider client={client} initialBenutzer={TEST_BENUTZER} automatischLaden={false}>
          <KontoSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Bei 1 Passkey: Löschen deaktiviert, "Noch nie verwendet" sichtbar, 2.-Passkey-Hinweis sichtbar
    await waitFor(() => {
      expect(screen.getByText('Passkey 1')).toBeVisible();
    });
    expect(screen.getByText(/Erstellt am 19\.11\.2026 · Zuletzt verwendet: Noch nie verwendet/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Passkey Passkey 1 löschen' })).toBeDisabled();
    expect(screen.getByText(/Zweiten Passkey als Ersatz hinterlegen/i)).toBeVisible();

    // Zweiten Passkey hinzufügen (Name enthält HTML-Tags -> muss als reiner Text erscheinen!)
    await user.click(screen.getByRole('button', { name: 'Zweiten Passkey hinzufügen' }));
    await waitFor(() => {
      expect(screen.getByText('<b>Smartphone</b>')).toBeVisible();
    });
    expect(document.querySelector('b')).toBeNull();
    expect(screen.getByText(/Zuletzt verwendet: 20\.11\.2026/i)).toBeVisible();
    // 2.-Passkey-Hinweis verschwindet bei >= 2 Passkeys
    expect(screen.queryByText(/Zweiten Passkey als Ersatz hinterlegen/i)).not.toBeInTheDocument();

    // Passkey umbenennen
    await user.click(screen.getByRole('button', { name: 'Passkey <b>Smartphone</b> umbenennen' }));
    const dialog = screen.getByRole('dialog', { name: 'Passkey umbenennen' });
    const eingabe = within(dialog).getByLabelText('Bezeichnung');
    await user.clear(eingabe);
    await user.type(eingabe, 'YubiKey Büro');
    await user.click(within(dialog).getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByText('YubiKey Büro')).toBeVisible();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Passkey löschen
    await user.click(screen.getByRole('button', { name: 'Passkey YubiKey Büro löschen' }));
    const loeschDialog = screen.getByRole('dialog', { name: 'Passkey löschen?' });
    await user.click(within(loeschDialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('YubiKey Büro')).not.toBeInTheDocument();
    });
    // Nach dem Löschen bleibt 1 Passkey -> Schutz wieder aktiv
    expect(screen.getByRole('button', { name: 'Passkey Passkey 1 löschen' })).toBeDisabled();
  });

  it('zeigt Serverfehler bei 409 (LETZTER_PASSKEY), 429 (Retry-After) und Netzwerkfehler sauber an', async () => {
    const user = userEvent.setup();

    // 1) 429 mit Retry-After bei Anmeldung
    const mockFetch429 = vi.fn<typeof fetch>(async () =>
      jsonAntwort(
        { code: 'ZU_VIELE_ANFRAGEN', meldung: 'Zu viele Anmeldeversuche.' },
        429,
        { 'Retry-After': '30' },
      ),
    );
    const client429 = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch429 });

    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider client={client429} initialStatus="abgemeldet" automatischLaden={false}>
          <KontoSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Mit Passkey anmelden' }));
    await waitFor(() => {
      expect(
        screen.getByText(/Zu viele Anmeldeversuche\. Bitte warte 30 Sekunden/i),
      ).toBeVisible();
    });
    unmount();

    // 2) 409 LETZTER_PASSKEY beim Löschen (z. B. parallele Tab-Änderung)
    const mockFetch409 = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const pfad = new URL(request.url).pathname;
      if (pfad === '/v1/passkeys' && request.method === 'GET') {
        return jsonAntwort([PASSKEY_1, PASSKEY_2]);
      }
      if (pfad === `/v1/passkeys/${PASSKEY_2.id}` && request.method === 'DELETE') {
        return jsonAntwort(
          { code: 'LETZTER_PASSKEY', meldung: 'Der letzte Passkey kann nicht gelöscht werden.' },
          409,
        );
      }
      return new Response(null, { status: 404 });
    });
    const client409 = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch409 });

    render(
      <MemoryRouter>
        <AuthProvider client={client409} initialBenutzer={TEST_BENUTZER} automatischLaden={false}>
          <KontoSeite />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('<b>Smartphone</b>')).toBeVisible();
    });
    await user.click(screen.getByRole('button', { name: 'Passkey <b>Smartphone</b> löschen' }));
    const dialog = screen.getByRole('dialog', { name: 'Passkey löschen?' });
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.getByText('Der letzte Passkey kann nicht gelöscht werden.')).toBeVisible();
    });
  });
});
