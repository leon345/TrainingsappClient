/**
 * API-Schicht für Registrierung, Anmeldung, Abmeldung und Passkeys (C-03).
 *
 * Format nach dem Server (Branch integration/server): OpenAPI
 * `target/openapi/openapi.json` und der Browser-E2E-Test
 * `PasskeyBrowserE2ETest` mit seiner Testseite `e2e-passkeys/passkeys.js`:
 * - Die `…/optionen`-Endpunkte liefern das JSON für
 *   `PublicKeyCredential.parseCreationOptionsFromJSON` bzw.
 *   `parseRequestOptionsFromJSON`.
 * - Zurück geht `credential.toJSON()`: bei der Registrierung eingepackt in
 *   `{benutzername, credential}`, bei Anmeldung und weiterem Passkey direkt.
 * - Fehler im Format `FehlerV1` (`{code, meldung}`); 429 mit `Retry-After`.
 *
 * Die Sitzung liegt in einem HttpOnly-Cookie derselben Origin (E15); hier wird
 * kein Token gelesen oder gespeichert.
 */

/** Passkey in der Liste (`PasskeyV1`, E29). Datumsangaben als `YYYY-MM-DD` (UTC). */
export interface Passkey {
  id: string;
  /** Nur als Text darstellen, nie als HTML (E29). */
  bezeichnung: string;
  erstelltAm: string;
  zuletztVerwendetAm: string | null;
}

/** Fehlerkörper des Servers unter `/v1` (`FehlerV1`). */
export interface FehlerV1 {
  code: string;
  meldung?: string;
}

/** Bekannte Codes aus `docs/api-konventionen.md` des Servers. */
export type FehlerCode =
  | 'BENUTZERNAME_UNGUELTIG'
  | 'BEZEICHNUNG_UNGUELTIG'
  | 'PASSKEY_UNGUELTIG'
  | 'NICHT_ANGEMELDET'
  | 'ORIGIN_UNGUELTIG'
  | 'PASSKEY_NICHT_GEFUNDEN'
  | 'BENUTZERNAME_VERGEBEN'
  | 'LETZTER_PASSKEY'
  | 'ZU_VIELE_ANFRAGEN';

/**
 * Fehler eines API-Aufrufs.
 * - `netz`: keine Antwort (offline, Server oder Proxy nicht erreichbar, fetch warf).
 * - `http`: Antwort mit Status ausserhalb von 2xx.
 * - `antwort`: 2xx, aber der Körper ist nicht wie erwartet.
 */
export class ApiFehler extends Error {
  readonly art: 'netz' | 'http' | 'antwort';
  readonly status: number | null;
  /** `code` aus `FehlerV1`, falls der Körper einer war. */
  readonly code: string | null;
  /** Wartezeit aus `Retry-After` in ganzen Sekunden (nur bei 429, falls lesbar). */
  readonly wartezeitSekunden: number | null;

  constructor(
    art: 'netz' | 'http' | 'antwort',
    optionen: {
      status?: number | null;
      code?: string | null;
      meldung?: string;
      wartezeitSekunden?: number | null;
      cause?: unknown;
    } = {},
  ) {
    super(optionen.meldung ?? art, { cause: optionen.cause });
    this.name = 'ApiFehler';
    this.art = art;
    this.status = optionen.status ?? null;
    this.code = optionen.code ?? null;
    this.wartezeitSekunden = optionen.wartezeitSekunden ?? null;
  }
}

/**
 * `Retry-After` in ganzen Sekunden: entweder eine Zahl von Sekunden oder ein
 * HTTP-Datum (RFC 9110). Nicht lesbar ergibt `null`.
 */
export function leseRetryAfter(wert: string | null, jetzt: number = Date.now()): number | null {
  if (wert === null) return null;
  const text = wert.trim();
  if (/^\d+$/.test(text)) return Number(text);
  // Ein HTTP-Datum enthält Wochentag und Monat als Wort; `Date.parse` nähme
  // sonst auch Zahlen wie "-5" als Jahr an.
  if (!/[A-Za-z]/.test(text)) return null;
  const zeitpunkt = Date.parse(text);
  if (Number.isNaN(zeitpunkt)) return null;
  return Math.max(0, Math.ceil((zeitpunkt - jetzt) / 1000));
}

function istFehlerV1(wert: unknown): wert is FehlerV1 {
  return (
    typeof wert === 'object' &&
    wert !== null &&
    typeof (wert as { code?: unknown }).code === 'string'
  );
}

