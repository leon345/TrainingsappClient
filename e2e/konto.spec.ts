import { expect, test, type Page } from '@playwright/test';
import { installiereV1Attrappe } from './support/v1Attrappe';

async function installiereWebAuthnStub(page: Page) {
  await page.addInitScript(() => {
    let zaehler = 0;

    class StubPublicKeyCredential {
      static parseCreationOptionsFromJSON(options: Record<string, unknown>) {
        return options;
      }

      static parseRequestOptionsFromJSON(options: Record<string, unknown>) {
        return options;
      }
    }

    Object.defineProperty(window, 'PublicKeyCredential', {
      configurable: true,
      writable: true,
      value: StubPublicKeyCredential,
    });

    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      writable: true,
      value: {
        async create() {
          zaehler += 1;
          const id = `stub-cred-${zaehler}`;
          return {
            id,
            type: 'public-key',
            toJSON: () => ({
              id,
              rawId: id,
              type: 'public-key',
              response: {
                clientDataJSON: 'Y2xpZW50RGF0YUpTT04',
                attestationObject: 'YXR0ZXN0YXRpb25PYmplY3Q',
              },
            }),
          };
        },
        async get() {
          const id = `stub-cred-${Math.max(1, zaehler)}`;
          return {
            id,
            type: 'public-key',
            toJSON: () => ({
              id,
              rawId: id,
              type: 'public-key',
              response: {
                clientDataJSON: 'Y2xpZW50RGF0YUpTT04',
                authenticatorData: 'YXV0aGVudGljYXRvckRhdGE',
                signature: 'c2lnbmF0dXJl',
                userHandle: 'dXNlckhhbmRsZQ',
              },
            }),
          };
        },
      },
    });
  });
}

test.use({ serviceWorkers: 'block' });

