import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  FEHLER,
  PASSKEY_HANDY,
  PASSKEY_LAPTOP,
  antwort429,
  installiereServer,
  type PasskeyV1,
  type ServerAttrappe,
} from './konto-server';
import { halteUhrAn } from './uhr';

/*
 * Konto (C-03) im Produktions-Build, alle vier Browser. /v1 beantwortet eine
 * Attrappe des Servers (e2e/konto-server.ts); es läuft kein echter Server.
 *
 * Keine echte WebAuthn-Abfrage: Die Browser-Funktionen werden per Init-Skript
 * ersetzt (Optionen werden durchgereicht, create/get lehnen ab wie ein
 * abgebrochener Dialog). Grund: Playwright-WebKit unter Linux hat weder
 * `parseCreationOptionsFromJSON` noch `navigator.credentials.create`; ohne
 * Attrappe zeigte die Ansicht dort nur "nicht unterstützt". Echte Abfragen
 * mit dem virtuellen Authenticator: e2e/konto-webauthn.spec.ts (Chromium).
 *
 * Der Service Worker wird blockiert, damit `page.route` jede Anfrage an /v1
 * sieht (Playwright fängt Anfragen eines Service Workers nicht ab). Dass der
 * Service Worker /v1 nicht anfasst, belegt e2e/service-worker-cache.spec.ts.
 */

test.use({ serviceWorkers: 'block' });

const START = new Date('2026-11-18T10:00:00Z');

/** Ersetzt WebAuthn: Optionen unverändert, create/get brechen ab (NotAllowedError). */
function webauthnAttrappe() {
  const abbruch = () => Promise.reject(new DOMException('Vom Benutzer abgebrochen', 'NotAllowedError'));
  const pkc = (window.PublicKeyCredential ?? function PublicKeyCredential() {}) as unknown as Record<string, unknown>;
  pkc.parseCreationOptionsFromJSON = (o: unknown) => o;
  pkc.parseRequestOptionsFromJSON = (o: unknown) => o;
  (window as unknown as Record<string, unknown>).PublicKeyCredential = pkc;
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create: abbruch, get: abbruch },
  });
}

/** Browser ohne WebAuthn. */
function ohneWebAuthn() {
  delete (window as unknown as Record<string, unknown>).PublicKeyCredential;
}

async function oeffneApp(
  page: Page,
  start: { angemeldet?: boolean; passkeys?: PasskeyV1[]; vergeben?: string[]; webauthn?: boolean } = {},
): Promise<ServerAttrappe> {
  const server = await installiereServer(page, start);
  await page.addInitScript(start.webauthn === false ? ohneWebAuthn : webauthnAttrappe);
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeVisible();
  await halteUhrAn(page, START);
  return server;
}

/** Antippen auf Touch-Geräten, sonst Klick. */
async function bediene(locator: Locator) {
  const touch = await locator.page().evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) await locator.tap();
  else await locator.click();
}

const knopf = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const namensFeld = (page: Page) => page.getByRole('textbox', { name: 'Benutzername' });
const meldung = (page: Page) => page.getByRole('alert');

async function zuKonto(page: Page) {
  await bediene(knopf(page, 'Konto'));
  await expect(page.getByRole('heading', { level: 2, name: 'Konto' })).toBeFocused();
}

