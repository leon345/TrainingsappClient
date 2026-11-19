import { describe, expect, it } from 'vitest';
import { dauerAlsWorte, formatiereDauer, MAX_DAUER_SEKUNDEN } from './dauer';

describe('formatiereDauer', () => {
  it.each([
    [0, '00:00'],
    [1, '00:01'],
    [30, '00:30'],
    [59, '00:59'],
    [60, '01:00'],
    [65, '01:05'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
    [36_000, '10:00:00'],
    [MAX_DAUER_SEKUNDEN, '24:00:00'],
  ])('formatiert %i Sekunden als %s', (sekunden, erwartet) => {
    expect(formatiereDauer(sekunden)).toBe(erwartet);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_DAUER_SEKUNDEN + 1])(
    'wirft RangeError fuer ungueltigen Wert %s',
    (ungueltig) => {
      expect(() => formatiereDauer(ungueltig)).toThrow(RangeError);
    },
  );
});

describe('dauerAlsWorte', () => {
  it.each([
    [0, '0 Sekunden'],
    [1, '1 Sekunde'],
    [30, '30 Sekunden'],
    [59, '59 Sekunden'],
    [60, '1 Minute'],
    [61, '1 Minute und 1 Sekunde'],
    [90, '1 Minute und 30 Sekunden'],
    [3599, '59 Minuten und 59 Sekunden'],
    [3600, '1 Stunde'],
    [3601, '1 Stunde und 1 Sekunde'],
    [3660, '1 Stunde und 1 Minute'],
    [3661, '1 Stunde, 1 Minute und 1 Sekunde'],
    [7325, '2 Stunden, 2 Minuten und 5 Sekunden'],
    [MAX_DAUER_SEKUNDEN, '24 Stunden'],
  ])('formatiert %i Sekunden als "%s"', (sekunden, erwartet) => {
    expect(dauerAlsWorte(sekunden)).toBe(erwartet);
  });

  it('wirft RangeError bei negativen oder zu grossen Werten', () => {
    expect(() => dauerAlsWorte(-5)).toThrow(RangeError);
    expect(() => dauerAlsWorte(MAX_DAUER_SEKUNDEN + 1)).toThrow(RangeError);
  });
});
