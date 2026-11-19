import type {
  PasskeyAnmeldeCredentialV1,
  PasskeyRegistrierungsCredentialV1,
} from '../api/client';

export type WebAuthnFehlerCode =
  | 'NICHT_UNTERSTUETZT'
  | 'ABGEBROCHEN'
  | 'BEREITS_REGISTRIERT'
  | 'SICHERHEITSKONTEXT'
  | 'UNGUELTIGE_ANTWORT'
  | 'UNBEKANNT';

export class WebAuthnFehler extends Error {
  readonly code: WebAuthnFehlerCode;

  constructor(code: WebAuthnFehlerCode, meldung: string) {
    super(meldung);
    this.name = 'WebAuthnFehler';
    this.code = code;
  }
}

interface PublicKeyCredentialMitJsonApi {
  parseCreationOptionsFromJSON?: (
    options: PublicKeyCredentialCreationOptionsJSON,
  ) => PublicKeyCredentialCreationOptions;
  parseRequestOptionsFromJSON?: (
    options: PublicKeyCredentialRequestOptionsJSON,
  ) => PublicKeyCredentialRequestOptions;
}

interface PublicKeyCredentialMitToJson extends PublicKeyCredential {
  toJSON?: () => Record<string, unknown>;
}

function holePublicKeyCredentialApi(): PublicKeyCredentialMitJsonApi | null {
  if (typeof globalThis === 'undefined' || !('PublicKeyCredential' in globalThis)) {
    return null;
  }
  const kandidat = globalThis.PublicKeyCredential as unknown;
  if (typeof kandidat !== 'function') {
    return null;
  }
  return kandidat as PublicKeyCredentialMitJsonApi;
}

export function istWebAuthnUnterstuetzt(): boolean {
  if (typeof navigator === 'undefined' || !navigator.credentials) {
    return false;
  }
  if (
    typeof navigator.credentials.create !== 'function' ||
    typeof navigator.credentials.get !== 'function'
  ) {
    return false;
  }
  const pkc = holePublicKeyCredentialApi();
  return (
    pkc !== null &&
    typeof pkc.parseCreationOptionsFromJSON === 'function' &&
    typeof pkc.parseRequestOptionsFromJSON === 'function'
  );
}

/**
 * Entfernt null- und undefined-Felder rekursiv aus WebAuthn-JSON-Optionen,
 * da Java/Jackson optionale Felder als null serialisieren kann, WebIDL-Parser
 * aber fehlende (undefined) statt null-Werte erwarten.
 */
export function bereinigeWebAuthnOptionen(wert: unknown): unknown {
  if (Array.isArray(wert)) {
    return wert.map((eintrag) => bereinigeWebAuthnOptionen(eintrag));
  }
  if (wert !== null && typeof wert === 'object') {
    const ergebnis: Record<string, unknown> = {};
    for (const [schluessel, eintrag] of Object.entries(wert as Record<string, unknown>)) {
      if (eintrag !== null && eintrag !== undefined) {
        ergebnis[schluessel] = bereinigeWebAuthnOptionen(eintrag);
      }
    }
    return ergebnis;
  }
  return wert;
}

