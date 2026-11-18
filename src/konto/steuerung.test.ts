import { describe, expect, it, vi } from 'vitest';
import { ApiFehler } from './api';
import {
  erzeugeKontoSteuerung,
  kontoFehlerText,
  ordneKontoFehlerEin,
  type KontoAbhaengigkeiten,
  type KontoFehler,
} from './steuerung';
import {
  ABRUF_OPTIONEN,
  ANMELDE_CREDENTIAL,
  ERZEUG_OPTIONEN,
  NEUES_CREDENTIAL,
  PASSKEY_1,
  PASSKEY_2,
  browserFehler,
  fakeApi,
  fakePasskeyBrowser,
  httpFehler,
  netzFehler,
} from '../test/fakeKonto';

const JETZT = Date.parse('2026-11-18T12:00:00Z');

function aufbau(optionen: { unterstuetzt?: boolean; offline?: boolean } & KontoAbhaengigkeiten = {}) {
  const api = fakeApi();
  const pb = fakePasskeyBrowser(optionen.unterstuetzt ?? true);
  const offline = { wert: optionen.offline ?? false };
  const steuerung = erzeugeKontoSteuerung({
    api,
    passkeys: pb,
    istOffline: () => offline.wert,
    jetzt: () => JETZT,
  });
  return { api, pb, offline, steuerung, z: () => steuerung.holeZustand() };
}

/** Steuerung im Zustand "abgemeldet" (Prüfung lieferte 401). */
async function abgemeldet() {
  const a = aufbau();
  a.api.passkeys.mockRejectedValueOnce(httpFehler(401, 'NICHT_ANGEMELDET'));
  await a.steuerung.pruefen();
  expect(a.z().status).toBe('abgemeldet');
  return a;
}

/** Steuerung im Zustand "angemeldet" mit einem Passkey. */
async function angemeldet() {
  const a = aufbau();
  await a.steuerung.pruefen();
  expect(a.z().status).toBe('angemeldet');
  return a;
}

/** Versprechen, das der Test selbst auflöst (zum Beobachten von "lädt"). */
function offen<T>() {
  let aufloesen!: (wert: T) => void;
  const versprechen = new Promise<T>((r) => {
    aufloesen = r;
  });
  return { versprechen, aufloesen };
}

describe('Anfangszustand und Prüfen per GET /v1/passkeys', () => {
  it('beginnt unbekannt, ohne Fehler, ohne laufende Aktion', () => {
    const { z } = aufbau();
    expect(z()).toEqual({
      status: 'unbekannt',
      passkeys: null,
      laeuft: null,
      fehler: null,
      zweitenPasskeyEmpfehlen: false,
      webauthnUnterstuetzt: true,
    });
  });

  it('200: angemeldet mit Liste', async () => {
    const { steuerung, z, api } = aufbau();
    api.passkeys.mockResolvedValueOnce([PASSKEY_1, PASSKEY_2]);
    await expect(steuerung.pruefen()).resolves.toBe(true);
    expect(z()).toMatchObject({ status: 'angemeldet', passkeys: [PASSKEY_1, PASSKEY_2], laeuft: null, fehler: null });
  });

  it('401: abgemeldet ohne Fehler', async () => {
    const { steuerung, z, api } = aufbau();
    api.passkeys.mockRejectedValueOnce(httpFehler(401, 'NICHT_ANGEMELDET'));
    await expect(steuerung.pruefen()).resolves.toBe(true);
    expect(z()).toMatchObject({ status: 'abgemeldet', passkeys: null, laeuft: null, fehler: null });
  });

  it('lädt: während der Prüfung laeuft = pruefen', async () => {
    const { steuerung, z, api } = aufbau();
    const antwort = offen<typeof PASSKEY_1[]>();
    api.passkeys.mockReturnValueOnce(antwort.versprechen);
    const p = steuerung.pruefen();
    expect(z().laeuft).toBe('pruefen');
    antwort.aufloesen([PASSKEY_1]);
    await p;
    expect(z().laeuft).toBeNull();
  });

  it('Server nicht erreichbar: Status bleibt unbekannt, Fehler nicht-erreichbar', async () => {
    const { steuerung, z, api } = aufbau();
    api.passkeys.mockRejectedValueOnce(netzFehler());
    await expect(steuerung.pruefen()).resolves.toBe(false);
    expect(z()).toMatchObject({
      status: 'unbekannt',
      laeuft: null,
      fehler: { art: 'nicht-erreichbar', offline: false },
    });
  });

  it('offline: Fehler nicht-erreichbar mit offline = true', async () => {
    const { steuerung, z, api } = aufbau({ offline: true });
    api.passkeys.mockRejectedValueOnce(netzFehler());
    await steuerung.pruefen();
    expect(z().fehler).toEqual({ art: 'nicht-erreichbar', offline: true });
  });

  it('502 vom Proxy (Server fehlt): nicht-erreichbar', async () => {
    const { steuerung, z, api } = aufbau();
    api.passkeys.mockRejectedValueOnce(httpFehler(502));
    await steuerung.pruefen();
    expect(z().fehler).toEqual({ art: 'nicht-erreichbar', offline: false });
  });

  it('Browser ohne WebAuthn: im Zustand vermerkt, Prüfen geht trotzdem', async () => {
    const { steuerung, z } = aufbau({ unterstuetzt: false });
    expect(z().webauthnUnterstuetzt).toBe(false);
    await steuerung.pruefen();
    expect(z().status).toBe('angemeldet');
  });
});

