import type { AktivePhase } from './logik';
import type { PhasenSignal } from './phasenSignal';

export const TRAINING_FREQUENZ_HZ = 880;
export const TRAINING_TON_DAUER_SEKUNDEN = 0.12;
export const TRAINING_TON_ABSTAND_SEKUNDEN = 0.08;

export const PAUSE_FREQUENZ_HZ = 440;
export const PAUSE_TON_DAUER_SEKUNDEN = 0.2;

const MAX_LAUTSTAERKE = 0.25;
const RAMPE_EIN_SEKUNDEN = 0.01;
const RAMPE_AUS_SEKUNDEN = 0.015;
const STILL_PEGEL = 0.0001;

type AudioContextKonstruktor = new () => AudioContext;

function holeAudioContextKonstruktor(): AudioContextKonstruktor | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const kandidat =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: AudioContextKonstruktor }).webkitAudioContext;
  return typeof kandidat === 'function' ? kandidat : null;
}

function spieleSinusTon(
  ctx: AudioContext,
  frequenzHz: number,
  startZeit: number,
  dauerSekunden: number,
): void {
  const endeZeit = startZeit + dauerSekunden;
  const oszillator = ctx.createOscillator();
  const verstaerker = ctx.createGain();

  oszillator.type = 'sine';
  oszillator.frequency.setValueAtTime(frequenzHz, startZeit);

  // Sanfte Huellkurve verhindert Knacken am Tonanfang und Tonende.
  verstaerker.gain.setValueAtTime(STILL_PEGEL, startZeit);
  verstaerker.gain.linearRampToValueAtTime(MAX_LAUTSTAERKE, startZeit + RAMPE_EIN_SEKUNDEN);
  verstaerker.gain.setValueAtTime(
    MAX_LAUTSTAERKE,
    Math.max(startZeit + RAMPE_EIN_SEKUNDEN, endeZeit - RAMPE_AUS_SEKUNDEN),
  );
  verstaerker.gain.linearRampToValueAtTime(STILL_PEGEL, endeZeit);

  oszillator.connect(verstaerker);
  verstaerker.connect(ctx.destination);

  oszillator.start(startZeit);
  oszillator.stop(endeZeit);
}

function entsperreKontextSicher(ctx: AudioContext): void {
  if (ctx.state !== 'suspended') {
    return;
  }
  try {
    const ergebnis = ctx.resume();
    if (ergebnis && typeof ergebnis.catch === 'function') {
      ergebnis.catch(() => {
        // Autoplay-Blockade darf den Timer nicht stoeren.
      });
    }
  } catch {
    // Synchroner Fehler beim Entsperren still abfangen.
  }
}

export function erstelleTonSignal(
  istAktiv: () => boolean,
  erzeugeKontext?: () => AudioContext | null,
): PhasenSignal {
  let kontext: AudioContext | null = null;

  function holeOderErzeugeKontext(): AudioContext | null {
    if (kontext && kontext.state !== 'closed') {
      return kontext;
    }
    try {
      if (erzeugeKontext) {
        kontext = erzeugeKontext();
        return kontext;
      }
      const Konstruktor = holeAudioContextKonstruktor();
      if (!Konstruktor) {
        return null;
      }
      kontext = new Konstruktor();
      return kontext;
    } catch {
      kontext = null;
      return null;
    }
  }

  return {
    entsperren() {
      const ctx = holeOderErzeugeKontext();
      if (ctx) {
        entsperreKontextSicher(ctx);
      }
    },

    ausloesen(phase: AktivePhase) {
      if (!istAktiv()) {
        return;
      }
      const ctx = holeOderErzeugeKontext();
      if (!ctx) {
        return;
      }
      try {
        entsperreKontextSicher(ctx);
        const basisZeit = ctx.currentTime;
        if (phase === 'training') {
          spieleSinusTon(ctx, TRAINING_FREQUENZ_HZ, basisZeit, TRAINING_TON_DAUER_SEKUNDEN);
          spieleSinusTon(
            ctx,
            TRAINING_FREQUENZ_HZ,
            basisZeit + TRAINING_TON_DAUER_SEKUNDEN + TRAINING_TON_ABSTAND_SEKUNDEN,
            TRAINING_TON_DAUER_SEKUNDEN,
          );
        } else {
          spieleSinusTon(ctx, PAUSE_FREQUENZ_HZ, basisZeit, PAUSE_TON_DAUER_SEKUNDEN);
        }
      } catch {
        // Bei Web-Audio-Fehlern laeuft der Timer still weiter.
      }
    },

    freigeben() {
      if (!kontext) {
        return;
      }
      const zuSchliessen = kontext;
      kontext = null;
      try {
        if (zuSchliessen.state !== 'closed') {
          const ergebnis = zuSchliessen.close();
          if (ergebnis && typeof ergebnis.catch === 'function') {
            ergebnis.catch(() => {});
          }
        }
      } catch {
        // Fehler beim Schliessen still ignorieren.
      }
    },
  };
}
