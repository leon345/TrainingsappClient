import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aendereTimerEinstellung,
  aktualisiereTimer,
  erstelleBereitZustand,
  istTimerAktiv,
  pausiereTimer,
  setzeTimerFort,
  setzeTimerZurueck,
  starteTimer,
  type TimerEinstellung,
  type TimerZustand,
} from './logik';
import { kombinierePhasenSignale, type PhasenSignal } from './phasenSignal';
import { lokalerTimerSpeicher, type SignalEinstellung, type TimerSpeicher } from './speicher';
import { erstelleTonSignal } from './ton';
import { useWakeLock } from './useWakeLock';
import { erstelleVibrationsSignal, istVibrationUnterstuetzt } from './vibration';

export const STANDARD_TAKT_INTERVALL_MS = 250;

export interface IntervallTimerOptionen {
  readonly speicher?: TimerSpeicher;
  readonly uhr?: () => number;
  readonly phasenSignal?: PhasenSignal;
  readonly taktIntervallMs?: number;
}

export interface IntervallTimerSteuerung {
  readonly zustand: TimerZustand;
  readonly signale: SignalEinstellung;
  readonly vibrationUnterstuetzt: boolean;
  readonly starten: () => void;
  readonly pausieren: () => void;
  readonly fortsetzen: () => void;
  readonly zuruecksetzen: () => void;
  readonly einstellungAendern: (eingabe: Partial<TimerEinstellung>) => void;
  readonly setzeTonAktiv: (aktiv: boolean) => void;
  readonly setzeVibrationAktiv: (aktiv: boolean) => void;
}

const standardUhr = () => Date.now();

export function useIntervallTimer(
  optionen: IntervallTimerOptionen = {},
): IntervallTimerSteuerung {
  const speicher = optionen.speicher ?? lokalerTimerSpeicher;
  const uhr = optionen.uhr ?? standardUhr;
  const externesSignal = optionen.phasenSignal;
  const taktIntervallMs = optionen.taktIntervallMs ?? STANDARD_TAKT_INTERVALL_MS;

  const [vibrationUnterstuetzt] = useState<boolean>(() => istVibrationUnterstuetzt());

  const [zustand, setZustand] = useState<TimerZustand>(() => {
    const wiederhergestellt = speicher.ladeLaufzustand(uhr());
    if (wiederhergestellt) {
      return wiederhergestellt;
    }
    return erstelleBereitZustand(speicher.ladeEinstellung());
  });

  const [signale, setSignale] = useState<SignalEinstellung>(() => speicher.ladeSignale());

  const zustandRef = useRef<TimerZustand>(zustand);
  const signaleRef = useRef<SignalEinstellung>(signale);
  const standardSignalRef = useRef<PhasenSignal | null>(null);

  useEffect(() => {
    zustandRef.current = zustand;
  }, [zustand]);

  useEffect(() => {
    signaleRef.current = signale;
  }, [signale]);

  useEffect(() => {
    return () => {
      standardSignalRef.current?.freigeben?.();
      standardSignalRef.current = null;
    };
  }, []);

  const holeAktivesSignal = useCallback((): PhasenSignal => {
    if (externesSignal) {
      return externesSignal;
    }
    if (!standardSignalRef.current) {
      standardSignalRef.current = kombinierePhasenSignale([
        erstelleTonSignal(() => signaleRef.current.tonAktiv),
        erstelleVibrationsSignal(() => signaleRef.current.vibrationAktiv),
      ]);
    }
    return standardSignalRef.current;
  }, [externesSignal]);

  const aktiv = istTimerAktiv(zustand);
  useWakeLock(aktiv);

  const pruefeTakt = useCallback(() => {
    const aktuell = zustandRef.current;
    if (!istTimerAktiv(aktuell)) {
      return;
    }
    const { zustand: naechster, phasenWechsel } = aktualisiereTimer(aktuell, uhr());
    zustandRef.current = naechster;
    setZustand(naechster);

    if (phasenWechsel !== null) {
      speicher.speichereLaufzustand(naechster);
      holeAktivesSignal().ausloesen(phasenWechsel);
    }
  }, [uhr, speicher, holeAktivesSignal]);

  useEffect(() => {
    if (!aktiv) {
      return;
    }

    const intervallId = window.setInterval(pruefeTakt, taktIntervallMs);
    const beiSichtbarkeitsWechsel = () => {
      if (document.visibilityState === 'visible') {
        pruefeTakt();
      }
    };
    document.addEventListener('visibilitychange', beiSichtbarkeitsWechsel);

    return () => {
      window.clearInterval(intervallId);
      document.removeEventListener('visibilitychange', beiSichtbarkeitsWechsel);
    };
  }, [aktiv, pruefeTakt, taktIntervallMs]);

  const starten = useCallback(() => {
    holeAktivesSignal().entsperren?.();
    const naechster = starteTimer(zustandRef.current, uhr());
    zustandRef.current = naechster;
    setZustand(naechster);
    speicher.speichereLaufzustand(naechster);
  }, [holeAktivesSignal, uhr, speicher]);

  const pausieren = useCallback(() => {
    const naechster = pausiereTimer(zustandRef.current, uhr());
    zustandRef.current = naechster;
    setZustand(naechster);
    speicher.speichereLaufzustand(naechster);
  }, [uhr, speicher]);

  const fortsetzen = useCallback(() => {
    holeAktivesSignal().entsperren?.();
    const naechster = setzeTimerFort(zustandRef.current, uhr());
    zustandRef.current = naechster;
    setZustand(naechster);
    speicher.speichereLaufzustand(naechster);
  }, [holeAktivesSignal, uhr, speicher]);

  const zuruecksetzen = useCallback(() => {
    const naechster = setzeTimerZurueck(zustandRef.current);
    zustandRef.current = naechster;
    setZustand(naechster);
    speicher.loescheLaufzustand();
  }, [speicher]);

  const einstellungAendern = useCallback(
    (eingabe: Partial<TimerEinstellung>) => {
      const naechster = aendereTimerEinstellung(zustandRef.current, eingabe);
      zustandRef.current = naechster;
      setZustand(naechster);
      speicher.speichereEinstellung(naechster.einstellung);
      if (naechster.phase !== 'bereit') {
        speicher.speichereLaufzustand(naechster);
      }
    },
    [speicher],
  );

  const setzeTonAktiv = useCallback(
    (tonAktiv: boolean) => {
      if (tonAktiv) {
        holeAktivesSignal().entsperren?.();
      }
      const neu: SignalEinstellung = { ...signaleRef.current, tonAktiv };
      signaleRef.current = neu;
      setSignale(neu);
      speicher.speichereSignale(neu);
    },
    [holeAktivesSignal, speicher],
  );

  const setzeVibrationAktiv = useCallback(
    (vibrationAktiv: boolean) => {
      const neu: SignalEinstellung = { ...signaleRef.current, vibrationAktiv };
      signaleRef.current = neu;
      setSignale(neu);
      speicher.speichereSignale(neu);
    },
    [speicher],
  );

  return {
    zustand,
    signale,
    vibrationUnterstuetzt,
    starten,
    pausieren,
    fortsetzen,
    zuruecksetzen,
    einstellungAendern,
    setzeTonAktiv,
    setzeVibrationAktiv,
  };
}
