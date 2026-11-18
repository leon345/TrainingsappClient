import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SPEICHER_SCHLUESSEL } from './einstellung';
import { SIGNAL_SPEICHER_SCHLUESSEL } from './signalEinstellung';
import { TimerAnsicht } from './TimerAnsicht';
import { TAKT_MS } from './useTimer';

/*
 * Phasensignale in der Timer-Ansicht (C-17, E33). Web Audio und
 * navigator.vibrate gibt es in jsdom nicht; beide werden hier nachgebaut und
 * schreiben mit, was die Ansicht auslöst. Die Uhr steuert Vitest.
 */

const START = new Date('2026-11-18T10:00:00Z').getTime();

interface Protokoll {
  kontexte: number;
  resume: number;
  toene: number[];
  vibrationen: number[][];
}

let protokoll: Protokoll;

function audioAttrappe(resume: 'ok' | 'abgelehnt' = 'ok') {
  class FakeKontext {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    constructor() {
      protokoll.kontexte++;
    }
    resume() {
      protokoll.resume++;
      if (resume === 'abgelehnt') return Promise.reject(new DOMException('nein', 'NotAllowedError'));
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createOscillator() {
      let frequenz = 0;
      return {
        type: '',
        frequency: { setValueAtTime: (wert: number) => void (frequenz = wert) },
        connect() {},
        disconnect() {},
        start: () => void protokoll.toene.push(frequenz),
        stop() {},
      };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
  }
  vi.stubGlobal('AudioContext', FakeKontext);
}

function vibrationAttrappe(verhalten: 'ok' | 'wirft' = 'ok') {
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (muster: number[]) => {
      if (verhalten === 'wirft') throw new TypeError('kaputt');
      protokoll.vibrationen.push(muster);
      return true;
    },
  });
}

/**
 * Zeit vergeht im Vordergrund. Jeder Takt in einem eigenen act(), damit React
 * jeden Takt zeichnet; in einem einzigen act() fasst React alle Takte zu einer
 * Neuzeichnung zusammen, und das wirkt wie ein Sprung aus dem Hintergrund.
 */
function vergeheMitTakt(ms: number) {
  for (let i = 0; i < ms / TAKT_MS; i++) {
    act(() => {
      vi.advanceTimersByTime(TAKT_MS);
    });
  }
}

