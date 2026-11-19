import createClient, { type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './schema';

export type FehlerV1 = components['schemas']['FehlerV1'];
export type SystemInfoV1 = components['schemas']['SystemInfoV1'];
export type BenutzerV1 = components['schemas']['BenutzerV1'];
export type PasskeyV1 = components['schemas']['PasskeyV1'];
export type WebAuthnOptionenV1 = components['schemas']['WebAuthnOptionenV1'];
export type PasskeyRegistrierungsCredentialV1 =
  components['schemas']['PasskeyRegistrierungsCredentialV1'];
export type PasskeyAnmeldeCredentialV1 = components['schemas']['PasskeyAnmeldeCredentialV1'];
export type TimerEinstellungV1 = components['schemas']['TimerEinstellungV1'];
export type TimerEinstellungAktualisierenV1 =
  components['schemas']['TimerEinstellungAktualisierenV1'];

export function erzeugeApiClient(optionen?: ClientOptions) {
  return createClient<paths>({
    baseUrl: '',
    credentials: 'same-origin',
    ...optionen,
  });
}

export type ApiClient = ReturnType<typeof erzeugeApiClient>;

export const apiClient = erzeugeApiClient();

export function istFehlerV1(wert: unknown): wert is FehlerV1 {
  if (typeof wert !== 'object' || wert === null) {
    return false;
  }

  const kandidat = wert as Record<string, unknown>;
  return typeof kandidat.code === 'string' && typeof kandidat.meldung === 'string';
}

export function istBenutzerV1(wert: unknown): wert is BenutzerV1 {
  if (typeof wert !== 'object' || wert === null) {
    return false;
  }

  const kandidat = wert as Record<string, unknown>;
  return (
    typeof kandidat.id === 'string' &&
    typeof kandidat.benutzername === 'string' &&
    typeof kandidat.rolle === 'string' &&
    typeof kandidat.erstelltAm === 'string'
  );
}

export function istTimerEinstellungV1(wert: unknown): wert is TimerEinstellungV1 {
  if (typeof wert !== 'object' || wert === null) {
    return false;
  }

  const kandidat = wert as Record<string, unknown>;
  return (
    typeof kandidat.trainingSekunden === 'number' &&
    typeof kandidat.pauseSekunden === 'number' &&
    typeof kandidat.gespeichert === 'boolean'
  );
}

function formatiereRetryAfterHinweis(response?: Response): string | null {
  const retryAfter = response?.headers.get('Retry-After')?.trim();
  if (!retryAfter) {
    return null;
  }
  const sekunden = Number(retryAfter);
  if (Number.isInteger(sekunden) && sekunden > 0) {
    return sekunden === 1
      ? 'Bitte warte 1 Sekunde und versuche es erneut.'
      : `Bitte warte ${sekunden} Sekunden und versuche es erneut.`;
  }
  return 'Bitte versuche es in Kürze erneut.';
}

export function extrahiereFehlermeldung(
  fehler: unknown,
  standardMeldung = 'Unbekannter Fehler bei der Serveranfrage.',
  response?: Response,
): string {
  const istRateLimit = response?.status === 429;
  const retryHinweis = istRateLimit ? formatiereRetryAfterHinweis(response) : null;

  if (istFehlerV1(fehler)) {
    const basis = fehler.meldung.trim();
    if (retryHinweis && !basis.toLowerCase().includes('warte')) {
      return `${basis} ${retryHinweis}`;
    }
    return basis;
  }

  if (istRateLimit) {
    return retryHinweis
      ? `Zu viele Anfragen. ${retryHinweis}`
      : 'Zu viele Anfragen. Bitte versuche es in Kürze erneut.';
  }

  if (fehler instanceof Error && fehler.message.trim().length > 0) {
    if (fehler.name === 'TypeError') {
      return 'Der Server ist derzeit nicht erreichbar. Bitte prüfe deine Verbindung.';
    }
    return fehler.message;
  }

  return standardMeldung;
}
