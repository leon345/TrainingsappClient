import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Funktionale Tests des Intervalltimers (C-02). Ohne Tag: laufen in allen vier
 * Browsern (chromium, firefox, webkit, mobile) gegen den Produktions-Build.
 *
 * Die Zeit steuert Playwright (page.clock): `runFor` lässt die Zeit mit allen
 * Takten vergehen, `fastForward` springt vor und löst fällige Takte nur
 * einmal aus, wie ein gedrosselter Tab im Hintergrund.
 */

const START = new Date('2026-11-18T10:00:00Z');

async function oeffneTimer(page: Page) {
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeVisible();
}

/** Antippen auf Touch-Geräten, sonst Klick. */
async function bediene(locator: Locator) {
  const touch = await locator.page().evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) await locator.tap();
  else await locator.click();
}

async function stelleEin(page: Page, training: number, pause: number) {
  const felder = [
    [page.getByRole('textbox', { name: 'Training in Sekunden' }), training],
    [page.getByRole('textbox', { name: 'Pause in Sekunden' }), pause],
  ] as const;
  for (const [feld, wert] of felder) {
    await feld.fill(String(wert));
    await feld.press('Enter');
    await expect(feld).toHaveValue(String(wert));
  }
}

const zeit = (page: Page) => page.getByRole('timer');
const ansage = (page: Page) => page.getByRole('status');

