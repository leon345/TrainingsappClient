import { describe, expect, it } from 'vitest';
import {
  erstelleBereitZustand,
  pausiereTimer,
  STANDARD_TIMER_EINSTELLUNG,
  starteTimer,
} from './logik';
import {
  erstelleLokalenTimerSpeicher,
  STANDARD_SIGNAL_EINSTELLUNG,
  TIMER_EINSTELLUNG_SCHLUESSEL,
  TIMER_SIGNALE_SCHLUESSEL,
  TIMER_ZUSTAND_SCHLUESSEL,
} from './speicher';

function erstelleMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('Lokale Timer-Persistenz (speicher.ts)', () => {
  it('speichert und lädt Einstellungen und Signal-Schalter unter den v1-Schlüsseln', () => {
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);

    expect(speicher.ladeEinstellung()).toEqual(STANDARD_TIMER_EINSTELLUNG);
    expect(speicher.ladeSignale()).toEqual(STANDARD_SIGNAL_EINSTELLUNG);

    expect(speicher.speichereEinstellung({ trainingSekunden: 45, pauseSekunden: 0 })).toBe(true);
    expect(speicher.speichereSignale({ tonAktiv: false, vibrationAktiv: true })).toBe(true);

    expect(raw.getItem(TIMER_EINSTELLUNG_SCHLUESSEL)).toBe(
      JSON.stringify({ trainingSekunden: 45, pauseSekunden: 0 }),
    );
    expect(raw.getItem(TIMER_SIGNALE_SCHLUESSEL)).toBe(
      JSON.stringify({ tonAktiv: false, vibrationAktiv: true }),
    );

    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 45, pauseSekunden: 0 });
    expect(speicher.ladeSignale()).toEqual({ tonAktiv: false, vibrationAktiv: true });
  });

  it('stellt laufenden und pausierten Zustand nach Neuladen exakt wieder her', () => {
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);

    const laufend = starteTimer(erstelleBereitZustand({ trainingSekunden: 30, pauseSekunden: 10 }), 1_000);
    expect(speicher.speichereLaufzustand(laufend)).toBe(true);

    // Nach 35 Sekunden (Reload im Lauf) muss der Timer in der Pause bei 5 s Restzeit stehen
    const wiederhergestellt = speicher.ladeLaufzustand(36_000);
    expect(wiederhergestellt).not.toBeNull();
    expect(wiederhergestellt?.phase).toBe('pause');
    expect(wiederhergestellt?.runde).toBe(1);
    expect(wiederhergestellt?.restMs).toBe(5_000);

    // Pausierter Zustand bleibt exakt erhalten
    const pausiert = pausiereTimer(laufend, 11_000);
    speicher.speichereLaufzustand(pausiert);
    const geladenPausiert = speicher.ladeLaufzustand(99_000);
    expect(geladenPausiert?.phase).toBe('pausiert');
    expect(geladenPausiert?.pausiertePhase).toBe('training');
    expect(geladenPausiert?.restMs).toBe(20_000);

    // Bereit-Zustand löscht den gespeicherten Laufzustand
    speicher.speichereLaufzustand(erstelleBereitZustand());
    expect(raw.getItem(TIMER_ZUSTAND_SCHLUESSEL)).toBeNull();
    expect(speicher.ladeLaufzustand(100_000)).toBeNull();
  });

  it('fängt korruptes oder ungültiges JSON sauber ab und fällt auf Standardwerte zurück', () => {
    const raw = erstelleMemoryStorage();
    raw.setItem(TIMER_EINSTELLUNG_SCHLUESSEL, '{kaputtes-json');
    raw.setItem(TIMER_SIGNALE_SCHLUESSEL, '["kein-objekt"]');
    raw.setItem(TIMER_ZUSTAND_SCHLUESSEL, JSON.stringify({ phase: 'training', runde: -1 }));

    const speicher = erstelleLokalenTimerSpeicher(() => raw);
    expect(speicher.ladeEinstellung()).toEqual(STANDARD_TIMER_EINSTELLUNG);
    expect(speicher.ladeSignale()).toEqual(STANDARD_SIGNAL_EINSTELLUNG);
    expect(speicher.ladeLaufzustand(1_000)).toBeNull();

    // Ungültige Zahlenwerte werden begrenzt bzw. auf Standard gesetzt
    raw.setItem(
      TIMER_EINSTELLUNG_SCHLUESSEL,
      JSON.stringify({ trainingSekunden: 0, pauseSekunden: 999_999 }),
    );
    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 1, pauseSekunden: 86_400 });

    raw.setItem(
      TIMER_SIGNALE_SCHLUESSEL,
      JSON.stringify({ tonAktiv: 'falsch', vibrationAktiv: false }),
    );
    expect(speicher.ladeSignale()).toEqual({ tonAktiv: true, vibrationAktiv: false });
  });

  it('stürzt bei blockiertem, fehlendem oder vollem localStorage nicht ab', () => {
    // 1. Blockierter localStorage (Getter wirft SecurityError)
    const blockiert = erstelleLokalenTimerSpeicher(() => {
      throw new DOMException('Zugriff verweigert', 'SecurityError');
    });
    expect(blockiert.ladeEinstellung()).toEqual(STANDARD_TIMER_EINSTELLUNG);
    expect(blockiert.ladeSignale()).toEqual(STANDARD_SIGNAL_EINSTELLUNG);
    expect(blockiert.ladeLaufzustand(1_000)).toBeNull();
    expect(blockiert.speichereEinstellung({ trainingSekunden: 20, pauseSekunden: 5 })).toBe(false);
    expect(blockiert.speichereSignale({ tonAktiv: false, vibrationAktiv: false })).toBe(false);
    expect(() => blockiert.loescheLaufzustand()).not.toThrow();

    // 2. Fehlender localStorage (null)
    const fehlend = erstelleLokalenTimerSpeicher(() => null);
    expect(fehlend.ladeEinstellung()).toEqual(STANDARD_TIMER_EINSTELLUNG);
    expect(fehlend.speichereEinstellung({ trainingSekunden: 20, pauseSekunden: 5 })).toBe(false);

    // 3. Voller localStorage (setItem wirft QuotaExceededError)
    const vollStorage: Storage = {
      ...erstelleMemoryStorage(),
      setItem() {
        throw new DOMException('Speicher voll', 'QuotaExceededError');
      },
    };
    const voll = erstelleLokalenTimerSpeicher(() => vollStorage);
    expect(voll.speichereEinstellung({ trainingSekunden: 20, pauseSekunden: 5 })).toBe(false);
    expect(voll.speichereSignale({ tonAktiv: false, vibrationAktiv: true })).toBe(false);
    expect(voll.speichereLaufzustand(starteTimer(erstelleBereitZustand(), 0))).toBe(false);
  });
});
