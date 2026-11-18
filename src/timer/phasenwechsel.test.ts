import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakePhasenSignal } from '../test/fakePhasenSignal';
import type { TimerEinstellung } from './einstellung';
import type { PhasenSignal } from './phasenSignal';
import { phasenNummer, pruefeWechsel } from './phasenwechsel';
import { usePhasenwechsel } from './usePhasenwechsel';
import { TAKT_MS, useTimer } from './useTimer';

describe('phasenNummer', () => {
  it.each([
    [{ phase: 'training', runde: 1 }, 0],
    [{ phase: 'pause', runde: 1 }, 1],
    [{ phase: 'training', runde: 2 }, 2],
    [{ phase: 'pause', runde: 7 }, 13],
  ] as const)('%j hat Nummer %i', (stand, nummer) => {
    expect(phasenNummer(stand)).toBe(nummer);
  });
});

describe('pruefeWechsel (rein)', () => {
  const training1 = { phase: 'training', runde: 1 } as const;
  const pause1 = { phase: 'pause', runde: 1 } as const;
  const training3 = { phase: 'training', runde: 3 } as const;

  it('erster Blick im Lauf merkt sich die Phase, ohne Signal', () => {
    expect(pruefeWechsel(null, 'laeuft', training1)).toEqual({ gesehen: 0, wechsel: null });
  });

  it('dieselbe Phase erneut: kein Signal', () => {
    expect(pruefeWechsel(0, 'laeuft', training1)).toEqual({ gesehen: 0, wechsel: null });
  });

  it('nächste Phase: genau ein Signal mit der neuen Phase', () => {
    expect(pruefeWechsel(0, 'laeuft', pause1)).toEqual({ gesehen: 1, wechsel: 'pause' });
  });

  it('Sprung über mehrere Phasen: ein Signal, nur für die aktuelle Phase', () => {
    expect(pruefeWechsel(0, 'laeuft', training3)).toEqual({ gesehen: 4, wechsel: 'training' });
  });

  it('angehalten: kein Signal, Gemerktes bleibt', () => {
    expect(pruefeWechsel(0, 'pausiert', pause1)).toEqual({ gesehen: 0, wechsel: null });
  });

  it('bereit: Gemerktes wird verworfen', () => {
    expect(pruefeWechsel(4, 'bereit', training1)).toEqual({ gesehen: null, wechsel: null });
  });

  it('kleinere Nummer (Uhr zurückgestellt): kein Signal, Höchststand bleibt', () => {
    expect(pruefeWechsel(1, 'laeuft', training1)).toEqual({ gesehen: 1, wechsel: null });
  });
});

/*
 * Zusammenspiel mit useTimer und kontrollierter Uhr: Die Uhr `t` steuert die
 * Zeit, die gefälschten Intervalle steuern die Neuzeichnungen.
 */