describe('Registrieren', () => {
  it('Erfolg: Optionen mit kleingeschriebenem Namen, create, Abschluss, Liste; Hinweis auf zweiten Passkey (E3)', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    await expect(steuerung.registrieren('Anna.B')).resolves.toBe(true);
    expect(api.registrierungsOptionen).toHaveBeenCalledWith('anna.b');
    expect(pb.erzeugen).toHaveBeenCalledWith(ERZEUG_OPTIONEN);
    expect(api.registrieren).toHaveBeenCalledWith('anna.b', NEUES_CREDENTIAL);
    expect(z()).toMatchObject({
      status: 'angemeldet',
      passkeys: [PASSKEY_1],
      laeuft: null,
      fehler: null,
      zweitenPasskeyEmpfehlen: true,
    });
  });

  it('lädt: während des Ablaufs laeuft = registrieren, zweite Aktion wird ignoriert', async () => {
    const { steuerung, z, pb, api } = await abgemeldet();
    const erzeugt = offen<unknown>();
    pb.erzeugen.mockReturnValueOnce(erzeugt.versprechen);
    const p = steuerung.registrieren('anna');
    expect(z().laeuft).toBe('registrieren');
    await expect(steuerung.anmelden()).resolves.toBe(false);
    await expect(steuerung.registrieren('bert')).resolves.toBe(false);
    expect(api.anmeldeOptionen).not.toHaveBeenCalled();
    erzeugt.aufloesen(NEUES_CREDENTIAL);
    await expect(p).resolves.toBe(true);
    expect(api.registrierungsOptionen).toHaveBeenCalledTimes(1);
  });

  it('ungültiger Name (Client, E28): kein Aufruf, Fehler mit Grund', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    await expect(steuerung.registrieren('a@b')).resolves.toBe(false);
    await expect(steuerung.registrieren('ab')).resolves.toBe(false);
    expect(api.registrierungsOptionen).not.toHaveBeenCalled();
    expect(pb.erzeugen).not.toHaveBeenCalled();
    expect(z()).toMatchObject({ status: 'abgemeldet', laeuft: null, fehler: { art: 'name-ungueltig', grund: 'zu-kurz' } });
  });

  it('400 BENUTZERNAME_UNGUELTIG vom Server (z. B. gesperrter Name)', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    api.registrierungsOptionen.mockRejectedValueOnce(httpFehler(400, 'BENUTZERNAME_UNGUELTIG'));
    await expect(steuerung.registrieren('admin')).resolves.toBe(false);
    expect(pb.erzeugen).not.toHaveBeenCalled();
    expect(z()).toMatchObject({ status: 'abgemeldet', laeuft: null, fehler: { art: 'name-ungueltig', grund: 'server' } });
  });

  it('409 Name vergeben bei den Optionen', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    api.registrierungsOptionen.mockRejectedValueOnce(httpFehler(409, 'BENUTZERNAME_VERGEBEN'));
    await expect(steuerung.registrieren('anna')).resolves.toBe(false);
    expect(pb.erzeugen).not.toHaveBeenCalled();
    expect(z()).toMatchObject({ status: 'abgemeldet', laeuft: null, fehler: { art: 'name-vergeben' } });
  });

  it('409 Name vergeben erst beim Abschluss (Wettlauf)', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.registrieren.mockRejectedValueOnce(httpFehler(409, 'BENUTZERNAME_VERGEBEN'));
    await expect(steuerung.registrieren('anna')).resolves.toBe(false);
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: { art: 'name-vergeben' } });
    expect(api.passkeys).toHaveBeenCalledTimes(1);
  });

  it('Passkey-Abfrage abgebrochen: kein Abschluss, abgemeldet', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    pb.erzeugen.mockRejectedValueOnce(browserFehler('abgebrochen'));
    await expect(steuerung.registrieren('anna')).resolves.toBe(false);
    expect(api.registrieren).not.toHaveBeenCalled();
    expect(z()).toMatchObject({ status: 'abgemeldet', laeuft: null, fehler: { art: 'abgebrochen' } });
  });

  it('429 mit Wartezeit', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.registrierungsOptionen.mockRejectedValueOnce(httpFehler(429, 'ZU_VIELE_ANFRAGEN', 30));
    await expect(steuerung.registrieren('anna')).resolves.toBe(false);
    expect(z().fehler).toEqual({ art: 'zu-viele-anfragen', wartezeitSekunden: 30, erneutAb: JETZT + 30_000 });
  });

  it('Server nicht erreichbar', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.registrierungsOptionen.mockRejectedValueOnce(netzFehler());
    await steuerung.registrieren('anna');
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: { art: 'nicht-erreichbar', offline: false } });
  });

  it('Browser ohne WebAuthn: kein Aufruf an den Server (schont das Rate-Limit)', async () => {
    const a = aufbau({ unterstuetzt: false });
    a.api.passkeys.mockRejectedValueOnce(httpFehler(401));
    await a.steuerung.pruefen();
    await expect(a.steuerung.registrieren('anna')).resolves.toBe(false);
    expect(a.api.registrierungsOptionen).not.toHaveBeenCalled();
    expect(a.z()).toMatchObject({ status: 'abgemeldet', laeuft: null, fehler: { art: 'nicht-unterstuetzt' } });
  });

  it('400 PASSKEY_UNGUELTIG beim Abschluss: passkey-abgelehnt', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.registrieren.mockRejectedValueOnce(httpFehler(400, 'PASSKEY_UNGUELTIG'));
    await steuerung.registrieren('anna');
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: { art: 'passkey-abgelehnt' } });
  });

  it('registriert, aber Liste nicht ladbar: angemeldet ohne Liste, Hinweis bleibt, Fehler sichtbar', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.passkeys.mockRejectedValueOnce(netzFehler());
    await expect(steuerung.registrieren('anna')).resolves.toBe(false);
    expect(z()).toMatchObject({
      status: 'angemeldet',
      passkeys: null,
      laeuft: null,
      zweitenPasskeyEmpfehlen: true,
      fehler: { art: 'nicht-erreichbar' },
    });
    await steuerung.pruefen();
    expect(z()).toMatchObject({ status: 'angemeldet', passkeys: [PASSKEY_1], fehler: null });
  });
});

