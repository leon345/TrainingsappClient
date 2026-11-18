import { Contrast, argbFromHex, lstarFromArgb } from '@material/material-color-utilities';
import { describe, expect, it } from 'vitest';
import { KONTRAST_HOCH, KONTRAST_STANDARD, erzeugeFarbCss, erzeugeSchema, farbRollen } from './farbschema';

function kontrast(a: string, b: string): number {
  return Contrast.ratioOfTones(lstarFromArgb(argbFromHex(a)), lstarFromArgb(argbFromHex(b)));
}

describe('Farbschema', () => {
  it('eingecheckte tokens/farbe.css entspricht der Ausgabe des Generators', async () => {
    await expect(erzeugeFarbCss()).toMatchFileSnapshot('./tokens/farbe.css');
  });

  it('enthält die Kernrollen von md.sys.color', () => {
    const namen = farbRollen(erzeugeSchema(false, KONTRAST_STANDARD)).map(([n]) => n);
    for (const rolle of [
      'primary',
      'on-primary',
      'primary-container',
      'on-primary-container',
      'secondary-container',
      'on-secondary-container',
      'tertiary',
      'error',
      'surface',
      'on-surface',
      'on-surface-variant',
      'surface-container',
      'surface-container-highest',
      'outline',
      'outline-variant',
      'inverse-surface',
      'inverse-on-surface',
      'shadow',
    ]) {
      expect(namen).toContain(`--md-sys-color-${rolle}`);
    }
  });

  // WCAG 2.1 AA (E7): Text mindestens 4,5:1, Bedienelement-Grenzen mindestens 3:1.
  const textPaare: [string, string][] = [
    ['on-primary', 'primary'],
    ['on-primary-container', 'primary-container'],
    ['on-secondary-container', 'secondary-container'],
    ['on-tertiary-container', 'tertiary-container'],
    ['on-error', 'error'],
    ['on-surface', 'surface'],
    ['on-surface-variant', 'surface'],
    ['on-surface-variant', 'surface-container-highest'],
    ['primary', 'surface'],
    ['inverse-on-surface', 'inverse-surface'],
  ];

  for (const dunkel of [false, true]) {
    for (const stufe of [KONTRAST_STANDARD, KONTRAST_HOCH]) {
      const name = `${dunkel ? 'dunkel' : 'hell'}, Kontrast ${stufe}`;
      const rollen = new Map(
        farbRollen(erzeugeSchema(dunkel, stufe)).map(([n, w]) => [n.replace('--md-sys-color-', ''), w]),
      );

      it.each(textPaare)(`${name}: %s auf %s hat mindestens 4,5:1`, (vorn, hinten) => {
        expect(kontrast(rollen.get(vorn)!, rollen.get(hinten)!)).toBeGreaterThanOrEqual(4.5);
      });

      it(`${name}: outline auf surface hat mindestens 3:1`, () => {
        expect(kontrast(rollen.get('outline')!, rollen.get('surface')!)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