function imHintergrund(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const signal = () => screen.getByRole('status');
const schalter = (name: 'Ton' | 'Vibration') => screen.getByRole('switch', { name });
const starte = () => fireEvent.click(screen.getByRole('button', { name: /^(Start|Fortsetzen)$/ }));

beforeEach(() => {
  localStorage.clear();
  protokoll = { kontexte: 0, resume: 0, toene: [], vibrationen: [] };
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (navigator as { vibrate?: unknown }).vibrate;
  localStorage.clear();
});

describe('Schalter Ton und Vibration', () => {
  it('zwei getrennte Schalter in einer benannten Gruppe, Standard an', () => {
    audioAttrappe();
    vibrationAttrappe();
    render(<TimerAnsicht />);
    const gruppe = screen.getByRole('group', { name: 'Signal beim Phasenwechsel' });
    expect(within(gruppe).getAllByRole('switch')).toHaveLength(2);
    expect(schalter('Ton')).toBeChecked();
    expect(schalter('Vibration')).toBeChecked();
    expect(schalter('Vibration')).toBeEnabled();
    expect(schalter('Vibration')).not.toHaveAttribute('aria-describedby');
  });

  it('beide an: Wechsel zu Pause ein Ton 440 Hz und [100,100,100], zu Training zwei Töne 880 Hz und [200]', () => {
    audioAttrappe();
    vibrationAttrappe();
    render(<TimerAnsicht />);
    starte();
    expect(protokoll.kontexte).toBe(1);
    expect(protokoll.resume).toBe(1);
    expect(protokoll.toene).toEqual([]);
    expect(protokoll.vibrationen).toEqual([]);

    vergeheMitTakt(30_000);
    expect(protokoll.toene).toEqual([440]);
    expect(protokoll.vibrationen).toEqual([[100, 100, 100]]);

    vergeheMitTakt(10_000);
    expect(protokoll.toene).toEqual([440, 880, 880]);
    expect(protokoll.vibrationen).toEqual([[100, 100, 100], [200]]);
  });

  it('Ton aus: kein AudioContext, kein Ton, Vibration weiter', () => {
    audioAttrappe();
    vibrationAttrappe();
    render(<TimerAnsicht />);
    fireEvent.click(schalter('Ton'));
    expect(schalter('Ton')).not.toBeChecked();

    starte();
    vergeheMitTakt(40_000);
    expect(protokoll.kontexte).toBe(0);
    expect(protokoll.toene).toEqual([]);
    expect(protokoll.vibrationen).toEqual([[100, 100, 100], [200]]);
  });

  it('Vibration aus: keine Vibration, Ton weiter', () => {
    audioAttrappe();
    vibrationAttrappe();
    render(<TimerAnsicht />);
    fireEvent.click(schalter('Vibration'));
    expect(schalter('Vibration')).not.toBeChecked();

    starte();
    vergeheMitTakt(40_000);
    expect(protokoll.vibrationen).toEqual([]);
    expect(protokoll.toene).toEqual([440, 880, 880]);
  });

  it('Umschalten während des Laufs wirkt beim nächsten Wechsel; Einschalten des Tons entsperrt ihn', () => {
    audioAttrappe();
    vibrationAttrappe();
    localStorage.setItem(SIGNAL_SPEICHER_SCHLUESSEL, JSON.stringify({ ton: false, vibration: true }));
    render(<TimerAnsicht />);
    starte();
    expect(protokoll.kontexte).toBe(0);

    vergeheMitTakt(30_000);
    expect(protokoll.toene).toEqual([]);

    fireEvent.click(schalter('Ton'));
    expect(protokoll.kontexte).toBe(1);
    expect(protokoll.resume).toBe(1);
    fireEvent.click(schalter('Vibration'));

    vergeheMitTakt(10_000);
    expect(protokoll.toene).toEqual([880, 880]);
    expect(protokoll.vibrationen).toEqual([[100, 100, 100]]);
  });

  it('Zustand der Schalter bleibt nach Neuladen erhalten, Timer-Einstellung unberührt', () => {
    audioAttrappe();
    vibrationAttrappe();
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify({ trainingSekunden: 45, pauseSekunden: 15 }));
    const { unmount } = render(<TimerAnsicht />);
    fireEvent.click(schalter('Ton'));
    expect(JSON.parse(localStorage.getItem(SIGNAL_SPEICHER_SCHLUESSEL)!)).toEqual({ ton: false, vibration: true });
    unmount();

    render(<TimerAnsicht />);
    expect(schalter('Ton')).not.toBeChecked();
    expect(schalter('Vibration')).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Training in Sekunden' })).toHaveValue('45');
    expect(JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)).toEqual({
      trainingSekunden: 45,
      pauseSekunden: 15,
    });
  });

  it('ohne Vibrations-API: Schalter deaktiviert, aus, mit Hinweis; gespeicherter Wert bleibt', () => {
    audioAttrappe();
    localStorage.setItem(SIGNAL_SPEICHER_SCHLUESSEL, JSON.stringify({ ton: true, vibration: true }));
    render(<TimerAnsicht />);
    expect(schalter('Vibration')).toBeDisabled();
    expect(schalter('Vibration')).not.toBeChecked();
    expect(schalter('Vibration')).toHaveAccessibleDescription('Dieser Browser unterstützt keine Vibration.');
    expect(screen.getByText('Dieser Browser unterstützt keine Vibration.')).toBeVisible();
    expect(schalter('Ton')).toBeEnabled();

    fireEvent.click(schalter('Ton'));
    expect(JSON.parse(localStorage.getItem(SIGNAL_SPEICHER_SCHLUESSEL)!)).toEqual({ ton: false, vibration: true });
  });
});

