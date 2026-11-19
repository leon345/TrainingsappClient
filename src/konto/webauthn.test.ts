import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bereinigeWebAuthnOptionen,
  erstellePasskeyCredential,
  istWebAuthnUnterstuetzt,
  pruefePasskeyCredential,
  WebAuthnFehler,
} from './webauthn';

describe('webauthn-Adapter', () => {
  const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials');
  const originalPublicKeyCredential = Object.getOwnPropertyDescriptor(
    globalThis,
    'PublicKeyCredential',
  );

  afterEach(() => {
    if (originalCredentials) {
      Object.defineProperty(navigator, 'credentials', originalCredentials);
    } else {
      Reflect.deleteProperty(navigator, 'credentials');
    }
    if (originalPublicKeyCredential) {
      Object.defineProperty(globalThis, 'PublicKeyCredential', originalPublicKeyCredential);
    } else {
      Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
    }
  });

  it('erkennt fehlende WebAuthn-JSON-Methoden sauber ueber Feature-Detection', () => {
    Reflect.deleteProperty(globalThis, 'PublicKeyCredential');
    expect(istWebAuthnUnterstuetzt()).toBe(false);

    // PublicKeyCredential vorhanden, aber ohne parseCreationOptionsFromJSON (z. B. aelteres WebKit)
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      writable: true,
      value: class {},
    });
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      writable: true,
      value: {
        create: vi.fn(),
        get: vi.fn(),
      },
    });
    expect(istWebAuthnUnterstuetzt()).toBe(false);
  });

  it('entfernt null- und undefined-Felder rekursiv aus Optionen vor dem Parsen', () => {
    const roh = {
      challenge: 'abc',
      extensions: null,
      excludeCredentials: [{ type: 'public-key', id: 'cred-1', transports: null }],
      authenticatorSelection: {
        authenticatorAttachment: null,
        residentKey: 'required',
        userVerification: undefined,
      },
    };

    expect(bereinigeWebAuthnOptionen(roh)).toEqual({
      challenge: 'abc',
      excludeCredentials: [{ type: 'public-key', id: 'cred-1' }],
      authenticatorSelection: {
        residentKey: 'required',
      },
    });
  });

  it('erstellt und serialisiert ein Registrierungs-Credential ueber Standard-JSON-APIs', async () => {
    const parseCreationOptionsFromJSON = vi.fn((opt) => opt);
    const parseRequestOptionsFromJSON = vi.fn((opt) => opt);
    const createMock = vi.fn(async () => ({
      id: 'cred-id',
      type: 'public-key',
      toJSON: () => ({
        id: 'cred-id',
        rawId: 'cred-id',
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: 'Y2xpZW50RGF0YQ',
          attestationObject: 'YXR0ZXN0YXRpb24',
          transports: ['internal'],
        },
      }),
    }));

    class MockPkc {
      static parseCreationOptionsFromJSON = parseCreationOptionsFromJSON;
      static parseRequestOptionsFromJSON = parseRequestOptionsFromJSON;
    }

    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      writable: true,
      value: MockPkc,
    });
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      writable: true,
      value: { create: createMock, get: vi.fn() },
    });

    expect(istWebAuthnUnterstuetzt()).toBe(true);

    const ergebnis = await erstellePasskeyCredential({
      challenge: 'test-challenge',
      extensions: null,
    });

    expect(parseCreationOptionsFromJSON).toHaveBeenCalledWith({ challenge: 'test-challenge' });
    expect(createMock).toHaveBeenCalledWith({ publicKey: { challenge: 'test-challenge' } });
    // Exakt die im OpenAPI-Vertrag definierten Felder ohne Zusatzballast
    expect(ergebnis).toEqual({
      id: 'cred-id',
      rawId: 'cred-id',
      type: 'public-key',
      response: {
        clientDataJSON: 'Y2xpZW50RGF0YQ',
        attestationObject: 'YXR0ZXN0YXRpb24',
      },
    });
  });

  it('prueft ein Anmelde-Credential und uebersetzt DOMExceptions verstaendlich', async () => {
    const parseCreationOptionsFromJSON = vi.fn((opt) => opt);
    const parseRequestOptionsFromJSON = vi.fn((opt) => opt);
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'cred-login',
        type: 'public-key',
        toJSON: () => ({
          id: 'cred-login',
          rawId: 'cred-login',
          type: 'public-key',
          response: {
            clientDataJSON: 'Y2xpZW50',
            authenticatorData: 'YXV0aA',
            signature: 'c2ln',
            userHandle: 'dXNlcg',
          },
        }),
      })
      .mockRejectedValueOnce(new DOMException('Abbruch', 'NotAllowedError'))
      .mockRejectedValueOnce(new DOMException('Bereits vorhanden', 'InvalidStateError'));

    class MockPkc {
      static parseCreationOptionsFromJSON = parseCreationOptionsFromJSON;
      static parseRequestOptionsFromJSON = parseRequestOptionsFromJSON;
    }

    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      writable: true,
      value: MockPkc,
    });
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      writable: true,
      value: { create: vi.fn(), get: getMock },
    });

    const ergebnis = await pruefePasskeyCredential({ challenge: 'login-challenge' });
    expect(ergebnis).toEqual({
      id: 'cred-login',
      rawId: 'cred-login',
      type: 'public-key',
      response: {
        clientDataJSON: 'Y2xpZW50',
        authenticatorData: 'YXV0aA',
        signature: 'c2ln',
        userHandle: 'dXNlcg',
      },
    });

    await expect(pruefePasskeyCredential({ challenge: 'c2' })).rejects.toMatchObject({
      name: 'WebAuthnFehler',
      code: 'ABGEBROCHEN',
    } satisfies Partial<WebAuthnFehler>);

    await expect(pruefePasskeyCredential({ challenge: 'c3' })).rejects.toMatchObject({
      name: 'WebAuthnFehler',
      code: 'BEREITS_REGISTRIERT',
    } satisfies Partial<WebAuthnFehler>);
  });
});
