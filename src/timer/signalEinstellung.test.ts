import { describe, expect, it, vi } from 'vitest';
import { SPEICHER_SCHLUESSEL, ladeEinstellung, speichereEinstellung } from './einstellung';
import { GeraeteSignal } from './geraeteSignal';
import {
  SIGNAL_SPEICHER_SCHLUESSEL,
  STANDARD_SIGNAL_EINSTELLUNG,
  ladeSignalEinstellung,
  speichereSignalEinstellung,
  type SignalEinstellung,
} from './signalEinstellung';
import { TonGeber } from './ton';

function speicherMit(inhalt: Record<string, string> = {}) {
  const daten = new Map(Object.entries(inhalt));
  return {
    daten,
    getItem: (schluessel: string) => daten.get(schluessel) ?? null,
    setItem: (schluessel: string, wert: string) => void daten.set(schluessel, wert),
  };
}

describe('Signal-Schalter: Standard und Speicherung (E33)', () => {
  it('Standard: Ton an, Vibration an', () => {
    expect(STANDARD_SIGNAL_EINSTELLUNG).toEqual({ ton: true, vibration: true });
    expect(ladeSignalEinstellung(speicherMit())).toEqual({ ton: true, vibration: true });
    expect(ladeSignalEinstellung(null)).toEqual({ ton: true, vibration: true });
  });

  it.each([
    [{ ton: false, vibration: true }],
    [{ ton: true, vibration: false }],
    [{ ton: false, vibration: false }],
  ])('speichert %j und lädt es wieder', (einstellung) => {
    const speicher = speicherMit();
    expect(speichereSignalEinstellung(einstellung, speicher)).toBe(true);
    expect(JSON.parse(speicher.daten.get(SIGNAL_SPEICHER_SCHLUESSEL)!)).toEqual(einstellung);
    expect(ladeSignalEinstellung(speicher)).toEqual(einstellung);
  });

  it.each([
    ['kein json', { ton: true, vibration: true }],
    ['null', { ton: true, vibration: true }],
    ['[]', { ton: true, vibration: true }],
    ['{}', { ton: true, vibration: true }],
    ['{"ton":false}', { ton: false, vibration: true }],
    ['{"vibration":false}', { ton: true, vibration: false }],
    ['{"ton":"nein","vibration":0}', { ton: true, vibration: true }],
    ['{"ton":false,"vibration":false,"lautstaerke":3}', { ton: false, vibration: false }],
  ])('Inhalt %s ergibt %j', (roh, erwartet) => {
    expect(ladeSignalEinstellung(speicherMit({ [SIGNAL_SPEICHER_SCHLUESSEL]: roh }))).toEqual(erwartet);
  });

  it('gesperrter oder voller Speicher: Standard, speichern meldet false', () => {
    const kaputt = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(ladeSignalEinstellung(kaputt)).toEqual(STANDARD_SIGNAL_EINSTELLUNG);
    expect(speichereSignalEinstellung({ ton: false, vibration: false }, kaputt)).toBe(false);
    expect(speichereSignalEinstellung({ ton: false, vibration: false }, null)).toBe(false);
  });

  it('alte gespeicherte Timer-Einstellung (vor C-17) wird weiter gelesen, Schalter stehen auf Standard', () => {
    // Stand vor C-17: nur der Schlüssel der Timer-Einstellung im alten Format
    const speicher = speicherMit({ [SPEICHER_SCHLUESSEL]: '{"trainingSekunden":45,"pauseSekunden":15}' });
    expect(ladeEinstellung(speicher)).toEqual({ trainingSekunden: 45, pauseSekunden: 15 });
    expect(ladeSignalEinstellung(speicher)).toEqual({ ton: true, vibration: true });
  });

  it('Timer-Einstellung und Schalter liegen getrennt und überschreiben sich nicht', () => {
    const speicher = speicherMit({ [SPEICHER_SCHLUESSEL]: '{"trainingSekunden":45,"pauseSekunden":15}' });
    speichereSignalEinstellung({ ton: false, vibration: true }, speicher);
    expect(speicher.daten.get(SPEICHER_SCHLUESSEL)).toBe('{"trainingSekunden":45,"pauseSekunden":15}');

    speichereEinstellung({ trainingSekunden: 20, pauseSekunden: 0 }, speicher);
    expect(ladeSignalEinstellung(speicher)).toEqual({ ton: false, vibration: true });
    expect(ladeEinstellung(speicher)).toEqual({ trainingSekunden: 20, pauseSekunden: 0 });
  });

  it('nutzt ohne Argument den localStorage des Browsers', () => {
    localStorage.clear();
    speichereSignalEinstellung({ ton: false, vibration: true });
    expect(ladeSignalEinstellung()).toEqual({ ton: false, vibration: true });
    localStorage.clear();
  });
});

