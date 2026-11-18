import { describe, expect, it } from 'vitest';
import type { TimerEinstellung } from './einstellung';
import { BEREIT, berechneStand, pausiere, setzeZurueck, starte, vergangeneMs } from './logik';

/*
 * Kontrollierte Uhr: Jede Funktion bekommt die Zeit als Argument (ms).
 * T0 ist ein beliebiger Startzeitpunkt, wie ihn Date.now() liefern würde.
 */
const T0 = 1_763_460_000_000;
const s = (sekunden: number) => sekunden * 1000;
const STANDARD: TimerEinstellung = { trainingSekunden: 30, pauseSekunden: 10 };

function standNach(ms: number, einstellung: TimerEinstellung = STANDARD) {
  return berechneStand(starte(BEREIT, T0), einstellung, T0 + ms);
}

describe('Zustandswechsel', () => {
  it('bereit zeigt Training, Runde 1, volle Dauer, Fortschritt 0', () => {
    expect(berechneStand(BEREIT, STANDARD, T0 + s(999))).toEqual({
      phase: 'training',
      runde: 1,
      restSekunden: 30,
      phasenDauerSekunden: 30,
      fortschritt: 0,
    });
  });

  it('starten beginnt bei 0 ms', () => {
    const zustand = starte(BEREIT, T0);
    expect(zustand).toEqual({ status: 'laeuft', vergangenMs: 0, laeuftSeit: T0 });
    expect(vergangeneMs(zustand, T0)).toBe(0);
  });

  it('erneutes Starten eines laufenden Timers ändert nichts', () => {
    const zustand = starte(BEREIT, T0);
    expect(starte(zustand, T0 + s(5))).toBe(zustand);
  });

  it('pausieren friert die Zeit ein, fortsetzen läuft ab dort weiter', () => {
    const pausiert = pausiere(starte(BEREIT, T0), T0 + s(12));
    expect(pausiert).toEqual({ status: 'pausiert', vergangenMs: s(12) });

    // Lange Pause: Die Restzeit bleibt stehen.
    expect(berechneStand(pausiert, STANDARD, T0 + s(5000)).restSekunden).toBe(18);

    const fortgesetzt = starte(pausiert, T0 + s(5000));
    expect(berechneStand(fortgesetzt, STANDARD, T0 + s(5000)).restSekunden).toBe(18);
    expect(berechneStand(fortgesetzt, STANDARD, T0 + s(5003)).restSekunden).toBe(15);
  });

  it('mehrfaches Pausieren und Fortsetzen summiert nur die Laufzeiten', () => {
    let zustand = starte(BEREIT, T0);
    zustand = pausiere(zustand, T0 + s(10)); // 10 s gelaufen
    zustand = starte(zustand, T0 + s(100));
    zustand = pausiere(zustand, T0 + s(115)); // +15 s
    zustand = starte(zustand, T0 + s(200));
    expect(vergangeneMs(zustand, T0 + s(210))).toBe(s(35)); // +10 s
    expect(berechneStand(zustand, STANDARD, T0 + s(210))).toMatchObject({
      phase: 'pause',
      runde: 1,
      restSekunden: 5,
    });
  });

  it('pausieren eines nicht laufenden Timers ändert nichts', () => {
    expect(pausiere(BEREIT, T0)).toBe(BEREIT);
    const pausiert = pausiere(starte(BEREIT, T0), T0 + 1);
    expect(pausiere(pausiert, T0 + 2)).toBe(pausiert);
  });

  it('zurücksetzen führt zu bereit', () => {
    expect(setzeZurueck()).toEqual({ status: 'bereit' });
  });

  it('eine zurückgestellte Systemuhr ergibt keine negative Zeit', () => {
    const zustand = starte(BEREIT, T0);
    expect(vergangeneMs(zustand, T0 - s(60))).toBe(0);
    expect(berechneStand(zustand, STANDARD, T0 - s(60)).restSekunden).toBe(30);
  });
});

