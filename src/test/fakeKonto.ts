import { vi } from 'vitest';
import { ApiFehler, type KontoApi, type Passkey } from '../konto/api';
import { PasskeyBrowserFehler, type PasskeyFehlerArt, type PasskeyBrowser } from '../konto/passkeyBrowser';

export const PASSKEY_1: Passkey = {
  id: 'cred-1',
  bezeichnung: 'Passkey 1',
  erstelltAm: '2026-11-01',
  zuletztVerwendetAm: '2026-11-18',
};

export const PASSKEY_2: Passkey = {
  id: 'cred-2',
  bezeichnung: 'Passkey 2',
  erstelltAm: '2026-11-18',
  zuletztVerwendetAm: null,
};

export const ERZEUG_OPTIONEN = { challenge: 'reg' } as unknown as PublicKeyCredentialCreationOptionsJSON;
export const ABRUF_OPTIONEN = { challenge: 'anm', rpId: 'localhost' } as unknown as PublicKeyCredentialRequestOptionsJSON;
export const NEUES_CREDENTIAL = { id: 'neu', type: 'public-key', response: { attestationObject: 'x' } };
export const ANMELDE_CREDENTIAL = { id: 'cred-1', type: 'public-key', response: { signature: 'y' } };

/** Fake der API: alle Aufrufe erfolgreich, einzelne per `mockRejectedValueOnce` umstellbar. */
export function fakeApi(passkeys: Passkey[] = [PASSKEY_1]) {
  return {
    registrierungsOptionen: vi.fn<KontoApi['registrierungsOptionen']>(async () => ERZEUG_OPTIONEN),
    registrieren: vi.fn<KontoApi['registrieren']>(async () => undefined),
    anmeldeOptionen: vi.fn<KontoApi['anmeldeOptionen']>(async () => ABRUF_OPTIONEN),
    anmelden: vi.fn<KontoApi['anmelden']>(async () => undefined),
    abmelden: vi.fn<KontoApi['abmelden']>(async () => undefined),
    passkeys: vi.fn<KontoApi['passkeys']>(async () => passkeys),
    passkeyOptionen: vi.fn<KontoApi['passkeyOptionen']>(async () => ERZEUG_OPTIONEN),
    passkeyHinzufuegen: vi.fn<KontoApi['passkeyHinzufuegen']>(async () => undefined),
  } satisfies KontoApi;
}

/** Fake der WebAuthn-Aufrufe: erfolgreich, `unterstuetzt` umstellbar. */
export function fakePasskeyBrowser(unterstuetzt = true) {
  return {
    unterstuetzt: vi.fn<PasskeyBrowser['unterstuetzt']>(() => unterstuetzt),
    erzeugen: vi.fn<PasskeyBrowser['erzeugen']>(async () => NEUES_CREDENTIAL),
    abrufen: vi.fn<PasskeyBrowser['abrufen']>(async () => ANMELDE_CREDENTIAL),
  } satisfies PasskeyBrowser;
}

export function httpFehler(
  status: number,
  code: string | null = null,
  wartezeitSekunden: number | null = null,
): ApiFehler {
  return new ApiFehler('http', { status, code, wartezeitSekunden });
}

export const netzFehler = (): ApiFehler => new ApiFehler('netz', { cause: new TypeError('Failed to fetch') });

export const browserFehler = (art: PasskeyFehlerArt): PasskeyBrowserFehler => new PasskeyBrowserFehler(art);
