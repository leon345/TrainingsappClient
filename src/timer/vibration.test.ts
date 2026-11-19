import { describe, expect, it, vi } from 'vitest';
import {
  erstelleVibrationsSignal,
  istVibrationUnterstuetzt,
  VIBRATION_MUSTER_PAUSE,
  VIBRATION_MUSTER_TRAINING,
} from './vibration';

describe('Vibrationsmodul (vibration.ts)', () => {
  it('löst bei Training [200] und bei Pause [100, 100, 100] aus', () => {
    const vibrateMock = vi.fn(() => true);
    const signal = erstelleVibrationsSignal(() => true, () => ({ vibrate: vibrateMock }));

    signal.ausloesen('training');
    signal.ausloesen('pause');

    expect(vibrateMock).toHaveBeenNthCalledWith(1, [...VIBRATION_MUSTER_TRAINING]);
    expect(vibrateMock).toHaveBeenNthCalledWith(2, [...VIBRATION_MUSTER_PAUSE]);
  });

  it('erkennt fehlende Vibrationsunterstützung und stürzt nicht ab', () => {
    expect(istVibrationUnterstuetzt({})).toBe(false);
    expect(istVibrationUnterstuetzt(undefined)).toBe(false);
    expect(istVibrationUnterstuetzt({ vibrate: () => true })).toBe(true);

    const ohneVibrate = erstelleVibrationsSignal(() => true, () => ({}));
    expect(() => {
      ohneVibrate.ausloesen('training');
      ohneVibrate.ausloesen('pause');
    }).not.toThrow();
  });

  it('vibriert nicht bei deaktiviertem Schalter und fängt Fehler aus navigator.vibrate ab', () => {
    const vibrateMock = vi.fn(() => {
      throw new Error('Vibration gesperrt');
    });

    const deaktiviert = erstelleVibrationsSignal(() => false, () => ({ vibrate: vibrateMock }));
    deaktiviert.ausloesen('training');
    expect(vibrateMock).not.toHaveBeenCalled();

    const aktivMitFehler = erstelleVibrationsSignal(() => true, () => ({ vibrate: vibrateMock }));
    expect(() => aktivMitFehler.ausloesen('pause')).not.toThrow();
    expect(vibrateMock).toHaveBeenCalledTimes(1);
  });
});
