/*
 * Port für Phasensignale (C-17, E33).
 *
 * Die Timer-Ansicht meldet hier jeden erkannten Wechsel genau einmal
 * (Erkennung: `phasenwechsel.ts`). Was daraus wird (Ton, Vibration), entscheidet
 * die Umsetzung des Ports (`geraeteSignal.ts`); Tests setzen einen Fake ein
 * (`src/test/fakePhasenSignal.ts`). Das sichtbare Signal hängt NICHT an diesem
 * Port, es erscheint immer.
 */
import type { Phase } from './logik';

/**
 * Anlass eines Signals. Heute nur der Wechsel in eine Phase. Ein Signal für
 * "Ende" (E33) ist vorgesehen, aber der Timer kennt kein Ende (Runden laufen,
 * bis der Benutzer anhält); es würde hier als weiterer Fall ergänzt. Muster
 * für Ton und Vibration sind nach diesem Typ geschlüsselt, der Compiler
 * verlangt dann für jeden neuen Fall ein Muster.
 */
export type SignalAnlass = Phase;

export interface PhasenSignal {
  /** Wird pro Übergang genau einmal aufgerufen. Darf nicht werfen; tut es doch, läuft der Timer weiter. */
  phaseGewechselt(neuePhase: SignalAnlass): void;
}