describe('Restzeit und Phasenwechsel', () => {
  it('Restzeit wird aufgerundet: 00:00 erscheint während einer Phase nie', () => {
    expect(standNach(1).restSekunden).toBe(30);
    expect(standNach(s(1) - 1).restSekunden).toBe(30);
    expect(standNach(s(1)).restSekunden).toBe(29);
    expect(standNach(s(30) - 1)).toMatchObject({ phase: 'training', restSekunden: 1 });
  });

  it('Wechsel exakt an der Phasengrenze Training → Pause', () => {
    expect(standNach(s(30))).toEqual({
      phase: 'pause',
      runde: 1,
      restSekunden: 10,
      phasenDauerSekunden: 10,
      fortschritt: 0,
    });
  });

  it('Wechsel exakt an der Rundengrenze Pause → Training der nächsten Runde', () => {
    expect(standNach(s(40) - 1)).toMatchObject({ phase: 'pause', runde: 1, restSekunden: 1 });
    expect(standNach(s(40))).toMatchObject({
      phase: 'training',
      runde: 2,
      restSekunden: 30,
      fortschritt: 0,
    });
  });

  it('Fortschritt steigt innerhalb der Phase von 0 gegen 1', () => {
    expect(standNach(s(15)).fortschritt).toBeCloseTo(0.5);
    expect(standNach(s(35)).fortschritt).toBeCloseTo(0.5);
    expect(standNach(s(40) - 1).fortschritt).toBeLessThan(1);
  });

  it('Pause 0: nur Trainingsphasen, jede Runde so lang wie das Training', () => {
    const ohnePause = { trainingSekunden: 20, pauseSekunden: 0 };
    expect(standNach(s(20) - 1, ohnePause)).toMatchObject({ phase: 'training', runde: 1, restSekunden: 1 });
    expect(standNach(s(20), ohnePause)).toMatchObject({ phase: 'training', runde: 2, restSekunden: 20 });
    expect(standNach(s(65), ohnePause)).toMatchObject({ phase: 'training', runde: 4, restSekunden: 15 });
    for (let ms = 0; ms < s(100); ms += 250) {
      const stand = standNach(ms, ohnePause);
      expect(stand.phase).toBe('training');
      expect(Number.isFinite(stand.fortschritt)).toBe(true);
    }
  });

  it('kleinste Einstellung: 1 s Training, 0 s Pause', () => {
    const minimal = { trainingSekunden: 1, pauseSekunden: 0 };
    expect(standNach(0, minimal)).toMatchObject({ runde: 1, restSekunden: 1 });
    expect(standNach(999, minimal)).toMatchObject({ runde: 1, restSekunden: 1 });
    expect(standNach(1000, minimal)).toMatchObject({ runde: 2, restSekunden: 1 });
  });
});

describe('Tab im Hintergrund (keine Ticks)', () => {
  it('nach mehr als einer ganzen Phase stimmen Phase und Restzeit', () => {
    // Nach 47 s ohne einen einzigen Tick: Runde 2, Training, 23 s übrig.
    expect(standNach(s(47))).toMatchObject({ phase: 'training', runde: 2, restSekunden: 23 });
  });

  it('nach vielen Runden im Hintergrund stimmt die Runde', () => {
    // 1 Stunde = 90 Runden zu 40 s; danach beginnt Runde 91.
    expect(standNach(s(3600))).toMatchObject({ phase: 'training', runde: 91, restSekunden: 30 });
    expect(standNach(s(3600 + 33))).toMatchObject({ phase: 'pause', runde: 91, restSekunden: 7 });
  });

  it('Ergebnis hängt nur vom Zeitpunkt ab, nicht von Zwischenabfragen', () => {
    const zustand = starte(BEREIT, T0);
    const direkt = berechneStand(zustand, STANDARD, T0 + s(1234));
    for (let ms = 0; ms < s(1234); ms += 777) berechneStand(zustand, STANDARD, T0 + ms);
    expect(berechneStand(zustand, STANDARD, T0 + s(1234))).toEqual(direkt);
  });
});

describe('Sehr lange Dauern', () => {
  const maximal = { trainingSekunden: 86_400, pauseSekunden: 86_400 };

  it('24 h Training und 24 h Pause', () => {
    expect(standNach(0, maximal)).toMatchObject({ phase: 'training', restSekunden: 86_400 });
    expect(standNach(s(86_400) - 1, maximal)).toMatchObject({ phase: 'training', restSekunden: 1 });
    expect(standNach(s(86_400), maximal)).toMatchObject({ phase: 'pause', restSekunden: 86_400 });
    expect(standNach(s(172_800), maximal)).toMatchObject({ phase: 'training', runde: 2 });
  });

  it('nach 30 Tagen Laufzeit sind die Werte exakt', () => {
    expect(standNach(s(30 * 86_400 + 5), maximal)).toMatchObject({
      phase: 'training',
      runde: 16,
      restSekunden: 86_395,
    });
  });

  it('nach einem Jahr Laufzeit mit 1 s Training ohne Pause', () => {
    const jahr = 365 * 86_400;
    expect(standNach(s(jahr) + 500, { trainingSekunden: 1, pauseSekunden: 0 })).toMatchObject({
      runde: jahr + 1,
      restSekunden: 1,
    });
  });
});
