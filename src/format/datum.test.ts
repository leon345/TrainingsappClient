import { describe, expect, it } from 'vitest';
import { formatiereDatum } from './datum';

describe('formatiereDatum', () => {
  it('formatiert reine ISO-Daten als TT.MM.JJJJ', () => {
    expect(formatiereDatum('2026-11-19')).toBe('19.11.2026');
    expect(formatiereDatum('2026-01-05')).toBe('05.01.2026');
  });

  it('formatiert ISO-Zeitstempel in UTC als TT.MM.JJJJ', () => {
    expect(formatiereDatum('2026-11-19T00:00:00Z')).toBe('19.11.2026');
    expect(formatiereDatum('2026-12-31T23:59:59Z')).toBe('31.12.2026');
  });

  it('wirft RangeError bei ungueltigen Daten', () => {
    expect(() => formatiereDatum('kein-datum')).toThrow(RangeError);
    expect(() => formatiereDatum('2026-02-30')).toThrow(RangeError);
    expect(() => formatiereDatum('')).toThrow(RangeError);
  });
});
