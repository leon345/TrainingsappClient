import { describe, expect, it, vi } from 'vitest';
import {
  HUELLKURVE_MS,
  LAUTSTAERKE,
  TON_LUECKE_MS,
  TON_MUSTER,
  TonGeber,
  findeAudioKontext,
  type AudioKontext,
  type AudioKontextKlasse,
} from './ton';

/** Nachgebauter AudioContext (jsdom kennt Web Audio nicht), schreibt alles mit. */
function attrappe(optionen: { resume?: 'ok' | 'abgelehnt' | 'wirft'; anfangsZustand?: AudioContextState } = {}) {
  const kontexte: FakeKontext[] = [];
  const toene: { frequenz: number; start: number; stop: number; typ: string; huelle: [string, number, number][] }[] = [];

  class FakeKontext {
    state: AudioContextState = optionen.anfangsZustand ?? 'suspended';
    currentTime = 5;
    destination = { name: 'lautsprecher' };
    resumeAufrufe = 0;
    // Bewusst kein vi.fn: Das hängt selbst einen Handler an das Versprechen
    // und würde eine unbehandelte Ablehnung verdecken.
    resume = () => {
      this.resumeAufrufe++;
      if (optionen.resume === 'wirft') throw new Error('resume kaputt');
      if (optionen.resume === 'abgelehnt') return Promise.reject(new DOMException('nein', 'NotAllowedError'));
      this.state = 'running';
      return Promise.resolve();
    };
    close = vi.fn(() => Promise.resolve());

    constructor() {
      kontexte.push(this);
    }

    createOscillator() {
      const ton = { frequenz: 0, start: 0, stop: 0, typ: '', huelle: [] as [string, number, number][] };
      const oszillator = {
        type: '',
        frequency: { setValueAtTime: (wert: number) => void (ton.frequenz = wert) },
        connect: vi.fn((ziel: { huelle?: typeof ton.huelle }) => {
          if (ziel.huelle) ton.huelle = ziel.huelle;
          return ziel;
        }),
        disconnect: vi.fn(),
        onended: null as null | (() => void),
        start: (zeit: number) => {
          ton.start = zeit;
          ton.typ = oszillator.type;
          toene.push(ton);
        },
        stop: (zeit: number) => void (ton.stop = zeit),
      };
      return oszillator;
    }

    createGain() {
      const huelle: [string, number, number][] = [];
      return {
        huelle,
        gain: {
          setValueAtTime: (wert: number, zeit: number) => void huelle.push(['setze', wert, zeit]),
          linearRampToValueAtTime: (wert: number, zeit: number) => void huelle.push(['rampe', wert, zeit]),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
  }

  return { Klasse: FakeKontext as unknown as AudioKontextKlasse, kontexte, toene };
}

const gerundet = (zahl: number) => Math.round(zahl * 1e6) / 1e6;

describe('Tonmuster (E33)', () => {
  it('Training: zwei Töne 880 Hz je 120 ms; Pause: ein Ton 440 Hz, 200 ms', () => {
    expect(TON_MUSTER).toEqual({
      training: [
        { frequenzHz: 880, dauerMs: 120 },
        { frequenzHz: 880, dauerMs: 120 },
      ],
      pause: [{ frequenzHz: 440, dauerMs: 200 }],
    });
  });
});

describe('TonGeber', () => {
  it('Feature-Detection: AudioContext, sonst webkitAudioContext, sonst keiner', () => {
    const A = class {} as unknown as AudioKontextKlasse;
    const W = class {} as unknown as AudioKontextKlasse;
    expect(findeAudioKontext({ AudioContext: A, webkitAudioContext: W })).toBe(A);
    expect(findeAudioKontext({ webkitAudioContext: W })).toBe(W);
    expect(findeAudioKontext({})).toBeNull();
  });

  it('erzeugt den AudioContext erst beim Entsperren und nur einmal', () => {
    const { Klasse, kontexte } = attrappe();
    const ton = new TonGeber(Klasse);
    expect(ton.verfuegbar).toBe(true);
    expect(kontexte).toHaveLength(0);

    ton.entsperre();
    expect(kontexte).toHaveLength(1);
    expect(kontexte[0]!.resumeAufrufe).toBe(1);

    ton.entsperre();
    expect(kontexte).toHaveLength(1);
  });

  it('ohne Entsperren kein Ton', () => {
    const { Klasse, kontexte, toene } = attrappe();
    new TonGeber(Klasse).spiele('pause');
    expect(kontexte).toHaveLength(0);
    expect(toene).toHaveLength(0);
  });

  it('Pause: ein Sinuston 440 Hz über 200 ms mit Hüllkurve', () => {
    const { Klasse, toene } = attrappe({ anfangsZustand: 'running' });
    const ton = new TonGeber(Klasse);
    ton.entsperre();
    ton.spiele('pause');

    expect(toene).toHaveLength(1);
    const [eins] = toene;
    expect(eins!.typ).toBe('sine');
    expect(eins!.frequenz).toBe(440);
    expect(gerundet(eins!.stop - eins!.start)).toBe(0.2);

    const s = eins!.start;
    const e = eins!.stop;
    const f = HUELLKURVE_MS / 1000;
    expect(eins!.huelle.map(([art, wert, zeit]) => [art, wert, gerundet(zeit)])).toEqual([
      ['setze', 0, gerundet(s)],
      ['rampe', LAUTSTAERKE, gerundet(s + f)],
      ['setze', LAUTSTAERKE, gerundet(e - f)],
      ['rampe', 0, gerundet(e)],
    ]);
  });

  it('Training: zwei Töne 880 Hz je 120 ms, mit Lücke, nicht in der Vergangenheit', () => {
    const { Klasse, toene, kontexte } = attrappe({ anfangsZustand: 'running' });
    const ton = new TonGeber(Klasse);
    ton.entsperre();
    ton.spiele('training');

    expect(toene.map((t) => t.frequenz)).toEqual([880, 880]);
    expect(toene.map((t) => gerundet(t.stop - t.start))).toEqual([0.12, 0.12]);
    expect(toene[0]!.start).toBeGreaterThanOrEqual(kontexte[0]!.currentTime);
    expect(gerundet(toene[1]!.start - toene[0]!.stop)).toBe(TON_LUECKE_MS / 1000);
    // jeder Ton mit eigener Hüllkurve, Lautstärke beginnt und endet bei 0
    for (const t of toene) {
      expect(t.huelle[0]![1]).toBe(0);
      expect(t.huelle.at(-1)![1]).toBe(0);
    }
  });

  it('ohne Web Audio: kein Fehler, kein Ton', () => {
    const ton = new TonGeber(null);
    expect(ton.verfuegbar).toBe(false);
    expect(() => {
      ton.entsperre();
      ton.spiele('training');
      ton.beende();
    }).not.toThrow();
  });

  // Eine unbehandelte Ablehnung meldet Vitest als Fehler des ganzen Laufs.
  it('resume() wird abgelehnt: kein Fehler nach außen, auch nicht unbehandelt', async () => {
    const { Klasse, kontexte } = attrappe({ resume: 'abgelehnt' });
    const ton = new TonGeber(Klasse);
    expect(() => ton.entsperre()).not.toThrow();
    expect(() => ton.spiele('pause')).not.toThrow();
    expect(kontexte[0]!.resumeAufrufe).toBe(2);
    await new Promise((fertig) => setTimeout(fertig, 0));
  });

  it('resume() wirft, Konstruktor wirft, createOscillator wirft: kein Fehler nach außen', () => {
    const { Klasse } = attrappe({ resume: 'wirft' });
    const ton = new TonGeber(Klasse);
    expect(() => ton.entsperre()).not.toThrow();
    expect(() => ton.spiele('training')).not.toThrow();

    const Kaputt = class {
      constructor() {
        throw new Error('kein Audio');
      }
    } as unknown as AudioKontextKlasse;
    const ohne = new TonGeber(Kaputt);
    expect(() => ohne.entsperre()).not.toThrow();
    expect(() => ohne.spiele('pause')).not.toThrow();

    const OhneOszillator = class {
      state = 'running';
      currentTime = 0;
      resume = () => Promise.resolve();
      close = () => Promise.resolve();
      createOscillator(): never {
        throw new Error('kaputt');
      }
    } as unknown as new () => AudioKontext;
    const halb = new TonGeber(OhneOszillator);
    halb.entsperre();
    expect(() => halb.spiele('pause')).not.toThrow();
  });

  it('beende schließt den AudioContext; danach still, erneutes Entsperren erzeugt einen neuen', () => {
    const { Klasse, kontexte, toene } = attrappe({ anfangsZustand: 'running' });
    const ton = new TonGeber(Klasse);
    ton.entsperre();
    ton.beende();
    expect(kontexte[0]!.close).toHaveBeenCalled();
    ton.spiele('pause');
    expect(toene).toHaveLength(0);
    ton.entsperre();
    expect(kontexte).toHaveLength(2);
  });
});
