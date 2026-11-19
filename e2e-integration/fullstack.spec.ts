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
      await page.getByRole('link', { name: 'Neues Workout', exact: true }).click();
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

  test('2-Nutzer-Flow: Sichtbarkeit, Einladung, Entdecken/Profil, DSGVO-Export und Kontoloeschung', async ({
    browser,
  }) => {
    const suffix = Date.now().toString(36);
    const nutzerA = `e2e.a.${suffix}`;
    const nutzerB = `e2e.b.${suffix}`;

    const kontextA = await browser.newContext();
    const kontextB = await browser.newContext();
    const seiteA = await kontextA.newPage();
    const seiteB = await kontextB.newPage();

    const cdpA = await kontextA.newCDPSession(seiteA);
    const cdpB = await kontextB.newCDPSession(seiteB);
    await cdpA.send('WebAuthn.enable');
    await cdpB.send('WebAuthn.enable');

    const authA = await cdpA.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    const authB = await cdpB.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    try {
      // 1) Nutzer A und Nutzer B registrieren
      for (const [seite, name] of [
        [seiteA, nutzerA],
        [seiteB, nutzerB],
      ] as const) {
        await seite.goto('/konto');
        await seite.locator('#registrieren-benutzername').fill(name);
        await seite.getByRole('checkbox', { name: /Ich willige ausdrücklich/i }).check();
        await seite.getByRole('button', { name: 'Mit Passkey registrieren' }).click();
        await expect(seite.getByRole('heading', { level: 2, name })).toBeVisible({
          timeout: 15_000,
        });
      }

      // 2) Nutzer A legt privates Workout an und laedt Nutzer B ein
      const navA = seiteA.getByRole('navigation', { name: 'Hauptnavigation' });
      await navA.getByRole('link', { name: 'Workouts' }).click();
      await seiteA.getByRole('link', { name: 'Neues Workout', exact: true }).click();
      await seiteA.getByLabel(/^Titel/i).fill('Privates Einladungs-Workout');
      await seiteA.getByRole('button', { name: 'Workout speichern' }).click();
      await expect(
        seiteA.getByRole('heading', { level: 1, name: 'Privates Einladungs-Workout' }),
      ).toBeVisible({ timeout: 15_000 });

      await seiteA.getByRole('button', { name: 'Benutzer einladen' }).click();
      const einladenDialog = seiteA.getByRole('dialog', { name: 'Benutzer einladen' });
      await einladenDialog.getByLabel(/Benutzername \(exakt\)/i).fill(nutzerB);
      await einladenDialog.getByRole('button', { name: 'Suchen' }).click();
      await expect(einladenDialog.getByText(nutzerB, { exact: true })).toBeVisible();
      await einladenDialog.getByRole('button', { name: 'Einladen' }).click();
      await expect(einladenDialog).toBeHidden();
      await expect(seiteA.getByText(nutzerB, { exact: true })).toBeVisible();

      // 3) Nutzer A legt zweites Workout an und schaltet Sichtbarkeit auf OEFFENTLICH
      await navA.getByRole('link', { name: 'Workouts' }).click();
      await seiteA.getByRole('link', { name: 'Neues Workout', exact: true }).click();
      await seiteA.getByLabel(/^Titel/i).fill('Oeffentliches Profil-Workout');
      await seiteA.getByRole('button', { name: 'Workout speichern' }).click();
      await expect(
        seiteA.getByRole('heading', { level: 1, name: 'Oeffentliches Profil-Workout' }),
      ).toBeVisible({ timeout: 15_000 });

      await seiteA.getByRole('button', { name: 'Öffentlich' }).click();
      await expect(
        seiteA.getByText(/Sichtbarkeit wurde auf „Öffentlich“ geändert/i),
      ).toBeVisible();

      // 4) Nutzer B sieht geteiltes Workout unter /entdecken (schreibgeschuetzt) & oeffentliches Profil
      const navB = seiteB.getByRole('navigation', { name: 'Hauptnavigation' });
      await navB.getByRole('link', { name: 'Entdecken' }).click();
      await expect(seiteB.getByText('Privates Einladungs-Workout')).toBeVisible({
        timeout: 15_000,
      });
      await expect(seiteB.getByText(`Von ${nutzerA}`)).toBeVisible();

      await seiteB.getByRole('link', { name: /Privates Einladungs-Workout/i }).click();
      await expect(
        seiteB.getByRole('heading', { level: 1, name: 'Privates Einladungs-Workout' }),
      ).toBeVisible();
      await expect(seiteB.getByText('Schreibgeschützt')).toBeVisible();
      await expect(seiteB.getByRole('button', { name: 'Bearbeiten' })).toBeHidden();

      await seiteB.getByRole('link', { name: 'Zurück zu Entdecken' }).click();
      await seiteB.getByLabel(/Benutzername \(exakt\)/i).fill(nutzerA);
      await seiteB.getByRole('button', { name: 'Profil suchen' }).click();
      await seiteB.getByRole('link', { name: 'Öffentliches Profil ansehen' }).click();

      await expect(seiteB.getByRole('heading', { level: 1, name: `Profil: ${nutzerA}` })).toBeVisible();
      await expect(seiteB.getByText('Oeffentliches Profil-Workout')).toBeVisible();
      await expect(seiteB.getByText('Privates Einladungs-Workout')).toBeHidden();

      // 5) Nutzer A exportiert DSGVO-Daten als JSON und loescht das Konto zweistufig
      await navA.getByRole('link', { name: 'Konto' }).click();
      const downloadPromise = seiteA.waitForEvent('download');
      await seiteA.getByRole('button', { name: 'Meine Daten exportieren (JSON)' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(
        /^trainingsapp-datenexport-\d{4}-\d{2}-\d{2}\.json$/,
      );

      for (const [seite, name] of [
        [seiteA, nutzerA],
        [seiteB, nutzerB],
      ] as const) {
        const nav = seite.getByRole('navigation', { name: 'Hauptnavigation' });
        await nav.getByRole('link', { name: 'Konto' }).click();
        await seite.getByRole('button', { name: 'Konto dauerhaft löschen' }).click();
        const dialog = seite.getByRole('dialog', { name: 'Konto dauerhaft löschen?' });
        await dialog.getByRole('checkbox').check();
        await dialog.getByLabel(/Benutzernamen zur Bestätigung eingeben/i).fill(name);
        await dialog.getByRole('button', { name: 'Konto endgültig löschen' }).click();
        await expect(dialog).toBeHidden();
        await expect(
          seite.getByText(/Dein Konto und alle zugehörigen Daten wurden dauerhaft gelöscht/i),
        ).toBeVisible();
      }
    } finally {
      await cdpA.send('WebAuthn.removeVirtualAuthenticator', {
        authenticatorId: authA.authenticatorId,
      });
      await cdpB.send('WebAuthn.removeVirtualAuthenticator', {
        authenticatorId: authB.authenticatorId,
      });
      await kontextA.close();
      await kontextB.close();
    }
  });
});
