import type { AktivePhase } from './logik';
import type { PhasenSignal } from './phasenSignal';

export const VIBRATION_MUSTER_TRAINING: readonly number[] = [200];
export const VIBRATION_MUSTER_PAUSE: readonly number[] = [100, 100, 100];

type VibrationsNavigator = {
  vibrate?: (pattern: VibratePattern) => boolean;
};

function holeStandardNavigator(): VibrationsNavigator | undefined {
  return typeof navigator !== 'undefined' ? navigator : undefined;
}

export function istVibrationUnterstuetzt(
  nav: VibrationsNavigator | undefined = holeStandardNavigator(),
): boolean {
  return typeof nav?.vibrate === 'function';
}

export function erstelleVibrationsSignal(
  istAktiv: () => boolean,
  navQuelle: () => VibrationsNavigator | undefined = holeStandardNavigator,
): PhasenSignal {
  return {
    ausloesen(phase: AktivePhase) {
      if (!istAktiv()) {
        return;
      }
      const nav = navQuelle();
      if (!istVibrationUnterstuetzt(nav)) {
        return;
      }
      const muster =
        phase === 'training' ? [...VIBRATION_MUSTER_TRAINING] : [...VIBRATION_MUSTER_PAUSE];
      try {
        nav?.vibrate?.(muster);
      } catch {
        // Fehlgeschlagene Vibration darf den Timer nicht unterbrechen.
      }
    },
  };
}
