import { describe, expect, it, vi } from 'vitest';
import { ApiFehler, erzeugeKontoApi, leseRetryAfter, type FetchFunktion } from './api';

function jsonAntwort(status: number, koerper: unknown, kopf: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { 'Content-Type': 'application/json', ...kopf },
  });
}

function leer(status: number): Response {
  return new Response(null, { status });
}

/** fetch-Attrappe mit fester Antwort; merkt sich die Aufrufe. */
function attrappe(antwort: () => Response | Promise<Response>) {
  const fn = vi.fn<FetchFunktion>(async () => antwort());
  return { fn, api: erzeugeKontoApi(fn) };
}

async function fehlerVon(versprechen: Promise<unknown>): Promise<ApiFehler> {
  try {
    await versprechen;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiFehler);
    return e as ApiFehler;
  }
  throw new Error('kein Fehler geworfen');
}

describe('Anfragen (Pfade, Methode, Körper)', () => {
  it('registrierungsOptionen: POST mit {benutzername}, liefert die Optionen', async () => {
    const optionen = { challenge: 'abc', rp: { id: 'localhost', name: 'x' } };
    const { fn, api } = attrappe(() => jsonAntwort(200, optionen));
    await expect(api.registrierungsOptionen('anna')).resolves.toEqual(optionen);
    const [pfad, init] = fn.mock.calls[0]!;
    expect(pfad).toBe('/v1/registrieren/optionen');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(JSON.parse(init?.body as string)).toEqual({ benutzername: 'anna' });
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('registrieren: POST mit {benutzername, credential}', async () => {
    const { fn, api } = attrappe(() => leer(204));
    await api.registrieren('anna', { id: 'c1', type: 'public-key' });
    const [pfad, init] = fn.mock.calls[0]!;
    expect(pfad).toBe('/v1/registrieren');
    expect(JSON.parse(init?.body as string)).toEqual({
      benutzername: 'anna',
      credential: { id: 'c1', type: 'public-key' },
    });
  });

  it('anmeldeOptionen: POST ohne Körper', async () => {
    const { fn, api } = attrappe(() => jsonAntwort(200, { challenge: 'x', rpId: 'localhost' }));
    await expect(api.anmeldeOptionen()).resolves.toEqual({ challenge: 'x', rpId: 'localhost' });
    const [pfad, init] = fn.mock.calls[0]!;
    expect(pfad).toBe('/v1/anmelden/optionen');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('anmelden und passkeyHinzufuegen: Credential direkt als Körper', async () => {
    const { fn, api } = attrappe(() => leer(204));
    await api.anmelden({ id: 'c1' });
    await api.passkeyHinzufuegen({ id: 'c2' });
    expect(fn.mock.calls[0]![0]).toBe('/v1/anmelden');
    expect(JSON.parse(fn.mock.calls[0]![1]?.body as string)).toEqual({ id: 'c1' });
    expect(fn.mock.calls[1]![0]).toBe('/v1/passkeys');
    expect(fn.mock.calls[1]![1]?.method).toBe('POST');
    expect(JSON.parse(fn.mock.calls[1]![1]?.body as string)).toEqual({ id: 'c2' });
  });

  it('passkeyOptionen und abmelden: POST ohne Körper', async () => {
    const { fn, api } = attrappe(() => jsonAntwort(200, { challenge: 'y' }));
    await api.passkeyOptionen();
    expect(fn.mock.calls[0]![0]).toBe('/v1/passkeys/optionen');
    const ab = attrappe(() => leer(204));
    await expect(ab.api.abmelden()).resolves.toBeUndefined();
    expect(ab.fn.mock.calls[0]![0]).toBe('/v1/abmelden');
    expect(ab.fn.mock.calls[0]![1]?.method).toBe('POST');
  });

  it('passkeys: GET, liefert nur die bekannten Felder, fehlendes zuletztVerwendetAm wird null', async () => {
    const { fn, api } = attrappe(() =>
      jsonAntwort(200, [
        { id: 'a', bezeichnung: 'Passkey 1', erstelltAm: '2026-11-01', zuletztVerwendetAm: '2026-11-18', extra: 1 },
        { id: 'b', bezeichnung: '<b>Laptop</b>', erstelltAm: '2026-11-02' },
      ]),
    );
    await expect(api.passkeys()).resolves.toEqual([
      { id: 'a', bezeichnung: 'Passkey 1', erstelltAm: '2026-11-01', zuletztVerwendetAm: '2026-11-18' },
      { id: 'b', bezeichnung: '<b>Laptop</b>', erstelltAm: '2026-11-02', zuletztVerwendetAm: null },
    ]);
    expect(fn.mock.calls[0]![0]).toBe('/v1/passkeys');
    expect(fn.mock.calls[0]![1]?.method).toBe('GET');
  });
});

describe('Fehlerabbildung', () => {
  it.each([
    [400, 'BENUTZERNAME_UNGUELTIG'],
    [400, 'PASSKEY_UNGUELTIG'],
    [401, 'NICHT_ANGEMELDET'],
    [403, 'ORIGIN_UNGUELTIG'],
    [409, 'BENUTZERNAME_VERGEBEN'],
  ])('%i mit FehlerV1 %s: Status und Code', async (status, code) => {
    const { api } = attrappe(() => jsonAntwort(status, { code, meldung: 'Text' }));
    const f = await fehlerVon(api.registrierungsOptionen('anna'));
    expect(f).toMatchObject({ art: 'http', status, code, message: 'Text', wartezeitSekunden: null });
  });

  it('429 mit Retry-After in Sekunden', async () => {
    const { api } = attrappe(() =>
      jsonAntwort(429, { code: 'ZU_VIELE_ANFRAGEN', meldung: 'x' }, { 'Retry-After': '42' }),
    );
    const f = await fehlerVon(api.anmeldeOptionen());
    expect(f).toMatchObject({ art: 'http', status: 429, code: 'ZU_VIELE_ANFRAGEN', wartezeitSekunden: 42 });
  });

  it('429 ohne Retry-After: Wartezeit unbekannt', async () => {
    const { api } = attrappe(() => jsonAntwort(429, { code: 'ZU_VIELE_ANFRAGEN' }));
    const f = await fehlerVon(api.anmeldeOptionen());
    expect(f.wartezeitSekunden).toBeNull();
  });

  it('Fehler ohne JSON-Körper (z. B. 502 vom Dev-Proxy, 400 ohne FehlerV1): Status ohne Code', async () => {
    const { api } = attrappe(
      () => new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } }),
    );
    const f = await fehlerVon(api.passkeys());
    expect(f).toMatchObject({ art: 'http', status: 502, code: null });
  });

  it('JSON-Körper ohne code gilt nicht als FehlerV1', async () => {
    const { api } = attrappe(() => jsonAntwort(400, { title: 'Bad Request' }));
    const f = await fehlerVon(api.registrierungsOptionen('anna'));
    expect(f).toMatchObject({ art: 'http', status: 400, code: null });
  });

  it('Netzfehler (fetch wirft, z. B. offline): art netz ohne Status', async () => {
    const { api } = attrappe(() => {
      throw new TypeError('Failed to fetch');
    });
    const f = await fehlerVon(api.passkeys());
    expect(f).toMatchObject({ art: 'netz', status: null, code: null });
    expect(f.cause).toBeInstanceOf(TypeError);
  });

  it('2xx mit unlesbarem Körper: art antwort', async () => {
    const { api } = attrappe(() => new Response('<html>', { status: 200 }));
    expect(await fehlerVon(api.passkeys())).toMatchObject({ art: 'antwort', status: 200 });
    const b = attrappe(() => jsonAntwort(200, { kein: 'array' }));
    expect(await fehlerVon(b.api.passkeys())).toMatchObject({ art: 'antwort' });
    const c = attrappe(() => jsonAntwort(200, [{ id: 'a' }]));
    expect(await fehlerVon(c.api.passkeys())).toMatchObject({ art: 'antwort' });
  });
});

describe('leseRetryAfter', () => {
  it('Sekunden als Zahl', () => {
    expect(leseRetryAfter('0')).toBe(0);
    expect(leseRetryAfter(' 120 ')).toBe(120);
  });

  it('HTTP-Datum relativ zu jetzt, aufgerundet, nie negativ', () => {
    const jetzt = Date.parse('2026-11-18T12:00:00Z');
    expect(leseRetryAfter('Wed, 18 Nov 2026 12:00:30 GMT', jetzt - 500)).toBe(31);
    expect(leseRetryAfter('Wed, 18 Nov 2026 11:00:00 GMT', jetzt)).toBe(0);
  });

  it('fehlend oder unlesbar ergibt null', () => {
    expect(leseRetryAfter(null)).toBeNull();
    expect(leseRetryAfter('bald')).toBeNull();
    expect(leseRetryAfter('-5')).toBeNull();
  });
});
