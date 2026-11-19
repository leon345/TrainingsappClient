import { useEffect } from 'react';

function istWakeLockUnterstuetzt(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    typeof navigator.wakeLock?.request === 'function'
  );
}

/**
 * Haelt das Display waehrend eines laufenden Timers wach (Screen Wake Lock API).
 * Bei fehlender oder abgelehnter API laeuft der Timer unveraendert weiter.
 */
export function useWakeLock(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv || !istWakeLockUnterstuetzt()) {
      return;
    }

    let abgebrochen = false;
    let sentinel: WakeLockSentinel | null = null;

    const anfordern = async () => {
      if (abgebrochen || !istWakeLockUnterstuetzt()) {
        return;
      }
      if (sentinel && !sentinel.released) {
        return;
      }
      try {
        const neuerSentinel = await navigator.wakeLock.request('screen');
        if (abgebrochen) {
          neuerSentinel.release().catch(() => {});
          return;
        }
        sentinel = neuerSentinel;
      } catch {
        // Abgelehnte oder nicht verfuegbare Wake-Lock-Anfrage still ignorieren.
      }
    };

    const beiSichtbarkeitsWechsel = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void anfordern();
      }
    };

    void anfordern();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', beiSichtbarkeitsWechsel);
    }

    return () => {
      abgebrochen = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', beiSichtbarkeitsWechsel);
      }
      const zuLoesen = sentinel;
      sentinel = null;
      if (zuLoesen && !zuLoesen.released) {
        zuLoesen.release().catch(() => {});
      }
    };
  }, [aktiv]);
}
