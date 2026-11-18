/**
 * WebAuthn-Aufrufe des Browsers hinter einer kleinen Schnittstelle (C-03),
 * damit Zustandslogik und Ansicht ohne echten Authenticator testbar sind.
 *
 * Wie im Server-E2E-Test (`PasskeyBrowserE2ETest`, Testseite
 * `e2e-passkeys/passkeys.js`): Optionen per
 * `PublicKeyCredential.parseCreationOptionsFromJSON` bzw.
 * `parseRequestOptionsFromJSON` einlesen, Ergebnis mit `credential.toJSON()`
 * zurückgeben. Fehlen diese Funktionen, gilt WebAuthn als nicht unterstützt;
 * eine eigene Base64URL-Umwandlung gibt es bewusst nicht.
 */

export interface PasskeyBrowser {
  /** WebAuthn samt JSON-Hilfsfunktionen vorhanden. */
  unterstuetzt(): boolean;
  /** Neuen Passkey erzeugen (`navigator.credentials.create`); liefert `toJSON()`. */
  erzeugen(optionen: PublicKeyCredentialCreationOptionsJSON): Promise<unknown>;
  /** Mit vorhandenem Passkey signieren (`navigator.credentials.get`); liefert `toJSON()`. */
  abrufen(optionen: PublicKeyCredentialRequestOptionsJSON): Promise<unknown>;
}

/**
 * - `abgebrochen`: Abfrage abgebrochen, abgelehnt oder abgelaufen
 *   (`NotAllowedError`, `AbortError`, kein Ergebnis).
 * - `schon-vorhanden`: Dieser Authenticator hat schon einen Passkey für das
 *   Konto (`InvalidStateError` durch `excludeCredentials`).
 * - `nicht-unterstuetzt`: WebAuthn fehlt oder der Authenticator kann die
 *   Optionen nicht (`NotSupportedError`).
 * - `sicherheit`: Origin oder rpId passen nicht (`SecurityError`).
 * - `unbekannt`: alles andere.
 */
export type PasskeyFehlerArt =
  | 'abgebrochen'
  | 'schon-vorhanden'
  | 'nicht-unterstuetzt'
  | 'sicherheit'
  | 'unbekannt';

export class PasskeyBrowserFehler extends Error {
  readonly art: PasskeyFehlerArt;

  constructor(art: PasskeyFehlerArt, optionen: { cause?: unknown } = {}) {
    super(art, { cause: optionen.cause });
    this.name = 'PasskeyBrowserFehler';
    this.art = art;
  }
}

/** Ordnet einen Fehler aus `navigator.credentials.*` ein (nach `DOMException.name`). */
export function ordnePasskeyFehlerEin(fehler: unknown): PasskeyBrowserFehler {
  if (fehler instanceof PasskeyBrowserFehler) return fehler;
  const name =
    typeof fehler === 'object' && fehler !== null && typeof (fehler as { name?: unknown }).name === 'string'
      ? (fehler as { name: string }).name
      : '';
  const art: PasskeyFehlerArt =
    name === 'NotAllowedError' || name === 'AbortError'
      ? 'abgebrochen'
      : name === 'InvalidStateError'
        ? 'schon-vorhanden'
        : name === 'NotSupportedError'
          ? 'nicht-unterstuetzt'
          : name === 'SecurityError'
            ? 'sicherheit'
            : 'unbekannt';
  return new PasskeyBrowserFehler(art, { cause: fehler });
}

/** Der Teil der Browser-Umgebung, den die Umsetzung braucht (im Test ersetzbar). */
export interface WebAuthnUmgebung {
  PublicKeyCredential?: {
    parseCreationOptionsFromJSON?: (o: PublicKeyCredentialCreationOptionsJSON) => PublicKeyCredentialCreationOptions;
    parseRequestOptionsFromJSON?: (o: PublicKeyCredentialRequestOptionsJSON) => PublicKeyCredentialRequestOptions;
  };
  navigator?: {
    credentials?: {
      create?: (o: CredentialCreationOptions) => Promise<Credential | null>;
      get?: (o: CredentialRequestOptions) => Promise<Credential | null>;
    };
  };
}

function alsJson(credential: Credential | null): unknown {
  const toJSON = (credential as { toJSON?: unknown } | null)?.toJSON;
  if (credential === null) throw new PasskeyBrowserFehler('abgebrochen');
  if (typeof toJSON !== 'function') throw new PasskeyBrowserFehler('nicht-unterstuetzt');
  return (toJSON as () => unknown).call(credential);
}

/** Umsetzung mit den echten Browser-APIs. */
export function erzeugeBrowserPasskeys(
  umgebung: WebAuthnUmgebung = globalThis as unknown as WebAuthnUmgebung,
): PasskeyBrowser {
  const unterstuetzt = (): boolean => {
    const pkc = umgebung.PublicKeyCredential;
    const cred = umgebung.navigator?.credentials;
    return (
      typeof pkc?.parseCreationOptionsFromJSON === 'function' &&
      typeof pkc.parseRequestOptionsFromJSON === 'function' &&
      typeof cred?.create === 'function' &&
      typeof cred.get === 'function'
    );
  };

  return {
    unterstuetzt,
    async erzeugen(optionen) {
      if (!unterstuetzt()) throw new PasskeyBrowserFehler('nicht-unterstuetzt');
      try {
        const publicKey = umgebung.PublicKeyCredential!.parseCreationOptionsFromJSON!(optionen);
        return alsJson(await umgebung.navigator!.credentials!.create!({ publicKey }));
      } catch (fehler) {
        throw ordnePasskeyFehlerEin(fehler);
      }
    },
    async abrufen(optionen) {
      if (!unterstuetzt()) throw new PasskeyBrowserFehler('nicht-unterstuetzt');
      try {
        const publicKey = umgebung.PublicKeyCredential!.parseRequestOptionsFromJSON!(optionen);
        return alsJson(await umgebung.navigator!.credentials!.get!({ publicKey }));
      } catch (fehler) {
        throw ordnePasskeyFehlerEin(fehler);
      }
    },
  };
}
