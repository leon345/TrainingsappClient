import type {
  SatzEingabeV1,
  Sichtbarkeit,
  UebungEingabeV1,
  WorkoutAktualisierenV1,
  WorkoutErstellenV1,
  WorkoutTyp,
  WorkoutV1,
} from '../api/client';
import { MAX_DAUER_SEKUNDEN } from '../format/dauer';

export const WORKOUT_TITEL_MAX_LAENGE = 100;
export const WORKOUT_NOTIZ_MAX_LAENGE = 500;
export const UEBUNG_NAME_MAX_LAENGE = 100;
export const UEBUNG_VARIANTE_MAX_LAENGE = 100;
export const SATZ_MAX_WIEDERHOLUNGEN = 10_000;
export const SATZ_MAX_GEWICHT_KG = 9999.99;

export interface SatzFormularEintrag {
  readonly clientId: string;
  readonly position: number;
  readonly wiederholungen: string;
  readonly dauerSekunden: string;
  readonly gewichtKg: string;
  readonly pauseSekunden: string;
}

export interface UebungFormularEintrag {
  readonly clientId: string;
  readonly position: number;
  readonly name: string;
  readonly variante: string;
  readonly saetze: readonly SatzFormularEintrag[];
}

export interface WorkoutFormularZustand {
  readonly typ: WorkoutTyp;
  readonly titel: string;
  readonly startZeitLokal: string;
  readonly dauerSekunden: string;
  readonly notiz: string;
  readonly sichtbarkeit: Sichtbarkeit;
  readonly uebungen: readonly UebungFormularEintrag[];
}

export interface SatzFormularFehler {
  wiederholungen?: string;
  dauerSekunden?: string;
  gewichtKg?: string;
  pauseSekunden?: string;
  allgemein?: string;
}

export interface UebungFormularFehler {
  name?: string;
  variante?: string;
  saetze: Record<string, SatzFormularFehler>;
}

export interface WorkoutFormularFehler {
  titel?: string;
  startZeitLokal?: string;
  dauerSekunden?: string;
  notiz?: string;
  uebungen: Record<string, UebungFormularFehler>;
}

export type WorkoutValidierungsErgebnis =
  | {
      readonly gueltig: true;
      readonly body: WorkoutErstellenV1;
      readonly fehler: WorkoutFormularFehler;
    }
  | {
      readonly gueltig: false;
      readonly fehler: WorkoutFormularFehler;
    };

let clientIdZaehler = 0;

export function erzeugeClientId(praefix: 'uebung' | 'satz'): string {
  clientIdZaehler += 1;
  return `${praefix}-${clientIdZaehler}`;
}

function zweistellig(wert: number): string {
  return String(wert).padStart(2, '0');
}

const LOKAL_ZEIT_MUSTER = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const GANZE_ZAHL_MUSTER = /^\d+$/;
const DEZIMAL_ZAHL_MUSTER = /^\d+(?:[.,]\d{1,2})?$/;

const DEUTSCHE_DATUM_ZEIT_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DEUTSCHES_GEWICHT_FORMAT = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formatiert ein lokales Date-Objekt als Wert fuer <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
 */
export function datumZuLokalEingabe(datum: Date): string {
  return (
    `${datum.getFullYear()}-${zweistellig(datum.getMonth() + 1)}-${zweistellig(datum.getDate())}` +
    `T${zweistellig(datum.getHours())}:${zweistellig(datum.getMinutes())}`
  );
}

/**
 * Konvertiert einen UTC ISO-8601 Zeitstempel (Instant) in die lokale datetime-local Darstellung.
 */
export function utcIsoZuLokalEingabe(isoWert: string): string {
  const zeitstempel = Date.parse(isoWert.trim());
  if (Number.isNaN(zeitstempel)) {
    throw new RangeError(`Ungueltiger ISO-Zeitstempel: ${isoWert}`);
  }
  return datumZuLokalEingabe(new Date(zeitstempel));
}

/**
 * Konvertiert eine lokale datetime-local Eingabe (YYYY-MM-DDTHH:mm[:ss]) in UTC ISO-8601 ohne Millisekunden.
 */