async function leseFehler(antwort: Response): Promise<ApiFehler> {
  let koerper: unknown = null;
  try {
    koerper = await antwort.json();
  } catch {
    // Kein JSON (z. B. 502 vom Dev-Proxy oder 400 ohne FehlerV1).
  }
  const fehler = istFehlerV1(koerper) ? koerper : null;
  return new ApiFehler('http', {
    status: antwort.status,
    code: fehler?.code ?? null,
    meldung: fehler?.meldung ?? `HTTP ${antwort.status}`,
    wartezeitSekunden:
      antwort.status === 429 ? leseRetryAfter(antwort.headers.get('Retry-After')) : null,
  });
}

export type FetchFunktion = (eingabe: string, init?: RequestInit) => Promise<Response>;

/** Schnittstelle der API, im Test ersetzbar. */
export interface KontoApi {
  registrierungsOptionen(benutzername: string): Promise<PublicKeyCredentialCreationOptionsJSON>;
  registrieren(benutzername: string, credential: unknown): Promise<void>;
  anmeldeOptionen(): Promise<PublicKeyCredentialRequestOptionsJSON>;
  anmelden(credential: unknown): Promise<void>;
  abmelden(): Promise<void>;
  passkeys(): Promise<Passkey[]>;
  passkeyOptionen(): Promise<PublicKeyCredentialCreationOptionsJSON>;
  passkeyHinzufuegen(credential: unknown): Promise<void>;
}

/**
 * API über `fetch` an dieselbe Origin (`/v1/…`). `basis` ist nur für Tests
 * oder einen späteren anderen Pfad gedacht.
 */
export function erzeugeKontoApi(
  fetchFunktion: FetchFunktion = (eingabe, init) => fetch(eingabe, init),
  basis = '',
): KontoApi {
  async function aufruf(
    methode: 'GET' | 'POST',
    pfad: string,
    koerper?: unknown,
  ): Promise<Response> {
    const init: RequestInit = {
      method: methode,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    };
    if (koerper !== undefined) {
      init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
      init.body = JSON.stringify(koerper);
    }
    let antwort: Response;
    try {
      antwort = await fetchFunktion(basis + pfad, init);
    } catch (fehler) {
      throw new ApiFehler('netz', { meldung: 'Keine Verbindung zum Server', cause: fehler });
    }
    if (!antwort.ok) throw await leseFehler(antwort);
    return antwort;
  }

  async function json<T>(antwort: Response): Promise<T> {
    try {
      return (await antwort.json()) as T;
    } catch (fehler) {
      throw new ApiFehler('antwort', {
        status: antwort.status,
        meldung: 'Antwort ist kein JSON',
        cause: fehler,
      });
    }
  }

  return {
    async registrierungsOptionen(benutzername) {
      return json(await aufruf('POST', '/v1/registrieren/optionen', { benutzername }));
    },
    async registrieren(benutzername, credential) {
      await aufruf('POST', '/v1/registrieren', { benutzername, credential });
    },
    async anmeldeOptionen() {
      return json(await aufruf('POST', '/v1/anmelden/optionen'));
    },
    async anmelden(credential) {
      await aufruf('POST', '/v1/anmelden', credential);
    },
    async abmelden() {
      await aufruf('POST', '/v1/abmelden');
    },
    async passkeys() {
      const liste = await json<unknown>(await aufruf('GET', '/v1/passkeys'));
      if (!Array.isArray(liste)) {
        throw new ApiFehler('antwort', { status: 200, meldung: 'Passkey-Liste ist kein Array' });
      }
      return liste.map(lesePasskey);
    },
    async passkeyOptionen() {
      return json(await aufruf('POST', '/v1/passkeys/optionen'));
    },
    async passkeyHinzufuegen(credential) {
      await aufruf('POST', '/v1/passkeys', credential);
    },
  };
}

/** Prüft einen Eintrag der Liste; nur die bekannten Felder werden übernommen. */
function lesePasskey(eintrag: unknown): Passkey {
  const e = (typeof eintrag === 'object' && eintrag !== null ? eintrag : {}) as Record<
    string,
    unknown
  >;
  const zuletzt = e.zuletztVerwendetAm;
  if (
    typeof e.id !== 'string' ||
    typeof e.bezeichnung !== 'string' ||
    typeof e.erstelltAm !== 'string' ||
    !(zuletzt === undefined || zuletzt === null || typeof zuletzt === 'string')
  ) {
    throw new ApiFehler('antwort', { status: 200, meldung: 'Passkey-Eintrag unvollständig' });
  }
  return {
    id: e.id,
    bezeichnung: e.bezeichnung,
    erstelltAm: e.erstelltAm,
    zuletztVerwendetAm: zuletzt ?? null,
  };
}
