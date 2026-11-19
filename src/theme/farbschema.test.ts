import { describe, expect, it } from 'vitest';
import {
  erzeugeFarbpalette,
  erzeugeFarbschema,
  QUELLFARBE,
  STANDARD_FARBSCHEMA,
  type Farbpalette,
} from './farbschema';

const HEX_MUSTER = /^#[0-9a-f]{6}$/i;

function helligkeit(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('farbschema (Material 3 Expressive)', () => {
  it('erzeugt gueltige Hex-Farben fuer alle Rollen im Hell- und Dunkelschema', () => {
    const schema = erzeugeFarbschema(QUELLFARBE);
    expect(schema.quellfarbe).toBe(QUELLFARBE);

    for (const palette of [schema.hell, schema.dunkel]) {
      const eintraege = Object.entries(palette) as [keyof Farbpalette, string][];
      expect(eintraege.length).toBeGreaterThanOrEqual(30);
      for (const [, wert] of eintraege) {
        expect(wert).toMatch(HEX_MUSTER);
      }
    }
  });

  it('liefert im Hellschema eine helle und im Dunkelschema eine dunkle Oberflaeche', () => {
    expect(helligkeit(STANDARD_FARBSCHEMA.hell.surface)).toBeGreaterThan(200);
    expect(helligkeit(STANDARD_FARBSCHEMA.dunkel.surface)).toBeLessThan(60);
    expect(helligkeit(STANDARD_FARBSCHEMA.hell.onSurface)).toBeLessThan(60);
    expect(helligkeit(STANDARD_FARBSCHEMA.dunkel.onSurface)).toBeGreaterThan(190);
  });

  it('reagiert deterministisch auf unterschiedliche Quellfarben', () => {
    const a = erzeugeFarbpalette('#006A60', false);
    const b = erzeugeFarbpalette('#006A60', false);
    const c = erzeugeFarbpalette('#B3261E', false);

    expect(a).toEqual(b);
    expect(a.primary).not.toBe(c.primary);
  });
});
