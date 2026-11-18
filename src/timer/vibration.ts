/*
 * Vibration beim Phasenwechsel (C-17, E33) über `navigator.vibrate`.
 *
 * Feature-Detection: Nur wenn `navigator.vibrate` eine Funktion ist, gilt
 * Vibration als verfügbar; sonst ist der Schalter deaktiviert. Wirft der
 * Aufruf oder lehnt der Browser ab (Rückgabe `false`, z. B. ohne vorherige
 * Nutzeraktion), passiert nichts weiter. Ob das Gerät tatsächlich vibriert,
 * lässt sich im Browser nicht feststellen und ist nicht geprüft (C-01b).
 */
import type { SignalAnlass } from './phasenSignal';

/** Muster in ms (Vibration, Stille, Vibration, ...). */
export const VIBRATIONS_MUSTER: Readonly<Record<SignalAnlass, readonly number[]>> = Object.freeze({
  training: [200],
  pause: [100, 100, 100],
});

type MitVibration = { vibrate?: unknown };

function standardNavigator(): MitVibration | undefined {
  try {
    return globalThis.navigator;
  } catch {
    return undefined;
  }
}

export function vibrationVerfuegbar(nav: MitVibration | undefined = standardNavigator()): boolean {
  try {
    return typeof nav?.vibrate === 'function';
  } catch {
    return false;
  }
}

/** Löst das Muster aus. Gibt zurück, ob der Browser es angenommen hat. */
export function vibriere(anlass: SignalAnlass, nav: MitVibration | undefined = standardNavigator()): boolean {
  if (!nav || !vibrationVerfuegbar(nav)) return false;
  try {
    return (nav as Navigator).vibrate([...VIBRATIONS_MUSTER[anlass]]) === true;
  } catch {
    return false;
  }
}