/** TonGeber-Attrappe, die nur mitschreibt. */
class TonProtokoll extends TonGeber {
  readonly protokoll: string[] = [];
  constructor() {
    super(null);
  }
  override entsperre() {
    this.protokoll.push('entsperre');
  }
  override spiele(anlass: 'training' | 'pause') {
    this.protokoll.push(`ton:${anlass}`);
  }
  override beende() {
    this.protokoll.push('beende');
  }
}

describe('GeraeteSignal: Schalter wirken auf Ton und Vibration', () => {
  function aufbau(schalter: SignalEinstellung) {
    const ton = new TonProtokoll();
    const vibration = vi.fn();
    const aktuell = { ...schalter };
    const signal = new GeraeteSignal(() => aktuell, ton, vibration);
    return { signal, ton, vibration, aktuell };
  }

  it('beide an: Ton und Vibration mit der neuen Phase', () => {
    const { signal, ton, vibration } = aufbau({ ton: true, vibration: true });
    signal.phaseGewechselt('pause');
    signal.phaseGewechselt('training');
    expect(ton.protokoll).toEqual(['ton:pause', 'ton:training']);
    expect(vibration.mock.calls).toEqual([['pause'], ['training']]);
  });

  it('Ton aus: nur Vibration, kein Entsperren', () => {
    const { signal, ton, vibration } = aufbau({ ton: false, vibration: true });
    signal.entsperreTon();
    signal.phaseGewechselt('pause');
    expect(ton.protokoll).toEqual([]);
    expect(vibration).toHaveBeenCalledWith('pause');
  });

  it('Vibration aus: nur Ton', () => {
    const { signal, ton, vibration } = aufbau({ ton: true, vibration: false });
    signal.entsperreTon();
    signal.phaseGewechselt('training');
    expect(ton.protokoll).toEqual(['entsperre', 'ton:training']);
    expect(vibration).not.toHaveBeenCalled();
  });

  it('beide aus: nichts', () => {
    const { signal, ton, vibration } = aufbau({ ton: false, vibration: false });
    signal.phaseGewechselt('training');
    expect(ton.protokoll).toEqual([]);
    expect(vibration).not.toHaveBeenCalled();
  });

  it('Umschalten während des Laufs wirkt beim nächsten Wechsel', () => {
    const { signal, ton, vibration, aktuell } = aufbau({ ton: true, vibration: true });
    signal.phaseGewechselt('pause');
    aktuell.ton = false;
    aktuell.vibration = false;
    signal.phaseGewechselt('training');
    expect(ton.protokoll).toEqual(['ton:pause']);
    expect(vibration).toHaveBeenCalledTimes(1);
  });

  it('Ton wirft: Vibration kommt trotzdem; Vibration wirft: kein Fehler', () => {
    const ton = new TonProtokoll();
    ton.spiele = () => {
      throw new Error('Ton kaputt');
    };
    const vibration = vi.fn(() => {
      throw new Error('Vibration kaputt');
    });
    const signal = new GeraeteSignal(() => ({ ton: true, vibration: true }), ton, vibration);
    expect(() => signal.phaseGewechselt('pause')).not.toThrow();
    expect(vibration).toHaveBeenCalledWith('pause');
  });
});