export function lokalEingabeZuUtcIso(lokalWert: string): string | null {
  const treffer = LOKAL_ZEIT_MUSTER.exec(lokalWert.trim());
  if (!treffer) {
    return null;
  }

  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const tag = Number(treffer[3]);
  const stunde = Number(treffer[4]);
  const minute = Number(treffer[5]);
  const sekunde = treffer[6] ? Number(treffer[6]) : 0;

  const datum = new Date(jahr, monat - 1, tag, stunde, minute, sekunde, 0);
  if (
    datum.getFullYear() !== jahr ||
    datum.getMonth() !== monat - 1 ||
    datum.getDate() !== tag ||
    datum.getHours() !== stunde ||
    datum.getMinutes() !== minute ||
    datum.getSeconds() !== sekunde
  ) {
    return null;
  }

  return datum.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function formatiereStartZeit(isoWert: string): string {
  const zeitstempel = Date.parse(isoWert.trim());
  if (Number.isNaN(zeitstempel)) {
    return isoWert;
  }
  return DEUTSCHE_DATUM_ZEIT_FORMAT.format(new Date(zeitstempel));
}

export function formatiereWorkoutTyp(typ: WorkoutTyp): string {
  return typ === 'CALISTHENICS' ? 'Calisthenics' : 'Kraft';
}

export function formatiereSichtbarkeit(sichtbarkeit: Sichtbarkeit): string {
  return sichtbarkeit === 'OEFFENTLICH' ? 'Öffentlich' : 'Privat';
}

export function formatiereGewichtKg(gewichtKg: number): string {
  return `${DEUTSCHES_GEWICHT_FORMAT.format(gewichtKg)} kg`;
}

export function erstelleLeerenSatz(position = 0): SatzFormularEintrag {
  return {
    clientId: erzeugeClientId('satz'),
    position,
    wiederholungen: '',
    dauerSekunden: '',
    gewichtKg: '',
    pauseSekunden: '',
  };
}

export function erstelleLeereUebung(position = 0, mitStartSatz = true): UebungFormularEintrag {
  return {
    clientId: erzeugeClientId('uebung'),
    position,
    name: '',
    variante: '',
    saetze: mitStartSatz ? [erstelleLeerenSatz(0)] : [],
  };
}

export function erstelleLeeresWorkoutFormular(
  jetzt: Date = new Date(),
  standardTyp: WorkoutTyp = 'KRAFT',
): WorkoutFormularZustand {
  return {
    typ: standardTyp,
    titel: '',
    startZeitLokal: datumZuLokalEingabe(jetzt),
    dauerSekunden: '',
    notiz: '',
    sichtbarkeit: 'PRIVAT',
    uebungen: [],
  };
}

export function normalisiereSaetze(
  saetze: readonly SatzFormularEintrag[],
): SatzFormularEintrag[] {
  return saetze.map((satz, index) => ({
    ...satz,
    position: index,
  }));
}

export function normalisiereUebungen(
  uebungen: readonly UebungFormularEintrag[],
): UebungFormularEintrag[] {
  return uebungen.map((uebung, index) => ({
    ...uebung,
    position: index,
    saetze: normalisiereSaetze(uebung.saetze),
  }));
}

export function verschiebeEintrag<T>(
  liste: readonly T[],
  index: number,
  richtung: -1 | 1,
): T[] {
  const zielIndex = index + richtung;
  if (index < 0 || index >= liste.length || zielIndex < 0 || zielIndex >= liste.length) {
    return [...liste];
  }
  const kopie = [...liste];
  const aktuell = kopie[index]!;
  kopie[index] = kopie[zielIndex]!;
  kopie[zielIndex] = aktuell;
  return kopie;
}

export function verschiebeUebung(
  uebungen: readonly UebungFormularEintrag[],
  index: number,
  richtung: -1 | 1,
): UebungFormularEintrag[] {
  return normalisiereUebungen(verschiebeEintrag(uebungen, index, richtung));
}

export function entferneUebung(
  uebungen: readonly UebungFormularEintrag[],
  clientId: string,
): UebungFormularEintrag[] {
  return normalisiereUebungen(uebungen.filter((u) => u.clientId !== clientId));
}

export function verschiebeSatz(
  saetze: readonly SatzFormularEintrag[],
  index: number,
  richtung: -1 | 1,
): SatzFormularEintrag[] {
  return normalisiereSaetze(verschiebeEintrag(saetze, index, richtung));
}

export function entferneSatz(
  saetze: readonly SatzFormularEintrag[],
  clientId: string,
): SatzFormularEintrag[] {
  return normalisiereSaetze(saetze.filter((s) => s.clientId !== clientId));
}

export function workoutZuFormularZustand(workout: WorkoutV1): WorkoutFormularZustand {
  const sortierteUebungen = [...workout.uebungen]
    .sort((a, b) => a.position - b.position)
    .map((uebung, uIndex): UebungFormularEintrag => {
      const sortierteSaetze = [...uebung.saetze]
        .sort((a, b) => a.position - b.position)
        .map(
          (satz, sIndex): SatzFormularEintrag => ({
            clientId: erzeugeClientId('satz'),
            position: sIndex,
            wiederholungen: satz.wiederholungen != null ? String(satz.wiederholungen) : '',
            dauerSekunden: satz.dauerSekunden != null ? String(satz.dauerSekunden) : '',
            gewichtKg: satz.gewichtKg != null ? String(satz.gewichtKg) : '',
            pauseSekunden: satz.pauseSekunden != null ? String(satz.pauseSekunden) : '',
          }),
        );

      return {
        clientId: erzeugeClientId('uebung'),
        position: uIndex,
        name: uebung.name,
        variante: uebung.variante ?? '',
        saetze: sortierteSaetze,
      };
    });

  return {
    typ: workout.typ,
    titel: workout.titel,
    startZeitLokal: utcIsoZuLokalEingabe(workout.startZeit),
    dauerSekunden: workout.dauerSekunden != null ? String(workout.dauerSekunden) : '',
    notiz: workout.notiz ?? '',
    sichtbarkeit: workout.sichtbarkeit,
    uebungen: sortierteUebungen,
  };
}

export function parseGanzeSekundenEingabe(eingabe: string, min: number, max: number): number | null {
  const bereinigt = eingabe.trim();
  if (!GANZE_ZAHL_MUSTER.test(bereinigt)) {
    return null;
  }
  const zahl = Number(bereinigt);
  if (!Number.isSafeInteger(zahl) || zahl < min || zahl > max) {
    return null;
  }
  return zahl;
}

function parseOptionaleGanzeZahl(
  eingabe: string,
  min: number,
  max: number,
  fehlerMeldung: string,
): { wert?: number; fehler?: string } {
  const bereinigt = eingabe.trim();
  if (bereinigt.length === 0) {
    return {};
  }
  const geparst = parseGanzeSekundenEingabe(bereinigt, min, max);
  if (geparst === null) {
    return { fehler: fehlerMeldung };
  }
  return { wert: geparst };
}

function parseOptionalesGewicht(eingabe: string): { wert?: number; fehler?: string } {
  const bereinigt = eingabe.trim();
  if (bereinigt.length === 0) {
    return {};
  }
  if (!DEZIMAL_ZAHL_MUSTER.test(bereinigt)) {
    return {
      fehler: 'Bitte gib ein gültiges Gewicht in kg an (z. B. 12,5 oder 60, max. 2 Nachkommastellen).',
    };
  }
  const normalisiert = bereinigt.replace(',', '.');
  const zahl = Number(normalisiert);
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > SATZ_MAX_GEWICHT_KG) {
    return {
      fehler: `Das Gewicht muss zwischen 0 und ${SATZ_MAX_GEWICHT_KG} kg liegen.`,
    };
  }
  return { wert: zahl };
}

