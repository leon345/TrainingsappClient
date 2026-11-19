import { describe, expect, it } from 'vitest';
import {
  normalisiereBenutzername,
  pruefeBenutzername,
  pruefePasskeyBezeichnung,
} from './benutzername';

describe('benutzername- und passkey-bezeichnungs-validierung', () => {
  it('akzeptiert gueltige Pseudonyme und normalisiert auf Kleinschreibung', () => {
    expect(normalisiereBenutzername('Max.Muster_01')).toBe('max.muster_01');

    for (const gueltig of ['abc', 'Max.Muster', 'a_b-c.1', 'user-123', 'a'.repeat(32)]) {
      const ergebnis = pruefeBenutzername(gueltig);
      expect(ergebnis.gueltig, `erwartet gueltig fuer "${gueltig}"`).toBe(true);
      expect(ergebnis.normalisiert).toBe(gueltig.toLowerCase());
      expect(ergebnis.fehler).toBeNull();
    }
  });

  it('lehnt ungueltige Benutzernamen mit verstaendlichen Meldungen ab', () => {
    expect(pruefeBenutzername('').gueltig).toBe(false);
    expect(pruefeBenutzername('ab').gueltig).toBe(false);
    expect(pruefeBenutzername('a'.repeat(33)).gueltig).toBe(false);
    expect(pruefeBenutzername(' max').gueltig).toBe(false);
    expect(pruefeBenutzername('max muster').gueltig).toBe(false);
    expect(pruefeBenutzername('.max').gueltig).toBe(false);
    expect(pruefeBenutzername('max.').gueltig).toBe(false);
    expect(pruefeBenutzername('max..muster').gueltig).toBe(false);
    expect(pruefeBenutzername('max._muster').gueltig).toBe(false);
    expect(pruefeBenutzername('max@example.com').gueltig).toBe(false);
    expect(pruefeBenutzername('müller').gueltig).toBe(false);
  });

  it('lehnt reservierte Benutzernamen aus der Sperrliste ab', () => {
    for (const gesperrt of ['admin', 'ADMIN', 'root', 'system', 'support', 'trainingsapp']) {
      const ergebnis = pruefeBenutzername(gesperrt);
      expect(ergebnis.gueltig).toBe(false);
      expect(ergebnis.fehler).toMatch(/reserviert/i);
    }
  });

  it('prueft Passkey-Bezeichnungen (Trim, NFC, 1..50 Zeichen, keine Steuerzeichen)', () => {
    const gueltig = pruefePasskeyBezeichnung('  YubiKey Büro 1  ');
    expect(gueltig.gueltig).toBe(true);
    expect(gueltig.bereinigt).toBe('YubiKey Büro 1');
    expect(gueltig.fehler).toBeNull();

    expect(pruefePasskeyBezeichnung('   ').gueltig).toBe(false);
    expect(pruefePasskeyBezeichnung('x'.repeat(50)).gueltig).toBe(true);
    expect(pruefePasskeyBezeichnung('x'.repeat(51)).gueltig).toBe(false);
    expect(pruefePasskeyBezeichnung('Passkey\n1').gueltig).toBe(false);
    expect(pruefePasskeyBezeichnung('Passkey\u200B1').gueltig).toBe(false);
  });
});
