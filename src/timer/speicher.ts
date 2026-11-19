import {
  aktualisiereTimer,
  bereinigeEinstellung,
  STANDARD_TIMER_EINSTELLUNG,
  type AktivePhase,
  type TimerEinstellung,
  type TimerZustand,
} from './logik';

export const TIMER_EINSTELLUNG_SCHLUESSEL = 'trainingsapp.timer.einstellung.v1';
export const TIMER_SIGNALE_SCHLUESSEL = 'trainingsapp.timer.signale.v1';
export const TIMER_ZUSTAND_SCHLUESSEL = 'trainingsapp.timer.zustand.v1';

export interface SignalEinstellung {
  readonly tonAktiv: boolean;
  readonly vibrationAktiv: boolean;
}

export const STANDARD_SIGNAL_EINSTELLUNG: SignalEinstellung = {
  tonAktiv: true,
  vibrationAktiv: true,
};

/**
 * Schnittstelle fuer die Persistenz der Timer-Einstellungen.
 * Ermoeglicht spaeteres Andocken des Server-Abgleichs (GET/PUT /v1/timer/einstellung).
 */
export interface TimerEinstellungSpeicher {
  ladeEinstellung(): TimerEinstellung;
  speichereEinstellung(einstellung: TimerEinstellung): boolean;
}

export interface TimerSpeicher extends TimerEinstellungSpeicher {
  ladeSignale(): SignalEinstellung;
  speichereSignale(signale: SignalEinstellung): boolean;
  ladeLaufzustand(jetztMs: number): TimerZustand | null;
  speichereLaufzustand(zustand: TimerZustand): boolean;
  loescheLaufzustand(): void;
}

type StorageQuelle = () => Storage | null | undefined;

function holeBrowserLocalStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function leseJsonSicher(holeStorage: StorageQuelle, schluessel: string): unknown {
  try {
    const storage = holeStorage();
    if (!storage) {
      return null;
    }
    const roh = storage.getItem(schluessel);
    if (roh === null) {
      return null;
    }
    return JSON.parse(roh) as unknown;
  } catch {
    return null;
  }
}

function schreibeJsonSicher(
  holeStorage: StorageQuelle,
  schluessel: string,
  wert: unknown,
): boolean {
  try {
    const storage = holeStorage();
    if (!storage) {
      return false;
    }
    storage.setItem(schluessel, JSON.stringify(wert));
    return true;
  } catch {
    return false;
  }
}

function loescheSicher(holeStorage: StorageQuelle, schluessel: string): void {
  try {
    const storage = holeStorage();
    storage?.removeItem(schluessel);
  } catch {
    // Blockierter oder nicht verfuegbarer Speicher darf keinen Absturz ausloesen.
  }
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function istAktivePhase(wert: unknown): wert is AktivePhase {
  return wert === 'training' || wert === 'pause';
}

export function erstelleLokalenTimerSpeicher(
  holeStorage: StorageQuelle = holeBrowserLocalStorage,
): TimerSpeicher {
  return {
    ladeEinstellung(): TimerEinstellung {
      const daten = leseJsonSicher(holeStorage, TIMER_EINSTELLUNG_SCHLUESSEL);
      if (!istObjekt(daten)) {
        return STANDARD_TIMER_EINSTELLUNG;
      }
      const training =
        typeof daten.trainingSekunden === 'number' ? daten.trainingSekunden : undefined;
      const pause = typeof daten.pauseSekunden === 'number' ? daten.pauseSekunden : undefined;
      return bereinigeEinstellung({
        trainingSekunden: training,
        pauseSekunden: pause,
      });
    },

    speichereEinstellung(einstellung: TimerEinstellung): boolean {
      const bereinigt = bereinigeEinstellung(einstellung);
      return schreibeJsonSicher(holeStorage, TIMER_EINSTELLUNG_SCHLUESSEL, bereinigt);
    },

    ladeSignale(): SignalEinstellung {
      const daten = leseJsonSicher(holeStorage, TIMER_SIGNALE_SCHLUESSEL);
      if (!istObjekt(daten)) {
        return STANDARD_SIGNAL_EINSTELLUNG;
      }
      return {
        tonAktiv:
          typeof daten.tonAktiv === 'boolean'
            ? daten.tonAktiv
            : STANDARD_SIGNAL_EINSTELLUNG.tonAktiv,
        vibrationAktiv:
          typeof daten.vibrationAktiv === 'boolean'
            ? daten.vibrationAktiv
            : STANDARD_SIGNAL_EINSTELLUNG.vibrationAktiv,
      };
    },

    speichereSignale(signale: SignalEinstellung): boolean {
      return schreibeJsonSicher(holeStorage, TIMER_SIGNALE_SCHLUESSEL, {
        tonAktiv: Boolean(signale.tonAktiv),
        vibrationAktiv: Boolean(signale.vibrationAktiv),
      });
    },

    ladeLaufzustand(jetztMs: number): TimerZustand | null {
      const daten = leseJsonSicher(holeStorage, TIMER_ZUSTAND_SCHLUESSEL);
      if (!istObjekt(daten)) {
        return null;
      }

      const phase = daten.phase;
      const runde = daten.runde;
      const gesamtMs = daten.gesamtMs;
      const restMs = daten.restMs;

      if (
        typeof runde !== 'number' ||
        !Number.isInteger(runde) ||
        runde < 1 ||
        typeof gesamtMs !== 'number' ||
        !Number.isFinite(gesamtMs) ||
        gesamtMs <= 0 ||
        typeof restMs !== 'number' ||
        !Number.isFinite(restMs) ||
        restMs < 0
      ) {
        return null;
      }

      const einstellungDaten = istObjekt(daten.einstellung) ? daten.einstellung : null;
      const einstellung = bereinigeEinstellung(
        einstellungDaten
          ? {
              trainingSekunden:
                typeof einstellungDaten.trainingSekunden === 'number'
                  ? einstellungDaten.trainingSekunden
                  : undefined,
              pauseSekunden:
                typeof einstellungDaten.pauseSekunden === 'number'
                  ? einstellungDaten.pauseSekunden
                  : undefined,
            }
          : undefined,
      );

      if (istAktivePhase(phase)) {
        const phasenEndeMs = daten.phasenEndeMs;
        if (typeof phasenEndeMs !== 'number' || !Number.isFinite(phasenEndeMs)) {
          return null;
        }
        const roh: TimerZustand = {
          phase,
          einstellung,
          runde,
          gesamtMs,
          restMs,
          phasenEndeMs,
          pausiertePhase: null,
        };
        return aktualisiereTimer(roh, jetztMs).zustand;
      }

      if (phase === 'pausiert' && istAktivePhase(daten.pausiertePhase)) {
        return {
          phase: 'pausiert',
          einstellung,
          runde,
          gesamtMs,
          restMs: Math.min(gesamtMs, restMs),
          phasenEndeMs: null,
          pausiertePhase: daten.pausiertePhase,
        };
      }

      return null;
    },

    speichereLaufzustand(zustand: TimerZustand): boolean {
      if (zustand.phase === 'bereit') {
        loescheSicher(holeStorage, TIMER_ZUSTAND_SCHLUESSEL);
        return true;
      }
      return schreibeJsonSicher(holeStorage, TIMER_ZUSTAND_SCHLUESSEL, zustand);
    },

    loescheLaufzustand(): void {
      loescheSicher(holeStorage, TIMER_ZUSTAND_SCHLUESSEL);
    },
  };
}

export const lokalerTimerSpeicher: TimerSpeicher = erstelleLokalenTimerSpeicher();
