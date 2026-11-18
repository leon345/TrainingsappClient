import { describe, expect, it } from 'vitest';
import { DAUER_MAX_SEKUNDEN, formatiereDauer } from './dauer';

describe('formatiereDauer: Anzeige (E21)', () => {
  it.each([
    [0, '00:00'],
    [1, '00:01'],
    [9, '00:09'],
    [10, '00:10'],
    [30, '00:30'],
    [59, '00:59'],
    [60, '01:00'],
    [61, '01:01'],
    [600, '10:00'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3601, '1:00:01'],
    [3660, '1:01:00'],
    [36_000, '10:00:00'],
    [86_399, '23:59:59'],
    [86_400, '24:00:00'],
  ])('%i s → %s', (sekunden, text) => {
    expect(formatiereDauer(sekunden).text).toBe(text);
  });
});

describe('formatiereDauer: aria-label in Worten', () => {
  it.each([
    [0, '0 Sekunden'],
    [1, '1 Sekunde'],
    [2, '2 Sekunden'],
    [30, '30 Sekunden'],
    [60, '1 Minute'],
    [61, '1 Minute und 1 Sekunde'],
    [125, '2 Minuten und 5 Sekunden'],
    [3599, '59 Minuten und 59 Sekunden'],
    [3600, '1 Stunde'],
    [3601, '1 Stunde und 1 Sekunde'],
    [3661, '1 Stunde, 1 Minute und 1 Sekunde'],
    [7322, '2 Stunden, 2 Minuten und 2 Sekunden'],
    [86_399, '23 Stunden, 59 Minuten und 59 Sekunden'],
    [86_400, '24 Stunden'],
  ])('%i s → %s', (sekunden, worte) => {
    expect(formatiereDauer(sekunden).ariaLabel).toBe(worte);
  });
});

describe('formatiereDauer: ungültige Werte', () => {
  it.each([-1, 0.5, 29.999, DAUER_MAX_SEKUNDEN + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'wirft bei %s',
    (sekunden) => {
      expect(() => formatiereDauer(sekunden)).toThrow(RangeError);
    },
  );
});
