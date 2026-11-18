/*
 * Timer-Einstellung: Standardwerte, Grenzen und lokale Speicherung (C-02).
 *
 * - Standard ohne gespeicherte Einstellung: 30 s Training, 10 s Pause (E20).
 * - Grenzen wie im Server: Training 1 bis 86400 s, Pause 0 bis 86400 s;
 *   Pause 0 heißt keine Pause (E20).
 * - Feldnamen wie im Server-DTO (`trainingSekunden`, `pauseSekunden`, E11).
 * - Gespeichert wird zunächst nur lokal im Browser (localStorage). Der Abgleich
 *   mit dem Server folgt mit S-02b (E10).
 */

export interface TimerEinstellung {
  trainingSekunden: number;
  pauseSekunden: number;
}

export const STANDARD_EINSTELLUNG: Readonly<TimerEinstellung> = Object.freeze({
  trainingSekunden: 30,
  pauseSekunden: 10,
});

export const GRENZEN = {
  trainingSekunden: { min: 1, max: 86_400 },
  pauseSekunden: { min: 0, max: 86_400 },
} as const;

/** Schlüssel im localStorage. Versionsnummer für spätere Formatänderungen. */
export const SPEICHER_SCHLUESSEL = 'trainingsapp.timer.einstellung.v1';

function imBereich(wert: unknown, grenze: { min: number; max: number }): wert is number {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= grenze.min && wert <= grenze.max;
}

export function istGueltigeEinstellung(wert: unknown): wert is TimerEinstellung {
  if (typeof wert !== 'object' || wert === null) return false;
  const kandidat = wert as Record<string, unknown>;
  return (
    imBereich(kandidat.trainingSekunden, GRENZEN.trainingSekunden) &&
    imBereich(kandidat.pauseSekunden, GRENZEN.pauseSekunden)
  );
}

export type Speicher = Pick<Storage, 'getItem' | 'setItem'>;

/** Liest den Speicher; im privaten Modus mancher Browser wirft schon der Zugriff. */
export function standardSpeicher(): Speicher | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Lädt die gespeicherte Einstellung. Fehlt sie, ist sie beschädigt oder ist
 * der Speicher nicht verfügbar, gilt der Standard.
 */
export function ladeEinstellung(speicher: Speicher | null = standardSpeicher()): TimerEinstellung {
  try {
    const roh = speicher?.getItem(SPEICHER_SCHLUESSEL);
    if (roh) {
      const wert: unknown = JSON.parse(roh);
      if (istGueltigeEinstellung(wert)) {
        return { trainingSekunden: wert.trainingSekunden, pauseSekunden: wert.pauseSekunden };
      }
    }
  } catch {
    // Beschädigter Inhalt oder gesperrter Speicher: Standard verwenden.
  }
  return { ...STANDARD_EINSTELLUNG };
}

/**
 * Speichert eine gültige Einstellung. Gibt `false` zurück, wenn sie ungültig
 * ist oder der Speicher nicht schreibbar ist (z. B. voll oder gesperrt); der
 * Timer funktioniert dann trotzdem, nur ohne Speicherung.
 */
export function speichereEinstellung(
  einstellung: TimerEinstellung,
  speicher: Speicher | null = standardSpeicher(),
): boolean {
  if (!speicher || !istGueltigeEinstellung(einstellung)) return false;
  try {
    speicher.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({
        trainingSekunden: einstellung.trainingSekunden,
        pauseSekunden: einstellung.pauseSekunden,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
