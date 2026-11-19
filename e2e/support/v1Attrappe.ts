import type { Page, Route } from '@playwright/test';

export interface MockBenutzer {
  id: string;
  benutzername: string;
  rolle: string;
  erstelltAm: string;
  einwilligungAm: string;
}

export interface MockPasskey {
  id: string;
  credentialId: string;
  bezeichnung: string;
  erstelltAm: string;
  zuletztVerwendetAm?: string;
}

export interface MockTimerEinstellung {
  trainingSekunden: number;
  pauseSekunden: number;
  gespeichert: boolean;
}

export interface MockSatz {
  id: string;
  position: number;
  wiederholungen?: number;
  dauerSekunden?: number;
  gewichtKg?: number;
  pauseSekunden?: number;
}

export interface MockUebung {
  id: string;
  position: number;
  name: string;
  variante?: string;
  saetze: MockSatz[];
}

export interface MockWorkout {
  id: string;
  typ: 'KRAFT' | 'CALISTHENICS';
  titel: string;
  startZeit: string;
  dauerSekunden?: number;
  notiz?: string;
  sichtbarkeit: 'PRIVAT' | 'OEFFENTLICH';
  herkunft: 'MANUELL' | 'IMPORT';
  erstelltAm: string;
  geaendertAm: string;
  version: number;
  uebungen: MockUebung[];
}

export interface V1AttrappeOptionen {
  initialAngemeldet?: boolean;
  initialBenutzer?: MockBenutzer;
  initialPasskeys?: MockPasskey[];
  initialTimer?: MockTimerEinstellung;
  initialWorkouts?: MockWorkout[];
}

export interface V1AttrappeZustand {
  angemeldet: boolean;
  benutzer: MockBenutzer | null;
  passkeys: MockPasskey[];
  timer: MockTimerEinstellung;
  workouts: MockWorkout[];
  naechsterFehler: {
    pfad?: string;
    methode?: string;
    status: number;
    code: string;
    meldung: string;
    retryAfter?: string;
  } | null;
  letztesRegistrierenCredential: unknown;
  letztesAnmeldenCredential: unknown;
  timerPutAufrufe: Array<{ trainingSekunden: number; pauseSekunden: number }>;
}

const STANDARD_BENUTZER: MockBenutzer = {
  id: '11111111-1111-1111-1111-111111111111',
  benutzername: 'max.muster',
  rolle: 'USER',
  erstelltAm: '2026-11-19T12:00:00Z',
  einwilligungAm: '2026-11-19T12:00:00Z',
};

function erzeugeBase64Url(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64url');
}

function erzeugePasskeyUuid(nummer: number): string {
  const hex = nummer.toString(16).padStart(12, '0');
  return `aaaaaaaa-aaaa-4aaa-8aaa-${hex}`;
}

function erzeugeWorkoutUuid(praefix: string, nummer: number): string {
  const hex = nummer.toString(16).padStart(12, '0');
  return `${praefix}-4aaa-8aaa-${hex}`;
}

async function antworteJson(
  route: Route,
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  });
}

