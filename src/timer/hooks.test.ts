import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTimer } from './useTimer';
import { useWakeLock } from './useWakeLock';

const EINSTELLUNG = { trainingSekunden: 30, pauseSekunden: 10 };

describe('useTimer mit eigener Uhr', () => {
  it('rechnet aus der Uhr, nicht aus der Zahl der Takte', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let t = 1_000_000;
    const uhr = () => t;
    const { result } = renderHook(() => useTimer(EINSTELLUNG, uhr));

    act(() => result.current.starte());
    // Viele Takte, aber die Uhr steht: Restzeit bleibt.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.stand.restSekunden).toBe(30);

    // Uhr springt ohne Takt, ein einziger Takt genügt für die richtige Anzeige.
    t += 33_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.stand).toMatchObject({ phase: 'pause', restSekunden: 7 });
    vi.useRealTimers();
  });

  it('kein Takt, solange der Timer nicht läuft', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const uhr = vi.fn(() => 0);
    const { result } = renderHook(() => useTimer(EINSTELLUNG, uhr));
    const aufrufe = uhr.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(uhr.mock.calls.length).toBe(aufrufe);

    act(() => result.current.starte());
    act(() => result.current.pausiere());
    const nachPause = uhr.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(uhr.mock.calls.length).toBe(nachPause);
    vi.useRealTimers();
  });
});

/* Nachgebaute Screen Wake Lock API (jsdom kennt sie nicht). */
function wakeLockAttrappe(verhalten: 'ok' | 'abgelehnt' = 'ok') {
  const sperren: { released: boolean; release: ReturnType<typeof vi.fn> }[] = [];
  const request = vi.fn(async () => {
    if (verhalten === 'abgelehnt') throw new DOMException('nicht erlaubt', 'NotAllowedError');
    const sperre = {
      released: false,
      release: vi.fn(async () => {
        sperre.released = true;
      }),
    };
    sperren.push(sperre);
    return sperre;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sperren };
}

function sichtbarkeit(zustand: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: zustand, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useWakeLock', () => {
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('fordert die Sperre an, solange aktiv, und gibt sie danach frei', async () => {
    const { request, sperren } = wakeLockAttrappe();
    const { rerender } = renderHook(({ aktiv }) => useWakeLock(aktiv), { initialProps: { aktiv: false } });
    expect(request).not.toHaveBeenCalled();

    rerender({ aktiv: true });
    await vi.waitFor(() => expect(sperren).toHaveLength(1));
    expect(request).toHaveBeenCalledWith('screen');

    rerender({ aktiv: false });
    expect(sperren[0]!.release).toHaveBeenCalled();
  });

  it('fordert nach Rückkehr in den Vordergrund neu an', async () => {
    const { request, sperren } = wakeLockAttrappe();
    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(sperren).toHaveLength(1));

    // Browser gibt die Sperre beim Verbergen selbst frei.
    sperren[0]!.released = true;
    sichtbarkeit('hidden');
    expect(request).toHaveBeenCalledTimes(1);

    sichtbarkeit('visible');
    await vi.waitFor(() => expect(sperren).toHaveLength(2));
  });

  it('ohne API und bei Ablehnung kein Fehler', async () => {
    expect(() => renderHook(() => useWakeLock(true)).unmount()).not.toThrow();

    const { request } = wakeLockAttrappe('abgelehnt');
    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    unmount();
  });

  it('gibt eine spät erteilte Sperre sofort frei, wenn der Timer schon steht', async () => {
    let erteile: (s: { released: boolean; release: () => Promise<void> }) => void = () => {};
    const release = vi.fn(async () => {});
    const request = vi.fn(() => new Promise((resolve) => (erteile = resolve)));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });

    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    await act(async () => erteile({ released: false, release }));
    expect(release).toHaveBeenCalled();
  });
});