async function zuTimer(page: Page) {
  await bediene(knopf(page, 'Timer'));
  await expect(page.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeFocused();
}

const endpunkte = (server: ServerAttrappe) => server.anfragen.map((a) => a.endpunkt);

test.describe('Konto', () => {
  test('ohne Anmeldung (401): Registrieren mit Namensregel und Anmelden; vorher keine Anfrage an /v1', async ({
    page,
  }) => {
    const server = await oeffneApp(page);
    expect(server.anfragen).toEqual([]);
    await zuKonto(page);
    await expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Anmelden' })).toBeVisible();
    await expect(namensFeld(page)).toHaveAccessibleDescription(/3 bis 32 Zeichen.*Keine E-Mail, kein Klarname/);
    await expect(knopf(page, 'Mit Passkey anmelden')).toBeEnabled();
    expect(endpunkte(server)).toEqual(['GET /v1/passkeys']);
  });

  test('angemeldet (200): Passkey-Liste mit Daten, "noch nie", Bezeichnung mit HTML-Zeichen als Text', async ({
    page,
  }) => {
    const html = '<img src=x onerror="window.__xss=1"><b>Laptop</b> & Co';
    await oeffneApp(page, { angemeldet: true, passkeys: [PASSKEY_HANDY, { ...PASSKEY_LAPTOP, bezeichnung: html }] });
    await zuKonto(page);
    const eintraege = page.getByRole('listitem');
    await expect(eintraege).toHaveCount(2);
    await expect(eintraege.nth(0)).toContainText('Passkey 1');
    await expect(eintraege.nth(0)).toContainText('Erstellt am 01.11.2026');
    await expect(eintraege.nth(0)).toContainText('Zuletzt verwendet am 18.11.2026');
    await expect(eintraege.nth(1)).toContainText(html);
    await expect(eintraege.nth(1)).toContainText('Erstellt am 10.11.2026');
    await expect(eintraege.nth(1)).toContainText('Zuletzt verwendet: noch nie');
    await expect(page.locator('main img, main b')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    // Zwei Passkeys: kein Hinweis auf einen zweiten
    await expect(page.getByRole('heading', { name: 'Lege einen zweiten Passkey an' })).toHaveCount(0);
  });

  test('angemeldet mit einem Passkey: Hinweis auf zweiten Passkey (E3)', async ({ page }) => {
    await oeffneApp(page, { angemeldet: true, passkeys: [PASSKEY_HANDY] });
    await zuKonto(page);
    await expect(page.getByRole('heading', { level: 3, name: 'Lege einen zweiten Passkey an' })).toBeVisible();
  });

  test('ungültiger Benutzername wird am Feld gemeldet, ohne Aufruf des Servers', async ({ page }) => {
    const server = await oeffneApp(page);
    await zuKonto(page);
    await namensFeld(page).fill('Anna Maria');
    await bediene(knopf(page, 'Registrieren'));
    await expect(namensFeld(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(namensFeld(page)).toHaveAccessibleDescription(/keine Umlaute, Leerzeichen oder @/);
    await expect(namensFeld(page)).toBeFocused();
    expect(endpunkte(server)).toEqual(['GET /v1/passkeys']);
  });

  test('Name vergeben (409) am Feld', async ({ page }) => {
    const server = await oeffneApp(page, { vergeben: ['anna'] });
    await zuKonto(page);
    await namensFeld(page).fill('Anna');
    await namensFeld(page).press('Enter');
    await expect(namensFeld(page)).toHaveAccessibleDescription(/schon vergeben/);
    expect(server.anfragen.at(-1)).toMatchObject({
      endpunkt: 'POST /v1/registrieren/optionen',
      koerper: { benutzername: 'anna' },
    });
  });

  test('429 mit Wartezeit', async ({ page }) => {
    const server = await oeffneApp(page);
    server.setze('POST /v1/anmelden/optionen', antwort429(120));
    await zuKonto(page);
    await bediene(knopf(page, 'Mit Passkey anmelden'));
    await expect(meldung(page)).toHaveText('Zu viele Versuche. Bitte in 2 Minuten erneut versuchen.');
    await expect(knopf(page, 'Mit Passkey anmelden')).toBeEnabled();
  });

  test('vom Benutzer abgebrochene Passkey-Abfrage', async ({ page }) => {
    const server = await oeffneApp(page);
    await zuKonto(page);
    await bediene(knopf(page, 'Mit Passkey anmelden'));
    await expect(meldung(page)).toContainText('Die Passkey-Abfrage wurde abgebrochen.');
    expect(endpunkte(server)).toEqual(['GET /v1/passkeys', 'POST /v1/anmelden/optionen']);
  });

  test('Server nicht erreichbar: verständliche Meldung, "Erneut versuchen" nach Rückkehr', async ({ page }) => {
    const server = await oeffneApp(page);
    server.nichtErreichbar = true;
    await zuKonto(page);
    await expect(meldung(page)).toContainText('Der Server ist gerade nicht erreichbar.');
    await expect(meldung(page)).toContainText('der Timer funktioniert auch ohne');
    server.nichtErreichbar = false;
    await bediene(knopf(page, 'Erneut versuchen'));
    await expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible();
    await expect(meldung(page)).toBeEmpty();
  });

  test('502 vom Proxy gilt ebenfalls als nicht erreichbar', async ({ page }) => {
    const server = await oeffneApp(page);
    server.setze('GET /v1/passkeys', { status: 502, json: undefined });
    await zuKonto(page);
    await expect(meldung(page)).toContainText('Der Server ist gerade nicht erreichbar.');
  });

  test('Abmelden', async ({ page }) => {
    const server = await oeffneApp(page, { angemeldet: true, passkeys: [PASSKEY_HANDY, PASSKEY_LAPTOP] });
    await zuKonto(page);
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await bediene(knopf(page, 'Abmelden'));
    await expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Abgemeldet.');
    await expect(page.getByRole('heading', { level: 2, name: 'Konto' })).toBeFocused();
    expect(server.angemeldet).toBe(false);
    expect(endpunkte(server)).toEqual(['GET /v1/passkeys', 'POST /v1/abmelden']);
  });

  test('Sitzung abgelaufen: 401 beim Hinzufügen führt zur Anmeldung zurück', async ({ page }) => {
    const server = await oeffneApp(page, { angemeldet: true, passkeys: [PASSKEY_HANDY] });
    await zuKonto(page);
    // Erst nach beantworteter Prüfung (Liste sichtbar) die Sitzung serverseitig beenden.
    await expect(page.getByRole('listitem')).toHaveCount(1);
    server.angemeldet = false;
    server.setze('POST /v1/passkeys/optionen', { status: 401, json: FEHLER.NICHT_ANGEMELDET });
    await bediene(knopf(page, 'Weiteren Passkey hinzufügen'));
    await expect(meldung(page)).toContainText('Du bist nicht mehr angemeldet.');
    await expect(page.getByRole('heading', { level: 3, name: 'Anmelden' })).toBeVisible();
  });

  test('Browser ohne WebAuthn: Hinweis, Registrieren und Anmelden gesperrt, keine Anfrage außer der Prüfung', async ({
    page,
  }) => {
    const server = await oeffneApp(page, { webauthn: false });
    await zuKonto(page);
    await expect(page.getByText(/Dieser Browser unterstützt keine Passkeys/)).toBeVisible();
    await expect(knopf(page, 'Registrieren')).toBeDisabled();
    await expect(knopf(page, 'Mit Passkey anmelden')).toBeDisabled();
    expect(endpunkte(server)).toEqual(['GET /v1/passkeys']);
  });
});

test.describe('Timer neben dem Konto', () => {
  test('läuft weiter, während im Konto Fehler und Abmelden passieren, und bleibt bedienbar', async ({ page }) => {
    const server = await oeffneApp(page, { angemeldet: true, passkeys: [PASSKEY_HANDY], vergeben: ['anna'] });
    await bediene(knopf(page, 'Start'));
    await expect(page.getByRole('status')).toHaveText('Training, Runde 1');
    await page.clock.runFor(10_000);
    await expect(page.getByRole('timer')).toHaveText('00:20');

    await zuKonto(page);
    await bediene(knopf(page, 'Abmelden'));
    await expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible();
    await namensFeld(page).fill('anna');
    await namensFeld(page).press('Enter');
    await expect(namensFeld(page)).toHaveAccessibleDescription(/schon vergeben/);
    server.setze('POST /v1/anmelden/optionen', antwort429(30));
    await bediene(knopf(page, 'Mit Passkey anmelden'));
    await expect(meldung(page)).toContainText('in 30 Sekunden');
    // 25 s in der Konto-Ansicht: Wechsel zu Pause nach 20 s
    await page.clock.runFor(25_000);

    await zuTimer(page);
    await expect(page.getByRole('timer')).toHaveText('00:05');
    await expect(page.getByRole('status')).toHaveText('Pause, Runde 1');
    await bediene(knopf(page, 'Anhalten'));
    await expect(knopf(page, 'Fortsetzen')).toBeVisible();
    await page.clock.runFor(3_000);
    await expect(page.getByRole('timer')).toHaveText('00:05');
  });

  test('ohne erreichbaren Server und offline bleibt der Timer nutzbar', async ({ page, context }) => {
    const server = await oeffneApp(page);
    server.nichtErreichbar = true;
    await context.setOffline(true);

    await zuKonto(page);
    await expect(meldung(page)).toContainText('Du bist offline.');
    await expect(meldung(page)).toContainText('der Timer funktioniert auch ohne');

    await zuTimer(page);
    await bediene(knopf(page, 'Start'));
    await page.clock.runFor(2_000);
    await expect(page.getByRole('timer')).toHaveText('00:28');
    await expect(page.getByRole('status')).toHaveText('Training, Runde 1');
    await bediene(knopf(page, 'Anhalten'));
    await expect(knopf(page, 'Fortsetzen')).toBeVisible();
    await context.setOffline(false);
  });
});
