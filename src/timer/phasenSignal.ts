import type { AktivePhase } from './logik';

export interface PhasenSignal {
  entsperren?(): void;
  ausloesen(phase: AktivePhase): void;
  freigeben?(): void;
}

export function kombinierePhasenSignale(signale: readonly PhasenSignal[]): PhasenSignal {
  return {
    entsperren() {
      for (const signal of signale) {
        try {
          signal.entsperren?.();
        } catch {
          // Ein einzelner fehlgeschlagener Signalweg darf andere nicht blockieren.
        }
      }
    },
    ausloesen(phase: AktivePhase) {
      for (const signal of signale) {
        try {
          signal.ausloesen(phase);
        } catch {
          // Fehler im Signalweg duerfen den Timer-Ablauf nicht unterbrechen.
        }
      }
    },
    freigeben() {
      for (const signal of signale) {
        try {
          signal.freigeben?.();
        } catch {
          // Fehler beim Freigeben still ignorieren.
        }
      }
    },
  };
}
