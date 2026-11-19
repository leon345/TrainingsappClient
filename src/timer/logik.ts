import { MAX_DAUER_SEKUNDEN } from '../format/dauer';

export const MIN_TRAINING_SEKUNDEN = 1;
export const MAX_TRAINING_SEKUNDEN = MAX_DAUER_SEKUNDEN;
export const MIN_PAUSE_SEKUNDEN = 0;
export const MAX_PAUSE_SEKUNDEN = MAX_DAUER_SEKUNDEN;

export interface TimerEinstellung {
  readonly trainingSekunden: number;
  readonly pauseSekunden: number;
}

export const STANDARD_TIMER_EINSTELLUNG: TimerEinstellung = {
  trainingSekunden: 30,
  pauseSekunden: 10,
};

export type AktivePhase = 'training' | 'pause';
export type TimerPhase = 'bereit' | AktivePhase | 'pausiert';

export interface TimerZustand {
  readonly phase: TimerPhase;
  readonly einstellung: TimerEinstellung;
  readonly runde: number;
  readonly restMs: number;
  readonly gesamtMs: number;
  readonly phasenEndeMs: number | null;
  readonly pausiertePhase: AktivePhase | null;
}

export interface TimerTaktErgebnis {
  readonly zustand: TimerZustand;
  /** Letzte aktive Phase, in die seit dem vorigen Zustand gewechselt wurde (null ohne Wechsel). */
  readonly phasenWechsel: AktivePhase | null;
}

export function begrenzeSekunden(
  wert: number,
  min: number,
  max: number,
  standard: number,
): number {
  if (typeof wert !== 'number' || !Number.isFinite(wert)) {
    return standard;
  }
  const ganzzahl = Math.round(wert);
  if (ganzzahl < min) {
    return min;
  }
  if (ganzzahl > max) {
    return max;
  }
  return ganzzahl;
}

export function bereinigeEinstellung(
  eingabe: Partial<TimerEinstellung> | null | undefined,
): TimerEinstellung {
  return {
    trainingSekunden: begrenzeSekunden(
      eingabe?.trainingSekunden ?? STANDARD_TIMER_EINSTELLUNG.trainingSekunden,
      MIN_TRAINING_SEKUNDEN,
      MAX_TRAINING_SEKUNDEN,
      STANDARD_TIMER_EINSTELLUNG.trainingSekunden,
    ),
    pauseSekunden: begrenzeSekunden(
      eingabe?.pauseSekunden ?? STANDARD_TIMER_EINSTELLUNG.pauseSekunden,
      MIN_PAUSE_SEKUNDEN,
      MAX_PAUSE_SEKUNDEN,
      STANDARD_TIMER_EINSTELLUNG.pauseSekunden,
    ),
  };
}

export function erstelleBereitZustand(
  einstellung: TimerEinstellung = STANDARD_TIMER_EINSTELLUNG,
): TimerZustand {
  const bereinigt = bereinigeEinstellung(einstellung);
  const trainingMs = bereinigt.trainingSekunden * 1000;
  return {
    phase: 'bereit',
    einstellung: bereinigt,
    runde: 1,
    restMs: trainingMs,
    gesamtMs: trainingMs,
    phasenEndeMs: null,
    pausiertePhase: null,
  };
}

export function istTimerAktiv(zustand: TimerZustand): boolean {
  return zustand.phase === 'training' || zustand.phase === 'pause';
}

export function starteTimer(zustand: TimerZustand, jetztMs: number): TimerZustand {
  if (zustand.phase === 'pausiert') {
    return setzeTimerFort(zustand, jetztMs);
  }
  if (istTimerAktiv(zustand)) {
    return zustand;
  }
  const trainingMs = zustand.einstellung.trainingSekunden * 1000;
  return {
    phase: 'training',
    einstellung: zustand.einstellung,
    runde: 1,
    restMs: trainingMs,
    gesamtMs: trainingMs,
    phasenEndeMs: jetztMs + trainingMs,
    pausiertePhase: null,
  };
}

export function pausiereTimer(zustand: TimerZustand, jetztMs: number): TimerZustand {
  if (!istTimerAktiv(zustand)) {
    return zustand;
  }
  const { zustand: aktuell } = aktualisiereTimer(zustand, jetztMs);
  const aktivePhase: AktivePhase = aktuell.phase === 'pause' ? 'pause' : 'training';
  return {
    ...aktuell,
    phase: 'pausiert',
    pausiertePhase: aktivePhase,
    phasenEndeMs: null,
  };
}