describe('Sichtbares Signal', () => {
  it('Text und Farbe je Phase, aria-live polite; bereit leer; angehalten', () => {
    render(<TimerAnsicht />);
    expect(signal()).toHaveAttribute('aria-live', 'polite');
    expect(signal()).toHaveTextContent(/^$/);
    expect(signal()).toHaveAttribute('data-signal', 'leer');
    expect(signal()).toBeVisible();

    starte();
    expect(signal()).toHaveTextContent('Training, Runde 1');
    expect(signal()).toHaveAttribute('data-signal', 'training');

    vergeheMitTakt(30_000);
    expect(signal()).toHaveTextContent('Pause, Runde 1');
    expect(signal()).toHaveAttribute('data-signal', 'pause');
    expect(signal()).not.toHaveClass('nur-screenreader');

    fireEvent.click(screen.getByRole('button', { name: 'Anhalten' }));
    expect(signal()).toHaveTextContent('Angehalten');
    expect(signal()).toHaveAttribute('data-signal', 'angehalten');

    starte();
    vergeheMitTakt(10_000);
    expect(signal()).toHaveTextContent('Training, Runde 2');
    expect(signal()).toHaveAttribute('data-signal', 'training');
  });

  it('keine doppelte Ansage: genau eine Live-Region in der Ansicht', () => {
    render(<TimerAnsicht />);
    starte();
    vergeheMitTakt(30_000);
    const ansicht = screen.getByRole('region', { name: 'Intervalltimer' });
    const liveRegionen = ansicht.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]');
    expect(liveRegionen).toHaveLength(1);
    expect(liveRegionen[0]).toBe(signal());
    // Die Restzeit (role="timer") ist nicht live, sonst käme jede Sekunde eine Ansage.
    expect(screen.getByRole('timer')).not.toHaveAttribute('aria-live');
  });

  it('nach dem Hintergrund: ein Signal für den letzten Wechsel, nicht für jeden verpassten', () => {
    audioAttrappe();
    vibrationAttrappe();
    render(<TimerAnsicht />);
    starte();
    imHintergrund(47_000);
    expect(signal()).toHaveTextContent('Training, Runde 2');
    expect(protokoll.toene).toEqual([880, 880]);
    expect(protokoll.vibrationen).toEqual([[200]]);
    vergeheMitTakt(10 * TAKT_MS);
    expect(protokoll.vibrationen).toEqual([[200]]);
  });
});

describe('Fehlertoleranz: Timer und sichtbares Signal laufen weiter', () => {
  const FAELLE = [
    { titel: 'kein AudioContext, keine Vibrations-API', vorbereiten: () => {} },
    { titel: 'resume() wird abgelehnt', vorbereiten: () => audioAttrappe('abgelehnt') },
    {
      titel: 'vibrate wirft',
      vorbereiten: () => {
        audioAttrappe();
        vibrationAttrappe('wirft');
      },
    },
  ];

  for (const { titel, vorbereiten } of FAELLE) {
    it(titel, async () => {
      vorbereiten();
      render(<TimerAnsicht />);
      starte();
      vergeheMitTakt(31_000);
      expect(signal()).toHaveTextContent('Pause, Runde 1');
      expect(screen.getByRole('timer')).toHaveTextContent('00:09');
      vergeheMitTakt(10_000);
      expect(signal()).toHaveTextContent('Training, Runde 2');
      expect(screen.getByRole('timer')).toHaveTextContent('00:29');
      // Abgelehnte Versprechen auslaufen lassen (unbehandelte meldet Vitest als Fehler)
      await act(async () => {
        await Promise.resolve();
      });
    });
  }
});
