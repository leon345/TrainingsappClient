import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { SPEICHER_SCHLUESSEL } from './einstellung';
import { TimerAnsicht } from './TimerAnsicht';
import { TAKT_MS } from './useTimer';

/*
 * Oberflächentests mit kontrollierter Uhr: Vitest ersetzt Date und
 * setInterval. "Tab im Hintergrund" heißt: Die Systemzeit springt, ohne dass
 * ein Takt läuft (vi.setSystemTime statt advanceTimersByTime).
 */

const START = new Date('2026-11-18T10:00:00Z').getTime();

function zeit() {
  return screen.getByRole('timer');
}

function vergeheMitTakt(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Zeit vergeht ohne Takte, danach wird die Seite wieder sichtbar. */
function imHintergrund(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('TimerAnsicht: Einstellung', () => {
  it('zeigt ohne gespeicherte Einstellung 30 s Training und 10 s Pause (E20)', () => {
    render(<TimerAnsicht />);
    expect(screen.getByRole('textbox', { name: 'Training in Sekunden' })).toHaveValue('30');
    expect(screen.getByRole('textbox', { name: 'Pause in Sekunden' })).toHaveValue('10');
    expect(zeit()).toHaveTextContent('00:30');
    expect(zeit()).toHaveAccessibleName('Restzeit 30 Sekunden');
  });

  it('Hilfetext nennt Grenzen und Dauer in Worten', () => {
    render(<TimerAnsicht />);
    expect(screen.getByRole('textbox', { name: 'Training in Sekunden' })).toHaveAccessibleDescription(
      '1 bis 86400, entspricht 30 Sekunden.',
    );
    expect(screen.getByRole('textbox', { name: 'Pause in Sekunden' })).toHaveAccessibleDescription(
      '0 bis 86400, 0 = keine Pause, entspricht 10 Sekunden.',
    );
  });

  it('lädt die gespeicherte Einstellung', () => {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify({ trainingSekunden: 3600, pauseSekunden: 0 }));
    render(<TimerAnsicht />);
    expect(screen.getByRole('textbox', { name: 'Training in Sekunden' })).toHaveValue('3600');
    expect(zeit()).toHaveTextContent('1:00:00');
    expect(zeit()).toHaveAccessibleName('Restzeit 1 Stunde');
  });

  it('übernimmt eine Änderung, speichert sie lokal und zeigt sie an', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TimerAnsicht />);
    const training = screen.getByRole('textbox', { name: 'Training in Sekunden' });

    await user.clear(training);
    await user.type(training, '90{Enter}');

    expect(zeit()).toHaveTextContent('01:30');
    expect(JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)).toEqual({
      trainingSekunden: 90,
      pauseSekunden: 10,
    });
  });

  it('Werte außerhalb der Grenzen werden auf die Grenze gesetzt', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TimerAnsicht />);
    const training = screen.getByRole('textbox', { name: 'Training in Sekunden' });
    const pause = screen.getByRole('textbox', { name: 'Pause in Sekunden' });

    await user.clear(training);
    await user.type(training, '0');
    await user.clear(pause);
    await user.type(pause, '999999');
    await user.tab();

    expect(training).toHaveValue('1');
    expect(pause).toHaveValue('86400');
    expect(JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)).toEqual({
      trainingSekunden: 1,
      pauseSekunden: 86400,
    });
  });

  it('ein geleertes Feld behält den bisherigen Wert', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TimerAnsicht />);
    const pause = screen.getByRole('textbox', { name: 'Pause in Sekunden' });

    await user.clear(pause);
    await user.tab();

    expect(pause).toHaveValue('10');
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
  });

  it('Einstellung ist während des Laufs gesperrt', () => {
    render(<TimerAnsicht />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('textbox', { name: 'Training in Sekunden' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Pause in Sekunden' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Pause in Sekunden' })).toHaveAccessibleDescription(
      /Zum Ändern zurücksetzen\.$/,
    );
  });
});