describe('Anmelden', () => {
  it('Erfolg: Optionen, get, Abschluss, Liste; kein Hinweis auf zweiten Passkey', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    await expect(steuerung.anmelden()).resolves.toBe(true);
    expect(pb.abrufen).toHaveBeenCalledWith(ABRUF_OPTIONEN);
    expect(api.anmelden).toHaveBeenCalledWith(ANMELDE_CREDENTIAL);
    expect(z()).toMatchObject({
      status: 'angemeldet',
      passkeys: [PASSKEY_1],
      laeuft: null,
      fehler: null,
      zweitenPasskeyEmpfehlen: false,
    });
  });

  it('lädt: laeuft = anmelden', async () => {
    const { steuerung, z, pb } = await abgemeldet();
    const abgerufen = offen<unknown>();
    pb.abrufen.mockReturnValueOnce(abgerufen.versprechen);
    const p = steuerung.anmelden();
    expect(z().laeuft).toBe('anmelden');
    abgerufen.aufloesen(ANMELDE_CREDENTIAL);
    await p;
    expect(z().laeuft).toBeNull();
  });

  it('abgebrochen: kein Abschluss', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    pb.abrufen.mockRejectedValueOnce(browserFehler('abgebrochen'));
    await expect(steuerung.anmelden()).resolves.toBe(false);
    expect(api.anmelden).not.toHaveBeenCalled();
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: { art: 'abgebrochen' } });
  });

  it('429 ohne Retry-After: Wartezeit unbekannt', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.anmeldeOptionen.mockRejectedValueOnce(httpFehler(429, 'ZU_VIELE_ANFRAGEN'));
    await steuerung.anmelden();
    expect(z().fehler).toEqual({ art: 'zu-viele-anfragen', wartezeitSekunden: null, erneutAb: null });
  });

  it('offline', async () => {
    const { steuerung, z, api, offline } = await abgemeldet();
    offline.wert = true;
    api.anmeldeOptionen.mockRejectedValueOnce(netzFehler());
    await steuerung.anmelden();
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: { art: 'nicht-erreichbar', offline: true } });
  });

  it('Browser ohne WebAuthn: kein Aufruf', async () => {
    const a = aufbau({ unterstuetzt: false });
    await expect(a.steuerung.anmelden()).resolves.toBe(false);
    expect(a.api.anmeldeOptionen).not.toHaveBeenCalled();
    expect(a.z().fehler).toEqual({ art: 'nicht-unterstuetzt' });
  });

  it('unbekannter Passkey (400 PASSKEY_UNGUELTIG)', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.anmelden.mockRejectedValueOnce(httpFehler(400, 'PASSKEY_UNGUELTIG'));
    await steuerung.anmelden();
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: { art: 'passkey-abgelehnt' } });
  });

  it('403 Origin: zugriff-verweigert', async () => {
    const { steuerung, z, api } = await abgemeldet();
    api.anmelden.mockRejectedValueOnce(httpFehler(403, 'ORIGIN_UNGUELTIG'));
    await steuerung.anmelden();
    expect(z().fehler).toEqual({ art: 'zugriff-verweigert' });
  });

  it('Browserfehler SecurityError: passkey-fehler', async () => {
    const { steuerung, z, pb } = await abgemeldet();
    pb.abrufen.mockRejectedValueOnce(browserFehler('sicherheit'));
    await steuerung.anmelden();
    expect(z().fehler).toEqual({ art: 'passkey-fehler' });
  });

  it('ein neuer Versuch löscht den alten Fehler', async () => {
    const { steuerung, z, pb } = await abgemeldet();
    pb.abrufen.mockRejectedValueOnce(browserFehler('abgebrochen'));
    await steuerung.anmelden();
    expect(z().fehler).not.toBeNull();
    await steuerung.anmelden();
    expect(z()).toMatchObject({ status: 'angemeldet', fehler: null });
  });
});

