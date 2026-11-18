/*
 * Ton beim Phasenwechsel (C-17, E33): Web Audio mit Sinus-Oszillator, ohne
 * Audiodatei.
 *
 * - Browser spielen Ton erst nach einer Nutzeraktion (Autoplay-Regeln). Der
 *   AudioContext wird deshalb beim Tippen auf "Start" (bzw. "Fortsetzen" und
 *   beim Einschalten des Tons) erzeugt und mit `resume()` entsperrt.
 * - Jeder Ton hat eine Hüllkurve (kurzer An- und Abstieg der Lautstärke),
 *   sonst knackt es an Anfang und Ende.
 * - Fehlertolerant: Fehlt Web Audio, wird `resume()` abgelehnt oder wirft
 *   etwas, bleibt es still. Der Timer und das sichtbare Signal sind davon
 *   nicht betroffen.
 *
 * Ob der Ton auf echten Geräten hörbar ist (Stummschalter, gesperrter
 * Bildschirm, iOS-Safari), ist nicht geprüft (C-01b).
 */
import type { SignalAnlass } from './phasenSignal';

export interface Ton {
  frequenzHz: number;
  dauerMs: number;
}

/** Wechsel zu Training: zwei kurze hohe Töne; zu Pause: ein tieferer, längerer Ton (E33). */
export const TON_MUSTER: Readonly<Record<SignalAnlass, readonly Ton[]>> = Object.freeze({
  training: [
    { frequenzHz: 880, dauerMs: 120 },
    { frequenzHz: 880, dauerMs: 120 },
  ],
  pause: [{ frequenzHz: 440, dauerMs: 200 }],
});

/** Stille zwischen zwei Tönen eines Musters (eigene Festlegung, E33 nennt keinen Wert). */
export const TON_LUECKE_MS = 80;
/** Dauer von An- und Abstieg der Hüllkurve (eigene Festlegung). */
export const HUELLKURVE_MS = 10;
/** Höchste Lautstärke (Verstärkung 0 bis 1, eigene Festlegung). */
export const LAUTSTAERKE = 0.3;
/** Kleiner Vorlauf, damit der erste Ton nicht in der Vergangenheit beginnt. */
const VORLAUF_S = 0.01;

/** Der Teil von AudioContext, den der Tongeber braucht. */
export type AudioKontext = Pick<
  AudioContext,
  'state' | 'currentTime' | 'destination' | 'resume' | 'close' | 'createOscillator' | 'createGain'
>;
export type AudioKontextKlasse = new () => AudioKontext;

/** Feature-Detection: AudioContext oder (ältere Safari-Versionen) webkitAudioContext. */
export function findeAudioKontext(umgebung: object = globalThis): AudioKontextKlasse | null {
  try {
    const fenster = umgebung as { AudioContext?: AudioKontextKlasse; webkitAudioContext?: AudioKontextKlasse };
    return fenster.AudioContext ?? fenster.webkitAudioContext ?? null;
  } catch {
    return null;
  }
}

/** Fängt die Ablehnung eines Versprechens ab, falls es eins ist. */
function ignoriereAblehnung(ergebnis: unknown): void {
  const versprechen = ergebnis as { catch?: unknown } | null | undefined;
  if (typeof versprechen?.catch === 'function') (versprechen as Promise<unknown>).catch(() => {});
}

/** Ruft `resume()` auf, ohne dass eine Ablehnung oder ein Wurf nach außen dringt. */
function setzeFort(kontext: AudioKontext): void {
  try {
    ignoriereAblehnung(kontext.resume());
  } catch {
    // Kein Ton, sonst nichts.
  }
}

export class TonGeber {
  private kontext: AudioKontext | null = null;
  private readonly klasse: AudioKontextKlasse | null;

  constructor(klasse: AudioKontextKlasse | null = findeAudioKontext()) {
    this.klasse = klasse;
  }

  /** Gibt es Web Audio in diesem Browser? */
  get verfuegbar(): boolean {
    return this.klasse !== null;
  }

  /**
   * Erzeugt und entsperrt den AudioContext. Muss synchron in einer
   * Nutzeraktion aufgerufen werden (Tippen auf "Start").
   */
  entsperre(): void {
    try {
      if (!this.kontext) {
        if (!this.klasse) return;
        this.kontext = new this.klasse();
      }
      if (this.kontext.state !== 'running') setzeFort(this.kontext);
    } catch {
      this.kontext = null;
    }
  }

  /** Spielt das Muster des Anlasses. Ohne vorheriges Entsperren bleibt es still. */
  spiele(anlass: SignalAnlass): void {
    const kontext = this.kontext;
    if (!kontext) return;
    try {
      // z. B. von iOS unterbrochen: erneut versuchen, ohne darauf zu warten
      if (kontext.state !== 'running') setzeFort(kontext);
      let beginn = kontext.currentTime + VORLAUF_S;
      for (const ton of TON_MUSTER[anlass]) {
        spieleTon(kontext, ton, beginn);
        beginn += (ton.dauerMs + TON_LUECKE_MS) / 1000;
      }
    } catch {
      // Kein Ton, sonst nichts.
    }
  }

  /** Gibt den AudioContext frei (beim Verlassen der Ansicht). */
  beende(): void {
    const kontext = this.kontext;
    this.kontext = null;
    if (!kontext) return;
    try {
      ignoriereAblehnung(kontext.close());
    } catch {
      // egal
    }
  }
}

function spieleTon(kontext: AudioKontext, { frequenzHz, dauerMs }: Ton, beginn: number): void {
  const ende = beginn + dauerMs / 1000;
  const flanke = HUELLKURVE_MS / 1000;

  const oszillator = kontext.createOscillator();
  oszillator.type = 'sine';
  oszillator.frequency.setValueAtTime(frequenzHz, beginn);

  // Hüllkurve: von 0 hoch, halten, wieder auf 0 vor dem Stopp
  const verstaerker = kontext.createGain();
  verstaerker.gain.setValueAtTime(0, beginn);
  verstaerker.gain.linearRampToValueAtTime(LAUTSTAERKE, beginn + flanke);
  verstaerker.gain.setValueAtTime(LAUTSTAERKE, ende - flanke);
  verstaerker.gain.linearRampToValueAtTime(0, ende);

  oszillator.connect(verstaerker);
  verstaerker.connect(kontext.destination);
  oszillator.onended = () => {
    oszillator.disconnect();
    verstaerker.disconnect();
  };
  oszillator.start(beginn);
  oszillator.stop(ende);
}
