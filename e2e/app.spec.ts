import { expect, test } from '@playwright/test';

test('Startseite zeigt Titel und bedienbaren Button', async ({ page }) => {
  // Seit C-02 ist die Startseite der Timer; der Start-Button ersetzt den
  // früheren Beispiel-Button.
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Trainingsapp' })).toBeVisible();

  const button = page.getByRole('button', { name: 'Start' });
  await button.click();
  await expect(page.getByRole('status')).toHaveText('Training, Runde 1');
});

test('Tab setzt den Tastaturfokus auf den ersten Button', async ({ page }) => {
  // Funktions- und Barrierefreiheitsprüfung ohne Bildvergleich, alle Browser.
  // Der Fokusring selbst wird nur in Chromium per Bildvergleich geprüft.
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Start' });
  await expect(button).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
});

test('Layout passt ohne horizontales Scrollen in den Viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const ueberlauf = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(ueberlauf).toBeLessThanOrEqual(0);
});

test('PWA-Manifest ist verlinkt und gültig', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const antwort = await request.get(new URL(href!, page.url()).toString());
  expect(antwort.ok()).toBe(true);
  const manifest = await antwort.json();
  expect(manifest.name).toBe('Trainingsapp');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThan(0);

  for (const icon of manifest.icons as { src: string }[]) {
    const iconAntwort = await request.get(new URL(icon.src, page.url()).toString());
    expect(iconAntwort.ok(), icon.src).toBe(true);
  }
});

test('Service Worker wird ausgeliefert', async ({ request }) => {
  const antwort = await request.get('/sw.js');
  expect(antwort.ok()).toBe(true);
  expect(antwort.headers()['content-type']).toContain('javascript');
});

test('Service Worker wird registriert', async ({ page }) => {
  await page.goto('/');
  const scope = await page.evaluate(async () => {
    const registrierung = await navigator.serviceWorker.ready;
    return registrierung.scope;
  });
  expect(scope).toBe(new URL('/', page.url()).toString());
});

test('Keine Anfragen an fremde Hosts (E2: keine CDNs)', async ({ page, baseURL }) => {
  const eigeneHerkunft = new URL(baseURL!).origin;
  const fremde: string[] = [];
  page.on('request', (anfrage) => {
    const url = new URL(anfrage.url());
    if (url.protocol.startsWith('http') && url.origin !== eigeneHerkunft) {
      fremde.push(anfrage.url());
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(fremde).toEqual([]);
});