describe('Weiteren Passkey hinzufügen', () => {
  it('Erfolg: Optionen, create, Abschluss, neue Liste; Hinweis verschwindet', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    await steuerung.registrieren('anna');
    expect(z().zweitenPasskeyEmpfehlen).toBe(true);
    api.passkeys.mockResolvedValueOnce([PASSKEY_1, PASSKEY_2]);
    await expect(steuerung.passkeyHinzufuegen()).resolves.toBe(true);
    expect(api.passkeyOptionen).toHaveBeenCalledTimes(1);
    expect(pb.erzeugen).toHaveBeenLastCalledWith(ERZEUG_OPTIONEN);
    expect(api.passkeyHinzufuegen).toHaveBeenCalledWith(NEUES_CREDENTIAL);
    expect(z()).toMatchObject({
      status: 'angemeldet',
      passkeys: [PASSKEY_1, PASSKEY_2],
      laeuft: null,
      fehler: null,
      zweitenPasskeyEmpfehlen: false,
    });
  });

  it('lädt: laeuft = hinzufuegen', async () => {
    const { steuerung, z, pb } = await angemeldet();
    const erzeugt = offen<unknown>();
    pb.erzeugen.mockReturnValueOnce(erzeugt.versprechen);
    const p = steuerung.passkeyHinzufuegen();
    expect(z().laeuft).toBe('hinzufuegen');
    erzeugt.aufloesen(NEUES_CREDENTIAL);
    await p;
    expect(z().laeuft).toBeNull();
  });

  it('abgebrochen: Liste und Hinweis bleiben', async () => {
    const { steuerung, z, api, pb } = await abgemeldet();
    await steuerung.registrieren('anna');
    pb.erzeugen.mockRejectedValueOnce(browserFehler('abgebrochen'));
    await expect(steuerung.passkeyHinzufuegen()).resolves.toBe(false);
    expect(api.passkeyHinzufuegen).not.toHaveBeenCalled();
    expect(z()).toMatchObject({
      status: 'angemeldet',
      passkeys: [PASSKEY_1],
      zweitenPasskeyEmpfehlen: true,
      fehler: { art: 'abgebrochen' },
    });
  });

  it('derselbe Authenticator (InvalidStateError durch excludeCredentials)', async () => {
    const { steuerung, z, pb } = await angemeldet();
    pb.erzeugen.mockRejectedValueOnce(browserFehler('schon-vorhanden'));
    await steuerung.passkeyHinzufuegen();
    expect(z()).toMatchObject({ status: 'angemeldet', fehler: { art: 'passkey-schon-vorhanden' } });
  });

  it('401 (Sitzung abgelaufen): abgemeldet, Fehler sitzung-abgelaufen', async () => {
    const { steuerung, z, api } = await angemeldet();
    api.passkeyOptionen.mockRejectedValueOnce(httpFehler(401, 'NICHT_ANGEMELDET'));
    await steuerung.passkeyHinzufuegen();
    expect(z()).toMatchObject({
      status: 'abgemeldet',
      passkeys: null,
      laeuft: null,
      zweitenPasskeyEmpfehlen: false,
      fehler: { art: 'sitzung-abgelaufen' },
    });
  });

  it('Server nicht erreichbar: bleibt angemeldet', async () => {
    const { steuerung, z, api } = await angemeldet();
    api.passkeyHinzufuegen.mockRejectedValueOnce(netzFehler());
    await steuerung.passkeyHinzufuegen();
    expect(z()).toMatchObject({ status: 'angemeldet', passkeys: [PASSKEY_1], fehler: { art: 'nicht-erreichbar' } });
  });

  it('Browser ohne WebAuthn: kein Aufruf', async () => {
    const a = aufbau({ unterstuetzt: false });
    await a.steuerung.pruefen();
    await a.steuerung.passkeyHinzufuegen();
    expect(a.api.passkeyOptionen).not.toHaveBeenCalled();
    expect(a.z()).toMatchObject({ status: 'angemeldet', fehler: { art: 'nicht-unterstuetzt' } });
  });
});

