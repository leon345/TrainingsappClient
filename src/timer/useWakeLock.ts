import { useEffect } from 'react';

/**
 * Hält den Bildschirm an, solange `aktiv` gilt (Screen Wake Lock API, E1).
 *
 * - Fehlt die API oder lehnt der Browser ab (z. B. Energiesparmodus, fehlende
 *   Berechtigung), passiert nichts weiter: Der Timer rechnet ohnehin mit
 *   Zeitstempeln und läuft korrekt, nur kann der Bildschirm ausgehen.
 * - Der Browser gibt die Sperre frei, sobald die Seite verborgen ist. Wird sie
 *   wieder sichtbar, fordert der Hook die Sperre neu an.
 */
export function useWakeLock(aktiv: boolean): void {
  useEffect(() => {
    if (!aktiv || typeof navigator === 'undefined' || !('wakeLock' in navigator) || !navigator.wakeLock) {
      return;
    }
    const api = navigator.wakeLock;
    let sperre: WakeLockSentinel | null = null;
    let anfrageLaeuft = false;
    let beendet = false;

    const anfordern = async () => {
      if (beendet || anfrageLaeuft || document.visibilityState !== 'visible') return;
      if (sperre && !sperre.released) return;
      anfrageLaeuft = true;
      try {
        const neu = await api.request('screen');
        if (beendet) {
          await neu.release();
        } else {
          sperre = neu;
        }
      } catch {
        // Nicht erlaubt oder nicht verfügbar: Timer läuft trotzdem.
      } finally {
        anfrageLaeuft = false;
      }
    };

    const beiSichtbarkeit = () => void anfordern();
    void anfordern();
    document.addEventListener('visibilitychange', beiSichtbarkeit);

    return () => {
      beendet = true;
      document.removeEventListener('visibilitychange', beiSichtbarkeit);
      if (sperre && !sperre.released) {
        sperre.release().catch(() => {});
      }
    };
  }, [aktiv]);
}
