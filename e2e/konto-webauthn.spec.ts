import { expect, test } from '@playwright/test';
import { installiereV1Attrappe } from './support/v1Attrappe';

test.describe('Echte WebAuthn-JSON-APIs mit Chromium CDP Virtual Authenticator', () => {
  test('fuehrt Registrierung, 2. Passkey und Discoverable Login ueber echte Browser-WebAuthn-APIs aus', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CDP Virtual Authenticator wird nur in Chromium unterstützt.');

    const attrappe = await installiereV1Attrappe(page);
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

    await page.goto('/konto');
    await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();

    // 1) Echte WebAuthn-Registrierung über PublicKeyCredential.parseCreationOptionsFromJSON + create + toJSON
    await page.locator('#registrieren-benutzername').fill('cdp.nutzer');
    await page.getByRole('checkbox', { name: /Ich willige ausdrücklich/i }).check();
    await page.getByRole('button', { name: 'Mit Passkey registrieren' }).click();

    await expect(page.getByRole('heading', { level: 2, name: 'cdp.nutzer' })).toBeVisible();
    await expect(page.getByText('Passkey 1', { exact: true })).toBeVisible();

    const regCred = attrappe.letztesRegistrierenCredential as {
      id: string;
      rawId: string;
      type: string;
      response: { clientDataJSON: string; attestationObject: string };
    };
    expect(regCred.type).toBe('public-key');
    expect(regCred.id.length).toBeGreaterThan(10);
    expect(regCred.rawId).toBe(regCred.id);
    expect(regCred.response.clientDataJSON.length).toBeGreaterThan(20);
    expect(regCred.response.attestationObject.length).toBeGreaterThan(20);

    // 2) Zweiten Passkey auf einem zweiten virtuellen Authenticator hinzufügen
    // (Authenticator 1 wird kurz deaktiviert/ersetzt, da excludeCredentials ihn korrekt ausschließt)
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
    await cdp.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId: ersterAuth.authenticatorId,
      enabled: false,
    });

    await page.getByRole('button', { name: 'Zweiten Passkey hinzufügen' }).click();
    await expect(page.getByText('Passkey 2', { exact: true })).toBeVisible();

    // 3) Abmelden und per Discoverable Passkey (ohne Benutzernamen) wieder anmelden
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeVisible();

    await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'cdp.nutzer' })).toBeVisible();

    const loginCred = attrappe.letztesAnmeldenCredential as {
      id: string;
      rawId: string;
      type: string;
      response: {
        clientDataJSON: string;
        authenticatorData: string;
        signature: string;
        userHandle?: string;
      };
    };
    expect(loginCred.type).toBe('public-key');
    expect(loginCred.id.length).toBeGreaterThan(10);
    expect(loginCred.response.clientDataJSON.length).toBeGreaterThan(20);
    expect(loginCred.response.authenticatorData.length).toBeGreaterThan(20);
    expect(loginCred.response.signature.length).toBeGreaterThan(20);
    expect(loginCred.response.userHandle).toBeTruthy();

    await cdp.send('WebAuthn.removeVirtualAuthenticator', {
      authenticatorId: zweiterAuth.authenticatorId,
    });
    await cdp.send('WebAuthn.removeVirtualAuthenticator', {
      authenticatorId: ersterAuth.authenticatorId,
    });
  });
});
