/**
 * Zustandslogik "Konto" ohne Oberfläche (C-03).
 *
 * Ein kleiner Speicher mit `holeZustand` und `abonnieren` (passt zu Reacts
 * `useSyncExternalStore`) und Aktionen für Prüfen, Registrieren, Anmelden,
 * weiteren Passkey hinzufügen und Abmelden. API und WebAuthn werden
 * hineingereicht und sind im Test ersetzbar.
 *
 * Ob jemand angemeldet ist, ergibt sich aus `GET /v1/passkeys`: 200 heisst
 * angemeldet, 401 heisst nicht angemeldet. Das Sitzungs-Cookie ist HttpOnly
 * und für JavaScript unsichtbar (E15).
 *
 * Kein Fehler hier blockiert den Timer: Die Steuerung kennt den Timer nicht.
 */
import { ApiFehler, erzeugeKontoApi, type KontoApi, type Passkey } from './api';
import { benutzernameGrundText, pruefeBenutzername, type BenutzernameGrund } from './benutzername';
import { PasskeyBrowserFehler, erzeugeBrowserPasskeys, type PasskeyBrowser } from './passkeyBrowser';

export type KontoFehler =
  /** Name verstösst gegen E28 (`grund`) oder der Server lehnt ihn ab (400, z. B. gesperrt). */
  | { art: 'name-ungueltig'; grund: BenutzernameGrund | 'server' }
  /** 409 `BENUTZERNAME_VERGEBEN`. */
  | { art: 'name-vergeben' }
  /** Passkey-Abfrage im Browser abgebrochen, abgelehnt oder abgelaufen. */
  | { art: 'abgebrochen' }
  /** Dieser Authenticator hat schon einen Passkey für das Konto (`excludeCredentials`). */
  | { art: 'passkey-schon-vorhanden' }
  /** Browser konnte den Passkey aus anderem Grund nicht verwenden (z. B. `SecurityError`). */
  | { art: 'passkey-fehler' }
  /** Server lehnt den Passkey ab (400, z. B. `PASSKEY_UNGUELTIG`, unbekannter Passkey, Challenge abgelaufen). */
  | { art: 'passkey-abgelehnt' }
  /** 429; `erneutAb` ist der Zeitpunkt (ms seit Epoche), ab dem ein neuer Versuch sinnvoll ist. */
  | { art: 'zu-viele-anfragen'; wartezeitSekunden: number | null; erneutAb: number | null }
  /** Keine Antwort vom Server (Netzfehler, offline, 502/503/504 bzw. 5xx ohne `FehlerV1`). */
  | { art: 'nicht-erreichbar'; offline: boolean }
  /** Browser ohne WebAuthn bzw. ohne die JSON-Hilfsfunktionen. */
  | { art: 'nicht-unterstuetzt' }
  /** 401 bei einer Aktion, die eine Anmeldung braucht. */
  | { art: 'sitzung-abgelaufen' }
  /** 403 (`ORIGIN_UNGUELTIG`). */
  | { art: 'zugriff-verweigert' }
  /** Alles andere (z. B. 500 mit `FehlerV1`, unlesbare Antwort). */
  | { art: 'unerwartet'; status: number | null };

export type KontoStatus = 'unbekannt' | 'abgemeldet' | 'angemeldet';
export type KontoAktion = 'pruefen' | 'registrieren' | 'anmelden' | 'hinzufuegen' | 'abmelden';

export interface KontoZustand {
  /** `unbekannt`, solange `GET /v1/passkeys` noch keine 200 oder 401 geliefert hat. */
  status: KontoStatus;
  /** Nur bei `angemeldet`; `null`, wenn die Liste (noch) nicht geladen ist. */
  passkeys: readonly Passkey[] | null;
  /** Laufende Aktion ("lädt"); währenddessen werden weitere Aktionen ignoriert. */
  laeuft: KontoAktion | null;
  fehler: KontoFehler | null;
  /**
   * Deutlich zu einem zweiten Passkey auffordern (E3): nach der Registrierung
   * und immer, wenn angemeldet nur ein Passkey existiert, bis der Hinweis
   * geschlossen wird (gilt bis zur nächsten Anmeldung oder Registrierung).
   */
  zweitenPasskeyEmpfehlen: boolean;
  webauthnUnterstuetzt: boolean;
}

