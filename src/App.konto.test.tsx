import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { erzeugeKontoSteuerung } from './konto/steuerung';
import { fakeApi, fakePasskeyBrowser, httpFehler, netzFehler } from './test/fakeKonto';
import { TAKT_MS } from './timer/useTimer';

/*
 * Umschalten zwischen Timer und Konto (C-03). Der Timer muss beim Wechsel
 * weiterlaufen, darf nicht zurückgesetzt werden und keine Signale verlieren;
 * er braucht weder Anmeldung noch Server. Die Uhr steuert Vitest, Vibration
 * ist eine Attrappe (wie in TimerAnsicht.signal.test.tsx).
 */

const START = new Date('2026-11-18T10:00:00Z').getTime();
let vibrationen: number[][];

/** Jeder Takt in einem eigenen act(), damit React jeden Takt zeichnet. */
function vergeheMitTakt(ms: number) {
  for (let i = 0; i < ms / TAKT_MS; i++) {
    act(() => {
      vi.advanceTimersByTime(TAKT_MS);
    });
  }
}

/** Offene Promises (Attrappen der API) abarbeiten. */
async function warteAufPromises() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function aufbau(api = fakeApi()) {
  const steuerung = erzeugeKontoSteuerung({ api, passkeys: fakePasskeyBrowser(), istOffline: () => false });
  render(<App kontoSteuerung={steuerung} />);
  return { api, steuerung };
}

const navigation = () => screen.getByRole('navigation', { name: 'Ansicht' });
const zuKonto = () => fireEvent.click(screen.getByRole('button', { name: 'Konto' }));
const zuTimer = () => fireEvent.click(screen.getByRole('button', { name: 'Timer' }));

beforeEach(() => {
  localStorage.clear();
  vibrationen = [];
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (muster: number[]) => {
      vibrationen.push(muster);
      return true;
    },
  });
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
  delete (navigator as { vibrate?: unknown }).vibrate;
  localStorage.clear();
});

describe('App: Umschalten zwischen Timer und Konto', () => {
  it('Timer ist die erste Ansicht; Konto wird erst beim Öffnen geladen', () => {
    const { api } = aufbau();
    expect(screen.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Timer' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Konto' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('heading', { name: 'Konto' })).not.toBeInTheDocument();
    expect(api.passkeys).not.toHaveBeenCalled();
  });

  it('die Navigation steht im DOM hinter dem Timer: Start bleibt das erste Bedienelement', () => {
    aufbau();
    const start = screen.getByRole('button', { name: 'Start' });
    expect(start.compareDocumentPosition(navigation()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Wechsel setzt den Fokus auf die Überschrift der neuen Ansicht', async () => {
    const { api } = aufbau();
    zuKonto();
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Konto' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: 'Intervalltimer' })).not.toBeInTheDocument();
    await warteAufPromises();
    expect(api.passkeys).toHaveBeenCalledTimes(1);

    zuTimer();
    expect(screen.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toHaveFocus();
    expect(screen.queryByRole('heading', { name: 'Konto' })).not.toBeInTheDocument();
  });

  it('laufender Timer läuft in der Konto-Ansicht weiter, ohne Zurücksetzen und mit Signalen', async () => {
    aufbau();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(20_000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:10');

    zuKonto();
    await warteAufPromises();
    // 15 s in der Konto-Ansicht: Wechsel zu Pause nach 10 s, Signal kommt trotzdem.
    vergeheMitTakt(15_000);
    expect(vibrationen).toEqual([[100, 100, 100]]);

    zuTimer();
    expect(screen.getByRole('timer')).toHaveTextContent('00:05');
    expect(screen.getByRole('status')).toHaveTextContent('Pause, Runde 1');
    expect(screen.getByRole('button', { name: 'Anhalten' })).toBeInTheDocument();

    vergeheMitTakt(5_000);
    expect(vibrationen).toEqual([[100, 100, 100], [200]]);
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 2');
  });

  it('angehaltener Timer bleibt angehalten, Einstellung bleibt erhalten', async () => {
    aufbau();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(3_000);
    fireEvent.click(screen.getByRole('button', { name: 'Anhalten' }));
    zuKonto();
    await warteAufPromises();
    vergeheMitTakt(10_000);
    zuTimer();
    expect(screen.getByRole('timer')).toHaveTextContent('00:27');
    expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeInTheDocument();
  });

  it('ohne erreichbaren Server: Konto zeigt den Fehler, der Timer funktioniert', async () => {
    const api = fakeApi();
    api.passkeys.mockRejectedValue(netzFehler());
    aufbau(api);
    zuKonto();
    await warteAufPromises();
    expect(screen.getByRole('alert')).toHaveTextContent('Der Server ist gerade nicht erreichbar.');

    zuTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(2_000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:28');
    expect(screen.getByRole('status')).toHaveTextContent('Training, Runde 1');
  });

  it('ohne Anmeldung (401) läuft der Timer ebenso', async () => {
    const api = fakeApi();
    api.passkeys.mockRejectedValue(httpFehler(401, 'NICHT_ANGEMELDET'));
    aufbau(api);
    zuKonto();
    await warteAufPromises();
    expect(screen.getByRole('heading', { level: 3, name: 'Registrieren' })).toBeInTheDocument();
    zuTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    vergeheMitTakt(1_000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:29');
  });
});