describe('TimerAnsicht: Ablauf', () => {
  it('Start, Phasenwechsel, nächste Runde', () => {
    render(<TimerAnsicht />);
    expect(screen.getByText('Bereit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Anhalten' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 1');

    vergeheMitTakt(1000);
    expect(zeit()).toHaveTextContent('00:29');

    vergeheMitTakt(29_000);
    expect(zeit()).toHaveTextContent('00:10');
    expect(screen.getByRole('status')).toHaveTextContent('Pause, Runde 1');
    expect(screen.getByRole('progressbar', { name: 'Fortschritt Pause' })).toBeInTheDocument();

    vergeheMitTakt(10_000);
    expect(zeit()).toHaveTextContent('00:30');
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 2');
    expect(screen.getByText('Runde 2')).toBeInTheDocument();
  });

  it('Anhalten friert die Zeit ein, Fortsetzen läuft weiter', () => {
    render(<TimerAnsicht />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(5000);
    fireEvent.click(screen.getByRole('button', { name: 'Anhalten' }));
    expect(screen.getByRole('status')).toHaveTextContent('Angehalten');
    expect(screen.getByText('Runde 1 · angehalten')).toBeInTheDocument();

    vergeheMitTakt(60_000);
    imHintergrund(600_000);
    expect(zeit()).toHaveTextContent('00:25');

    fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }));
    vergeheMitTakt(2000);
    expect(zeit()).toHaveTextContent('00:23');
  });

  it('Zurücksetzen führt zu Bereit und setzt den Fokus auf Start', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TimerAnsicht />);
    const zuruecksetzen = screen.getByRole('button', { name: 'Zurücksetzen' });
    expect(zuruecksetzen).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(zuruecksetzen).toBeEnabled();
    await user.click(zuruecksetzen);

    expect(zeit()).toHaveTextContent('00:30');
    expect(screen.getByText('Bereit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Training in Sekunden' })).toBeEnabled();
  });

  it('per Tastatur bedienbar: Enter startet, Leertaste hält an, Fokus bleibt', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<TimerAnsicht />);

    await user.tab();
    const haupt = screen.getByRole('button', { name: 'Start' });
    expect(haupt).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(haupt).toHaveAccessibleName('Anhalten');
    expect(haupt).toHaveFocus();
    await user.keyboard(' ');
    expect(haupt).toHaveAccessibleName('Fortsetzen');
    expect(haupt).toHaveFocus();
  });

  it('Tab länger im Hintergrund als eine ganze Phase: Anzeige stimmt sofort', () => {
    render(<TimerAnsicht />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    imHintergrund(47_000);

    expect(zeit()).toHaveTextContent('00:23');
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 2');
  });

  it('Pause 0: nur Training, Runden zählen weiter', () => {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify({ trainingSekunden: 5, pauseSekunden: 0 }));
    render(<TimerAnsicht />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    vergeheMitTakt(5000);
    expect(zeit()).toHaveTextContent('00:05');
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 2');
    expect(screen.queryByText('Pause')).toBeNull();
  });

  it('lange Dauer: Anzeige h:mm:ss', () => {
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({ trainingSekunden: 86_400, pauseSekunden: 10 }),
    );
    render(<TimerAnsicht />);
    expect(zeit()).toHaveTextContent('24:00:00');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(TAKT_MS);
    expect(zeit()).toHaveTextContent('24:00:00');
    imHintergrund(3 * 3600 * 1000);
    expect(zeit()).toHaveTextContent('21:00:00');
    expect(zeit()).toHaveAccessibleName('Restzeit 21 Stunden');
  });
});

/*
 * Ergänzungen C-09: Zustände und Übergänge, die oben nicht geprüft werden.
 */
describe('TimerAnsicht: Sperre und Zurücksetzen (C-09)', () => {
  it('Einstellung bleibt auch angehalten gesperrt, erst Zurücksetzen gibt sie frei', () => {
    render(<TimerAnsicht />);
    const training = screen.getByRole('textbox', { name: 'Training in Sekunden' });
    const pause = screen.getByRole('textbox', { name: 'Pause in Sekunden' });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Anhalten' }));

    // Angehalten: Eine Änderung würde Phase und Runde des laufenden Durchgangs verschieben.
    expect(training).toBeDisabled();
    expect(pause).toBeDisabled();
    expect(training).toHaveAccessibleDescription(/Zum Ändern zurücksetzen\.$/);

    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(training).toBeEnabled();
    expect(pause).toBeEnabled();
    expect(training).toHaveAccessibleDescription('1 bis 86400, entspricht 30 Sekunden.');
  });

  it('nach Zurücksetzen beginnt der nächste Lauf bei 0 mit der neuen Einstellung', () => {
    render(<TimerAnsicht />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(12_000);
    fireEvent.click(screen.getByRole('button', { name: 'Anhalten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));

    // Eingabe und Übernahme beim Verlassen des Felds (userEvent wartet mit
    // stillstehender Uhr endlos, daher fireEvent).
    const training = screen.getByRole('textbox', { name: 'Training in Sekunden' });
    fireEvent.focus(training);
    fireEvent.change(training, { target: { value: '20' } });
    fireEvent.blur(training);
    expect(zeit()).toHaveTextContent('00:20');

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(5000);
    // Ohne Rücksetzen der Laufzeit stünde hier 00:03 (12 s + 5 s von 20 s).
    expect(zeit()).toHaveTextContent('00:15');
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 1');

    vergeheMitTakt(15_000);
    expect(screen.getByRole('status')).toHaveTextContent('Pause, Runde 1');
    expect(zeit()).toHaveTextContent('00:10');
  });
});

describe('TimerAnsicht: Fortschritt und Ansage (C-09)', () => {
  it('Fortschrittsanzeige folgt der Phase und beginnt bei jedem Wechsel bei 0', () => {
    render(<TimerAnsicht />);
    const fortschritt = (name: string) => screen.getByRole('progressbar', { name });

    expect(fortschritt('Fortschritt Training')).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(15_000);
    expect(fortschritt('Fortschritt Training')).toHaveAttribute('aria-valuenow', '50');
    expect(fortschritt('Fortschritt Training')).toHaveAttribute('aria-valuetext', '50 %');

    vergeheMitTakt(15_000);
    expect(fortschritt('Fortschritt Pause')).toHaveAttribute('aria-valuenow', '0');

    vergeheMitTakt(2500);
    expect(fortschritt('Fortschritt Pause')).toHaveAttribute('aria-valuenow', '25');
  });

  it('Live-Ansage ändert sich nur beim Phasenwechsel, nicht mit jeder Sekunde', () => {
    render(<TimerAnsicht />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    // Jeden Takt der ersten Runde mitschreiben, was die Live-Region enthält.
    const ansagen: string[] = [];
    for (let ms = 0; ms < 40_000; ms += TAKT_MS) {
      const text = screen.getByRole('status').textContent ?? '';
      if (ansagen.at(-1) !== text) ansagen.push(text);
      vergeheMitTakt(TAKT_MS);
    }
    expect(ansagen).toEqual(['Training, Runde 1', 'Pause, Runde 1']);
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 2');
  });
});

describe('App', () => {
  it('Startseite ist der Timer', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });
});
