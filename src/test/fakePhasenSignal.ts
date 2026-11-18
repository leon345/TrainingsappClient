import type { PhasenSignal, SignalAnlass } from '../timer/phasenSignal';

/** Fake des Ports `PhasenSignal` für Tests: schreibt jeden Aufruf mit. */
export class FakePhasenSignal implements PhasenSignal {
  readonly aufrufe: SignalAnlass[] = [];

  phaseGewechselt(neuePhase: SignalAnlass): void {
    this.aufrufe.push(neuePhase);
  }
}
