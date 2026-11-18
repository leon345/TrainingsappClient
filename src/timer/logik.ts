/*
 * Timer-Logik ohne Browser-Abhängigkeit (C-02).
 *
 * Grundsatz (E1): Die Zeit wird aus Zeitstempeln berechnet, nicht aus
 * setInterval-Zählern. Der Zustand speichert nur, wann der Timer zuletzt
 * gestartet wurde und wie viel Zeit davor schon vergangen war. Phase, Runde und
 * Restzeit leiten sich daraus und aus der Einstellung ab. Deshalb stimmt die
 * Anzeige auch dann, wenn der Tab im Hintergrund war und keine Ticks kamen.
 *
 * Alle Funktionen sind rein und bekommen die aktuelle Zeit (`jetzt`, in
 * Millisekunden) als Argument. Tests steuern die Uhr damit vollständig.
 */
import type { TimerEinstellung } from './einstellung';

export type TimerZustand =
  | { status: 'bereit' }
  | { status: 'laeuft'; vergangenMs: number; laeuftSeit: number }
  | { status: 'pausiert'; vergangenMs: number };

export type Phase = 'training' | 'pause';

export interface TimerStand {
  phase: Phase;
  /** Laufende Runde, beginnend bei 1. Eine Runde = Training plus Pause. */
  runde: number;
  /** Restzeit der Phase in ganzen Sekunden, aufgerundet (zeigt nie 0 während einer Phase). */
  restSekunden: number;
  /** Gesamtdauer der aktuellen Phase in Sekunden. */
  phasenDauerSekunden: number;
  /** Anteil der Phase, der vergangen ist, 0 bis unter 1. */
  fortschritt: number;
}

export const BEREIT: TimerZustand = { status: 'bereit' };

/** Vergangene Laufzeit in ms. Eine zurückgestellte Systemuhr ergibt nie negative Zeit. */
export function vergangeneMs(zustand: TimerZustand, jetzt: number): number {
  switch (zustand.status) {
    case 'bereit':
      return 0;
    case 'pausiert':
      return zustand.vergangenMs;
    case 'laeuft':
      return zustand.vergangenMs + Math.max(0, jetzt - zustand.laeuftSeit);
  }
}

/** Startet aus "bereit" oder setzt aus "pausiert" fort. Läuft er schon, bleibt alles gleich. */
export function starte(zustand: TimerZustand, jetzt: number): TimerZustand {
  switch (zustand.status) {
    case 'bereit':
      return { status: 'laeuft', vergangenMs: 0, laeuftSeit: jetzt };
    case 'pausiert':
      return { status: 'laeuft', vergangenMs: zustand.vergangenMs, laeuftSeit: jetzt };
    case 'laeuft':
      return zustand;
  }
}

/** Hält den Timer an und friert die vergangene Zeit ein. */
export function pausiere(zustand: TimerZustand, jetzt: number): TimerZustand {
  if (zustand.status !== 'laeuft') return zustand;
  return { status: 'pausiert', vergangenMs: vergangeneMs(zustand, jetzt) };
}

export function setzeZurueck(): TimerZustand {
  return BEREIT;
}

/**
 * Leitet Phase, Runde und Restzeit ab. Runden wiederholen sich, bis der
 * Benutzer anhält. Bei Pause 0 gibt es nur Trainingsphasen.
 *
 * An einer Phasengrenze gilt bereits die neue Phase: Nach genau
 * `trainingSekunden` beginnt die Pause mit voller Restzeit.
 */
export function berechneStand(
  zustand: TimerZustand,
  einstellung: TimerEinstellung,
  jetzt: number,
): TimerStand {
  const trainingMs = einstellung.trainingSekunden * 1000;
  const pauseMs = einstellung.pauseSekunden * 1000;
  const rundeMs = trainingMs + pauseMs;
  const vergangen = vergangeneMs(zustand, jetzt);

  const runde = Math.floor(vergangen / rundeMs) + 1;
  const inRunde = vergangen % rundeMs;
  const phase: Phase = inRunde < trainingMs ? 'training' : 'pause';
  const phasenDauerMs = phase === 'training' ? trainingMs : pauseMs;
  const restMs = phase === 'training' ? trainingMs - inRunde : rundeMs - inRunde;

  return {
    phase,
    runde,
    restSekunden: Math.ceil(restMs / 1000),
    phasenDauerSekunden: phasenDauerMs / 1000,
    fortschritt: 1 - restMs / phasenDauerMs,
  };
}
