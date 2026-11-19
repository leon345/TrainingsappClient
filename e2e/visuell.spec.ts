import { expect, test } from '@playwright/test';
import { installiereV1Attrappe } from './support/v1Attrappe';

const SZENARIEN = [
  { name: 'startseite-desktop-hell', breite: 1280, hoehe: 800, farbschema: 'light' as const },
  { name: 'startseite-desktop-dunkel', breite: 1280, hoehe: 800, farbschema: 'dark' as const },
  { name: 'startseite-mobil-hell', breite: 360, hoehe: 800, farbschema: 'light' as const },
  { name: 'startseite-mobil-dunkel', breite: 360, hoehe: 800, farbschema: 'dark' as const },
];

test.describe('Visuelle Regression (nur Chromium – Nutzerentscheid C)', () => {
  for (const szenario of SZENARIEN) {
    test(`Snapshot: ${szenario.name}`, async ({ page }) => {
      await page.setViewportSize({ width: szenario.breite, height: szenario.hoehe });
      await page.emulateMedia({ colorScheme: szenario.farbschema, reducedMotion: 'reduce' });

      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      await expect(page).toHaveScreenshot(`${szenario.name}.png`, {
        animations: 'disabled',
      });
    });
  }

  test('Snapshot: timer-laufend-mobil-hell', async ({ page }) => {
    const startZeit = new Date('2026-11-19T12:00:00Z').getTime();
    const basisZeit = startZeit + 60_000;
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.clock.install({ time: startZeit });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
    await page.clock.pauseAt(basisZeit);
    await page.getByRole('button', { name: 'Start' }).click();
    await page.clock.runFor(10_000);
    await expect(page.getByRole('timer')).toHaveText('00:20');

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('timer-laufend-mobil-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: konto-abgemeldet-desktop-hell', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: false });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

    await page.goto('/konto');
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('konto-abgemeldet-desktop-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: konto-abgemeldet-mobil-dunkel', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: false });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    await page.goto('/konto');
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('konto-abgemeldet-mobil-dunkel.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: konto-angemeldet-desktop-hell', async ({ page }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialPasskeys: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
          credentialId: 'cred-1',
          bezeichnung: 'Laptop Arbeit',
          erstelltAm: '2026-11-19',
          zuletztVerwendetAm: '2026-11-20',
        },
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
          credentialId: 'cred-2',
          bezeichnung: 'Smartphone',
          erstelltAm: '2026-11-19',
        },
      ],
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

    await page.goto('/konto');
    await expect(page.getByText('Laptop Arbeit', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('konto-angemeldet-desktop-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: konto-angemeldet-mobil-dunkel', async ({ page }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialPasskeys: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
          credentialId: 'cred-1',
          bezeichnung: 'Passkey 1',
          erstelltAm: '2026-11-19',
        },
      ],
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    await page.goto('/konto');
    await expect(page.getByText('Passkey 1', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('konto-angemeldet-mobil-dunkel.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: workouts-uebersicht-desktop-hell', async ({ page }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialWorkouts: [
        {
          id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000001',
          typ: 'KRAFT',
          titel: 'Oberkörper Kraft',
          startZeit: '2026-11-19T17:00:00Z',
          dauerSekunden: 3600,
          notiz: 'Saubere Technik bei Bankdrücken und Rudern',
          sichtbarkeit: 'PRIVAT',
          herkunft: 'MANUELL',
          erstelltAm: '2026-11-19T17:00:00Z',
          geaendertAm: '2026-11-19T18:00:00Z',
          version: 1,
          uebungen: [
            {
              id: 'cccccccc-cccc-4aaa-8aaa-000000000001',
              position: 0,
              name: 'Bankdrücken',
              saetze: [
                {
                  id: 'dddddddd-dddd-4aaa-8aaa-000000000001',
                  position: 0,
                  wiederholungen: 8,
                  gewichtKg: 75,
                },
              ],
            },
          ],
        },
        {
          id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000002',
          typ: 'CALISTHENICS',
          titel: 'Front Lever & Pull',
          startZeit: '2026-11-18T16:30:00Z',
          dauerSekunden: 2700,
          sichtbarkeit: 'OEFFENTLICH',
          herkunft: 'MANUELL',
          erstelltAm: '2026-11-18T16:30:00Z',
          geaendertAm: '2026-11-18T17:15:00Z',
          version: 1,
          uebungen: [
            {
              id: 'cccccccc-cccc-4aaa-8aaa-000000000002',
              position: 0,
              name: 'Front Lever',
              variante: 'Tuck',
              saetze: [
                {
                  id: 'dddddddd-dddd-4aaa-8aaa-000000000002',
                  position: 0,
                  dauerSekunden: 20,
                  pauseSekunden: 90,
                },
              ],
            },
            {
              id: 'cccccccc-cccc-4aaa-8aaa-000000000003',
              position: 1,
              name: 'Klimmzüge',
              saetze: [
                {
                  id: 'dddddddd-dddd-4aaa-8aaa-000000000003',
                  position: 0,
                  wiederholungen: 10,
                },
              ],
            },
          ],
        },
      ],
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

    await page.goto('/workouts');
    await expect(page.getByText('Oberkörper Kraft')).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('workouts-uebersicht-desktop-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: workouts-uebersicht-mobil-dunkel', async ({ page }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialWorkouts: [
        {
          id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000002',
          typ: 'CALISTHENICS',
          titel: 'Front Lever & Pull',
          startZeit: '2026-11-18T16:30:00Z',
          dauerSekunden: 2700,
          sichtbarkeit: 'OEFFENTLICH',
          herkunft: 'MANUELL',
          erstelltAm: '2026-11-18T16:30:00Z',
          geaendertAm: '2026-11-18T17:15:00Z',
          version: 1,
          uebungen: [
            {
              id: 'cccccccc-cccc-4aaa-8aaa-000000000002',
              position: 0,
              name: 'Front Lever',
              variante: 'Tuck',
              saetze: [
                {
                  id: 'dddddddd-dddd-4aaa-8aaa-000000000002',
                  position: 0,
                  dauerSekunden: 20,
                  pauseSekunden: 90,
                },
              ],
            },
          ],
        },
      ],
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    await page.goto('/workouts');
    await expect(page.getByText('Front Lever & Pull')).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('workouts-uebersicht-mobil-dunkel.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: workouts-formular-desktop-hell', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: true });
    await page.clock.install({ time: new Date('2026-11-19T12:00:00Z').getTime() });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

    await page.goto('/workouts/neu');
    await expect(page.getByRole('heading', { level: 1, name: 'Neues Workout' })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('workouts-formular-desktop-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: workouts-formular-mobil-dunkel', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: true });
    await page.clock.install({ time: new Date('2026-11-19T12:00:00Z').getTime() });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    await page.goto('/workouts/neu');
    await expect(page.getByRole('heading', { level: 1, name: 'Neues Workout' })).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('workouts-formular-mobil-dunkel.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: entdecken-angemeldet-desktop-hell', async ({ page }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialGeteilteWorkouts: [
        {
          id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000201',
          ownerId: '44444444-4444-4444-8444-444444444441',
          ownerBenutzername: 'anna.fit',
          typ: 'CALISTHENICS',
          titel: 'Annas Ring-Training',
          startZeit: '2026-11-19T16:00:00Z',
          dauerSekunden: 2700,
          sichtbarkeit: 'PRIVAT',
          herkunft: 'MANUELL',
          erstelltAm: '2026-11-19T16:00:00Z',
          geaendertAm: '2026-11-19T16:45:00Z',
          version: 1,
          eingeladenAm: '2026-11-19T17:00:00Z',
          uebungen: [
            {
              id: 'cccccccc-cccc-4aaa-8aaa-000000000201',
              position: 0,
              name: 'Ring Dips',
              saetze: [
                {
                  id: 'dddddddd-dddd-4aaa-8aaa-000000000201',
                  position: 0,
                  wiederholungen: 10,
                },
              ],
            },
          ],
        },
      ],
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

    await page.goto('/entdecken');
    await expect(page.getByText('Annas Ring-Training')).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('entdecken-angemeldet-desktop-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: entdecken-angemeldet-mobil-dunkel', async ({ page }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialGeteilteWorkouts: [
        {
          id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000201',
          ownerId: '44444444-4444-4444-8444-444444444441',
          ownerBenutzername: 'anna.fit',
          typ: 'CALISTHENICS',
          titel: 'Annas Ring-Training',
          startZeit: '2026-11-19T16:00:00Z',
          dauerSekunden: 2700,
          sichtbarkeit: 'PRIVAT',
          herkunft: 'MANUELL',
          erstelltAm: '2026-11-19T16:00:00Z',
          geaendertAm: '2026-11-19T16:45:00Z',
          version: 1,
          eingeladenAm: '2026-11-19T17:00:00Z',
          uebungen: [],
        },
      ],
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    await page.goto('/entdecken');
    await expect(page.getByText('Annas Ring-Training')).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('entdecken-angemeldet-mobil-dunkel.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: datenschutz-desktop-hell', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: false });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });

    await page.goto('/datenschutz');
    await expect(
      page.getByRole('heading', { level: 1, name: /Datenschutz & PoC-Hinweis/i }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('datenschutz-desktop-hell.png', {
      animations: 'disabled',
    });
  });

  test('Snapshot: datenschutz-mobil-dunkel', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: false });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

    await page.goto('/datenschutz');
    await expect(
      page.getByRole('heading', { level: 1, name: /Datenschutz & PoC-Hinweis/i }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    await expect(page).toHaveScreenshot('datenschutz-mobil-dunkel.png', {
      animations: 'disabled',
    });
  });
});
