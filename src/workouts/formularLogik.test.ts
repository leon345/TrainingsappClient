import { describe, expect, it } from 'vitest';
import type { WorkoutV1 } from '../api/client';
import {
  datumZuLokalEingabe,
  entferneSatz,
  entferneUebung,
  erstelleLeerenSatz,
  erstelleLeeresWorkoutFormular,
  erstelleLeereUebung,
  formatiereGewichtKg,
  formatiereSichtbarkeit,
  formatiereWorkoutTyp,
  lokalEingabeZuUtcIso,
  pruefeSatzFormular,
  utcIsoZuLokalEingabe,
  validiereWorkoutFormular,
  verschiebeSatz,
  verschiebeUebung,
  workoutZuFormularZustand,
  zuWorkoutAktualisierenBody,
} from './formularLogik';

describe('Workout-Formularlogik & API-Mapping', () => {
  it('konvertiert lokale datetime-local Eingaben sauber nach UTC ISO-8601 und zurueck', () => {
    const lokal = '2026-11-19T18:30';
    const utcIso = lokalEingabeZuUtcIso(lokal);

    expect(utcIso).not.toBeNull();
    expect(utcIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/);
    expect(utcIsoZuLokalEingabe(utcIso!)).toBe(lokal);

    const datum = new Date(2026, 10, 19, 8, 5);
    expect(datumZuLokalEingabe(datum)).toBe('2026-11-19T08:05');

    expect(lokalEingabeZuUtcIso('')).toBeNull();
    expect(lokalEingabeZuUtcIso('2026-02-30T10:00')).toBeNull();
    expect(lokalEingabeZuUtcIso('ungueltig')).toBeNull();
    expect(() => utcIsoZuLokalEingabe('ungueltig')).toThrow(RangeError);
  });

  it('validiert ein vollstaendiges Calisthenics-Workout inkl. Variante, Dauer, Zusatzgewicht und Pause', () => {
    const satz1 = {
      ...erstelleLeerenSatz(0),
      dauerSekunden: '20',
      pauseSekunden: '90',
    };
    const satz2 = {
      ...erstelleLeerenSatz(1),
      wiederholungen: '8',
      gewichtKg: '12,5',
      pauseSekunden: '120',
    };
    const uebung = {
      ...erstelleLeereUebung(0, false),
      name: '  Front Lever  ',
      variante: '  Adv. Tuck  ',
      saetze: [satz1, satz2],
    };

    const formular = {
      typ: 'CALISTHENICS' as const,
      titel: '  Oberkörper Calisthenics  ',
      startZeitLokal: '2026-11-19T18:00',
      dauerSekunden: '2700',
      notiz: '  Gute Spannung im Core  ',
      sichtbarkeit: 'OEFFENTLICH' as const,
      uebungen: [uebung],
    };

    const ergebnis = validiereWorkoutFormular(formular);
    expect(ergebnis.gueltig).toBe(true);
    if (!ergebnis.gueltig) {
      return;
    }

    expect(ergebnis.body).toEqual({
      typ: 'CALISTHENICS',
      titel: 'Oberkörper Calisthenics',
      startZeit: lokalEingabeZuUtcIso('2026-11-19T18:00'),
      dauerSekunden: 2700,
      notiz: 'Gute Spannung im Core',
      sichtbarkeit: 'OEFFENTLICH',
      uebungen: [
        {
          name: 'Front Lever',
          variante: 'Adv. Tuck',
          saetze: [
            { dauerSekunden: 20, pauseSekunden: 90 },
            { wiederholungen: 8, gewichtKg: 12.5, pauseSekunden: 120 },
          ],
        },
      ],
    });

    const updateBody = zuWorkoutAktualisierenBody(ergebnis.body, 3);
    expect(updateBody.version).toBe(3);
    expect(updateBody.titel).toBe('Oberkörper Calisthenics');
  });

  it('erzwingt Titel, Startzeit, Grenzen und bei jedem Satz Wiederholungen oder Dauer', () => {
    const leererSatz = erstelleLeerenSatz(0);
    const ungueltigerSatz = {
      ...erstelleLeerenSatz(1),
      wiederholungen: '0',
      dauerSekunden: '90000',
      gewichtKg: '-5',
      pauseSekunden: '12.5',
    };
    const uebung = {
      ...erstelleLeereUebung(0, false),
      name: '   ',
      variante: 'x'.repeat(101),
      saetze: [leererSatz, ungueltigerSatz],
    };

    const ergebnis = validiereWorkoutFormular({
      typ: 'KRAFT',
      titel: '   ',
      startZeitLokal: '',
      dauerSekunden: '0',
      notiz: 'n'.repeat(501),
      sichtbarkeit: 'PRIVAT',
      uebungen: [uebung],
    });

    expect(ergebnis.gueltig).toBe(false);
    expect(ergebnis.fehler.titel).toBeDefined();
    expect(ergebnis.fehler.startZeitLokal).toBeDefined();
    expect(ergebnis.fehler.dauerSekunden).toBeDefined();
    expect(ergebnis.fehler.notiz).toBeDefined();

    const uebungFehler = ergebnis.fehler.uebungen[uebung.clientId];
    expect(uebungFehler?.name).toBeDefined();
    expect(uebungFehler?.variante).toBeDefined();
    expect(uebungFehler?.saetze[leererSatz.clientId]?.allgemein).toMatch(
      /Wiederholungen oder Dauer/i,
    );
    expect(uebungFehler?.saetze[ungueltigerSatz.clientId]?.wiederholungen).toBeDefined();
    expect(uebungFehler?.saetze[ungueltigerSatz.clientId]?.dauerSekunden).toBeDefined();
    expect(uebungFehler?.saetze[ungueltigerSatz.clientId]?.gewichtKg).toBeDefined();
    expect(uebungFehler?.saetze[ungueltigerSatz.clientId]?.pauseSekunden).toBeDefined();
  });

  it('erlaubt kombinierte Wiederholungen + Dauer und Gewicht 0 im Satz', () => {
    const pruefung = pruefeSatzFormular({
      ...erstelleLeerenSatz(0),
      wiederholungen: '5',
      dauerSekunden: '10',
      gewichtKg: '0',
      pauseSekunden: '0',
    });

    expect(pruefung.gueltig).toBe(true);
    expect(pruefung.eingabe).toEqual({
      wiederholungen: 5,
      dauerSekunden: 10,
      gewichtKg: 0,
      pauseSekunden: 0,
    });
  });

  it('haelt Positionen 0..n-1 beim Verschieben und Entfernen von Uebungen und Saetzen konsistent', () => {
    const u1 = { ...erstelleLeereUebung(0, false), name: 'Klimmzüge' };
    const u2 = { ...erstelleLeereUebung(1, false), name: 'Dips' };
    const u3 = { ...erstelleLeereUebung(2, false), name: 'Rudern' };

    const verschoben = verschiebeUebung([u1, u2, u3], 2, -1);
    expect(verschoben.map((u) => [u.name, u.position])).toEqual([
      ['Klimmzüge', 0],
      ['Rudern', 1],
      ['Dips', 2],
    ]);

    const entfernt = entferneUebung(verschoben, u1.clientId);
    expect(entfernt.map((u) => [u.name, u.position])).toEqual([
      ['Rudern', 0],
      ['Dips', 1],
    ]);

    const s1 = { ...erstelleLeerenSatz(0), wiederholungen: '8' };
    const s2 = { ...erstelleLeerenSatz(1), wiederholungen: '10' };
    const sVerschoben = verschiebeSatz([s1, s2], 0, 1);
    expect(sVerschoben.map((s) => [s.wiederholungen, s.position])).toEqual([
      ['10', 0],
      ['8', 1],
    ]);

    const sEntfernt = entferneSatz(sVerschoben, s2.clientId);
    expect(sEntfernt.map((s) => [s.wiederholungen, s.position])).toEqual([['8', 0]]);
  });

  it('wandelt WorkoutV1 sortiert nach Position in einen Formularzustand um', () => {
    const workout: WorkoutV1 = {
      id: '11111111-1111-4111-8111-111111111111',
      typ: 'KRAFT',
      titel: 'Unterkörper',
      startZeit: '2026-11-19T17:00:00Z',
      dauerSekunden: 3600,
      notiz: 'Starkes Training',
      sichtbarkeit: 'PRIVAT',
      herkunft: 'MANUELL',
      erstelltAm: '2026-11-19T17:00:00Z',
      geaendertAm: '2026-11-19T18:00:00Z',
      version: 2,
      uebungen: [
        {
          id: 'u-2',
          position: 1,
          name: 'Kreuzheben',
          saetze: [
            { id: 's-2', position: 1, wiederholungen: 5, gewichtKg: 120 },
            { id: 's-1', position: 0, wiederholungen: 5, gewichtKg: 100, pauseSekunden: 180 },
          ],
        },
        {
          id: 'u-1',
          position: 0,
          name: 'Kniebeugen',
          variante: 'High Bar',
          saetze: [{ id: 's-0', position: 0, wiederholungen: 8, gewichtKg: 80 }],
        },
      ],
    };

    const formular = workoutZuFormularZustand(workout);
    expect(formular.typ).toBe('KRAFT');
    expect(formular.titel).toBe('Unterkörper');
    expect(formular.dauerSekunden).toBe('3600');
    expect(formular.notiz).toBe('Starkes Training');
    expect(formular.sichtbarkeit).toBe('PRIVAT');
    expect(formular.uebungen.map((u) => [u.name, u.position, u.variante])).toEqual([
      ['Kniebeugen', 0, 'High Bar'],
      ['Kreuzheben', 1, ''],
    ]);
    expect(formular.uebungen[1]?.saetze.map((s) => [s.gewichtKg, s.position])).toEqual([
      ['100', 0],
      ['120', 1],
    ]);
  });

  it('stellt sinnvolle Standardwerte und Anzeigeformatierungen bereit', () => {
    const leer = erstelleLeeresWorkoutFormular(new Date(2026, 10, 19, 14, 15));
    expect(leer.typ).toBe('KRAFT');
    expect(leer.sichtbarkeit).toBe('PRIVAT');
    expect(leer.startZeitLokal).toBe('2026-11-19T14:15');
    expect(formatiereWorkoutTyp('KRAFT')).toBe('Kraft');
    expect(formatiereWorkoutTyp('CALISTHENICS')).toBe('Calisthenics');
    expect(formatiereSichtbarkeit('PRIVAT')).toBe('Privat');
    expect(formatiereSichtbarkeit('OEFFENTLICH')).toBe('Öffentlich');
    expect(formatiereGewichtKg(12.5)).toBe('12,5 kg');
    expect(formatiereGewichtKg(60)).toBe('60 kg');
  });
});