export function setzeTimerFort(zustand: TimerZustand, jetztMs: number): TimerZustand {
  if (zustand.phase !== 'pausiert' || zustand.pausiertePhase === null) {
    return zustand;
  }
  const restMs = Math.max(0, zustand.restMs);
  return {
    ...zustand,
    phase: zustand.pausiertePhase,
    restMs,
    phasenEndeMs: jetztMs + restMs,
    pausiertePhase: null,
  };
}

export function setzeTimerZurueck(zustand: TimerZustand): TimerZustand {
  return erstelleBereitZustand(zustand.einstellung);
}

export function aendereTimerEinstellung(
  zustand: TimerZustand,
  eingabe: Partial<TimerEinstellung>,
): TimerZustand {
  const bereinigt = bereinigeEinstellung({
    trainingSekunden: eingabe.trainingSekunden ?? zustand.einstellung.trainingSekunden,
    pauseSekunden: eingabe.pauseSekunden ?? zustand.einstellung.pauseSekunden,
  });

  if (zustand.phase === 'bereit') {
    return erstelleBereitZustand(bereinigt);
  }

  return {
    ...zustand,
    einstellung: bereinigt,
  };
}

export function aktualisiereTimer(zustand: TimerZustand, jetztMs: number): TimerTaktErgebnis {
  if (!istTimerAktiv(zustand) || zustand.phasenEndeMs === null) {
    return { zustand, phasenWechsel: null };
  }

  if (jetztMs < zustand.phasenEndeMs) {
    const restMs = Math.min(zustand.gesamtMs, Math.max(0, zustand.phasenEndeMs - jetztMs));
    if (restMs === zustand.restMs) {
      return { zustand, phasenWechsel: null };
    }
    return {
      zustand: { ...zustand, restMs },
      phasenWechsel: null,
    };
  }

  const trainingMs = zustand.einstellung.trainingSekunden * 1000;
  const pauseMs = zustand.einstellung.pauseSekunden * 1000;
  const zyklusMs = trainingMs + pauseMs;

  let phase: AktivePhase = zustand.phase === 'pause' ? 'pause' : 'training';
  let runde = zustand.runde;
  let endeMs = zustand.phasenEndeMs;
  let letzterWechsel: AktivePhase;

  // Erster Phasenuebergang aus der abgelaufenen Phase
  if (phase === 'training' && pauseMs > 0) {
    phase = 'pause';
    endeMs += pauseMs;
    letzterWechsel = 'pause';
  } else {
    phase = 'training';
    runde += 1;
    endeMs += trainingMs;
    letzterWechsel = 'training';
  }

  // O(1)-Sprung ueber beliebig viele komplette Zyklen bei langem Hintergrund-Schlaf
  if (jetztMs >= endeMs) {
    const ueberhangMs = jetztMs - endeMs;
    const volleZyklen = Math.floor(ueberhangMs / zyklusMs);
    if (volleZyklen > 0) {
      runde += volleZyklen;
      endeMs += volleZyklen * zyklusMs;
    }

    while (jetztMs >= endeMs) {
      if (phase === 'training' && pauseMs > 0) {
        phase = 'pause';
        endeMs += pauseMs;
        letzterWechsel = 'pause';
      } else {
        phase = 'training';
        runde += 1;
        endeMs += trainingMs;
        letzterWechsel = 'training';
      }
    }
  }

  const gesamtMs = phase === 'training' ? trainingMs : pauseMs;
  const restMs = Math.min(gesamtMs, Math.max(0, endeMs - jetztMs));

  return {
    zustand: {
      ...zustand,
      phase,
      runde,
      gesamtMs,
      restMs,
      phasenEndeMs: endeMs,
    },
    phasenWechsel: letzterWechsel,
  };
}

export function restSekundenAnzeige(zustand: TimerZustand): number {
  return Math.min(MAX_DAUER_SEKUNDEN, Math.max(0, Math.ceil(zustand.restMs / 1000)));
}

export function berechneFortschrittProzent(zustand: TimerZustand): number {
  if (zustand.gesamtMs <= 0) {
    return 0;
  }
  const prozent = (zustand.restMs / zustand.gesamtMs) * 100;
  return Math.min(100, Math.max(0, Math.round(prozent * 10) / 10));
}
