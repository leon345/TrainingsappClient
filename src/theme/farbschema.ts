import {
  argbFromHex,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  SchemeExpressive,
} from '@material/material-color-utilities';

/**
 * Verbindliche Quellfarbe (Seed) der Trainingsapp.
 * Daraus generiert Material Color Utilities (SchemeExpressive, Spec 2025)
 * sowohl das helle als auch das dunkle Material-3-Expressive-Farbschema.
 */
export const QUELLFARBE = '#006A60';

export interface Farbpalette {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

export interface Farbschema {
  quellfarbe: string;
  hell: Farbpalette;
  dunkel: Farbpalette;
}

const farben = new MaterialDynamicColors();

export function erzeugeFarbpalette(
  quellfarbeHex: string,
  dunkel: boolean,
  kontrast = 0,
): Farbpalette {
  const hct = Hct.fromInt(argbFromHex(quellfarbeHex));
  const scheme = new SchemeExpressive(hct, dunkel, kontrast, '2025');
  const hex = (rolle: ReturnType<typeof farben.primary>) => hexFromArgb(rolle.getArgb(scheme));

  return {
    primary: hex(farben.primary()),
    onPrimary: hex(farben.onPrimary()),
    primaryContainer: hex(farben.primaryContainer()),
    onPrimaryContainer: hex(farben.onPrimaryContainer()),
    secondary: hex(farben.secondary()),
    onSecondary: hex(farben.onSecondary()),
    secondaryContainer: hex(farben.secondaryContainer()),
    onSecondaryContainer: hex(farben.onSecondaryContainer()),
    tertiary: hex(farben.tertiary()),
    onTertiary: hex(farben.onTertiary()),
    tertiaryContainer: hex(farben.tertiaryContainer()),
    onTertiaryContainer: hex(farben.onTertiaryContainer()),
    error: hex(farben.error()),
    onError: hex(farben.onError()),
    errorContainer: hex(farben.errorContainer()),
    onErrorContainer: hex(farben.onErrorContainer()),
    background: hex(farben.background()),
    onBackground: hex(farben.onBackground()),
    surface: hex(farben.surface()),
    onSurface: hex(farben.onSurface()),
    surfaceVariant: hex(farben.surfaceVariant()),
    onSurfaceVariant: hex(farben.onSurfaceVariant()),
    surfaceContainerLowest: hex(farben.surfaceContainerLowest()),
    surfaceContainerLow: hex(farben.surfaceContainerLow()),
    surfaceContainer: hex(farben.surfaceContainer()),
    surfaceContainerHigh: hex(farben.surfaceContainerHigh()),
    surfaceContainerHighest: hex(farben.surfaceContainerHighest()),
    outline: hex(farben.outline()),
    outlineVariant: hex(farben.outlineVariant()),
    inverseSurface: hex(farben.inverseSurface()),
    inverseOnSurface: hex(farben.inverseOnSurface()),
    inversePrimary: hex(farben.inversePrimary()),
  };
}

export function erzeugeFarbschema(quellfarbeHex: string = QUELLFARBE): Farbschema {
  return {
    quellfarbe: quellfarbeHex,
    hell: erzeugeFarbpalette(quellfarbeHex, false),
    dunkel: erzeugeFarbpalette(quellfarbeHex, true),
  };
}

export const STANDARD_FARBSCHEMA: Farbschema = erzeugeFarbschema(QUELLFARBE);
