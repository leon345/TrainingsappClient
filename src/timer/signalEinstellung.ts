/*
 * Schalter für die Phasensignale (C-17, E33): Ton und Vibration getrennt,
 * Standard beide an, nur lokal gespeichert.
 *
 * Eigener Schlüssel statt Erweiterung von `trainingsapp.timer.einstellung.v1`:
 * Das Format der Timer-Einstellung bleibt unverändert (Feldnamen wie im
 * Server-DTO, Abgleich mit S-02b), und die Schalter gehören zum Gerät, nicht
 * zum Training (Vibration gibt es nicht überall). Bereits gespeicherte
 * Timer-Einstellungen werden davon nicht berührt.
 *
 * Fehlt ein Feld oder ist es kein Wahrheitswert, gilt für dieses Feld der
 * Standard; ein gesperrter oder voller Speicher bricht nichts.
 */
import { standardSpeicher, type Speicher } from './einstellung';

export interface SignalEinstellung {
  ton: boolean;
  vibration: boolean;
}

export const STANDARD_SIGNAL_EINSTELLUNG: Readonly<SignalEinstellung> = Object.freeze({
  ton: true,
  vibration: true,
});

export const SIGNAL_SPEICHER_SCHLUESSEL = 'trainingsapp.timer.signale.v1';

export function ladeSignalEinstellung(speicher: Speicher | null = standardSpeicher()): SignalEinstellung {
  const ergebnis = { ...STANDARD_SIGNAL_EINSTELLUNG };
  try {
    const roh = speicher?.getItem(SIGNAL_SPEICHER_SCHLUESSEL);
    if (!roh) return ergebnis;
    const wert: unknown = JSON.parse(roh);
    if (typeof wert !== 'object' || wert === null || Array.isArray(wert)) return ergebnis;
    const kandidat = wert as Record<string, unknown>;
    if (typeof kandidat.ton === 'boolean') ergebnis.ton = kandidat.ton;
    if (typeof kandidat.vibration === 'boolean') ergebnis.vibration = kandidat.vibration;
  } catch {
    // Beschädigter Inhalt oder gesperrter Speicher: Standard verwenden.
  }
  return ergebnis;
}

/** Gibt `false` zurück, wenn der Speicher fehlt, gesperrt oder voll ist. */
export function speichereSignalEinstellung(
  einstellung: SignalEinstellung,
  speicher: Speicher | null = standardSpeicher(),
): boolean {
  if (!speicher) return false;
  try {
    speicher.setItem(
      SIGNAL_SPEICHER_SCHLUESSEL,
      JSON.stringify({ ton: einstellung.ton === true, vibration: einstellung.vibration === true }),
    );
    return true;
  } catch {
    return false;
  }
}