export function pruefeSatzFormular(satz: SatzFormularEintrag): {
  readonly gueltig: boolean;
  readonly fehler: SatzFormularFehler;
  readonly eingabe?: SatzEingabeV1;
} {
  const fehler: SatzFormularFehler = {};

  const wdh = parseOptionaleGanzeZahl(
    satz.wiederholungen,
    1,
    SATZ_MAX_WIEDERHOLUNGEN,
    `Wiederholungen müssen eine ganze Zahl zwischen 1 und ${SATZ_MAX_WIEDERHOLUNGEN} sein.`,
  );
  if (wdh.fehler) {
    fehler.wiederholungen = wdh.fehler;
  }

  const dauer = parseOptionaleGanzeZahl(
    satz.dauerSekunden,
    1,
    MAX_DAUER_SEKUNDEN,
    `Dauer muss eine ganze Zahl zwischen 1 und ${MAX_DAUER_SEKUNDEN} Sekunden sein.`,
  );
  if (dauer.fehler) {
    fehler.dauerSekunden = dauer.fehler;
  }

  const gewicht = parseOptionalesGewicht(satz.gewichtKg);
  if (gewicht.fehler) {
    fehler.gewichtKg = gewicht.fehler;
  }

  const pause = parseOptionaleGanzeZahl(
    satz.pauseSekunden,
    0,
    MAX_DAUER_SEKUNDEN,
    `Pause muss eine ganze Zahl zwischen 0 und ${MAX_DAUER_SEKUNDEN} Sekunden sein.`,
  );
  if (pause.fehler) {
    fehler.pauseSekunden = pause.fehler;
  }

  const beideLeer =
    satz.wiederholungen.trim().length === 0 && satz.dauerSekunden.trim().length === 0;
  if (beideLeer) {
    fehler.allgemein = 'Bitte gib Wiederholungen oder Dauer (in Sekunden) an.';
  }

  const hatFehler =
    fehler.wiederholungen !== undefined ||
    fehler.dauerSekunden !== undefined ||
    fehler.gewichtKg !== undefined ||
    fehler.pauseSekunden !== undefined ||
    fehler.allgemein !== undefined;

  if (hatFehler) {
    return { gueltig: false, fehler };
  }

  const eingabe: SatzEingabeV1 = {};
  if (wdh.wert !== undefined) {
    eingabe.wiederholungen = wdh.wert;
  }
  if (dauer.wert !== undefined) {
    eingabe.dauerSekunden = dauer.wert;
  }
  if (gewicht.wert !== undefined) {
    eingabe.gewichtKg = gewicht.wert;
  }
  if (pause.wert !== undefined) {
    eingabe.pauseSekunden = pause.wert;
  }

  return { gueltig: true, fehler, eingabe };
}