export interface KontoSteuerung {
  holeZustand(): KontoZustand;
  abonnieren(zuhoerer: () => void): () => void;
  /** Liefert jeweils `true` bei Erfolg, `false` bei Fehler oder wenn schon eine Aktion läuft. */
  pruefen(): Promise<boolean>;
  registrieren(benutzername: string): Promise<boolean>;
  anmelden(): Promise<boolean>;
  passkeyHinzufuegen(): Promise<boolean>;
  abmelden(): Promise<boolean>;
  fehlerSchliessen(): void;
  hinweisSchliessen(): void;
}

export interface KontoAbhaengigkeiten {
  api?: KontoApi;
  passkeys?: PasskeyBrowser;
  /** Standard: `navigator.onLine === false`. */
  istOffline?: () => boolean;
  /** Standard: `Date.now`. */
  jetzt?: () => number;
}

function standardOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Ordnet einen Fehler aus API oder WebAuthn für die Anzeige ein. */
export function ordneKontoFehlerEin(
  fehler: unknown,
  umgebung: { istOffline: () => boolean; jetzt: () => number },
): KontoFehler {
  if (fehler instanceof PasskeyBrowserFehler) {
    switch (fehler.art) {
      case 'abgebrochen':
        return { art: 'abgebrochen' };
      case 'schon-vorhanden':
        return { art: 'passkey-schon-vorhanden' };
      case 'nicht-unterstuetzt':
        return { art: 'nicht-unterstuetzt' };
      default:
        return { art: 'passkey-fehler' };
    }
  }
  if (fehler instanceof ApiFehler) {
    if (fehler.art === 'netz') return { art: 'nicht-erreichbar', offline: umgebung.istOffline() };
    if (fehler.art === 'antwort') return { art: 'unerwartet', status: fehler.status };
    const status = fehler.status ?? 0;
    if (status === 429) {
      const w = fehler.wartezeitSekunden;
      return {
        art: 'zu-viele-anfragen',
        wartezeitSekunden: w,
        erneutAb: w === null ? null : umgebung.jetzt() + w * 1000,
      };
    }
    if (status === 409 && fehler.code !== 'LETZTER_PASSKEY') return { art: 'name-vergeben' };
    if (status === 400) {
      return fehler.code === 'BENUTZERNAME_UNGUELTIG'
        ? { art: 'name-ungueltig', grund: 'server' }
        : { art: 'passkey-abgelehnt' };
    }
    if (status === 401) return { art: 'sitzung-abgelaufen' };
    if (status === 403) return { art: 'zugriff-verweigert' };
    // Gateway-Fehler und 5xx ohne FehlerV1 kommen nicht vom Server selbst
    // (z. B. 502 vom Dev-Proxy oder Reverse-Proxy, wenn der Server fehlt).
    if (status === 502 || status === 503 || status === 504 || (status >= 500 && fehler.code === null)) {
      return { art: 'nicht-erreichbar', offline: umgebung.istOffline() };
    }
    return { art: 'unerwartet', status: fehler.status };
  }
  return { art: 'unerwartet', status: null };
}

function istStatus(fehler: unknown, status: number): boolean {
  return fehler instanceof ApiFehler && fehler.art === 'http' && fehler.status === status;
}

