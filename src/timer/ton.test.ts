import { describe, expect, it, vi } from 'vitest';
import {
  erstelleTonSignal,
  PAUSE_FREQUENZ_HZ,
  PAUSE_TON_DAUER_SEKUNDEN,
  TRAINING_FREQUENZ_HZ,
  TRAINING_TON_DAUER_SEKUNDEN,
} from './ton';

interface AufgezeichneterTon {
  type: OscillatorType;
  frequenzHz: number | null;
  startZeit: number | null;
  endeZeit: number | null;
  gainRampen: number;
}

function erstelleFakeAudioContext(startStatus: AudioContextState = 'running') {
  const toene: AufgezeichneterTon[] = [];
  const resumeMock = vi.fn(async () => {
    kontext.state = 'running';
  });
  const closeMock = vi.fn(async () => {
    kontext.state = 'closed';
  });

  const kontext = {
    state: startStatus,
    currentTime: 10,
    destination: {},
    resume: resumeMock,
    close: closeMock,
    createOscillator: vi.fn(() => {
      const eintrag: AufgezeichneterTon = {
        type: 'sine',
        frequenzHz: null,
        startZeit: null,
        endeZeit: null,
        gainRampen: 0,
      };
      toene.push(eintrag);
      return {
        get type() {
          return eintrag.type;
        },
        set type(wert: OscillatorType) {
          eintrag.type = wert;
        },
        frequency: {
          setValueAtTime: vi.fn((hz: number) => {
            eintrag.frequenzHz = hz;
          }),
        },
        connect: vi.fn(),
        start: vi.fn((zeit: number) => {
          eintrag.startZeit = zeit;
        }),
        stop: vi.fn((zeit: number) => {
          eintrag.endeZeit = zeit;
        }),
      };
    }),
    createGain: vi.fn(() => {
      const letzterTon = () => toene[toene.length - 1];
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(() => {
            const eintrag = letzterTon();
            if (eintrag) {
              eintrag.gainRampen += 1;
            }
          }),
        },
        connect: vi.fn(),
      };
    }),
  };

  return {
    kontext: kontext as unknown as AudioContext,
    toene,
    resumeMock,
    closeMock,
  };
}

describe('Web-Audio-Tonmodul (ton.ts)', () => {
  it('spielt beim Wechsel zu Training zwei 880-Hz-Sinustöne à 120 ms mit Hüllkurve', () => {
    const fake = erstelleFakeAudioContext('running');
    const signal = erstelleTonSignal(() => true, () => fake.kontext);

    signal.ausloesen('training');

    expect(fake.toene).toHaveLength(2);
    for (const ton of fake.toene) {
      expect(ton.type).toBe('sine');
      expect(ton.frequenzHz).toBe(TRAINING_FREQUENZ_HZ);
      expect(ton.startZeit).not.toBeNull();
      expect(ton.endeZeit).not.toBeNull();
      expect((ton.endeZeit ?? 0) - (ton.startZeit ?? 0)).toBeCloseTo(
        TRAINING_TON_DAUER_SEKUNDEN,
        5,
      );
      expect(ton.gainRampen).toBeGreaterThanOrEqual(2);
    }
    expect((fake.toene[1]!.startZeit ?? 0) > (fake.toene[0]!.endeZeit ?? 0)).toBe(true);
  });

  it('spielt beim Wechsel zu Pause einen 440-Hz-Sinuston à 200 ms mit Hüllkurve', () => {
    const fake = erstelleFakeAudioContext('running');
    const signal = erstelleTonSignal(() => true, () => fake.kontext);

    signal.ausloesen('pause');

    expect(fake.toene).toHaveLength(1);
    const ton = fake.toene[0]!;
    expect(ton.type).toBe('sine');
    expect(ton.frequenzHz).toBe(PAUSE_FREQUENZ_HZ);
    expect((ton.endeZeit ?? 0) - (ton.startZeit ?? 0)).toBeCloseTo(PAUSE_TON_DAUER_SEKUNDEN, 5);
    expect(ton.gainRampen).toBeGreaterThanOrEqual(2);
  });

  it('entsperrt einen pausierten AudioContext via resume()', () => {
    const fake = erstelleFakeAudioContext('suspended');
    const signal = erstelleTonSignal(() => true, () => fake.kontext);

    signal.entsperren?.();

    expect(fake.resumeMock).toHaveBeenCalledTimes(1);
  });

  it('erzeugt keine Töne, wenn der Ton-Schalter aus ist', () => {
    const fake = erstelleFakeAudioContext('running');
    const signal = erstelleTonSignal(() => false, () => fake.kontext);

    signal.ausloesen('training');
    signal.ausloesen('pause');

    expect(fake.toene).toHaveLength(0);
  });

  it('läuft still weiter, wenn Web Audio fehlt oder resume() fehlschlägt', () => {
    const ohneAudio = erstelleTonSignal(() => true, () => null);
    expect(() => {
      ohneAudio.entsperren?.();
      ohneAudio.ausloesen('training');
      ohneAudio.freigeben?.();
    }).not.toThrow();

    const fake = erstelleFakeAudioContext('suspended');
    fake.resumeMock.mockRejectedValueOnce(new Error('Autoplay blockiert'));
    const mitFehler = erstelleTonSignal(() => true, () => fake.kontext);
    expect(() => {
      mitFehler.entsperren?.();
      mitFehler.ausloesen('pause');
    }).not.toThrow();
  });
});
