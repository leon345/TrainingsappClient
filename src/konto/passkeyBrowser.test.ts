import { describe, expect, it, vi } from 'vitest';
import {
  PasskeyBrowserFehler,
  erzeugeBrowserPasskeys,
  ordnePasskeyFehlerEin,
  type WebAuthnUmgebung,
} from './passkeyBrowser';

const erzeugOptionen = { challenge: 'c' } as unknown as PublicKeyCredentialCreationOptionsJSON;
const abrufOptionen = { challenge: 'c', rpId: 'localhost' } as unknown as PublicKeyCredentialRequestOptionsJSON;

function umgebung(ergebnis: () => Promise<Credential | null>) {
  const create = vi.fn(ergebnis);
  const get = vi.fn(ergebnis);
  const parseCreationOptionsFromJSON = vi.fn((o: unknown) => ({ geparst: o }) as never);
  const parseRequestOptionsFromJSON = vi.fn((o: unknown) => ({ geparst: o }) as never);
  const u: WebAuthnUmgebung = {
    PublicKeyCredential: { parseCreationOptionsFromJSON, parseRequestOptionsFromJSON },
    navigator: { credentials: { create, get } },
  };
  return { u, create, get, parseCreationOptionsFromJSON, parseRequestOptionsFromJSON };
}

const credential = { toJSON: () => ({ id: 'c1', type: 'public-key' }) } as unknown as Credential;

function domFehler(name: string): Error {
  const e = new Error(name);
  e.name = name;
  return e;
}

describe('erzeugeBrowserPasskeys', () => {
  it('erzeugen: Optionen per parseCreationOptionsFromJSON, Ergebnis per toJSON', async () => {
    const m = umgebung(async () => credential);
    const pb = erzeugeBrowserPasskeys(m.u);
    expect(pb.unterstuetzt()).toBe(true);
    await expect(pb.erzeugen(erzeugOptionen)).resolves.toEqual({ id: 'c1', type: 'public-key' });
    expect(m.parseCreationOptionsFromJSON).toHaveBeenCalledWith(erzeugOptionen);
    expect(m.create).toHaveBeenCalledWith({ publicKey: { geparst: erzeugOptionen } });
  });

  it('abrufen: Optionen per parseRequestOptionsFromJSON, Ergebnis per toJSON', async () => {
    const m = umgebung(async () => credential);
    const pb = erzeugeBrowserPasskeys(m.u);
    await expect(pb.abrufen(abrufOptionen)).resolves.toEqual({ id: 'c1', type: 'public-key' });
    expect(m.get).toHaveBeenCalledWith({ publicKey: { geparst: abrufOptionen } });
  });

  it.each<[string, WebAuthnUmgebung]>([
    ['ohne PublicKeyCredential', { navigator: { credentials: { create: vi.fn(), get: vi.fn() } } }],
    [
      'ohne JSON-Hilfsfunktionen',
      { PublicKeyCredential: {}, navigator: { credentials: { create: vi.fn(), get: vi.fn() } } },
    ],
    [
      'ohne navigator.credentials',
      {
        PublicKeyCredential: { parseCreationOptionsFromJSON: vi.fn(), parseRequestOptionsFromJSON: vi.fn() },
        navigator: {},
      },
    ],
  ])('%s: nicht unterstützt, Aufrufe werfen nicht-unterstuetzt', async (_, u) => {
    const pb = erzeugeBrowserPasskeys(u);
    expect(pb.unterstuetzt()).toBe(false);
    await expect(pb.erzeugen(erzeugOptionen)).rejects.toMatchObject({ art: 'nicht-unterstuetzt' });
    await expect(pb.abrufen(abrufOptionen)).rejects.toMatchObject({ art: 'nicht-unterstuetzt' });
  });

  it('jsdom ohne WebAuthn gilt als nicht unterstützt', () => {
    expect(erzeugeBrowserPasskeys().unterstuetzt()).toBe(false);
  });

  it('kein Ergebnis (null) gilt als abgebrochen', async () => {
    const pb = erzeugeBrowserPasskeys(umgebung(async () => null).u);
    await expect(pb.abrufen(abrufOptionen)).rejects.toMatchObject({ art: 'abgebrochen' });
  });

  it('Credential ohne toJSON: nicht unterstützt', async () => {
    const pb = erzeugeBrowserPasskeys(umgebung(async () => ({}) as Credential).u);
    await expect(pb.erzeugen(erzeugOptionen)).rejects.toMatchObject({ art: 'nicht-unterstuetzt' });
  });

  it('Fehler des Browsers werden eingeordnet, Ursache bleibt erhalten', async () => {
    const ursache = domFehler('NotAllowedError');
    const pb = erzeugeBrowserPasskeys(umgebung(async () => Promise.reject(ursache)).u);
    const f = await pb.erzeugen(erzeugOptionen).catch((e: unknown) => e);
    expect(f).toBeInstanceOf(PasskeyBrowserFehler);
    expect(f).toMatchObject({ art: 'abgebrochen', cause: ursache });
  });

  it('ungültige Optionen (parse wirft TypeError): unbekannt', async () => {
    const m = umgebung(async () => credential);
    m.u.PublicKeyCredential!.parseRequestOptionsFromJSON = () => {
      throw new TypeError('kaputt');
    };
    await expect(erzeugeBrowserPasskeys(m.u).abrufen(abrufOptionen)).rejects.toMatchObject({
      art: 'unbekannt',
    });
  });
});

describe('ordnePasskeyFehlerEin', () => {
  it.each([
    ['NotAllowedError', 'abgebrochen'],
    ['AbortError', 'abgebrochen'],
    ['InvalidStateError', 'schon-vorhanden'],
    ['NotSupportedError', 'nicht-unterstuetzt'],
    ['SecurityError', 'sicherheit'],
    ['UnknownError', 'unbekannt'],
  ])('%s -> %s', (name, art) => {
    expect(ordnePasskeyFehlerEin(domFehler(name)).art).toBe(art);
  });

  it('Werte ohne Namen: unbekannt; schon eingeordnete bleiben', () => {
    expect(ordnePasskeyFehlerEin('text').art).toBe('unbekannt');
    expect(ordnePasskeyFehlerEin(null).art).toBe('unbekannt');
    const f = new PasskeyBrowserFehler('abgebrochen');
    expect(ordnePasskeyFehlerEin(f)).toBe(f);
  });
});
