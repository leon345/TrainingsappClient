import { expect, test } from '@playwright/test';

test.describe('Fullstack-Integration gegen laufenden Quarkus-Server (Chromium CDP WebAuthn)', () => {
  test('Registrierung, 2. Passkey, Umbenennen, Timer-Sync + Reload, Abmelden, Discoverable Login & Loeschschutz', async ({
    page,
  }) => {
    const benutzername = `e2e.${Date.now().toString(36)}`;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');

    const ersterAuth = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    let zweiterAuthId: string | null = null;

    try {
      // 1) Registrieren
      await page.goto('/konto');
      await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();

      await page.locator('#registrieren-benutzername').fill(benutzername);
      await page.getByRole('checkbox', { name: /Ich willige ausdrücklich/i }).check();
      await page.getByRole('button', { name: 'Mit Passkey registrieren' }).click();

      await expect(page.getByRole('heading', { level: 2, name: benutzername })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(/Zweiten Passkey als Ersatz hinterlegen/i)).toBeVisible();
      await expect(page.getByText('Passkey 1', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Passkey Passkey 1 löschen' })).toBeDisabled();

      // 2) Zweiten Passkey auf zweitem virtuellen Authenticator hinzufügen
      const zweiterAuth = await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'usb',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      zweiterAuthId = zweiterAuth.authenticatorId;
      await cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
        authenticatorId: ersterAuth.authenticatorId,
        enabled: false,
      });

      await page.getByRole('button', { name: 'Zweiten Passkey hinzufügen' }).click();
      await expect(page.getByText('Passkey 2', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Zweiten Passkey als Ersatz hinterlegen/i)).toBeHidden();

      // 3) Passkey 2 umbenennen
      await page.getByRole('button', { name: 'Passkey Passkey 2 umbenennen' }).click();
      const umbenennenDialog = page.getByRole('dialog', { name: 'Passkey umbenennen' });
      await umbenennenDialog.getByLabel('Bezeichnung').fill('YubiKey Ersatz');
      await umbenennenDialog.getByRole('button', { name: 'Speichern' }).click();
      await expect(umbenennenDialog).toBeHidden();
      await expect(page.getByText('YubiKey Ersatz', { exact: true })).toBeVisible();

      // 4) Timer-Einstellung synchronisieren & über Reload ohne localStorage vom Server wiederherstellen
      const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
      await nav.getByRole('link', { name: 'Timer' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();

      const putTraining = page.waitForResponse(
        (res) => res.url().includes('/v1/timer/einstellung') && res.request().method() === 'PUT',
      );
      await page.getByLabel('Training (Sekunden)').fill('45');
      expect((await putTraining).status()).toBe(200);

      const putPause = page.waitForResponse(
        (res) => res.url().includes('/v1/timer/einstellung') && res.request().method() === 'PUT',
      );
      await page.getByLabel('Pause (Sekunden)').fill('15');
      expect((await putPause).status()).toBe(200);

      // Lokalen Speicher leeren und neu laden -> Server-Werte (45/15) müssen wiederkommen
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await expect(page.getByRole('timer')).toHaveText('00:45');
      await expect(page.getByLabel('Training (Sekunden)')).toHaveValue('45');
      await expect(page.getByLabel('Pause (Sekunden)')).toHaveValue('15');

      // 5) Abmelden
      await nav.getByRole('link', { name: 'Konto' }).click();
      await expect(page.getByRole('heading', { level: 2, name: benutzername })).toBeVisible();
      await page.getByRole('button', { name: 'Abmelden' }).click();
      await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeVisible();

      // 6) Anmeldung ohne Benutzernamen (discoverable Passkey)
      await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
      await expect(page.getByRole('heading', { level: 2, name: benutzername })).toBeVisible({
        timeout: 15_000,
      });

      // 7) Sitzung bleibt nach Reload erhalten
      await page.reload();
      await expect(page.getByRole('heading', { level: 2, name: benutzername })).toBeVisible();
      await expect(page.getByText('YubiKey Ersatz', { exact: true })).toBeVisible();

      // 8) Workout-Tracking-Flow (Calisthenics anlegen, Reload pruefen, bearbeiten, loeschen)
      await nav.getByRole('link', { name: 'Workouts' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();
      await page.getByRole('link', { name: 'Neues Workout' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Neues Workout' })).toBeVisible();

      await page.getByRole('button', { name: 'Calisthenics' }).click();
      await page.getByLabel(/^Titel/i).fill('Fullstack Calisthenics');
      await page.getByLabel(/Dauer \(Sekunden, optional\)/i).fill('2700');
      await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
      await page.getByLabel(/^Übungsname/i).fill('Front Lever');
      await page.getByLabel(/Variante/i).fill('Tuck');
      await page.getByLabel(/Dauer \(Sek\.\)/i).fill('20');
      await page.getByLabel(/Pause \(Sek\.\)/i).fill('90');
      await page.getByRole('button', { name: 'Workout speichern' }).click();

      await expect(
        page.getByRole('heading', { level: 1, name: 'Fullstack Calisthenics' }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Tuck', { exact: true })).toBeVisible();

      // Reload pruefen
      await page.reload();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Fullstack Calisthenics' }),
      ).toBeVisible();
      await expect(page.getByText('45:00')).toBeVisible();

      // Bearbeiten
      await page.getByRole('button', { name: 'Bearbeiten' }).click();
      await page.getByLabel(/^Titel/i).fill('Fullstack Calisthenics Bearbeitet');
      await page.getByRole('button', { name: 'Änderungen speichern' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: 'Fullstack Calisthenics Bearbeitet' }),
      ).toBeVisible();

      // Loeschen
      await page.getByRole('button', { name: 'Löschen' }).click();
      const workoutLoeschDialog = page.getByRole('dialog', { name: 'Workout löschen?' });
      await workoutLoeschDialog.getByRole('button', { name: 'Löschen' }).click();
      await expect(page).toHaveURL(/\/workouts$/);
      await expect(page.getByText('Fullstack Calisthenics Bearbeitet')).toBeHidden();

      // 9) Passkey 2 löschen -> letzter Passkey bleibt geschützt
      await nav.getByRole('link', { name: 'Konto' }).click();
      await expect(page.getByText('YubiKey Ersatz', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Passkey YubiKey Ersatz löschen' }).click();
      const loeschDialog = page.getByRole('dialog', { name: 'Passkey löschen?' });
      await loeschDialog.getByRole('button', { name: 'Löschen' }).click();
      await expect(loeschDialog).toBeHidden();
      await expect(page.getByText('YubiKey Ersatz', { exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Passkey Passkey 1 löschen' })).toBeDisabled();
      await expect(page.getByText(/Letzter Passkey kann nicht gelöscht werden/i)).toBeVisible();
    } finally {
      if (zweiterAuthId) {
        await cdp.send('WebAuthn.removeVirtualAuthenticator', {
          authenticatorId: zweiterAuthId,
        });
      }
      await cdp.send('WebAuthn.removeVirtualAuthenticator', {
        authenticatorId: ersterAuth.authenticatorId,
      });
    }
  });
});
