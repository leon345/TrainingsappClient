import {
  DynamicScheme,
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  hexFromArgb,
} from '@material/material-color-utilities';

/**
 * Erzeugt die Farb-Tokens (md.sys.color.*) als CSS-Variablen mit
 * `@material/material-color-utilities` (E2).
 *
 * Das Ergebnis liegt eingecheckt unter `tokens/farbe.css`. Der Test
 * `farbschema.test.ts` vergleicht die Datei mit der Ausgabe dieser Funktion.
 * Nach einer Änderung hier: `npx vitest run src/theme -u` schreibt die Datei neu.
 *
 * Herkunft der Parameter: siehe docs/design-tokens.md.
 */

/** Quellfarbe (eigene Festlegung): md.ref.palette.primary40 des M3-Baseline-Schemas. */
export const QUELLFARBE = '#6750a4';

/** Farbspezifikation 2025 = Farbsystem von M3 Expressive in material-color-utilities. */
export const SPEZIFIKATION = '2025' as const;

/** Kontraststufen: 0 = Standard, 1 = hoch (für `prefers-contrast: more`). */
export const KONTRAST_STANDARD = 0;
export const KONTRAST_HOCH = 1;

export function erzeugeSchema(dunkel: boolean, kontrast: number): DynamicScheme {
  return new SchemeTonalSpot(
    Hct.fromInt(argbAusHex(QUELLFARBE)),
    dunkel,
    kontrast,
    SPEZIFIKATION,
    'phone',
  );
}

function argbAusHex(hex: string): number {
  return (0xff000000 | parseInt(hex.slice(1), 16)) >>> 0;
}

/** snake_case-Namen der Bibliothek (z. B. `primary_container`) als CSS-Namen. */
function cssName(name: string): string {
  return `--md-sys-color-${name.replaceAll('_', '-')}`;
}

/**
 * Alle Farbrollen eines Schemas als Name-Wert-Paare.
 * Paletten-Schlüsselfarben werden ausgelassen, sie sind keine sys-Tokens.
 */
export function farbRollen(schema: DynamicScheme): [string, string][] {
  const farben = new MaterialDynamicColors();
  // `allColors` enthält surface-variant, shadow, scrim und surface-tint nicht,
  // sie gehören aber zu md.sys.color und werden deshalb ergänzt.
  const alle = [
    ...farben.allColors,
    farben.surfaceVariant(),
    farben.shadow(),
    farben.scrim(),
    farben.surfaceTint(),
  ];
  return alle
    .filter((farbe) => farbe !== undefined)
    .filter((farbe) => !farbe.name.endsWith('palette_key_color'))
    .map((farbe) => [cssName(farbe.name), hexFromArgb(farbe.getArgb(schema))]);
}

function block(selektor: string, schema: DynamicScheme, einzug = ''): string {
  const zeilen = farbRollen(schema).map(([name, wert]) => `${einzug}  ${name}: ${wert};`);
  return `${einzug}${selektor} {\n${einzug}  color-scheme: ${schema.isDark ? 'dark' : 'light'};\n${zeilen.join('\n')}\n${einzug}}`;
}

/**
 * CSS mit hellem und dunklem Schema, jeweils mit Standard- und hohem Kontrast.
 * Auswahl: Systemeinstellung (`prefers-color-scheme`), übersteuerbar über
 * `data-theme="light"` bzw. `data-theme="dark"` am `<html>`-Element.
 */
export function erzeugeFarbCss(): string {
  const hell = erzeugeSchema(false, KONTRAST_STANDARD);
  const dunkel = erzeugeSchema(true, KONTRAST_STANDARD);
  const hellHoch = erzeugeSchema(false, KONTRAST_HOCH);
  const dunkelHoch = erzeugeSchema(true, KONTRAST_HOCH);

  const autoDunkel = ':root:not([data-theme="light"])';

  return [
    '/*',
    ' * GENERIERT von src/theme/farbschema.ts – nicht von Hand bearbeiten.',
    ` * Quelle: @material/material-color-utilities, SchemeTonalSpot, Spezifikation ${SPEZIFIKATION},`,
    ` * Quellfarbe ${QUELLFARBE}. Herkunft: docs/design-tokens.md.`,
    ' */',
    '',
    block(':root', hell),
    '',
    '@media (prefers-color-scheme: dark) {',
    block(autoDunkel, dunkel, '  '),
    '}',
    '',
    block(':root[data-theme="dark"]', dunkel),
    '',
    '@media (prefers-contrast: more) {',
    block(':root', hellHoch, '  '),
    '}',
    '',
    '@media (prefers-contrast: more) and (prefers-color-scheme: dark) {',
    block(autoDunkel, dunkelHoch, '  '),
    '}',
    '',
    '@media (prefers-contrast: more) {',
    block(':root[data-theme="dark"]', dunkelHoch, '  '),
    '}',
    '',
  ].join('\n');
}
