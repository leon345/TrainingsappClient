import createClient, { type ClientOptions } from 'openapi-fetch';
import type { components, paths } from './schema';

export type FehlerV1 = components['schemas']['FehlerV1'];
export type SystemInfoV1 = components['schemas']['SystemInfoV1'];

export function erzeugeApiClient(optionen?: ClientOptions) {
  return createClient<paths>({
    baseUrl: '',
    credentials: 'same-origin',
    ...optionen,
  });
}

export const apiClient = erzeugeApiClient();

export function istFehlerV1(wert: unknown): wert is FehlerV1 {
  if (typeof wert !== 'object' || wert === null) {
    return false;
  }

  const kandidat = wert as Record<string, unknown>;
  return typeof kandidat.code === 'string' && typeof kandidat.meldung === 'string';
}

export function extrahiereFehlermeldung(
  fehler: unknown,
  standardMeldung = 'Unbekannter Fehler bei der Serveranfrage.',
): string {
  if (istFehlerV1(fehler)) {
    return fehler.meldung;
  }
  if (fehler instanceof Error && fehler.message.trim().length > 0) {
    return fehler.message;
  }
  return standardMeldung;
}
