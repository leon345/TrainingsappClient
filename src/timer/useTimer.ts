import { useCallback, useEffect, useState } from 'react';
import type { TimerEinstellung } from './einstellung';
import { BEREIT, berechneStand, pausiere, setzeZurueck, starte, type TimerStand, type TimerZustand } from './logik';

/**
 * Abstand der Bildschirm-Aktualisierung in ms. Der Takt zählt NICHT die Zeit,
 * er löst nur ein neues Zeichnen aus; die Zeit kommt aus der Uhr (E1).
 * Gedrosselte oder ausgefallene Takte (Tab im Hintergrund, gesperrter
 * Bildschirm) verfälschen die Anzeige deshalb nicht.
 */
export const TAKT_MS = 250;

export interface TimerSteuerung {
  zustand: TimerZustand;
  stand: TimerStand;
  starte: () => void;
  pausiere: () => void;
  setzeZurueck: () => void;
}

/**
 * Verbindet die reine Timer-Logik mit React. `uhr` ist austauschbar, damit
 * Tests die Zeit steuern können. Standard ist `Date.now`: Die Wanduhr läuft
 * auch weiter, während das Gerät schläft.
 */
export function useTimer(einstellung: TimerEinstellung, uhr: () => number = Date.now): TimerSteuerung {
  const [zustand, setZustand] = useState<TimerZustand>(BEREIT);
  const [jetzt, setJetzt] = useState(uhr);
  const laeuft = zustand.status === 'laeuft';

  useEffect(() => {
    if (!laeuft) return;
    const aktualisiere = () => setJetzt(uhr());
    const takt = setInterval(aktualisiere, TAKT_MS);
    // Rückkehr in den Vordergrund oder aus dem Back-Forward-Cache: sofort neu
    // berechnen, nicht auf den nächsten Takt warten.
    document.addEventListener('visibilitychange', aktualisiere);
    window.addEventListener('pageshow', aktualisiere);
    window.addEventListener('focus', aktualisiere);
    return () => {
      clearInterval(takt);
      document.removeEventListener('visibilitychange', aktualisiere);
      window.removeEventListener('pageshow', aktualisiere);
      window.removeEventListener('focus', aktualisiere);
    };
  }, [laeuft, uhr]);

  const mitUhr = useCallback(
    (uebergang: (z: TimerZustand, t: number) => TimerZustand) => {
      const t = uhr();
      setJetzt(t);
      setZustand((z) => uebergang(z, t));
    },
    [uhr],
  );

  return {
    zustand,
    stand: berechneStand(zustand, einstellung, jetzt),
    starte: useCallback(() => mitUhr(starte), [mitUhr]),
    pausiere: useCallback(() => mitUhr(pausiere), [mitUhr]),
    setzeZurueck: useCallback(() => mitUhr(() => setzeZurueck()), [mitUhr]),
  };
}
