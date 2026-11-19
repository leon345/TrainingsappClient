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
  herkunft: 'MANUELL' | 'APPLE_HEALTH';
  erstelltAm: string;
  geaendertAm: string;
  version: number;
  uebungen: MockUebung[];
}

export interface MockEinladung {
  id: string;
  workoutId: string;
  eingeladenerId: string;
  eingeladenerBenutzername: string;
  status: 'AKTIV';
  erstelltAm: string;
}

export interface MockBenutzerKurz {
  id: string;
  benutzername: string;
}

export interface MockGeteiltesWorkout extends MockWorkout {
  ownerId: string;
  ownerBenutzername: string;
  eingeladenAm: string;
}

export interface V1AttrappeOptionen {
  initialAngemeldet?: boolean;
  initialBenutzer?: MockBenutzer;
  initialPasskeys?: MockPasskey[];
  initialTimer?: MockTimerEinstellung;
  initialWorkouts?: MockWorkout[];
  initialEinladungen?: MockEinladung[];
  initialSuchbareBenutzer?: MockBenutzerKurz[];
  initialGeteilteWorkouts?: MockGeteiltesWorkout[];
  initialProfilWorkouts?: Record<string, MockWorkout[]>;
}

export interface V1AttrappeZustand {
  angemeldet: boolean;
  benutzer: MockBenutzer | null;
  passkeys: MockPasskey[];
  timer: MockTimerEinstellung;
  workouts: MockWorkout[];
  einladungen: MockEinladung[];
  suchbareBenutzer: MockBenutzerKurz[];
  geteilteWorkouts: MockGeteiltesWorkout[];
  profilWorkouts: Record<string, MockWorkout[]>;
  kontoGeloescht: boolean;
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
  let einladungZaehler = optionen.initialEinladungen?.length ?? 0;
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
    einladungen: optionen.initialEinladungen
      ? optionen.initialEinladungen.map((e) => ({ ...e }))
      : [],
    suchbareBenutzer: optionen.initialSuchbareBenutzer
      ? optionen.initialSuchbareBenutzer.map((b) => ({ ...b }))
      : [],
    geteilteWorkouts: optionen.initialGeteilteWorkouts
      ? optionen.initialGeteilteWorkouts.map((w) => structuredClone(w))
      : [],
    profilWorkouts: optionen.initialProfilWorkouts
      ? structuredClone(optionen.initialProfilWorkouts)
      : {},
    kontoGeloescht: false,
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

  // In gemockten E2E-Tests verhindert das Blockieren von /sw.js, dass WebKit
  // spaetere /v1-Fetch-Aufrufe ueber den Service Worker an page.context().route() vorbeileitet.
  await page.context().route('**/sw.js', async (route) => {
    await route.abort();
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

    if (pfad === '/v1/benutzer/suche' && methode === 'GET') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const name = (url.searchParams.get('name') ?? '').trim().toLowerCase();
      const treffer = zustand.suchbareBenutzer.find((b) => b.benutzername.toLowerCase() === name);
      if (!treffer) {
        await antworteJson(
          route,
          { code: 'BENUTZER_NICHT_GEFUNDEN', meldung: 'Kein Benutzer mit diesem exakten Namen gefunden.' },
          404,
        );
        return;
      }
      await antworteJson(route, treffer);
      return;
    }

    if (pfad === '/v1/workouts/geteilt' && methode === 'GET') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      await antworteJson(route, zustand.geteilteWorkouts);
      return;
    }

