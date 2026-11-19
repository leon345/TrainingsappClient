import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock';

describe('Screen Wake Lock Hook (useWakeLock.ts)', () => {
  const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
  const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

  afterEach(() => {
    if (originalWakeLock) {
      Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
    } else {
      Reflect.deleteProperty(navigator, 'wakeLock');
    }
    if (originalVisibility) {
      Object.defineProperty(document, 'visibilityState', originalVisibility);
    } else {
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('fordert Wake Lock an, erneuert nach visibilitychange und gibt bei Deaktivierung frei', async () => {
    const releaseMock = vi.fn(async () => {
      sentinel.released = true;
    });
    const sentinel = {
      released: false,
      type: 'screen' as const,
      release: releaseMock,
    };
    const requestMock = vi.fn(async () => {
      sentinel.released = false;
      return sentinel;
    });

    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: requestMock },
    });

    const { rerender, unmount } = renderHook(({ aktiv }) => useWakeLock(aktiv), {
      initialProps: { aktiv: true },
    });

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith('screen');
    });

    // Browser gibt Wake Lock im Hintergrund frei -> bei Rueckkehr erneut anfordern
    sentinel.released = true;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(requestMock).toHaveBeenCalledTimes(2);

    // Bei Pause/Reset freigeben
    rerender({ aktiv: false });
    await waitFor(() => {
      expect(releaseMock).toHaveBeenCalledTimes(1);
    });

    unmount();
  });

  it('stürzt bei fehlender oder abgelehnter Wake-Lock-API nicht ab', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();

    const requestMock = vi.fn(async () => {
      throw new DOMException('Verweigert', 'NotAllowedError');
    });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: requestMock },
    });

    const { unmount: unmount2 } = renderHook(() => useWakeLock(true));
    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledTimes(1);
    });
    unmount2();
  });
});
