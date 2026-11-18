import { randomBytes } from 'node:crypto';
import type { Page, Request, Route } from '@playwright/test';

/*
 * Attrappe des Servers für /v1 in E2E-Tests (C-03): Playwright fängt alle
 * Anfragen an /v1 ab (`page.route`), es läuft kein echter Server.
 *
 * Die Antworten folgen dem Server (Branch integration/server), nicht einer
 * eigenen Vorstellung:
 * - Pfade, Statuscodes und Fehlercodes: target/openapi/openapi.json,
 *   docs/api-konventionen.md, api.v1.PasskeyFehlerMapper (Texte wörtlich),
 *   infrastructure.http.RateLimit (429-Körper wörtlich, Retry-After in s).
 * - Optionen: so, wie webauthn4j 0.30.3 (ObjectConverter, von
 *   WebAuthnSecurity.toJsonString genutzt) sie mit den Werten aus
 *   QuarkusWebAuthnZeremonie und WebAuthnSecurity 3.40 serialisiert: Timeout
 *   5 min, Challenge 64 Byte, residentKey und userVerification "required",
 *   Attestation "none", Algorithmen EdDSA, ES256, RS256, User-Handle 16 Byte,
 *   bei der Anmeldung leere allowCredentials. Die Serialisierung wurde einmal
 *   mit webauthn4j selbst erzeugt (jshell) und hier nachgebaut.
 * - Abschluss: Registrieren und Anmelden 204, weiterer Passkey 201, Abmelden
 *   204, jeweils ohne Körper. PasskeyV1 mit `zuletztVerwendetAm: null`, wenn
 *   nie verwendet (Java-Record, Jackson schreibt null).
 *
 * Nicht nachgebaut: Prüfung der Signatur und der Challenge (das kann nur der
 * echte Server; Durchlauf dagegen folgt in Teil 4), Cookies.
 */

export interface PasskeyV1 {
  id: string;
  bezeichnung: string;
  erstelltAm: string;
  zuletztVerwendetAm: string | null;
}

