import { useEffect, useRef, useState } from 'react';
import type { Phase, TimerStand, TimerZustand } from './logik';
import type { PhasenSignal } from './phasenSignal';
import { pruefeWechsel } from './phasenwechsel';

/** Der zuletzt signalisierte Wechsel, Grundlage des sichtbaren Signals. */
export interface LetzterWechsel {
  phase: Phase;
  runde: number;
}

/**
 * Prüft nach jeder Neuzeichnung, ob ein Phasenwechsel fällig ist (Regeln in
 * `phasenwechsel.ts`), meldet ihn genau einmal an den Port und liefert ihn für
 * das sichtbare Signal zurück. Ein Fehler im Port hält den Timer nicht an.
 */
export function usePhasenwechsel(
  zustand: TimerZustand,
  stand: Pick<TimerStand, 'phase' | 'runde'>,
  signal: PhasenSignal | undefined,
): LetzterWechsel | null {
  const gesehen = useRef<number | null>(null);
  const [letzter, setLetzter] = useState<LetzterWechsel | null>(null);
  const { status } = zustand;
  const { phase, runde } = stand;

  useEffect(() => {
    const ergebnis = pruefeWechsel(gesehen.current, status, { phase, runde });
    gesehen.current = ergebnis.gesehen;
    if (status === 'bereit') {
      setLetzter(null);
      return;
    }
    if (ergebnis.wechsel === null) return;
    setLetzter({ phase: ergebnis.wechsel, runde });
    try {
      signal?.phaseGewechselt(ergebnis.wechsel);
    } catch {
      // Ton oder Vibration gescheitert: Das sichtbare Signal erscheint trotzdem.
    }
  }, [status, phase, runde, signal]);

  return letzter;
}
