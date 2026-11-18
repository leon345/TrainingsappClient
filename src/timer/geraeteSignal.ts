/*
 * Umsetzung des Ports `PhasenSignal` im Browser (C-17, E33): Ton und
 * Vibration je nach Schalter. Die Schalter werden bei jedem Wechsel neu
 * gelesen, damit ein Umschalten während des Laufs sofort wirkt.
 */
import type { PhasenSignal, SignalAnlass } from './phasenSignal';
import type { SignalEinstellung } from './signalEinstellung';
import { TonGeber } from './ton';
import { vibriere } from './vibration';

export class GeraeteSignal implements PhasenSignal {
  private readonly schalter: () => SignalEinstellung;
  private readonly ton: TonGeber;
  private readonly vibration: (anlass: SignalAnlass) => unknown;

  constructor(
    schalter: () => SignalEinstellung,
    ton: TonGeber = new TonGeber(),
    vibration: (anlass: SignalAnlass) => unknown = vibriere,
  ) {
    this.schalter = schalter;
    this.ton = ton;
    this.vibration = vibration;
  }

  /** In einer Nutzeraktion aufrufen (Start, Fortsetzen, Ton einschalten). */
  entsperreTon(): void {
    if (this.schalter().ton) this.ton.entsperre();
  }

  phaseGewechselt(neuePhase: SignalAnlass): void {
    const { ton, vibration } = this.schalter();
    // Getrennt abgesichert: Scheitert der Ton, soll trotzdem vibriert werden.
    if (ton) {
      try {
        this.ton.spiele(neuePhase);
      } catch {
        // still
      }
    }
    if (vibration) {
      try {
        this.vibration(neuePhase);
      } catch {
        // keine Vibration
      }
    }
  }

  beende(): void {
    this.ton.beende();
  }
}
