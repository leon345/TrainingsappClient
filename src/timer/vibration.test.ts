import { describe, expect, it, vi } from 'vitest';
import { VIBRATIONS_MUSTER, vibrationVerfuegbar, vibriere } from './vibration';

describe('Vibration (E33)', () => {
  it('Muster: Training [200], Pause [100, 100, 100]', () => {
    expect(VIBRATIONS_MUSTER).toEqual({ training: [200], pause: [100, 100, 100] });
  });

  it('Feature-Detection: nur mit navigator.vibrate als Funktion', () => {
    expect(vibrationVerfuegbar({ vibrate: () => true })).toBe(true);
    expect(vibrationVerfuegbar({})).toBe(false);
    expect(vibrationVerfuegbar({ vibrate: 'ja' })).toBe(false);
    expect(vibrationVerfuegbar(undefined)).toBe(false);
    const wirft = {
      get vibrate(): unknown {
        throw new Error('kein Zugriff');
      },
    };
    expect(vibrationVerfuegbar(wirft)).toBe(false);
  });

  it('jsdom hat kein navigator.vibrate: ohne Argument nicht verfügbar, kein Fehler', () => {
    expect('vibrate' in navigator).toBe(false);
    expect(vibrationVerfuegbar()).toBe(false);
    expect(vibriere('pause')).toBe(false);
  });

  it('ruft vibrate mit dem Muster und dem Navigator als this auf', () => {
    const nav = {
      vibrate: vi.fn(function (this: unknown, _muster: number[]) {
        return this === nav;
      }),
    };
    expect(vibriere('training', nav)).toBe(true);
    expect(vibriere('pause', nav)).toBe(true);
    expect(nav.vibrate.mock.calls).toEqual([[[200]], [[100, 100, 100]]]);
  });

  it('übergibt eine Kopie, das Muster bleibt unverändert', () => {
    const nav = {
      vibrate: (muster: number[]) => {
        muster.push(999);
        return true;
      },
    };
    vibriere('pause', nav);
    expect(VIBRATIONS_MUSTER.pause).toEqual([100, 100, 100]);
  });

  it('vibrate wirft oder lehnt ab: kein Fehler, Rückgabe false', () => {
    const wirft = {
      vibrate: () => {
        throw new TypeError('kaputt');
      },
    };
    expect(() => vibriere('pause', wirft)).not.toThrow();
    expect(vibriere('pause', wirft)).toBe(false);
    expect(vibriere('training', { vibrate: () => false })).toBe(false);
  });
});