describe('usePhasenwechsel mit useTimer', () => {
  let t: number;
  const uhr = () => t;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    t = 1_000_000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function aufbau(einstellung: TimerEinstellung, signal: PhasenSignal = new FakePhasenSignal()) {
    const hook = renderHook(() => {
      const timer = useTimer(einstellung, uhr);
      const letzter = usePhasenwechsel(timer.zustand, timer.stand, signal);
      return { timer, letzter };
    });
    return {
      ...hook,
      timer: () => hook.result.current.timer,
      letzter: () => hook.result.current.letzter,
      /** Zeit vergeht im Vordergrund: ein Takt alle 250 ms. */
      laufe(ms: number) {
        for (let i = 0; i < ms / TAKT_MS; i++) {
          t += TAKT_MS;
          act(() => {
            vi.advanceTimersByTime(TAKT_MS);
          });
        }
      },
      /** Zeit vergeht ohne Takt, danach wird die Seite wieder sichtbar. */
      imHintergrund(ms: number) {
        t += ms;
        act(() => {
          document.dispatchEvent(new Event('visibilitychange'));
        });
      },
      bediene(aktion: 'starte' | 'pausiere' | 'setzeZurueck') {
        act(() => hook.result.current.timer[aktion]());
      },
    };
  }

  const STANDARD = { trainingSekunden: 30, pauseSekunden: 10 };

  it('Start löst kein Signal aus; jeder Wechsel genau einmal, trotz vieler Neuzeichnungen', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    expect(signal.aufrufe).toEqual([]);

    timer.laufe(30_000 - TAKT_MS);
    expect(signal.aufrufe).toEqual([]);

    timer.laufe(TAKT_MS);
    expect(timer.timer().stand.phase).toBe('pause');
    expect(signal.aufrufe).toEqual(['pause']);
    expect(timer.letzter()).toEqual({ phase: 'pause', runde: 1 });

    // 40 Neuzeichnungen in derselben Pause
    timer.laufe(10_000 - TAKT_MS);
    expect(signal.aufrufe).toEqual(['pause']);

    timer.laufe(TAKT_MS);
    expect(signal.aufrufe).toEqual(['pause', 'training']);
    expect(timer.letzter()).toEqual({ phase: 'training', runde: 2 });

    timer.laufe(80_000);
    expect(signal.aufrufe).toEqual(['pause', 'training', 'pause', 'training', 'pause', 'training']);
  });

  it('Neuzeichnen ohne vergangene Zeit löst nichts aus', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(30_000);
    for (let i = 0; i < 5; i++) timer.rerender();
    act(() => {
      vi.advanceTimersByTime(10 * TAKT_MS);
    });
    expect(signal.aufrufe).toEqual(['pause']);
  });

  it('Rückkehr aus dem Hintergrund über mehrere Phasen: nur der letzte Wechsel', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');

    // 47 s: Pause der Runde 1 verpasst, jetzt Training Runde 2
    timer.imHintergrund(47_000);
    expect(signal.aufrufe).toEqual(['training']);
    expect(timer.letzter()).toEqual({ phase: 'training', runde: 2 });

    // weitere 300 s: insgesamt 347 s, 347 % 40 = 27, also Training in Runde 9 (14 Wechsel verpasst)
    timer.imHintergrund(300_000);
    expect(timer.timer().stand).toMatchObject({ phase: 'training', runde: 9 });
    expect(signal.aufrufe).toEqual(['training', 'training']);

    timer.imHintergrund(5_000);
    expect(timer.timer().stand).toMatchObject({ phase: 'pause', runde: 9 });
    expect(signal.aufrufe).toEqual(['training', 'training', 'pause']);

    // Im Vordergrund weiter: kein Nachholen
    timer.laufe(2000);
    expect(signal.aufrufe).toEqual(['training', 'training', 'pause']);
  });

  it('Rückkehr in dieselbe Phase (kein Wechsel verpasst): kein Signal', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.imHintergrund(20_000);
    expect(signal.aufrufe).toEqual([]);
  });

  it('Pause 0: nur Wechsel zu Training, nie zu Pause', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau({ trainingSekunden: 5, pauseSekunden: 0 }, signal);
    timer.bediene('starte');
    timer.laufe(20_000);
    expect(signal.aufrufe).toEqual(['training', 'training', 'training', 'training']);
    expect(timer.letzter()).toEqual({ phase: 'training', runde: 5 });

    timer.imHintergrund(12_000);
    expect(signal.aufrufe).toEqual(['training', 'training', 'training', 'training', 'training']);
  });

  it('Anhalten und Fortsetzen mitten in der Phase: kein Signal', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(10_000);
    timer.bediene('pausiere');
    t += 60_000;
    timer.bediene('starte');
    timer.laufe(5_000);
    expect(signal.aufrufe).toEqual([]);
  });

  it('Anhalten genau an der Grenze: kein Signal beim Anhalten, genau eins beim Fortsetzen', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(30_000 - TAKT_MS);

    // Der Benutzer hält im Augenblick der Grenze an, bevor ein Takt kommt.
    t += TAKT_MS;
    timer.bediene('pausiere');
    expect(timer.timer().stand.phase).toBe('pause');
    expect(signal.aufrufe).toEqual([]);

    t += 5_000;
    timer.bediene('starte');
    expect(signal.aufrufe).toEqual(['pause']);
    timer.laufe(5_000);
    timer.bediene('pausiere');
    timer.bediene('starte');
    expect(signal.aufrufe).toEqual(['pause']);
  });

  it('Anhalten direkt nach einem Wechsel und Fortsetzen: kein zweites Signal', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(30_000);
    expect(signal.aufrufe).toEqual(['pause']);
    timer.bediene('pausiere');
    timer.bediene('starte');
    timer.laufe(TAKT_MS);
    expect(signal.aufrufe).toEqual(['pause']);
  });

  it('Zurücksetzen: sichtbares Signal verschwindet, nächster Start ohne Signal, danach wieder Signale', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(31_000);
    expect(signal.aufrufe).toEqual(['pause']);

    timer.bediene('setzeZurueck');
    expect(timer.letzter()).toBeNull();
    timer.bediene('starte');
    timer.laufe(TAKT_MS);
    expect(signal.aufrufe).toEqual(['pause']);
    expect(timer.letzter()).toBeNull();

    timer.laufe(30_000);
    expect(signal.aufrufe).toEqual(['pause', 'pause']);
  });

  it('Zurücksetzen im angehaltenen Zustand an der Grenze: kein Signal beim nächsten Start', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(30_000 - TAKT_MS);
    t += TAKT_MS;
    timer.bediene('pausiere');
    timer.bediene('setzeZurueck');
    timer.bediene('starte');
    timer.laufe(1000);
    expect(signal.aufrufe).toEqual([]);
  });

  it('zurückgestellte Systemuhr: derselbe Wechsel wird nicht zweimal signalisiert', () => {
    const signal = new FakePhasenSignal();
    const timer = aufbau(STANDARD, signal);
    timer.bediene('starte');
    timer.laufe(31_000);
    expect(signal.aufrufe).toEqual(['pause']);

    t -= 5_000; // Uhr springt zurück: wieder Training
    timer.laufe(TAKT_MS);
    expect(timer.timer().stand.phase).toBe('training');
    timer.laufe(5_000);
    expect(timer.timer().stand.phase).toBe('pause');
    expect(signal.aufrufe).toEqual(['pause']);
  });

  it('Port wirft: Timer läuft weiter, sichtbares Signal erscheint', () => {
    const kaputt: PhasenSignal = {
      phaseGewechselt: vi.fn(() => {
        throw new Error('kaputt');
      }),
    };
    const timer = aufbau(STANDARD, kaputt);
    timer.bediene('starte');
    timer.laufe(30_000);
    expect(kaputt.phaseGewechselt).toHaveBeenCalledTimes(1);
    expect(timer.letzter()).toEqual({ phase: 'pause', runde: 1 });
    timer.laufe(11_000);
    expect(timer.timer().stand).toMatchObject({ phase: 'training', runde: 2, restSekunden: 29 });
    expect(kaputt.phaseGewechselt).toHaveBeenCalledTimes(2);
  });

  it('ohne Port: nur das sichtbare Signal', () => {
    const hook = renderHook(() => {
      const timer = useTimer(STANDARD, uhr);
      return { timer, letzter: usePhasenwechsel(timer.zustand, timer.stand, undefined) };
    });
    act(() => hook.result.current.timer.starte());
    t += 30_000;
    act(() => {
      vi.advanceTimersByTime(TAKT_MS);
    });
    expect(hook.result.current.letzter).toEqual({ phase: 'pause', runde: 1 });
  });
});
