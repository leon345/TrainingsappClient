import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import { installiereServer, type ServerAttrappe } from './konto-server';

/*
 * Echte WebAuthn-Abfragen (C-03), nur Chromium: Der virtuelle Authenticator
 * kommt über das Chrome DevTools Protocol (Domain "WebAuthn"), wie im
 * Server-Test PasskeyBrowserE2ETest. /v1 beantwortet die Attrappe
 * (e2e/konto-server.ts); die Optionen haben das Format des Servers.
 *
 * Belegt wird: Die App ruft navigator.credentials.create() bzw. .get() mit
 * den Optionen des Servers auf und sendet credential.toJSON() im erwarteten
 * Format an /v1. Ob der echte Server die Antworten annimmt (Signatur,
 * Challenge, Origin), prüft erst der Durchlauf gegen den laufenden Server.
 */

test.use({ serviceWorkers: 'block' });
test.skip(({ browserName }) => browserName !== 'chromium', 'Virtueller Authenticator nur über CDP (Chromium)');

const knopf = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function klick(locator: Locator) {
  await locator.click();
}

async function authenticator(page: Page): Promise<{ cdp: CDPSession; id: string }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, id: authenticatorId };
}

async function oeffneKonto(page: Page): Promise<ServerAttrappe> {
  const server = await installiereServer(page);
  await page.goto('/');
  await klick(knopf(page, 'Konto'));
  await expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible();
  return server;
}

const b64url = /^[A-Za-z0-9_-]+$/;

function clientData(credential: { response: { clientDataJSON: string } }) {
  return JSON.parse(Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf8')) as {
    type: string;
    challenge: string;
    origin: string;
  };
}

function letzte(server: ServerAttrappe, endpunkt: string) {
  const a = server.anfragen.filter((x) => x.endpunkt === endpunkt).at(-1);
  expect(a, endpunkt).toBeDefined();
  return a!;
}

test('Registrieren, Anmelden und zweiter Passkey auf demselben Gerät mit virtuellem Authenticator', async ({
  page,
  baseURL,
}) => {
  const herkunft = new URL(baseURL!).origin;
  const { cdp, id } = await authenticator(page);
  const server = await oeffneKonto(page);

  // 1. Registrieren: create() mit den Optionen des Servers, Abschluss mit toJSON()
  await page.getByRole('textbox', { name: 'Benutzername' }).fill('Anna');
  await klick(knopf(page, 'Registrieren'));
  await expect(page.getByRole('heading', { level: 3, name: 'Deine Passkeys' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Lege einen zweiten Passkey an' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText([/Passkey 1.*Erstellt am 18\.11\.2026.*noch nie/]);

  const optionen = server.anfragen.find((a) => a.endpunkt === 'POST /v1/registrieren/optionen')!;
  expect(optionen.koerper).toEqual({ benutzername: 'anna' });
  const erzeugung = server.letzteOptionen as { challenge: string; user: { id: string } };
  const registrierung = letzte(server, 'POST /v1/registrieren');
  expect(registrierung.origin).toBe(herkunft);
  const { benutzername, credential } = registrierung.koerper as {
    benutzername: string;
    credential: {
      id: string;
      rawId: string;
      type: string;
      authenticatorAttachment: string;
      clientExtensionResults: object;
      response: {
        clientDataJSON: string;
        attestationObject: string;
        authenticatorData: string;
        publicKey: string;
        publicKeyAlgorithm: number;
        transports: string[];
      };
    };
  };
  expect(benutzername).toBe('anna');
  expect(credential.type).toBe('public-key');
  expect(credential.id).toMatch(b64url);
  expect(credential.rawId).toBe(credential.id);
  expect(credential.clientExtensionResults).toEqual(expect.any(Object));
  expect(credential.response.attestationObject).toMatch(b64url);
  expect(credential.response.authenticatorData).toMatch(b64url);
  expect([-8, -7, -257]).toContain(credential.response.publicKeyAlgorithm);
  expect(clientData(credential)).toMatchObject({
    type: 'webauthn.create',
    challenge: erzeugung.challenge,
    origin: herkunft,
  });

  // Der Authenticator hat einen auffindbaren Passkey mit dem User-Handle des Servers.
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId: id });
  expect(credentials).toHaveLength(1);
  expect(credentials[0]!.isResidentCredential).toBe(true);
  expect(credentials[0]!.rpId).toBe('localhost');
  expect(Buffer.from(credentials[0]!.userHandle!, 'base64').toString('base64url')).toBe(erzeugung.user.id);

  // 2. Weiterer Passkey auf demselben Gerät: excludeCredentials greift (InvalidStateError).
  await klick(knopf(page, 'Weiteren Passkey hinzufügen'));
  await expect(page.getByRole('alert')).toContainText('Auf diesem Gerät gibt es schon einen Passkey');
  expect((server.letzteOptionen as { excludeCredentials: { id: string }[] }).excludeCredentials).toEqual([
    { type: 'public-key', id: credential.id },
  ]);
  expect(server.anfragen.some((a) => a.endpunkt === 'POST /v1/passkeys')).toBe(false);

  // 3. Abmelden, dann Anmelden ohne Benutzernamen: get() und toJSON()
  await klick(knopf(page, 'Abmelden'));
  await expect(page.getByRole('heading', { level: 3, name: 'Anmelden' })).toBeVisible();
  await klick(knopf(page, 'Mit Passkey anmelden'));
  await expect(page.getByRole('heading', { level: 3, name: 'Deine Passkeys' })).toBeVisible();

  const anforderung = server.letzteOptionen as { challenge: string };
  const anmeldung = letzte(server, 'POST /v1/anmelden');
  expect(anmeldung.origin).toBe(herkunft);
  const angemeldet = anmeldung.koerper as {
    id: string;
    rawId: string;
    type: string;
    response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle: string };
  };
  expect(angemeldet.type).toBe('public-key');
  expect(angemeldet.id).toBe(credential.id);
  expect(angemeldet.rawId).toBe(credential.id);
  expect(angemeldet.response.authenticatorData).toMatch(b64url);
  expect(angemeldet.response.signature).toMatch(b64url);
  // discoverable credential: User-Handle kommt mit (der Server prüft ihn gegen den Besitzer)
  expect(angemeldet.response.userHandle).toBe(erzeugung.user.id);
  expect(clientData(angemeldet)).toMatchObject({ type: 'webauthn.get', challenge: anforderung.challenge, origin: herkunft });
});

test('vom Benutzer abgelehnte Abfrage (keine Bestätigung) wird verständlich gemeldet', async ({ page }) => {
  const { cdp, id } = await authenticator(page);
  // Der Authenticator verweigert die Benutzerprüfung; der Server verlangt sie ("required").
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId: id, isUserVerified: false });
  const server = await oeffneKonto(page);

  await page.getByRole('textbox', { name: 'Benutzername' }).fill('anna');
  await klick(knopf(page, 'Registrieren'));
  await expect(page.getByRole('alert')).toHaveText(
    'Die Passkey-Abfrage wurde abgebrochen. Du kannst es erneut versuchen.',
  );
  await klick(knopf(page, 'Mit Passkey anmelden'));
  await expect(page.getByRole('status')).toHaveText('');
  await expect(page.getByRole('alert')).toContainText('Die Passkey-Abfrage wurde abgebrochen.');

  expect(server.anfragen.map((a) => a.endpunkt)).toEqual([
    'GET /v1/passkeys',
    'POST /v1/registrieren/optionen',
    'POST /v1/anmelden/optionen',
  ]);
  await expect(page.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeVisible();
});
