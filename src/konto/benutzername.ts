/**
 * Benutzername nach E28, gleiche Regel wie `domain.benutzer.Benutzername` im
 * Server: Eingabe klein schreiben (nicht trimmen, Leerraum ist ein Fehler),
 * dann 3 bis 32 Zeichen aus a-z, 0-9, `.`, `_`, `-`; Anfang und Ende
 * alphanumerisch, keine zwei Sonderzeichen hintereinander.
 *
 * Die Prüfung im Client spart nur einen Aufruf; verbindlich ist der Server
 * (z. B. gesperrte Namen wie `admin`, die nur er kennt).
 */

export const BENUTZERNAME_MUSTER = /^[a-z0-9](?:[a-z0-9]|[._-](?=[a-z0-9])){2,31}$/;
export const BENUTZERNAME_MIN = 3;
export const BENUTZERNAME_MAX = 32;

/** Hinweis zur Namensregel für das Formular (E17, E28). */
export const BENUTZERNAME_REGEL =
  '3 bis 32 Zeichen: Kleinbuchstaben a–z, Ziffern und . _ -, am Anfang und Ende ein Buchstabe oder eine Ziffer. Keine E-Mail, kein Klarname.';

export type BenutzernameGrund = 'leer' | 'zu-kurz' | 'zu-lang' | 'zeichen' | 'sonderzeichen-stellung';

export type BenutzernamePruefung =
  | { gueltig: true; name: string }
  | { gueltig: false; grund: BenutzernameGrund };

export function pruefeBenutzername(eingabe: string): BenutzernamePruefung {
  // Wie Locale.ROOT im Server: keine sprachabhängige Umwandlung.
  const name = eingabe.toLowerCase();
  if (name.length === 0) return { gueltig: false, grund: 'leer' };
  if (!/^[a-z0-9._-]*$/.test(name)) return { gueltig: false, grund: 'zeichen' };
  if (name.length < BENUTZERNAME_MIN) return { gueltig: false, grund: 'zu-kurz' };
  if (name.length > BENUTZERNAME_MAX) return { gueltig: false, grund: 'zu-lang' };
  if (!BENUTZERNAME_MUSTER.test(name)) return { gueltig: false, grund: 'sonderzeichen-stellung' };
  return { gueltig: true, name };
}

export function benutzernameGrundText(grund: BenutzernameGrund): string {
  switch (grund) {
    case 'leer':
      return 'Bitte einen Benutzernamen eingeben.';
    case 'zu-kurz':
      return 'Der Benutzername ist zu kurz (mindestens 3 Zeichen).';
    case 'zu-lang':
      return 'Der Benutzername ist zu lang (höchstens 32 Zeichen).';
    case 'zeichen':
      return 'Nur Kleinbuchstaben a–z, Ziffern und . _ - sind erlaubt (keine Umlaute, Leerzeichen oder @).';
    case 'sonderzeichen-stellung':
      return 'Am Anfang und Ende muss ein Buchstabe oder eine Ziffer stehen, und . _ - dürfen nicht doppelt hintereinander stehen.';
  }
}