export function validiereWorkoutFormular(
  formular: WorkoutFormularZustand,
): WorkoutValidierungsErgebnis {
  const fehler: WorkoutFormularFehler = { uebungen: {} };
  let hatFehler = false;

  const titel = formular.titel.trim();
  if (titel.length === 0) {
    fehler.titel = 'Bitte gib einen Titel für das Workout an.';
    hatFehler = true;
  } else if (titel.length > WORKOUT_TITEL_MAX_LAENGE) {
    fehler.titel = `Der Titel darf höchstens ${WORKOUT_TITEL_MAX_LAENGE} Zeichen lang sein.`;
    hatFehler = true;
  }

  const startZeitUtc = lokalEingabeZuUtcIso(formular.startZeitLokal);
  if (!startZeitUtc) {
    fehler.startZeitLokal = 'Bitte gib ein gültiges Startdatum mit Uhrzeit an.';
    hatFehler = true;
  }

  const dauer = parseOptionaleGanzeZahl(
    formular.dauerSekunden,
    1,
    MAX_DAUER_SEKUNDEN,
    `Die Dauer muss eine ganze Zahl zwischen 1 und ${MAX_DAUER_SEKUNDEN} Sekunden sein.`,
  );
  if (dauer.fehler) {
    fehler.dauerSekunden = dauer.fehler;
    hatFehler = true;
  }

  const notiz = formular.notiz.trim();
  if (notiz.length > WORKOUT_NOTIZ_MAX_LAENGE) {
    fehler.notiz = `Die Notiz darf höchstens ${WORKOUT_NOTIZ_MAX_LAENGE} Zeichen lang sein.`;
    hatFehler = true;
  }

  const uebungenEingabe: UebungEingabeV1[] = [];
  for (const uebung of formular.uebungen) {
    const uebungFehler: UebungFormularFehler = { saetze: {} };
    let uebungHatFehler = false;

    const uebungName = uebung.name.trim();
    if (uebungName.length === 0) {
      uebungFehler.name = 'Bitte gib einen Namen für die Übung an.';
      uebungHatFehler = true;
    } else if (uebungName.length > UEBUNG_NAME_MAX_LAENGE) {
      uebungFehler.name = `Der Übungsname darf höchstens ${UEBUNG_NAME_MAX_LAENGE} Zeichen lang sein.`;
      uebungHatFehler = true;
    }

    const variante = uebung.variante.trim();
    if (variante.length > UEBUNG_VARIANTE_MAX_LAENGE) {
      uebungFehler.variante = `Die Variante darf höchstens ${UEBUNG_VARIANTE_MAX_LAENGE} Zeichen lang sein.`;
      uebungHatFehler = true;
    }

    const saetzeEingabe: SatzEingabeV1[] = [];
    for (const satz of uebung.saetze) {
      const satzPruefung = pruefeSatzFormular(satz);
      if (!satzPruefung.gueltig || !satzPruefung.eingabe) {
        uebungFehler.saetze[satz.clientId] = satzPruefung.fehler;
        uebungHatFehler = true;
      } else {
        saetzeEingabe.push(satzPruefung.eingabe);
      }
    }

    if (uebungHatFehler) {
      fehler.uebungen[uebung.clientId] = uebungFehler;
      hatFehler = true;
    } else {
      const uebungBody: UebungEingabeV1 = {
        name: uebungName,
        saetze: saetzeEingabe,
      };
      if (variante.length > 0) {
        uebungBody.variante = variante;
      }
      uebungenEingabe.push(uebungBody);
    }
  }

  if (hatFehler || !startZeitUtc) {
    return { gueltig: false, fehler };
  }

  const body: WorkoutErstellenV1 = {
    typ: formular.typ,
    titel,
    startZeit: startZeitUtc,
    sichtbarkeit: formular.sichtbarkeit,
    uebungen: uebungenEingabe,
  };

  if (dauer.wert !== undefined) {
    body.dauerSekunden = dauer.wert;
  }
  if (notiz.length > 0) {
    body.notiz = notiz;
  }

  return { gueltig: true, body, fehler };
}

export function zuWorkoutAktualisierenBody(
  body: WorkoutErstellenV1,
  version: number,
): WorkoutAktualisierenV1 {
  return {
    version,
    ...body,
  };
}
