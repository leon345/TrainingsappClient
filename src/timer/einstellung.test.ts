import { describe, expect, it } from 'vitest';
import {
  GRENZEN,
  SPEICHER_SCHLUESSEL,
  STANDARD_EINSTELLUNG,
  istGueltigeEinstellung,
  ladeEinstellung,
  speichereEinstellung,
} from './einstellung';

function speicherMit(inhalt: Record<string, string> = {}) {
  const daten = new Map(Object.entries(inhalt));
  return {
    daten,
    getItem: (schluessel: string) => daten.get(schluessel) ?? null,
    setItem: (schluessel: string, wert: string) => void daten.set(schluessel, wert),
  };
}

describe('Standard und Grenzen (E20)', () => {
  it('Standard ist 30 s Training und 10 s Pause', () => {
    expect(STANDARD_EINSTELLUNG).toEqual({ trainingSekunden: 30, pauseSekunden: 10 });
  });

  it('Grenzen wie im Server', () => {
    expect(GRENZEN).toEqual({
      trainingSekunden: { min: 1, max: 86_400 },
      pauseSekunden: { min: 0, max: 86_400 },
    });
  });

  it.each([
    [{ trainingSekunden: 1, pauseSekunden: 0 }, true],
    [{ trainingSekunden: 86_400, pauseSekunden: 86_400 }, true],
    [{ trainingSekunden: 0, pauseSekunden: 10 }, false],
    [{ trainingSekunden: 86_401, pauseSekunden: 10 }, false],
    [{ trainingSekunden: 30, pauseSekunden: -1 }, false],
    [{ trainingSekunden: 30, pauseSekunden: 86_401 }, false],
    [{ trainingSekunden: 30.5, pauseSekunden: 10 }, false],
    [{ trainingSekunden: '30', pauseSekunden: 10 }, false],
    [{ trainingSekunden: Number.NaN, pauseSekunden: 10 }, false],
    [{ trainingSekunden: 30 }, false],
    [null, false],
    ['30/10', false],
  ])('%j gültig: %s', (wert, gueltig) => {
    expect(istGueltigeEinstellung(wert)).toBe(gueltig);
  });
});

describe('Lokale Speicherung (E10)', () => {
  it('ohne gespeicherte Einstellung gilt der Standard', () => {
    expect(ladeEinstellung(speicherMit())).toEqual({ trainingSekunden: 30, pauseSekunden: 10 });
  });

  it('ohne Speicher gilt der Standard, speichern meldet false', () => {
    expect(ladeEinstellung(null)).toEqual(STANDARD_EINSTELLUNG);
    expect(speichereEinstellung({ trainingSekunden: 5, pauseSekunden: 5 }, null)).toBe(false);
  });

  it('speichert und lädt wieder', () => {
    const speicher = speicherMit();
    expect(speichereEinstellung({ trainingSekunden: 45, pauseSekunden: 0 }, speicher)).toBe(true);
    expect(JSON.parse(speicher.daten.get(SPEICHER_SCHLUESSEL)!)).toEqual({
      trainingSekunden: 45,
      pauseSekunden: 0,
    });
    expect(ladeEinstellung(speicher)).toEqual({ trainingSekunden: 45, pauseSekunden: 0 });
  });

  it('speichert keine ungültige Einstellung', () => {
    const speicher = speicherMit();
    expect(speichereEinstellung({ trainingSekunden: 0, pauseSekunden: 10 }, speicher)).toBe(false);
    expect(speicher.daten.size).toBe(0);
  });

  it.each(['kein json', '{"trainingSekunden":0,"pauseSekunden":10}', '{}', 'null', '[]'])(
    'beschädigter Inhalt %s ergibt den Standard',
    (roh) => {
      expect(ladeEinstellung(speicherMit({ [SPEICHER_SCHLUESSEL]: roh }))).toEqual(STANDARD_EINSTELLUNG);
    },
  );

  it('Speicher, der beim Lesen und Schreiben wirft, bricht nichts', () => {
    const kaputt = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(ladeEinstellung(kaputt)).toEqual(STANDARD_EINSTELLUNG);
    expect(speichereEinstellung({ trainingSekunden: 5, pauseSekunden: 5 }, kaputt)).toBe(false);
  });

  it('übernimmt nur die bekannten Felder', () => {
    const speicher = speicherMit({
      [SPEICHER_SCHLUESSEL]: '{"trainingSekunden":20,"pauseSekunden":5,"gespeichert":true}',
    });
    expect(ladeEinstellung(speicher)).toEqual({ trainingSekunden: 20, pauseSekunden: 5 });
  });

  it('nutzt ohne Argument den localStorage des Browsers', () => {
    localStorage.clear();
    expect(ladeEinstellung()).toEqual(STANDARD_EINSTELLUNG);
    speichereEinstellung({ trainingSekunden: 12, pauseSekunden: 3 });
    expect(ladeEinstellung()).toEqual({ trainingSekunden: 12, pauseSekunden: 3 });
    localStorage.clear();
  });
});