describe('Abmelden', () => {
  it('Erfolg: abgemeldet, Liste und Hinweis weg', async () => {
    const { steuerung, z, api } = await abgemeldet();
    await steuerung.registrieren('anna');
    await expect(steuerung.abmelden()).resolves.toBe(true);
    expect(api.abmelden).toHaveBeenCalledTimes(1);
    expect(z()).toMatchObject({
      status: 'abgemeldet',
      passkeys: null,
      laeuft: null,
      fehler: null,
      zweitenPasskeyEmpfehlen: false,
    });
  });

  it('lädt: laeuft = abmelden', async () => {
    const { steuerung, z, api } = await angemeldet();
    const ab = offen<void>();
    api.abmelden.mockReturnValueOnce(ab.versprechen);
    const p = steuerung.abmelden();
    expect(z().laeuft).toBe('abmelden');
    ab.aufloesen();
    await p;
    expect(z().status).toBe('abgemeldet');
  });

  it('401: Sitzung war schon weg, gilt als Erfolg', async () => {
    const { steuerung, z, api } = await angemeldet();
    api.abmelden.mockRejectedValueOnce(httpFehler(401, 'NICHT_ANGEMELDET'));
    await expect(steuerung.abmelden()).resolves.toBe(true);
    expect(z()).toMatchObject({ status: 'abgemeldet', fehler: null });
  });

  it('offline: bleibt angemeldet, Fehler sichtbar', async () => {
    const { steuerung, z, api } = await angemeldet();
    api.abmelden.mockRejectedValueOnce(netzFehler());
    await expect(steuerung.abmelden()).resolves.toBe(false);
    expect(z()).toMatchObject({ status: 'angemeldet', passkeys: [PASSKEY_1], fehler: { art: 'nicht-erreichbar' } });
  });
});

