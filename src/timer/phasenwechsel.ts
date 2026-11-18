/*
 * Phasenwechsel erkennen (C-17, E33), rein und ohne Browser.
 *
 * Der Takt (250 ms) zeichnet nur neu; die Phase kommt aus der Uhr (E1). Ein
 * Wechsel ist deshalb kein Ereignis, sondern wird beim Neuzeichnen erkannt:
 * Jede Phase seit dem Start hat eine fortlaufende Nummer. Gemerkt wird die
 * höchste Nummer, die bisher im Lauf zu sehen war. Ist die aktuelle Nummer
 * höher, gab es (mindestens) einen Wechsel, und signalisiert wird genau einmal
 * die aktuelle Phase. Daraus folgt:
 *
 * - Mehrere Neuzeichnungen in derselben Phase: kein weiteres Signal.
 * - Rückkehr aus dem Hintergrund über mehrere Phasen hinweg: ein Signal für
 *   die Phase, in der der Timer jetzt steht; verpasste werden nicht nachgeholt.
 * - Pause 0: Es gibt nur Trainingsphasen; jeder Rundenwechsel ist ein Wechsel
 *   zu Training, nie zu Pause.
 * - Start aus "bereit": kein Signal (der Benutzer hat selbst gestartet).
 * - Angehalten: kein Signal und die gemerkte Nummer bleibt stehen. Hält der
 *   Benutzer genau an einer Grenze an, kommt das Signal beim Fortsetzen,
 *   nicht beim Anhalten, und nur einmal.
 * - Zurücksetzen: Die gemerkte Nummer wird verworfen; der nächste Start
 *   beginnt ohne Signal.
 * - Geht die Systemuhr zurück, sinkt die Nummer; ein späterer erneuter
 *   Anstieg auf dieselbe Nummer löst nicht noch einmal aus.
 */
import type { Phase, TimerStand, TimerZustand } from './logik';

/** Fortlaufende Nummer der Phase seit dem Start: Training Runde 1 = 0, Pause Runde 1 = 1, ... */
export function phasenNummer(stand: Pick<TimerStand, 'phase' | 'runde'>): number {
  return (stand.runde - 1) * 2 + (stand.phase === 'pause' ? 1 : 0);
}

export interface WechselPruefung {
  /** Höchste bisher im Lauf gesehene Phasennummer; `null` = kein Lauf. */
  gesehen: number | null;
  /** Neue Phase, wenn jetzt ein Signal fällig ist, sonst `null`. */
  wechsel: Phase | null;
}

/**
 * Prüft bei einer Neuzeichnung, ob ein Signal fällig ist. `gesehen` ist das
 * Ergebnis der vorigen Prüfung (anfangs `null`).
 */
export function pruefeWechsel(
  gesehen: number | null,
  status: TimerZustand['status'],
  stand: Pick<TimerStand, 'phase' | 'runde'>,
): WechselPruefung {
  switch (status) {
    case 'bereit':
      return { gesehen: null, wechsel: null };
    case 'pausiert':
      return { gesehen, wechsel: null };
    case 'laeuft': {
      const nummer = phasenNummer(stand);
      if (gesehen === null) return { gesehen: nummer, wechsel: null };
      if (nummer > gesehen) return { gesehen: nummer, wechsel: stand.phase };
      return { gesehen, wechsel: null };
    }
  }
}
