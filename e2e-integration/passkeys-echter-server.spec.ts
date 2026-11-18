import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/*
 * Durchgehender Test gegen den ECHTEN Server (C-03, Teil 4), keine
 * abgefangenen Antworten. Client im Vite-Dev-Server (http://localhost:5173,
 * Proxy /v1 -> http://localhost:8080), Server im Dev-Modus mit flüchtiger
 * Datenbank. Passkeys kommen von virtuellen Authenticatoren (CDP, Chromium).
 *
 * Start: `npm run test:e2e:integration` (Server muss laufen, siehe README).
 */

const knopf = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const ueberschrift = (page: Page, name: string) => page.getByRole('heading', { level: 3, name });

async function authenticator(kontext: BrowserContext, page: Page) {
  const cdp = await kontext.newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const neu = async () =>
    (
      await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      })
    ).authenticatorId;
  const entferne = (id: string) => cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: id });
  return { neu, entferne };
}

async function zuKonto(page: Page) {
  await knopf(page, 'Konto').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Konto' })).toBeFocused();
}

test('Registrieren, zweiter Passkey, Abmelden, Anmelden ohne Namen, Sitzung, Timer, Name vergeben', async ({
  browser,
}) => {
  // Eindeutig je Lauf, gültig nach E28 (klein, Ziffern, Bindestrich).
  const name = `it-${Date.now().toString(36)}`;
  const kontext = await browser.newContext();
  const page = await kontext.newPage();
  const geraete = await authenticator(kontext, page);
  const a = await geraete.neu();

  // 1. Konto öffnen: nicht angemeldet
  await page.goto('/');
  await zuKonto(page);
  await expect(ueberschrift(page, 'Registrieren')).toBeVisible();

  // 2. Registrieren: angemeldet, genau "Passkey 1", Hinweis auf zweiten Passkey
  await page.getByRole('textbox', { name: 'Benutzername' }).fill(name);
  await knopf(page, 'Registrieren').click();
  await expect(ueberschrift(page, 'Deine Passkeys')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem')).toContainText('Passkey 1');
  await expect(ueberschrift(page, 'Lege einen zweiten Passkey an')).toBeVisible();

  // 3. Zweiter Passkey auf einem zweiten Gerät (A nicht mehr verbunden, wie im Server-Test)
  await geraete.entferne(a);
  await geraete.neu();
  await knopf(page, 'Weiteren Passkey hinzufügen').click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('status')).toHaveText('Weiterer Passkey hinzugefügt.');

  // 4. Abmelden; nach Neuladen weiterhin nicht angemeldet
  await knopf(page, 'Abmelden').click();
  await expect(ueberschrift(page, 'Registrieren')).toBeVisible();
  await page.reload();
  await zuKonto(page);
  await expect(ueberschrift(page, 'Registrieren')).toBeVisible();

  // 5. Anmelden ohne Benutzernamen (discoverable Passkey auf Gerät B)
  await knopf(page, 'Mit Passkey anmelden').click();
  await expect(ueberschrift(page, 'Deine Passkeys')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(2);

  // 6. Neu laden: weiterhin angemeldet (Sitzungs-Cookie über den Proxy)
  await page.reload();
  await zuKonto(page);
  await expect(page.getByRole('listitem')).toHaveCount(2);

  // 7. Timer: starten, läuft
  await knopf(page, 'Timer').click();
  await knopf(page, 'Start').click();
  await expect(page.getByRole('status')).toHaveText('Training, Runde 1');
  await expect(page.getByRole('timer')).not.toHaveText('00:30', { timeout: 5_000 });
  await kontext.close();

  // 8. Frischer Browserzustand, derselbe Name: "vergeben"
  const frisch = await browser.newContext();
  const seite = await frisch.newPage();
  await (await authenticator(frisch, seite)).neu();
  await seite.goto('/');
  await zuKonto(seite);
  await expect(ueberschrift(seite, 'Registrieren')).toBeVisible();
  await seite.getByRole('textbox', { name: 'Benutzername' }).fill(name);
  await knopf(seite, 'Registrieren').click();
  await expect(seite.getByRole('textbox', { name: 'Benutzername' })).toHaveAccessibleDescription(
    /Dieser Benutzername ist schon vergeben/,
  );
  await frisch.close();
});