function istRecord(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function lesePflichtString(obj: Record<string, unknown>, feld: string): string {
  const wert = obj[feld];
  if (typeof wert !== 'string' || wert.trim().length === 0) {
    throw new WebAuthnFehler(
      'UNGUELTIGE_ANTWORT',
      'Die Passkey-Antwort des Browsers war unvollständig.',
    );
  }
  return wert;
}

function uebersetzeDomFehler(fehler: unknown): WebAuthnFehler {
  if (fehler instanceof WebAuthnFehler) {
    return fehler;
  }

  if (fehler instanceof DOMException || (fehler instanceof Error && 'name' in fehler)) {
    switch (fehler.name) {
      case 'NotAllowedError':
      case 'AbortError':
        return new WebAuthnFehler(
          'ABGEBROCHEN',
          'Der Passkey-Vorgang wurde abgebrochen oder ist abgelaufen.',
        );
      case 'InvalidStateError':
        return new WebAuthnFehler(
          'BEREITS_REGISTRIERT',
          'Dieser Passkey ist auf diesem Gerät bereits für dieses Konto registriert.',
        );
      case 'SecurityError':
        return new WebAuthnFehler(
          'SICHERHEITSKONTEXT',
          'Passkeys können in diesem Sicherheitskontext nicht verwendet werden (HTTPS oder localhost erforderlich).',
        );
      case 'NotSupportedError':
        return new WebAuthnFehler(
          'NICHT_UNTERSTUETZT',
          'Dieser Browser oder Authentifikator unterstützt das angeforderte Passkey-Verfahren nicht.',
        );
      default:
        break;
    }
  }

  return new WebAuthnFehler(
    'UNBEKANNT',
    'Der Passkey-Vorgang konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
  );
}

function holeCredentialJson(credential: Credential | null): Record<string, unknown> {
  if (!credential) {
    throw new WebAuthnFehler(
      'ABGEBROCHEN',
      'Der Passkey-Vorgang wurde abgebrochen oder lieferte kein Ergebnis.',
    );
  }
  const pkc = credential as PublicKeyCredentialMitToJson;
  if (typeof pkc.toJSON !== 'function') {
    throw new WebAuthnFehler(
      'NICHT_UNTERSTUETZT',
      'Dieser Browser unterstützt die moderne Passkey-JSON-API (toJSON) nicht.',
    );
  }
  const json = pkc.toJSON();
  if (!istRecord(json)) {
    throw new WebAuthnFehler(
      'UNGUELTIGE_ANTWORT',
      'Die Passkey-Antwort des Browsers konnte nicht verarbeitet werden.',
    );
  }
  return json;
}

export async function erstellePasskeyCredential(
  optionenJson: unknown,
): Promise<PasskeyRegistrierungsCredentialV1> {
  if (!istWebAuthnUnterstuetzt()) {
    throw new WebAuthnFehler(
      'NICHT_UNTERSTUETZT',
      'Passkeys werden von diesem Browser nicht unterstützt.',
    );
  }

  const pkc = holePublicKeyCredentialApi();
  if (!pkc?.parseCreationOptionsFromJSON) {
    throw new WebAuthnFehler(
      'NICHT_UNTERSTUETZT',
      'Passkeys werden von diesem Browser nicht unterstützt.',
    );
  }

  try {
    const bereinigt = bereinigeWebAuthnOptionen(optionenJson);
    const publicKey = pkc.parseCreationOptionsFromJSON(
      bereinigt as PublicKeyCredentialCreationOptionsJSON,
    );
    const credential = await navigator.credentials.create({ publicKey });
    const json = holeCredentialJson(credential);
    const response = json.response;
    if (!istRecord(response)) {
      throw new WebAuthnFehler(
        'UNGUELTIGE_ANTWORT',
        'Die Registrierungsantwort des Authentifikators fehlt.',
      );
    }

    return {
      id: lesePflichtString(json, 'id'),
      rawId: lesePflichtString(json, 'rawId'),
      type: lesePflichtString(json, 'type'),
      response: {
        clientDataJSON: lesePflichtString(response, 'clientDataJSON'),
        attestationObject: lesePflichtString(response, 'attestationObject'),
      },
    };
  } catch (fehler) {
    throw uebersetzeDomFehler(fehler);
  }
}

export async function pruefePasskeyCredential(
  optionenJson: unknown,
): Promise<PasskeyAnmeldeCredentialV1> {
  if (!istWebAuthnUnterstuetzt()) {
    throw new WebAuthnFehler(
      'NICHT_UNTERSTUETZT',
      'Passkeys werden von diesem Browser nicht unterstützt.',
    );
  }

  const pkc = holePublicKeyCredentialApi();
  if (!pkc?.parseRequestOptionsFromJSON) {
    throw new WebAuthnFehler(
      'NICHT_UNTERSTUETZT',
      'Passkeys werden von diesem Browser nicht unterstützt.',
    );
  }

  try {
    const bereinigt = bereinigeWebAuthnOptionen(optionenJson);
    const publicKey = pkc.parseRequestOptionsFromJSON(
      bereinigt as PublicKeyCredentialRequestOptionsJSON,
    );
    const credential = await navigator.credentials.get({ publicKey });
    const json = holeCredentialJson(credential);
    const response = json.response;
    if (!istRecord(response)) {
      throw new WebAuthnFehler(
        'UNGUELTIGE_ANTWORT',
        'Die Anmeldeantwort des Authentifikators fehlt.',
      );
    }

    const userHandleWert = response.userHandle;
    const userHandle =
      typeof userHandleWert === 'string' && userHandleWert.trim().length > 0
        ? userHandleWert
        : undefined;

    return {
      id: lesePflichtString(json, 'id'),
      rawId: lesePflichtString(json, 'rawId'),
      type: lesePflichtString(json, 'type'),
      response: {
        clientDataJSON: lesePflichtString(response, 'clientDataJSON'),
        authenticatorData: lesePflichtString(response, 'authenticatorData'),
        signature: lesePflichtString(response, 'signature'),
        ...(userHandle !== undefined ? { userHandle } : {}),
      },
    };
  } catch (fehler) {
    throw uebersetzeDomFehler(fehler);
  }
}