/** Körper `FehlerV1`, Texte wie im Server. */
export const FEHLER = {
  NICHT_ANGEMELDET: { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich' },
  BENUTZERNAME_VERGEBEN: { code: 'BENUTZERNAME_VERGEBEN', meldung: 'Benutzername ist bereits vergeben' },
  PASSKEY_UNGUELTIG: { code: 'PASSKEY_UNGUELTIG', meldung: 'Passkey konnte nicht geprueft werden' },
  ZU_VIELE_ANFRAGEN: { code: 'ZU_VIELE_ANFRAGEN', meldung: 'Zu viele Anfragen, bitte spaeter erneut versuchen' },
} as const;

const base64url = (bytes: Buffer) => bytes.toString('base64url');

/** PublicKeyCredentialCreationOptions wie vom Server (Registrierung und weiterer Passkey). */
export function erzeugungsOptionen(benutzername: string, userHandle: string, ausschliessen: string[] = []) {
  return {
    rp: { id: 'localhost', name: 'Trainingsapp' },
    user: { id: userHandle, name: benutzername, displayName: benutzername },
    challenge: base64url(randomBytes(64)),
    pubKeyCredParams: [
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 300000,
    excludeCredentials: ausschliessen.map((id) => ({ type: 'public-key', id })),
    authenticatorSelection: { requireResidentKey: true, residentKey: 'required', userVerification: 'required' },
    attestation: 'none',
    extensions: {},
  };
}

/** PublicKeyCredentialRequestOptions wie vom Server (discoverable, ohne Benutzername). */
export function anmeldeOptionen() {
  return {
    challenge: base64url(randomBytes(64)),
    timeout: 300000,
    rpId: 'localhost',
    allowCredentials: [],
    userVerification: 'required',
  };
}

export type Endpunkt =
  | 'GET /v1/passkeys'
  | 'POST /v1/passkeys'
  | 'POST /v1/passkeys/optionen'
  | 'POST /v1/registrieren/optionen'
  | 'POST /v1/registrieren'
  | 'POST /v1/anmelden/optionen'
  | 'POST /v1/anmelden'
  | 'POST /v1/abmelden';

/** Feste Antwort statt des Verhaltens der Attrappe; `abbrechen`: keine Antwort (Server nicht erreichbar). */
export type Antwort =
  | { status: number; json?: unknown; kopf?: Record<string, string> }
  | { abbrechen: true };

export const antwort429 = (sekunden: number): Antwort => ({
  status: 429,
  json: FEHLER.ZU_VIELE_ANFRAGEN,
  kopf: { 'Retry-After': String(sekunden) },
});

export interface Anfrage {
  endpunkt: string;
  origin: string | undefined;
  koerper: unknown;
}

export interface ServerAttrappe {
  /** Alle Anfragen an /v1 in Reihenfolge. */
  readonly anfragen: Anfrage[];
  angemeldet: boolean;
  passkeys: PasskeyV1[];
  /** Benutzernamen, die schon vergeben sind (409). */
  vergeben: Set<string>;
  /** Antwort für einen Endpunkt fest vorgeben (bis `null`). */
  setze(endpunkt: Endpunkt, antwort: Antwort | null): void;
  /** Alle Endpunkte: keine Antwort (Server nicht erreichbar). */
  nichtErreichbar: boolean;
  /** Letzte ausgegebene Optionen (für Prüfungen der Challenge und des User-Handles). */
  letzteOptionen: Record<string, unknown> | null;
}

const HEUTE = '2026-11-18';

export async function installiereServer(
  page: Page,
  start: { angemeldet?: boolean; passkeys?: PasskeyV1[]; vergeben?: string[] } = {},
): Promise<ServerAttrappe> {
  const vorgaben = new Map<string, Antwort>();
  const userHandle = base64url(randomBytes(16));
  let naechsteNummer = (start.passkeys?.length ?? 0) + 1;
  let benutzername = 'anna';

  const server: ServerAttrappe = {
    anfragen: [],
    angemeldet: start.angemeldet ?? false,
    passkeys: [...(start.passkeys ?? [])],
    vergeben: new Set(start.vergeben ?? []),
    setze: (endpunkt, a) => (a === null ? vorgaben.delete(endpunkt) : vorgaben.set(endpunkt, a)),
    nichtErreichbar: false,
    letzteOptionen: null,
  };

  const json = (route: Route, status: number, koerper?: unknown, kopf: Record<string, string> = {}) =>
    route.fulfill({
      status,
      headers: { ...(koerper === undefined ? {} : { 'Content-Type': 'application/json' }), ...kopf },
      body: koerper === undefined ? '' : JSON.stringify(koerper),
    });

  const neuerPasskey = (credential: { id?: unknown }) => {
    server.passkeys.push({
      id: String(credential.id),
      bezeichnung: `Passkey ${naechsteNummer++}`,
      erstelltAm: HEUTE,
      zuletztVerwendetAm: null,
    });
  };

  const koerperVon = (anfrage: Request): unknown => {
    const text = anfrage.postData();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  };

  await page.route(
    (url) => url.pathname === '/v1' || url.pathname.startsWith('/v1/'),
    async (route) => {
      const anfrage = route.request();
      const endpunkt = `${anfrage.method()} ${new URL(anfrage.url()).pathname}`;
      const koerper = koerperVon(anfrage);
      server.anfragen.push({ endpunkt, origin: await anfrage.headerValue('origin') ?? undefined, koerper });

      if (server.nichtErreichbar) return route.abort('connectionrefused');
      const vorgabe = vorgaben.get(endpunkt);
      if (vorgabe) {
        if ('abbrechen' in vorgabe) return route.abort('connectionrefused');
        return json(route, vorgabe.status, vorgabe.json, vorgabe.kopf);
      }

      const nichtAngemeldet = () => json(route, 401, FEHLER.NICHT_ANGEMELDET);
      switch (endpunkt) {
        case 'GET /v1/passkeys':
          return server.angemeldet ? json(route, 200, server.passkeys) : nichtAngemeldet();
        case 'POST /v1/registrieren/optionen': {
          const name = String((koerper as { benutzername?: unknown })?.benutzername ?? '').toLowerCase();
          if (server.vergeben.has(name)) return json(route, 409, FEHLER.BENUTZERNAME_VERGEBEN);
          server.letzteOptionen = erzeugungsOptionen(name, userHandle);
          return json(route, 200, server.letzteOptionen);
        }
        case 'POST /v1/registrieren': {
          const k = koerper as { benutzername?: string; credential?: { id?: unknown } };
          benutzername = String(k.benutzername);
          server.vergeben.add(benutzername);
          neuerPasskey(k.credential ?? {});
          server.angemeldet = true;
          return json(route, 204);
        }
        case 'POST /v1/anmelden/optionen':
          server.letzteOptionen = anmeldeOptionen();
          return json(route, 200, server.letzteOptionen);
        case 'POST /v1/anmelden':
          server.angemeldet = true;
          return json(route, 204);
        case 'POST /v1/passkeys/optionen':
          if (!server.angemeldet) return nichtAngemeldet();
          server.letzteOptionen = erzeugungsOptionen(benutzername, userHandle, server.passkeys.map((p) => p.id));
          return json(route, 200, server.letzteOptionen);
        case 'POST /v1/passkeys':
          if (!server.angemeldet) return nichtAngemeldet();
          neuerPasskey((koerper ?? {}) as { id?: unknown });
          return json(route, 201);
        case 'POST /v1/abmelden':
          if (!server.angemeldet) return nichtAngemeldet();
          server.angemeldet = false;
          return json(route, 204);
        default:
          // E25: alle übrigen /v1-Pfade ohne Anmeldung 401
          return nichtAngemeldet();
      }
    },
  );
  return server;
}

/** Feste Beispieldaten. */
export const PASSKEY_HANDY: PasskeyV1 = {
  id: 'cGFzc2tleS1oYW5keQ',
  bezeichnung: 'Passkey 1',
  erstelltAm: '2026-11-01',
  zuletztVerwendetAm: '2026-11-18',
};

export const PASSKEY_LAPTOP: PasskeyV1 = {
  id: 'cGFzc2tleS1sYXB0b3A',
  bezeichnung: 'Laptop',
  erstelltAm: '2026-11-10',
  zuletztVerwendetAm: null,
};