describe('Speicher: abonnieren, Fehler und Hinweis schliessen', () => {
  it('meldet jede Änderung, Abmelden vom Speicher beendet das', async () => {
    const { steuerung } = aufbau();
    const zuhoerer = vi.fn();
    const weg = steuerung.abonnieren(zuhoerer);
    await steuerung.pruefen();
    expect(zuhoerer).toHaveBeenCalled();
    const anzahl = zuhoerer.mock.calls.length;
    weg();
    await steuerung.abmelden();
    expect(zuhoerer).toHaveBeenCalledTimes(anzahl);
  });

  it('gleiche Referenz, solange sich nichts ändert (für useSyncExternalStore)', () => {
    const { steuerung } = aufbau();
    expect(steuerung.holeZustand()).toBe(steuerung.holeZustand());
    steuerung.fehlerSchliessen();
    steuerung.hinweisSchliessen();
    expect(steuerung.holeZustand()).toBe(steuerung.holeZustand());
  });

  it('fehlerSchliessen und hinweisSchliessen', async () => {
    const { steuerung, z, pb } = await abgemeldet();
    await steuerung.registrieren('anna');
    pb.erzeugen.mockRejectedValueOnce(browserFehler('abgebrochen'));
    await steuerung.passkeyHinzufuegen();
    steuerung.fehlerSchliessen();
    expect(z().fehler).toBeNull();
    steuerung.hinweisSchliessen();
    expect(z().zweitenPasskeyEmpfehlen).toBe(false);
    expect(z().status).toBe('angemeldet');
  });
});

describe('ordneKontoFehlerEin', () => {
  const umgebung = { istOffline: () => false, jetzt: () => JETZT };

  it.each<[unknown, KontoFehler]>([
    [httpFehler(500, 'IRGENDWAS'), { art: 'unerwartet', status: 500 }],
    [httpFehler(500), { art: 'nicht-erreichbar', offline: false }],
    [httpFehler(503), { art: 'nicht-erreichbar', offline: false }],
    [httpFehler(504), { art: 'nicht-erreichbar', offline: false }],
    [httpFehler(404, 'PASSKEY_NICHT_GEFUNDEN'), { art: 'unerwartet', status: 404 }],
    [httpFehler(409, 'LETZTER_PASSKEY'), { art: 'unerwartet', status: 409 }],
    [httpFehler(400), { art: 'passkey-abgelehnt' }],
    [new ApiFehler('antwort', { status: 200 }), { art: 'unerwartet', status: 200 }],
    [browserFehler('unbekannt'), { art: 'passkey-fehler' }],
    [browserFehler('nicht-unterstuetzt'), { art: 'nicht-unterstuetzt' }],
    [new Error('irgendwas'), { art: 'unerwartet', status: null }],
  ])('%s', (fehler, erwartet) => {
    expect(ordneKontoFehlerEin(fehler, umgebung)).toEqual(erwartet);
  });
});

describe('kontoFehlerText', () => {
  const alle: KontoFehler[] = [
    { art: 'name-ungueltig', grund: 'zeichen' },
    { art: 'name-ungueltig', grund: 'server' },
    { art: 'name-vergeben' },
    { art: 'abgebrochen' },
    { art: 'passkey-schon-vorhanden' },
    { art: 'passkey-fehler' },
    { art: 'passkey-abgelehnt' },
    { art: 'zu-viele-anfragen', wartezeitSekunden: null, erneutAb: null },
    { art: 'nicht-erreichbar', offline: true },
    { art: 'nicht-erreichbar', offline: false },
    { art: 'nicht-unterstuetzt' },
    { art: 'sitzung-abgelaufen' },
    { art: 'zugriff-verweigert' },
    { art: 'unerwartet', status: 500 },
  ];

  it('jeder Fehler hat einen eigenen Text', () => {
    const texte = alle.map(kontoFehlerText);
    for (const t of texte) expect(t.length).toBeGreaterThan(20);
    expect(new Set(texte).size).toBe(texte.length);
  });

  it('429 nennt die Wartezeit in Sekunden oder Minuten', () => {
    const text = (s: number) => kontoFehlerText({ art: 'zu-viele-anfragen', wartezeitSekunden: s, erneutAb: null });
    expect(text(1)).toContain('in 1 Sekunde ');
    expect(text(30)).toContain('in 30 Sekunden ');
    expect(text(60)).toContain('in 1 Minute ');
    expect(text(61)).toContain('in 2 Minuten ');
  });

  it('Name vergeben, offline, nicht unterstützt: verständlich', () => {
    expect(kontoFehlerText({ art: 'name-vergeben' })).toMatch(/schon vergeben/);
    expect(kontoFehlerText({ art: 'nicht-erreichbar', offline: true })).toMatch(/offline.*Timer/);
    expect(kontoFehlerText({ art: 'nicht-unterstuetzt' })).toMatch(/keine Passkeys/);
  });
});
