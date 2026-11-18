import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PASSKEY_HANDY, PASSKEY_LAPTOP, installiereServer, type PasskeyV1 } from './konto-server';

/*
 * Bildvergleiche der Konto-Ansicht (C-03), nur Chromium (Tag `@visuell`,
 * Projekt `visuell-chromium`, Test-Build).
 *
 * Abweichung von der Galerie: Die Konto-Ansicht liegt unter src/konto/ und
 * braucht eine Konto-Steuerung. Die Galerie darf nach der ESLint-Regel (E24)
 * nur src/components/ importieren. Deshalb zeigt dieser Test die echte App
 * mit festen Beispieldaten aus der Server-Attrappe (e2e/konto-server.ts),
 * ohne Server.
 *
 * Ganzseite mit gelöster Navigationsleiste wie in e2e/visuell.spec.ts
 * (Begründung in e2e/ganzseite.css).
 */

const GANZSEITE = fileURLToPath(new URL('./ganzseite.css', import.meta.url));

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

const ZUSTAENDE: {
  name: string;
  titel: string;
  start: { angemeldet?: boolean; passkeys?: PasskeyV1[] };
  nichtErreichbar?: boolean;
  bereit: (page: Page) => Promise<void>;
}[] = [
  {
    name: 'konto-abgemeldet',
    titel: 'nicht angemeldet',
    start: {},
    bereit: (page) => expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible(),
  },
  {
    name: 'konto-zwei-passkeys',
    titel: 'angemeldet mit zwei Passkeys',
    start: { angemeldet: true, passkeys: [PASSKEY_HANDY, PASSKEY_LAPTOP] },
    bereit: (page) => expect(page.getByRole('listitem')).toHaveCount(2),
  },
  {
    name: 'konto-ein-passkey',
    titel: 'angemeldet mit einem Passkey und Hinweis',
    start: { angemeldet: true, passkeys: [PASSKEY_HANDY] },
    bereit: (page) =>
      expect(page.getByRole('heading', { level: 3, name: 'Lege einen zweiten Passkey an' })).toBeVisible(),
  },
  {
    name: 'konto-fehler',
    titel: 'Fehler: Server nicht erreichbar',
    start: {},
    nichtErreichbar: true,
    bereit: (page) => expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible(),
  },
];

test.describe('Konto-Ansicht', { tag: '@visuell' }, () => {
  for (const zustand of ZUSTAENDE) {
    for (const farbschema of ['light', 'dark'] as const) {
      test(`${zustand.titel} (${farbschema === 'light' ? 'hell' : 'dunkel'})`, async ({ page }) => {
        const server = await installiereServer(page, zustand.start);
        server.nichtErreichbar = zustand.nichtErreichbar ?? false;
        await page.emulateMedia({ colorScheme: farbschema, reducedMotion: 'reduce' });
        await page.goto('/');
        await page.getByRole('button', { name: 'Konto', exact: true }).click();
        await zustand.bereit(page);
        await page.mouse.move(0, 0);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${zustand.name}-${farbschema}.png`, {
          fullPage: true,
          stylePath: GANZSEITE,
        });
      });
    }
  }
});