    const profilWorkoutsTreffer = /^\/v1\/profile\/([0-9a-f-]+)\/workouts$/i.exec(pfad);
    if (profilWorkoutsTreffer && methode === 'GET') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const benutzerId = profilWorkoutsTreffer[1]!;
      const existiert =
        benutzerId in zustand.profilWorkouts ||
        zustand.suchbareBenutzer.some((b) => b.id === benutzerId) ||
        zustand.benutzer?.id === benutzerId;
      if (!existiert) {
        await antworteJson(
          route,
          { code: 'BENUTZER_NICHT_GEFUNDEN', meldung: 'Benutzerprofil nicht gefunden.' },
          404,
        );
        return;
      }
      const liste = (zustand.profilWorkouts[benutzerId] ?? []).filter(
        (w) => w.sichtbarkeit === 'OEFFENTLICH',
      );
      await antworteJson(route, liste);
      return;
    }

    if (pfad === '/v1/dsgvo/export' && methode === 'GET') {
      if (!zustand.angemeldet || !zustand.benutzer) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      await antworteJson(route, {
        exportiertAm: '2026-11-19T18:30:00Z',
        benutzer: zustand.benutzer,
        passkeys: zustand.passkeys.map(formatPasskey),
        ...(zustand.timer.gespeichert ? { timerEinstellung: zustand.timer } : {}),
        workouts: zustand.workouts.map((w) => ({
          ...w,
          einladungen: zustand.einladungen.filter((e) => e.workoutId === w.id),
        })),
        erhalteneEinladungen: zustand.geteilteWorkouts.map((g, idx) => ({
          id: erzeugeWorkoutUuid('eeeeeeee-eeee', idx + 1),
          workoutId: g.id,
          workoutTitel: g.titel,
          ownerId: g.ownerId,
          ownerBenutzername: g.ownerBenutzername,
          status: 'AKTIV',
          erstelltAm: g.eingeladenAm,
        })),
      });
      return;
    }

    if (pfad === '/v1/konto' && methode === 'DELETE') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      zustand.angemeldet = false;
      zustand.benutzer = null;
      zustand.passkeys = [];
      zustand.workouts = [];
      zustand.einladungen = [];
      zustand.kontoGeloescht = true;
      await route.fulfill({ status: 204 });
      return;
    }

    const sichtbarkeitTreffer = /^\/v1\/workouts\/([0-9a-f-]+)\/sichtbarkeit$/i.exec(pfad);
    if (sichtbarkeitTreffer && methode === 'PATCH') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const id = sichtbarkeitTreffer[1]!;
      const idx = zustand.workouts.findIndex((w) => w.id === id);
      if (idx === -1) {
        await antworteJson(route, { code: 'WORKOUT_NICHT_GEFUNDEN', meldung: 'Workout nicht gefunden.' }, 404);
        return;
      }
      const body = request.postDataJSON() as { sichtbarkeit: 'PRIVAT' | 'OEFFENTLICH' };
      const aktualisiert: MockWorkout = {
        ...zustand.workouts[idx]!,
        sichtbarkeit: body.sichtbarkeit,
        geaendertAm: '2026-11-19T19:30:00Z',
        version: zustand.workouts[idx]!.version + 1,
      };
      zustand.workouts[idx] = aktualisiert;
      await antworteJson(route, aktualisiert);
      return;
    }

    const einladungenTreffer = /^\/v1\/workouts\/([0-9a-f-]+)\/einladungen$/i.exec(pfad);
    if (einladungenTreffer) {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const workoutId = einladungenTreffer[1]!;
      const eigenesWorkout = zustand.workouts.find((w) => w.id === workoutId);
      if (!eigenesWorkout) {
        const fremdesWorkout =
          zustand.geteilteWorkouts.some((w) => w.id === workoutId) ||
          Object.values(zustand.profilWorkouts).some((liste) => liste.some((w) => w.id === workoutId));
        if (fremdesWorkout) {
          await route.fulfill({ status: 403 });
          return;
        }
        await antworteJson(route, { code: 'WORKOUT_NICHT_GEFUNDEN', meldung: 'Workout nicht gefunden.' }, 404);
        return;
      }

      if (methode === 'GET') {
        await antworteJson(
          route,
          zustand.einladungen.filter((e) => e.workoutId === workoutId),
        );
        return;
      }

      if (methode === 'POST') {
        const body = request.postDataJSON() as { benutzername: string };
        const normalisiert = body.benutzername.trim().toLowerCase();
        if (zustand.benutzer && normalisiert === zustand.benutzer.benutzername.toLowerCase()) {
          await antworteJson(
            route,
            { code: 'SELBSTEINLADUNG', meldung: 'Du kannst dich nicht selbst einladen.' },
            400,
          );
          return;
        }
        const ziel = zustand.suchbareBenutzer.find(
          (b) => b.benutzername.toLowerCase() === normalisiert,
        );
        if (!ziel) {
          await antworteJson(
            route,
            { code: 'BENUTZER_NICHT_GEFUNDEN', meldung: 'Benutzer nicht gefunden.' },
            404,
          );
          return;
        }
        const existiert = zustand.einladungen.some(
          (e) => e.workoutId === workoutId && e.eingeladenerId === ziel.id,
        );
        if (existiert) {
          await antworteJson(
            route,
            { code: 'EINLADUNG_EXISTIERT_BEREITS', meldung: 'Benutzer wurde bereits eingeladen.' },
            409,
          );
          return;
        }
        einladungZaehler += 1;
        const neu: MockEinladung = {
          id: erzeugeWorkoutUuid('ffffffff-ffff', einladungZaehler),
          workoutId,
          eingeladenerId: ziel.id,
          eingeladenerBenutzername: ziel.benutzername,
          status: 'AKTIV',
          erstelltAm: '2026-11-19T19:00:00Z',
        };
        zustand.einladungen.push(neu);
        await antworteJson(route, neu, 201);
        return;
      }
    }

    const einladungLoeschenTreffer =
      /^\/v1\/workouts\/([0-9a-f-]+)\/einladungen\/([0-9a-f-]+)$/i.exec(pfad);
    if (einladungLoeschenTreffer && methode === 'DELETE') {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }
      const workoutId = einladungLoeschenTreffer[1]!;
      const eingeladenerId = einladungLoeschenTreffer[2]!;
      zustand.einladungen = zustand.einladungen.filter(
        (e) => !(e.workoutId === workoutId && e.eingeladenerId === eingeladenerId),
      );
      await route.fulfill({ status: 204 });
      return;
    }

    const workoutIdTreffer = /^\/v1\/workouts\/([0-9a-f-]+)$/i.exec(pfad);
    if (workoutIdTreffer) {
      if (!zustand.angemeldet) {
        await antworteJson(route, { code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }, 401);
        return;
      }

      const id = workoutIdTreffer[1]!;
      const gefundenIndex = zustand.workouts.findIndex((w) => w.id === id);
      if (gefundenIndex === -1) {
        if (methode === 'GET') {
          const geteilt = zustand.geteilteWorkouts.find((w) => w.id === id);
          if (geteilt) {
            await antworteJson(route, geteilt);
            return;
          }
          for (const liste of Object.values(zustand.profilWorkouts)) {
            const oeffentlich = liste.find((w) => w.id === id && w.sichtbarkeit === 'OEFFENTLICH');
            if (oeffentlich) {
              await antworteJson(route, oeffentlich);
              return;
            }
          }
        }
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
