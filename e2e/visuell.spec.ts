import { expect, test, type Page } from '@playwright/test';

/*
 * Visuelle Tests der Kernkomponenten (C-06). Grundlage ist die
 * Komponentengalerie (galerie.html).
 *
 * Tags (Zuordnung zu den Projekten in playwright.config.ts):
 * - `@visuell`: Bildvergleich gegen Referenzbilder. Läuft nur in Chromium
 *   (Projekt `visuell-chromium`) gegen den Test-Build. Referenzbilder liegen
 *   unter e2e/visuell.spec.ts-snapshots/, nur für Chromium unter Linux.
 * - `@galerie`: braucht galerie.html, die es nur im Test-Build gibt (E24).
 *   Funktionale Galerie-Tests (`@galerie` ohne `@visuell`) laufen in allen
 *   Browsern gegen den Test-Build (Projekte `galerie-*`).
 * - ohne Tag: funktional, alle Browser gegen den Produktions-Build.
 *
 * Neu erzeugen nach gewollten Änderungen:
 *   npx playwright test --project=visuell-chromium --update-snapshots
 */

const ABSCHNITTE = [
  'buttons',
  'icon-buttons',
  'textfelder',
  'cards',
  'icons',
  'farben',
  'typografie',
  'formen',
] as const;

async function oeffneGalerie(page: Page, farbschema: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: farbschema, reducedMotion: 'reduce' });
  await page.goto('/galerie.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Komponentengalerie' })).toBeVisible();
  // Schrift vollständig geladen, sonst schwanken die Bilder.
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 16px "Roboto Variable"'),
      document.fonts.load('500 16px "Roboto Variable"'),
      document.fonts.load('600 16px "Roboto Variable"'),
    ]);
    await document.fonts.ready;
  });
}

for (const farbschema of ['light', 'dark'] as const) {
  test.describe(
    `Komponentengalerie (${farbschema === 'light' ? 'hell' : 'dunkel'})`,
    { tag: ['@galerie', '@visuell'] },
    () => {
      for (const abschnitt of ABSCHNITTE) {
        test(`${abschnitt}`, async ({ page }) => {
          await oeffneGalerie(page, farbschema);
          await expect(page.getByTestId(abschnitt)).toHaveScreenshot(`${abschnitt}-${farbschema}.png`);
        });
      }
    },
  );
}

test('Button: Fokusring bei Tastaturbedienung', { tag: ['@galerie', '@visuell'] }, async ({ page }) => {
  await oeffneGalerie(page, 'light');
  const button = page.getByRole('button', { name: 'Filled' });
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await expect(page.getByTestId('buttons')).toHaveScreenshot('buttons-fokus-light.png');
});

test('Textfeld: schwebendes Label im Fokus', { tag: ['@galerie', '@visuell'] }, async ({ page }) => {
  await oeffneGalerie(page, 'light');
  await page.getByRole('textbox', { name: 'Titel' }).focus();
  await expect(page.getByTestId('textfelder')).toHaveScreenshot('textfelder-fokus-light.png', {
    // Blinkender Cursor
    caret: 'hide',
  });
});

test('Startseite (hell und dunkel)', { tag: '@visuell' }, async ({ page }) => {
  for (const farbschema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: farbschema });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Trainingsapp' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`startseite-${farbschema}.png`);
  }
});

test('Roboto wird selbst gehostet geladen', { tag: '@galerie' }, async ({ page, baseURL }) => {
  const schriften: string[] = [];
  page.on('request', (anfrage) => {
    if (anfrage.resourceType() === 'font') schriften.push(anfrage.url());
  });
  await oeffneGalerie(page, 'light');

  expect(await page.evaluate(() => document.fonts.check('16px "Roboto Variable"'))).toBe(true);
  expect(schriften.length).toBeGreaterThan(0);
  for (const url of schriften) {
    expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
  }
});

test('Dunkles Schema folgt der Systemeinstellung und data-theme', async ({ page }) => {
  const flaeche = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim(),
    );

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const hell = await flaeche();

  await page.emulateMedia({ colorScheme: 'dark' });
  const dunkel = await flaeche();
  expect(dunkel).not.toBe(hell);

  // Ausdrückliche Wahl übersteuert die Systemeinstellung
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  expect(await flaeche()).toBe(hell);
});

test('Galerie fragt keine fremden Hosts an', { tag: '@galerie' }, async ({ page, baseURL }) => {
  const eigeneHerkunft = new URL(baseURL!).origin;
  const fremde: string[] = [];
  page.on('request', (anfrage) => {
    const url = new URL(anfrage.url());
    if (url.protocol.startsWith('http') && url.origin !== eigeneHerkunft) {
      fremde.push(anfrage.url());
    }
  });

  await page.goto('/galerie.html');
  await page.waitForLoadState('networkidle');

  expect(fremde).toEqual([]);
});