export function erzeugeKontoSteuerung(abh: KontoAbhaengigkeiten = {}): KontoSteuerung {
  const api = abh.api ?? erzeugeKontoApi();
  const pb = abh.passkeys ?? erzeugeBrowserPasskeys();
  const umgebung = { istOffline: abh.istOffline ?? standardOffline, jetzt: abh.jetzt ?? Date.now };

  let zustand: KontoZustand = {
    status: 'unbekannt',
    passkeys: null,
    laeuft: null,
    fehler: null,
    zweitenPasskeyEmpfehlen: false,
    webauthnUnterstuetzt: pb.unterstuetzt(),
  };
  const zuhoerer = new Set<() => void>();
  let hinweisGeschlossen = false;
  const empfehlen = (liste: readonly Passkey[]): boolean => !hinweisGeschlossen && liste.length < 2;

  function setze(teil: Partial<KontoZustand>): void {
    zustand = { ...zustand, ...teil };
    for (const z of zuhoerer) z();
  }

  const abgemeldet: Partial<KontoZustand> = {
    status: 'abgemeldet',
    passkeys: null,
    zweitenPasskeyEmpfehlen: false,
  };

  /** Fehler setzen; 401 bedeutet zusätzlich: nicht (mehr) angemeldet. */
  function scheitern(fehler: unknown): false {
    const eingeordnet = ordneKontoFehlerEin(fehler, umgebung);
    setze({
      ...(eingeordnet.art === 'sitzung-abgelaufen' ? abgemeldet : {}),
      laeuft: null,
      fehler: eingeordnet,
    });
    return false;
  }

  /**
   * Führt eine Aktion aus, wenn keine andere läuft. Der Fehler der letzten
   * Aktion wird beim Start gelöscht.
   */
  async function aktion(name: KontoAktion, ablauf: () => Promise<void>): Promise<boolean> {
    if (zustand.laeuft !== null) return false;
    setze({ laeuft: name, fehler: null });
    try {
      await ablauf();
      return true;
    } catch (fehler) {
      return scheitern(fehler);
    }
  }

  /** Nach erfolgreicher Anmeldung bzw. Registrierung: Liste laden. */
  async function angemeldetMitListe(nachRegistrierung: boolean): Promise<void> {
    hinweisGeschlossen = false;
    setze({ status: 'angemeldet', passkeys: null, zweitenPasskeyEmpfehlen: nachRegistrierung });
    const liste = await api.passkeys();
    setze({ passkeys: liste, laeuft: null, zweitenPasskeyEmpfehlen: empfehlen(liste) });
  }

  function brauchtWebAuthn(): void {
    if (!pb.unterstuetzt()) throw new PasskeyBrowserFehler('nicht-unterstuetzt');
  }

  return {
    holeZustand: () => zustand,

    abonnieren(z) {
      zuhoerer.add(z);
      return () => {
        zuhoerer.delete(z);
      };
    },

    pruefen: () =>
      aktion('pruefen', async () => {
        try {
          const liste = await api.passkeys();
          setze({ status: 'angemeldet', passkeys: liste, laeuft: null, zweitenPasskeyEmpfehlen: empfehlen(liste) });
        } catch (fehler) {
          if (!istStatus(fehler, 401)) throw fehler;
          setze({ ...abgemeldet, laeuft: null });
        }
      }),

    async registrieren(eingabe) {
      if (zustand.laeuft !== null) return false;
      const pruefung = pruefeBenutzername(eingabe);
      if (!pruefung.gueltig) {
        setze({ fehler: { art: 'name-ungueltig', grund: pruefung.grund } });
        return false;
      }
      const name = pruefung.name;
      return aktion('registrieren', async () => {
        brauchtWebAuthn();
        const optionen = await api.registrierungsOptionen(name);
        const credential = await pb.erzeugen(optionen);
        await api.registrieren(name, credential);
        await angemeldetMitListe(true);
      });
    },

    anmelden: () =>
      aktion('anmelden', async () => {
        brauchtWebAuthn();
        const optionen = await api.anmeldeOptionen();
        const credential = await pb.abrufen(optionen);
        await api.anmelden(credential);
        await angemeldetMitListe(false);
      }),

    passkeyHinzufuegen: () =>
      aktion('hinzufuegen', async () => {
        brauchtWebAuthn();
        const optionen = await api.passkeyOptionen();
        const credential = await pb.erzeugen(optionen);
        await api.passkeyHinzufuegen(credential);
        setze({ zweitenPasskeyEmpfehlen: false });
        const liste = await api.passkeys();
        setze({ passkeys: liste, laeuft: null, zweitenPasskeyEmpfehlen: empfehlen(liste) });
      }),

    abmelden: () =>
      aktion('abmelden', async () => {
        try {
          await api.abmelden();
        } catch (fehler) {
          // 401: Sitzung war schon weg, Ziel erreicht.
          if (!istStatus(fehler, 401)) throw fehler;
        }
        hinweisGeschlossen = false;
        setze({ ...abgemeldet, laeuft: null });
      }),

    fehlerSchliessen() {
      if (zustand.fehler !== null) setze({ fehler: null });
    },

    hinweisSchliessen() {
      hinweisGeschlossen = true;
      if (zustand.zweitenPasskeyEmpfehlen) setze({ zweitenPasskeyEmpfehlen: false });
    },
  };
}