test.describe('Konto, Passkey-Verwaltung & Timer-Sync (E2E alle Browser)', () => {
  test('Registrierung, 2. Passkey, Umbenennen, Loeschen, Schutz letzter Passkey, Abmelden, Anmelden & Reload', async ({
    page,
  }) => {
    await installiereWebAuthnStub(page);
    await installiereV1Attrappe(page);

    await page.goto('/konto');
    await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();

    // Ohne Einwilligung wird Registrierung blockiert
    const nameFeld = page.locator('#registrieren-benutzername');
    await nameFeld.fill('Lina.Sport');
    await page.getByRole('button', { name: 'Mit Passkey registrieren' }).click();
    await expect(page.getByText(/ausdrückliche Einwilligung/i)).toBeVisible();

    // Einwilligung erteilen und registrieren
    await page.getByRole('checkbox', { name: /Ich willige ausdrücklich/i }).check();
    await page.getByRole('button', { name: 'Mit Passkey registrieren' }).click();

    // Nach Registrierung angemeldet (kleingeschrieben) + 2.-Passkey-Hinweis sichtbar
    await expect(page.getByRole('heading', { level: 2, name: 'lina.sport' })).toBeVisible();
    await expect(page.getByText(/Zweiten Passkey als Ersatz hinterlegen/i)).toBeVisible();
    await expect(page.getByText('Passkey 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passkey Passkey 1 löschen' })).toBeDisabled();

    // Zweiten Passkey hinzufügen
    await page.getByRole('button', { name: 'Zweiten Passkey hinzufügen' }).click();
    await expect(page.getByText('Passkey 2', { exact: true })).toBeVisible();
    await expect(page.getByText(/Zweiten Passkey als Ersatz hinterlegen/i)).toBeHidden();

    // Passkey 2 umbenennen
    await page.getByRole('button', { name: 'Passkey Passkey 2 umbenennen' }).click();
    const umbenennenDialog = page.getByRole('dialog', { name: 'Passkey umbenennen' });
    await umbenennenDialog.getByLabel('Bezeichnung').fill('Handy Privat');
    await umbenennenDialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(umbenennenDialog).toBeHidden();
    await expect(page.getByText('Handy Privat', { exact: true })).toBeVisible();

    // Passkey 2 löschen
    await page.getByRole('button', { name: 'Passkey Handy Privat löschen' }).click();
    const loeschDialog = page.getByRole('dialog', { name: 'Passkey löschen?' });
    await loeschDialog.getByRole('button', { name: 'Löschen' }).click();
    await expect(loeschDialog).toBeHidden();
    await expect(page.getByText('Handy Privat', { exact: true })).toBeHidden();

    // Letzter Passkey wieder geschützt
    await expect(page.getByRole('button', { name: 'Passkey Passkey 1 löschen' })).toBeDisabled();
    await expect(page.getByText(/Letzter Passkey kann nicht gelöscht werden/i)).toBeVisible();

    // Abmelden
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeVisible();

    // Anmelden ohne Benutzernamen (discoverable)
    await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'lina.sport' })).toBeVisible();

    // Reload behält Sitzung über GET /v1/ich bei
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'lina.sport' })).toBeVisible();
    await expect(page.getByText('Passkey 1', { exact: true })).toBeVisible();
  });

  test('synchronisiert Timer-Einstellung mit dem Server und laesst laufenden Timer beim Wechsel zu /konto weiterlaufen', async ({
    page,
  }) => {
    const startZeit = new Date('2026-11-19T12:00:00Z').getTime();
    const basisZeit = startZeit + 60_000;
    await installiereWebAuthnStub(page);
    const attrappe = await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialPasskeys: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
          credentialId: 'stub-cred-1',
          bezeichnung: 'Laptop',
          erstelltAm: '2026-11-19',
        },
      ],
      initialTimer: {
        trainingSekunden: 45,
        pauseSekunden: 15,
        gespeichert: true,
      },
    });

    await page.clock.install({ time: startZeit });
    await page.goto('/');
    await page.clock.pauseAt(basisZeit);

    // Server-Werte (45/15) wurden automatisch übernommen
    await expect(page.getByRole('timer')).toHaveText('00:45');
    await expect(page.getByLabel('Training (Sekunden)')).toHaveValue('45');
    await expect(page.getByLabel('Pause (Sekunden)')).toHaveValue('15');

    // Änderung wird per PUT /v1/timer/einstellung an den Server synchronisiert
    await page.getByLabel('Training (Sekunden)').fill('50');
    await page.getByLabel('Training (Sekunden)').press('Enter');
    await expect.poll(() => attrappe.timer.trainingSekunden).toBe(50);

    // Timer starten, zu /konto wechseln, Zeit weiterlaufen lassen -> Timer läuft im Hintergrund weiter
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('status')).toHaveText('Training – Runde 1');

    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await nav.getByRole('link', { name: 'Konto' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'max.muster' })).toBeVisible();

    await page.clock.runFor(6_000);

    await nav.getByRole('link', { name: 'Timer' }).click();
    await expect(page.getByRole('status')).toHaveText('Training – Runde 1');
    await expect(page.getByRole('timer')).toHaveText('00:44');
  });

  test('zeigt Fehler 409 und 429 sauber an', async ({ page }) => {
    await installiereWebAuthnStub(page);
    const attrappe = await installiereV1Attrappe(page);

    await page.goto('/konto');

    // 409 Benutzername vergeben
    attrappe.naechsterFehler = {
      pfad: '/v1/registrieren/optionen',
      methode: 'POST',
      status: 409,
      code: 'BENUTZERNAME_VERGEBEN',
      meldung: 'Dieser Benutzername ist bereits vergeben.',
    };

    await page.locator('#registrieren-benutzername').fill('max.muster');
    await page.getByRole('checkbox', { name: /Ich willige ausdrücklich/i }).check();
    await page.getByRole('button', { name: 'Mit Passkey registrieren' }).click();
    await expect(page.getByText('Dieser Benutzername ist bereits vergeben.')).toBeVisible();

    // 429 Rate-Limit mit Retry-After
    attrappe.naechsterFehler = {
      pfad: '/v1/anmelden/optionen',
      methode: 'POST',
      status: 429,
      code: 'ZU_VIELE_ANFRAGEN',
      meldung: 'Zu viele Anmeldeversuche.',
      retryAfter: '60',
    };

    await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
    await expect(
      page.getByText(/Zu viele Anmeldeversuche\. Bitte warte 60 Sekunden/i),
    ).toBeVisible();
  });

  test('sperrt Passkey-Buttons bei fehlender WebAuthn-JSON-API und haelt Timer voll nutzbar', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        writable: true,
        value: class {},
      });
    });
    await installiereV1Attrappe(page);

    await page.goto('/konto');
    await expect(
      page.getByText(/Passkeys werden in diesem Browser nicht unterstützt/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mit Passkey registrieren' })).toBeDisabled();

    // Timer bleibt ohne Anmeldung und ohne WebAuthn zu 100 % nutzbar
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await nav.getByRole('link', { name: 'Timer' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('status')).toHaveText('Training – Runde 1');
  });
});
