import { describe, expect, it } from 'vitest';
import { benutzernameGrundText, pruefeBenutzername, type BenutzernameGrund } from './benutzername';

describe('pruefeBenutzername (E28)', () => {
  it.each(['abc', 'anna', 'a.b', 'a_b-c.d', '007', 'x'.repeat(32), 'a1-b2_c3.d4'])('gültig: %s', (n) => {
    expect(pruefeBenutzername(n)).toEqual({ gueltig: true, name: n });
  });

  it('wandelt in Kleinbuchstaben um', () => {
    expect(pruefeBenutzername('Anna.B')).toEqual({ gueltig: true, name: 'anna.b' });
  });

  it.each<[string, BenutzernameGrund]>([
    ['', 'leer'],
    ['ab', 'zu-kurz'],
    ['x'.repeat(33), 'zu-lang'],
    ['anna@example.org', 'zeichen'],
    ['jürgen', 'zeichen'],
    [' anna', 'zeichen'],
    ['anna ', 'zeichen'],
    ['an na', 'zeichen'],
    ['anna😀', 'zeichen'],
    ['.anna', 'sonderzeichen-stellung'],
    ['anna-', 'sonderzeichen-stellung'],
    ['an..na', 'sonderzeichen-stellung'],
    ['an._na', 'sonderzeichen-stellung'],
    ['a-.', 'sonderzeichen-stellung'],
  ])('ungültig: %j (%s)', (n, grund) => {
    expect(pruefeBenutzername(n)).toEqual({ gueltig: false, grund });
  });

  it('jeder Grund hat einen Text', () => {
    for (const g of ['leer', 'zu-kurz', 'zu-lang', 'zeichen', 'sonderzeichen-stellung'] as const) {
      expect(benutzernameGrundText(g).length).toBeGreaterThan(10);
    }
  });
});