export async function installiereV1Attrappe(
  page: Page,
  optionen: V1AttrappeOptionen = {},
): Promise<V1AttrappeZustand> {
  let passkeyZaehler = optionen.initialPasskeys?.length ?? 0;
  let workoutZaehler = optionen.initialWorkouts?.length ?? 0;
  let uebungZaehler = 0;
  let satzZaehler = 0;

  const zustand: V1AttrappeZustand = {
    angemeldet: optionen.initialAngemeldet ?? false,
    benutzer: optionen.initialBenutzer ?? (optionen.initialAngemeldet ? STANDARD_BENUTZER : null),
    passkeys: optionen.initialPasskeys ? [...optionen.initialPasskeys] : [],
    timer: optionen.initialTimer
      ? { ...optionen.initialTimer }
      : { trainingSekunden: 30, pauseSekunden: 10, gespeichert: false },
    workouts: optionen.initialWorkouts
      ? optionen.initialWorkouts.map((w) => structuredClone(w))
      : [],
    naechsterFehler: null,
    letztesRegistrierenCredential: null,
    letztesAnmeldenCredential: null,
    timerPutAufrufe: [],
  };

  const formatPasskey = (p: MockPasskey) => ({
    id: p.id,
    bezeichnung: p.bezeichnung,
    erstelltAm: p.erstelltAm,
    ...(p.zuletztVerwendetAm ? { zuletztVerwendetAm: p.zuletztVerwendetAm } : {}),
  });

  await page.context().route('**/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pfad = url.pathname;
    const methode = request.method();

    if (
      zustand.naechsterFehler &&
      (!zustand.naechsterFehler.pfad || zustand.naechsterFehler.pfad === pfad) &&
      (!zustand.naechsterFehler.methode || zustand.naechsterFehler.methode === methode)
    ) {
      const fehler = zustand.naechsterFehler;
      zustand.naechsterFehler = null;
      await antworteJson(
        route,
        { code: fehler.code, meldung: fehler.meldung },
        fehler.status,
        fehler.retryAfter ? { 'Retry-After': fehler.retryAfter } : undefined,
      );
      return;
    }

    if (pfad === '/v1/ich' && methode === 'GET') {
      if (!zustand.angemeldet || !zustand.benutzer) {
        await antworteJson(
          route,
          { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' },
          401,
        );
        return;
      }
      await antworteJson(route, zustand.benutzer);
      return;
    }

    if (pfad === '/v1/registrieren/optionen' && methode === 'POST') {
      const body = request.postDataJSON() as {
        benutzername?: string;
        einwilligungErteilt?: boolean;
      };
      if (!body.benutzername || !body.einwilligungErteilt) {
        await antworteJson(
          route,
          { code: 'VALIDIERUNG_FEHLGESCHLAGEN', meldung: 'Benutzername und Einwilligung erforderlich.' },
          400,
        );
        return;
      }
      const userId = '11111111-1111-4111-8111-111111111111';
      await antworteJson(route, {
        optionen: {
          rp: { id: 'localhost', name: 'Trainingsapp' },
          user: {
            id: erzeugeBase64Url(userId),
            name: body.benutzername,
            displayName: body.benutzername,
          },
          challenge: erzeugeBase64Url(`reg-${body.benutzername}-${Date.now()}`),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: 60_000,
          excludeCredentials: [],
          authenticatorSelection: {
            residentKey: 'required',
            requireResidentKey: true,
            userVerification: 'preferred',
          },
          attestation: 'none',
          extensions: null,
        },
      });
      return;
    }

    if (pfad === '/v1/registrieren' && methode === 'POST') {
      const body = request.postDataJSON() as {
        benutzername: string;
        credential: { id: string };
        bezeichnung?: string;
      };
      zustand.letztesRegistrierenCredential = body.credential;
      passkeyZaehler = 1;
      zustand.benutzer = {
        id: '11111111-1111-4111-8111-111111111111',
        benutzername: body.benutzername,
        rolle: 'USER',
        erstelltAm: '2026-11-19T12:00:00Z',
        einwilligungAm: '2026-11-19T12:00:00Z',
      };
      zustand.passkeys = [
        {
          id: erzeugePasskeyUuid(passkeyZaehler),
          credentialId: body.credential.id,
          bezeichnung: body.bezeichnung ?? 'Passkey 1',
          erstelltAm: '2026-11-19',
        },
      ];
      zustand.angemeldet = true;
      await antworteJson(route, zustand.benutzer, 201);
      return;
    }

    if (pfad === '/v1/anmelden/optionen' && methode === 'POST') {
      const body = (request.postDataJSON() ?? {}) as { benutzername?: string };
      const allowCredentials =
        body.benutzername && zustand.passkeys.length > 0
          ? zustand.passkeys.map((p) => ({
              type: 'public-key',
              id: p.credentialId,
              transports: null,
            }))
          : [];
      await antworteJson(route, {
        optionen: {
          challenge: erzeugeBase64Url(`login-${Date.now()}`),
          timeout: 60_000,
          rpId: 'localhost',
          allowCredentials,
          userVerification: 'preferred',
          extensions: null,
        },
      });
      return;
    }

    if (pfad === '/v1/anmelden' && methode === 'POST') {
      const body = request.postDataJSON() as { credential: { id: string } };
      zustand.letztesAnmeldenCredential = body.credential;
      if (!zustand.benutzer) {
        zustand.benutzer = STANDARD_BENUTZER;
      }
      zustand.passkeys = zustand.passkeys.map((p) =>
        p.credentialId === body.credential.id ? { ...p, zuletztVerwendetAm: '2026-11-20' } : p,
      );
      zustand.angemeldet = true;
      await antworteJson(route, zustand.benutzer);
      return;
    }

    if (pfad === '/v1/abmelden' && methode === 'POST') {
      zustand.angemeldet = false;
      await route.fulfill({ status: 204 });
      return;
    }

    if (pfad === '/v1/passkeys' && methode === 'GET') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      await antworteJson(route, zustand.passkeys.map(formatPasskey));
      return;
    }

    if (pfad === '/v1/passkeys/optionen' && methode === 'POST') {
      if (!zustand.angemeldet || !zustand.benutzer) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      await antworteJson(route, {
        optionen: {
          rp: { id: 'localhost', name: 'Trainingsapp' },
          user: {
            id: erzeugeBase64Url(zustand.benutzer.id),
            name: zustand.benutzer.benutzername,
            displayName: zustand.benutzer.benutzername,
          },
          challenge: erzeugeBase64Url(`add-${Date.now()}`),
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          timeout: 60_000,
          excludeCredentials: zustand.passkeys.map((p) => ({
            type: 'public-key',
            id: p.credentialId,
            transports: null,
          })),
          authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'preferred',
          },
          attestation: 'none',
          extensions: null,
        },
      });
      return;
    }

    if (pfad === '/v1/passkeys' && methode === 'POST') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const body = request.postDataJSON() as { credential: { id: string }; bezeichnung?: string };
      passkeyZaehler += 1;
      const neu: MockPasskey = {
        id: erzeugePasskeyUuid(passkeyZaehler),
        credentialId: body.credential.id,
        bezeichnung: body.bezeichnung ?? `Passkey ${passkeyZaehler}`,
        erstelltAm: '2026-11-19',
      };
      zustand.passkeys.push(neu);
      await antworteJson(route, formatPasskey(neu), 201);
      return;
    }

    const passkeyIdTreffer = /^\/v1\/passkeys\/([0-9a-f-]+)$/i.exec(pfad);
    if (passkeyIdTreffer) {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const id = passkeyIdTreffer[1];
      const gefunden = zustand.passkeys.find((p) => p.id === id);
      if (!gefunden) {
        await antworteJson(route, { code: 'NICHT_GEFUNDEN', meldung: 'Passkey nicht gefunden.' }, 404);
        return;
      }

      if (methode === 'PATCH') {
        const body = request.postDataJSON() as { bezeichnung: string };
        gefunden.bezeichnung = body.bezeichnung.trim();
        await antworteJson(route, formatPasskey(gefunden));
        return;
      }

      if (methode === 'DELETE') {
        if (zustand.passkeys.length <= 1) {
          await antworteJson(
            route,
            {
              code: 'LETZTER_PASSKEY',
              meldung: 'Der letzte Passkey kann nicht gelöscht werden.',
            },
            409,
          );
          return;
        }
        zustand.passkeys = zustand.passkeys.filter((p) => p.id !== id);
        await route.fulfill({ status: 204 });
        return;
      }
    }

    if (pfad === '/v1/timer/einstellung') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      if (methode === 'GET') {
        await antworteJson(route, zustand.timer);
        return;
      }
      if (methode === 'PUT') {
        const body = request.postDataJSON() as { trainingSekunden: number; pauseSekunden: number };
        zustand.timerPutAufrufe.push(body);
        zustand.timer = {
          trainingSekunden: body.trainingSekunden,
          pauseSekunden: body.pauseSekunden,
          gespeichert: true,
        };
        await antworteJson(route, zustand.timer);
        return;
      }
    }

    if (pfad === '/v1/workouts') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }

      if (methode === 'GET') {
        const typFilter = url.searchParams.get('typ');
        const gefiltert = zustand.workouts
          .filter((w) => (!typFilter ? true : w.typ === typFilter))
          .sort((a, b) => b.startZeit.localeCompare(a.startZeit));
        await antworteJson(route, gefiltert);
        return;
      }

      if (methode === 'POST') {
        const body = request.postDataJSON() as {
          typ: 'KRAFT' | 'CALISTHENICS';
          titel: string;
          startZeit: string;
          dauerSekunden?: number;
          notiz?: string;
          sichtbarkeit?: 'PRIVAT' | 'OEFFENTLICH';
          uebungen?: Array<{
            name: string;
            variante?: string;
            saetze?: Array<{
              wiederholungen?: number;
              dauerSekunden?: number;
              gewichtKg?: number;
              pauseSekunden?: number;
            }>;
          }>;
        };

        workoutZaehler += 1;
        const jetztIso = '2026-11-19T18:00:00Z';
        const neu: MockWorkout = {
          id: erzeugeWorkoutUuid('bbbbbbbb-bbbb', workoutZaehler),
          typ: body.typ,
          titel: body.titel.trim(),
          startZeit: body.startZeit,
          ...(body.dauerSekunden !== undefined ? { dauerSekunden: body.dauerSekunden } : {}),
          ...(body.notiz ? { notiz: body.notiz.trim() } : {}),
          sichtbarkeit: body.sichtbarkeit ?? 'PRIVAT',
          herkunft: 'MANUELL',
          erstelltAm: jetztIso,
          geaendertAm: jetztIso,
          version: 1,
          uebungen: (body.uebungen ?? []).map((u, uIndex) => {
            uebungZaehler += 1;
            return {
              id: erzeugeWorkoutUuid('cccccccc-cccc', uebungZaehler),
              position: uIndex,
              name: u.name.trim(),
              ...(u.variante ? { variante: u.variante.trim() } : {}),
              saetze: (u.saetze ?? []).map((s, sIndex) => {
                satzZaehler += 1;
                return {
                  id: erzeugeWorkoutUuid('dddddddd-dddd', satzZaehler),
                  position: sIndex,
                  ...(s.wiederholungen !== undefined ? { wiederholungen: s.wiederholungen } : {}),
                  ...(s.dauerSekunden !== undefined ? { dauerSekunden: s.dauerSekunden } : {}),
                  ...(s.gewichtKg !== undefined ? { gewichtKg: s.gewichtKg } : {}),
                  ...(s.pauseSekunden !== undefined ? { pauseSekunden: s.pauseSekunden } : {}),
                };
              }),
            };
          }),
        };

        zustand.workouts.push(neu);
        await antworteJson(route, neu, 201, { Location: `/v1/workouts/${neu.id}` });
        return;
      }
    }

    const workoutIdTreffer = /^\/v1\/workouts\/([0-9a-f-]+)$/i.exec(pfad);
    if (workoutIdTreffer) {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }

      const id = workoutIdTreffer[1];
      const gefundenIndex = zustand.workouts.findIndex((w) => w.id === id);
      if (gefundenIndex === -1) {
        await antworteJson(
          route,
          { code: 'WORKOUT_NICHT_GEFUNDEN', meldung: 'Das gesuchte Workout wurde nicht gefunden.' },
          404,
        );
        return;
      }

      const gefunden = zustand.workouts[gefundenIndex]!;

      if (methode === 'GET') {
        await antworteJson(route, gefunden);
        return;
      }

      if (methode === 'PUT') {
        const body = request.postDataJSON() as {
          version: number;
          typ: 'KRAFT' | 'CALISTHENICS';
          titel: string;
          startZeit: string;
          dauerSekunden?: number;
          notiz?: string;
          sichtbarkeit?: 'PRIVAT' | 'OEFFENTLICH';
          uebungen?: Array<{
            name: string;
            variante?: string;
            saetze?: Array<{
              wiederholungen?: number;
              dauerSekunden?: number;
              gewichtKg?: number;
              pauseSekunden?: number;
            }>;
          }>;
        };

        if (body.version !== gefunden.version) {
          await antworteJson(
            route,
            {
              code: 'WORKOUT_VERSIONSKONFLIKT',
              meldung: 'Das Workout wurde zwischenzeitlich geändert. Bitte lade es neu.',
            },
            409,
          );
          return;
        }

        const aktualisiert: MockWorkout = {
          ...gefunden,
          typ: body.typ,
          titel: body.titel.trim(),
          startZeit: body.startZeit,
          dauerSekunden: body.dauerSekunden,
          notiz: body.notiz ? body.notiz.trim() : undefined,
          sichtbarkeit: body.sichtbarkeit ?? 'PRIVAT',
          geaendertAm: '2026-11-19T19:00:00Z',
          version: gefunden.version + 1,
          uebungen: (body.uebungen ?? []).map((u, uIndex) => {
            uebungZaehler += 1;
            return {
              id: erzeugeWorkoutUuid('cccccccc-cccc', uebungZaehler),
              position: uIndex,
              name: u.name.trim(),
              ...(u.variante ? { variante: u.variante.trim() } : {}),
              saetze: (u.saetze ?? []).map((s, sIndex) => {
                satzZaehler += 1;
                return {
                  id: erzeugeWorkoutUuid('dddddddd-dddd', satzZaehler),
                  position: sIndex,
                  ...(s.wiederholungen !== undefined ? { wiederholungen: s.wiederholungen } : {}),
                  ...(s.dauerSekunden !== undefined ? { dauerSekunden: s.dauerSekunden } : {}),
                  ...(s.gewichtKg !== undefined ? { gewichtKg: s.gewichtKg } : {}),
                  ...(s.pauseSekunden !== undefined ? { pauseSekunden: s.pauseSekunden } : {}),
                };
              }),
            };
          }),
        };

        zustand.workouts[gefundenIndex] = aktualisiert;
        await antworteJson(route, aktualisiert);
        return;
      }

      if (methode === 'DELETE') {
        zustand.workouts.splice(gefundenIndex, 1);
        await route.fulfill({ status: 204 });
        return;
      }
    }

    await antworteJson(route, { code: 'NICHT_GEFUNDEN', meldung: `Unbekannter Pfad: ${pfad}` }, 404);
  });

  return zustand;
}