test.describe('Intervalltimer', () => {
  test('Standard 30 s Training und 10 s Pause, Restzeit in Worten', async ({ page }) => {
    await oeffneTimer(page);
    await expect(page.getByRole('textbox', { name: 'Training in Sekunden' })).toHaveValue('30');
    await expect(page.getByRole('textbox', { name: 'Pause in Sekunden' })).toHaveValue('10');
    await expect(zeit(page)).toHaveText('00:30');
    await expect(zeit(page)).toHaveAccessibleName('Restzeit 30 Sekunden');
  });

  test('Training und Pause einstellen, starten, Phasen und Runden wechseln', async ({ page }) => {
    await oeffneTimer(page);
    await stelleEin(page, 5, 3);
    await expect(zeit(page)).toHaveText('00:05');

    await bediene(page.getByRole('button', { name: 'Start' }));
    await expect(page.getByRole('button', { name: 'Anhalten' })).toBeVisible();
    await expect(ansage(page)).toHaveText('Training, Runde 1');

    await page.clock.runFor(2000);
    await expect(zeit(page)).toHaveText('00:03');

    await page.clock.runFor(3000);
    await expect(ansage(page)).toHaveText('Pause, Runde 1');
    await expect(zeit(page)).toHaveText('00:03');
    await expect(page.getByRole('progressbar', { name: 'Fortschritt Pause' })).toBeVisible();

    await page.clock.runFor(3000);
    await expect(ansage(page)).toHaveText('Training, Runde 2');
    await expect(zeit(page)).toHaveText('00:05');
    await expect(page.getByText('Runde 2', { exact: true })).toBeVisible();
  });

  test('Anhalten, Fortsetzen und Zurücksetzen', async ({ page }) => {
    await oeffneTimer(page);
    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.runFor(4000);
    await expect(zeit(page)).toHaveText('00:26');

    await bediene(page.getByRole('button', { name: 'Anhalten' }));
    await expect(ansage(page)).toHaveText('Angehalten');
    await page.clock.runFor(60_000);
    await expect(zeit(page)).toHaveText('00:26');

    await bediene(page.getByRole('button', { name: 'Fortsetzen' }));
    await page.clock.runFor(6000);
    await expect(zeit(page)).toHaveText('00:20');

    await bediene(page.getByRole('button', { name: 'Zurücksetzen' }));
    await expect(zeit(page)).toHaveText('00:30');
    await expect(page.getByText('Bereit', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Training in Sekunden' })).toBeEnabled();
  });

  test('Einstellung ist während des Laufs gesperrt', async ({ page }) => {
    await oeffneTimer(page);
    await bediene(page.getByRole('button', { name: 'Start' }));
    await expect(page.getByRole('textbox', { name: 'Training in Sekunden' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Pause in Sekunden' })).toBeDisabled();
  });

  test('Zeitsprung ohne Takte (Tab länger im Hintergrund als eine Phase)', async ({ page }) => {
    await oeffneTimer(page);
    await bediene(page.getByRole('button', { name: 'Start' }));
    // 47 s am Stück: Runde 1 (40 s) ist vorbei, Runde 2 hat 23 s Training übrig.
    await page.clock.fastForward(47_000);
    await expect(zeit(page)).toHaveText('00:23');
    await expect(ansage(page)).toHaveText('Training, Runde 2');
  });

  test('Pause 0: nur Trainingsphasen', async ({ page }) => {
    await oeffneTimer(page);
    await stelleEin(page, 4, 0);
    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.runFor(4000);
    await expect(ansage(page)).toHaveText('Training, Runde 2');
    await expect(zeit(page)).toHaveText('00:04');
    await expect(page.getByText('Pause', { exact: true })).toHaveCount(0);
  });

  test('Lange Dauern als h:mm:ss, Grenzen werden eingehalten', async ({ page }) => {
    await oeffneTimer(page);
    const training = page.getByRole('textbox', { name: 'Training in Sekunden' });
    const pause = page.getByRole('textbox', { name: 'Pause in Sekunden' });

    await training.fill('100000');
    await training.press('Enter');
    await expect(training).toHaveValue('86400');
    await expect(zeit(page)).toHaveText('24:00:00');
    await expect(zeit(page)).toHaveAccessibleName('Restzeit 24 Stunden');

    await training.fill('0');
    await training.press('Enter');
    await expect(training).toHaveValue('1');

    await pause.fill('3600');
    await pause.press('Enter');
    await expect(pause).toHaveAccessibleDescription(/entspricht 1 Stunde\./);

    await training.fill('3661');
    await training.press('Enter');
    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.fastForward(61_000);
    await expect(zeit(page)).toHaveText('1:00:00');
  });

  test('Einstellung bleibt nach Neuladen erhalten (lokal gespeichert)', async ({ page }) => {
    await oeffneTimer(page);
    await stelleEin(page, 45, 15);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Training in Sekunden' })).toHaveValue('45');
    await expect(page.getByRole('textbox', { name: 'Pause in Sekunden' })).toHaveValue('15');
    await expect(zeit(page)).toHaveText('00:45');
  });

  test('Bedienung per Tastatur', async ({ page }) => {
    await oeffneTimer(page);
    await page.keyboard.press('Tab');
    const haupt = page.getByRole('button', { name: 'Start' });
    await expect(haupt).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Anhalten' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Fortsetzen' })).toBeFocused();
  });
});

test.describe('Bildschirmgröße Smartphone', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('alles erreichbar, kein horizontales Scrollen, Zielflächen mindestens 48 px', async ({ page }) => {
    await oeffneTimer(page);
    const ueberlauf = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(ueberlauf).toBeLessThanOrEqual(0);

    // Anzeige und Start ohne Scrollen sichtbar
    await expect(zeit(page)).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Start' })).toBeInViewport();

    const bedienelemente = [
      page.getByRole('button', { name: 'Start' }),
      page.getByRole('button', { name: 'Zurücksetzen' }),
      page.getByRole('textbox', { name: 'Training in Sekunden' }),
      page.getByRole('textbox', { name: 'Pause in Sekunden' }),
    ];
    for (const element of bedienelemente) {
      await element.scrollIntoViewIfNeeded();
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(360);
    }
    const start = (await page.getByRole('button', { name: 'Start' }).boundingBox())!;
    expect(start.height).toBeGreaterThanOrEqual(48);
    expect(start.width).toBeGreaterThanOrEqual(48);
  });
});

test.describe('Wake Lock', () => {
  /** Ersetzt die Screen Wake Lock API durch eine Attrappe, die Aufrufe mitschreibt. */
  async function attrappe(page: Page, verhalten: 'ok' | 'abgelehnt' | 'fehlt') {
    await page.addInitScript((modus) => {
      const protokoll: string[] = [];
      (window as unknown as { wakeLockProtokoll: string[] }).wakeLockProtokoll = protokoll;
      const api =
        modus === 'fehlt'
          ? undefined
          : {
              request: async (typ: string) => {
                protokoll.push(`request:${typ}`);
                if (modus === 'abgelehnt') throw new DOMException('nein', 'NotAllowedError');
                const sperre = {
                  released: false,
                  type: typ,
                  release: async () => {
                    sperre.released = true;
                    protokoll.push('release');
                  },
                  addEventListener() {},
                  removeEventListener() {},
                };
                return sperre;
              },
            };
      if (api) {
        Object.defineProperty(Navigator.prototype, 'wakeLock', { get: () => api, configurable: true });
      } else {
        // Browser ohne API: Eigenschaft entfernen
        delete (Navigator.prototype as { wakeLock?: unknown }).wakeLock;
      }
    }, verhalten);
  }

  const protokoll = (page: Page) =>
    page.evaluate(() => (window as unknown as { wakeLockProtokoll: string[] }).wakeLockProtokoll);

  test('Sperre beim Start, Freigabe beim Anhalten', async ({ page }) => {
    await attrappe(page, 'ok');
    await oeffneTimer(page);
    expect(await protokoll(page)).toEqual([]);

    await bediene(page.getByRole('button', { name: 'Start' }));
    await expect.poll(() => protokoll(page)).toEqual(['request:screen']);

    await bediene(page.getByRole('button', { name: 'Anhalten' }));
    await expect.poll(() => protokoll(page)).toEqual(['request:screen', 'release']);
  });

  for (const verhalten of ['abgelehnt', 'fehlt'] as const) {
    test(`Timer läuft korrekt, wenn Wake Lock ${verhalten === 'fehlt' ? 'fehlt' : 'abgelehnt wird'}`, async ({
      page,
    }) => {
      await attrappe(page, verhalten);
      await oeffneTimer(page);
      expect(await page.evaluate(() => 'wakeLock' in navigator)).toBe(verhalten !== 'fehlt');
      await bediene(page.getByRole('button', { name: 'Start' }));
      await page.clock.runFor(31_000);
      await expect(ansage(page)).toHaveText('Pause, Runde 1');
      await expect(zeit(page)).toHaveText('00:09');
    });
  }

  test('echte API des Browsers: Timer läuft unabhängig vom Ergebnis', async ({ page }) => {
    // Hält fest, was die (emulierte) Umgebung meldet. Ob Wake Lock auf echten
    // Geräten greift, prüft dieser Test NICHT (offen für C-01b).
    await oeffneTimer(page);
    const ergebnis = await page.evaluate(async () => {
      if (!('wakeLock' in navigator)) return 'API fehlt';
      try {
        const sperre = await navigator.wakeLock.request('screen');
        await sperre.release();
        return 'erteilt';
      } catch (fehler) {
        return `abgelehnt (${(fehler as Error).name})`;
      }
    });
    test.info().annotations.push({ type: 'wake-lock', description: ergebnis });

    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.runFor(3000);
    await expect(zeit(page)).toHaveText('00:27');
  });
});