function wartezeitText(sekunden: number): string {
  if (sekunden < 60) return sekunden === 1 ? '1 Sekunde' : `${sekunden} Sekunden`;
  const minuten = Math.ceil(sekunden / 60);
  return minuten === 1 ? '1 Minute' : `${minuten} Minuten`;
}

/** Verständlicher Text zu einem Fehler. Der Timer bleibt in jedem Fall benutzbar. */
export function kontoFehlerText(fehler: KontoFehler): string {
  switch (fehler.art) {
    case 'name-ungueltig':
      return fehler.grund === 'server'
        ? 'Dieser Benutzername ist nicht erlaubt. Bitte einen anderen wählen.'
        : benutzernameGrundText(fehler.grund);
    case 'name-vergeben':
      return 'Dieser Benutzername ist schon vergeben. Bitte einen anderen wählen.';
    case 'abgebrochen':
      return 'Die Passkey-Abfrage wurde abgebrochen. Du kannst es erneut versuchen.';
    case 'passkey-schon-vorhanden':
      return 'Auf diesem Gerät gibt es schon einen Passkey für dein Konto. Nimm für den weiteren Passkey ein anderes Gerät oder einen anderen Passwortmanager.';
    case 'passkey-fehler':
      return 'Der Browser konnte den Passkey nicht verwenden. Bitte erneut versuchen.';
    case 'passkey-abgelehnt':
      return 'Der Passkey wurde nicht angenommen. Bitte erneut versuchen; bei der Anmeldung einen Passkey dieses Kontos wählen.';
    case 'zu-viele-anfragen':
      return fehler.wartezeitSekunden === null
        ? 'Zu viele Versuche. Bitte etwas später erneut versuchen.'
        : `Zu viele Versuche. Bitte in ${wartezeitText(fehler.wartezeitSekunden)} erneut versuchen.`;
    case 'nicht-erreichbar':
      return fehler.offline
        ? 'Du bist offline. Anmelden geht nur mit Verbindung; der Timer funktioniert auch ohne.'
        : 'Der Server ist gerade nicht erreichbar. Bitte später erneut versuchen; der Timer funktioniert auch ohne.';
    case 'nicht-unterstuetzt':
      return 'Dieser Browser unterstützt keine Passkeys. Der Timer funktioniert auch ohne Konto.';
    case 'sitzung-abgelaufen':
      return 'Du bist nicht mehr angemeldet. Bitte erneut anmelden.';
    case 'zugriff-verweigert':
      return 'Der Server hat die Anfrage abgelehnt. Bitte die Seite neu laden.';
    case 'unerwartet':
      return 'Etwas ist schiefgegangen. Bitte später erneut versuchen.';
  }
}
