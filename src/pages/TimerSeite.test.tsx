import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { erzeugeApiClient, type BenutzerV1 } from '../api/client';
import { App } from '../App';
import { AuthProvider } from '../konto/AuthContext';
import type { PhasenSignal } from '../timer/phasenSignal';
import { erstelleLokalenTimerSpeicher } from '../timer/speicher';
import { TimerSeite } from './TimerSeite';

const SYNC_BENUTZER: BenutzerV1 = {
  id: '22222222-2222-2222-2222-222222222222',
  benutzername: 'timer.tester',
  rolle: 'USER',
  erstelltAm: '2026-11-19T12:00:00Z',
  einwilligungAm: '2026-11-19T12:00:00Z',
};

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

describe('TimerSeite (Komponente & Verhalten)', () => {
  const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    if (originalVibrate) {
      Object.defineProperty(navigator, 'vibrate', originalVibrate);
    } else {
      Reflect.deleteProperty(navigator, 'vibrate');
    }
  });

  it('zeigt Standarddauer, aria-label, aria-live-Status und begrenzt ungültige Eingaben beim Verlassen', async () => {
    const user = userEvent.setup();
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);

    render(<TimerSeite timerOptionen={{ speicher }} />);

    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('00:30');
    expect(timer).toHaveAttribute('aria-label', '30 Sekunden');

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Bereit');

    const trainingFeld = screen.getByLabelText('Training (Sekunden)');
    const pauseFeld = screen.getByLabelText('Pause (Sekunden)');

    await user.clear(trainingFeld);
    await user.type(trainingFeld, '0');
    await user.tab();
    expect(trainingFeld).toHaveValue(1);
    expect(screen.getByRole('timer')).toHaveTextContent('00:01');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '1 Sekunde');

    await user.clear(trainingFeld);
    await user.type(trainingFeld, '99999');
    await user.tab();
    expect(trainingFeld).toHaveValue(86400);
    expect(screen.getByRole('timer')).toHaveTextContent('24:00:00');
    expect(screen.getByRole('timer')).toHaveAttribute('aria-label', '24 Stunden');

    await user.clear(pauseFeld);
    await user.type(pauseFeld, '-5');
    await user.tab();
    expect(pauseFeld).toHaveValue(0);
    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 86400, pauseSekunden: 0 });
  });

  it('löst Phasensignale pro Übergang exakt einmal aus und holt im Hintergrund verpasste Wechsel nicht nach', () => {
    vi.useFakeTimers();
    let aktuelleZeit = 1_000_000;
    const uhr = () => aktuelleZeit;

    const signal: PhasenSignal = {
      entsperren: vi.fn(),
      ausloesen: vi.fn(),
    };
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);
    speicher.speichereEinstellung({ trainingSekunden: 5, pauseSekunden: 3 });

    render(<TimerSeite timerOptionen={{ speicher, uhr, phasenSignal: signal }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(signal.entsperren).toHaveBeenCalledTimes(1);
    expect(signal.ausloesen).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Training – Runde 1');

    // 4 s vergehen in 250-ms-Schritten -> noch kein Phasenwechsel
    for (let i = 0; i < 16; i += 1) {
      aktuelleZeit += 250;
      act(() => {
        vi.advanceTimersByTime(250);
      });
    }
    expect(signal.ausloesen).not.toHaveBeenCalled();
    expect(screen.getByRole('timer')).toHaveTextContent('00:01');

    // Übergang Training -> Pause: exakt EIN Signal, Folgetakte lösen nichts weiter aus
    aktuelleZeit += 1_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(signal.ausloesen).toHaveBeenCalledTimes(1);
    expect(signal.ausloesen).toHaveBeenLastCalledWith('pause');
    expect(screen.getByRole('status')).toHaveTextContent('Pause – Runde 1');

    aktuelleZeit += 500;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(signal.ausloesen).toHaveBeenCalledTimes(1);

    // Langer Hintergrund-Zeitsprung über mehrere Phasen (24 s = 3 volle 8-s-Zyklen + 0 s -> landet in Pause Runde 4)
    aktuelleZeit += 24_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    // Nur EIN Signal für den letzten Phasenwechsel, keine Nachholung verpasster Wechsel!
    expect(signal.ausloesen).toHaveBeenCalledTimes(2);
    expect(signal.ausloesen).toHaveBeenLastCalledWith('pause');
    expect(screen.getByRole('status')).toHaveTextContent('Pause – Runde 4');

    // Pause und Zurücksetzen lösen KEIN Phasensignal aus
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(signal.ausloesen).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent(/Pausiert/);

    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    expect(signal.ausloesen).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('Bereit');
  });

  it('deaktiviert den Vibrationsschalter mit Hinweis, wenn navigator.vibrate fehlt, und entsperrt Ton beim Einschalten', async () => {
    const user = userEvent.setup();
    Reflect.deleteProperty(navigator, 'vibrate');

    const signal: PhasenSignal = {
      entsperren: vi.fn(),
      ausloesen: vi.fn(),
    };
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);

    render(<TimerSeite timerOptionen={{ speicher, phasenSignal: signal }} />);

    const tonSchalter = screen.getByRole('switch', { name: /Ton bei Phasenwechsel/i });
    const vibrationSchalter = screen.getByRole('switch', { name: /Vibration bei Phasenwechsel/i });

    expect(tonSchalter).toBeChecked();
    expect(vibrationSchalter).toBeDisabled();
    expect(
      screen.getByText(/Vibration wird von diesem Browser oder Gerät nicht unterstützt/i),
    ).toBeVisible();

    await user.click(tonSchalter);
    expect(tonSchalter).not.toBeChecked();
    expect(speicher.ladeSignale().tonAktiv).toBe(false);

    await user.click(tonSchalter);
    expect(tonSchalter).toBeChecked();
    expect(signal.entsperren).toHaveBeenCalledTimes(1);
    expect(speicher.ladeSignale().tonAktiv).toBe(true);
  });

  it('hält einen laufenden Timer beim Wechsel auf andere Routen aktiv', () => {
    vi.useFakeTimers({ now: 10_000 });

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('status')).toHaveTextContent('Training – Runde 1');

    // Auf Workouts wechseln
    fireEvent.click(within(nav).getByRole('link', { name: 'Workouts' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();

    // 10 Sekunden verstreichen während wir auf /workouts sind
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Zurück zum Timer: Zeit ist exakt weitergelaufen (30 - 10 = 20 s)
    fireEvent.click(within(nav).getByRole('link', { name: 'Timer' }));
    expect(screen.getByRole('timer')).toHaveTextContent('00:20');
    expect(screen.getByRole('status')).toHaveTextContent('Training – Runde 1');
  });

  it('uebernimmt gespeicherte Server-Einstellung bei Login (gespeichert=true) und synchronisiert Aenderungen per PUT', async () => {
    const user = userEvent.setup();
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);
    const putBodies: unknown[] = [];

    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.method === 'GET' && request.url.endsWith('/v1/timer/einstellung')) {
        return new Response(
          JSON.stringify({ trainingSekunden: 45, pauseSekunden: 15, gespeichert: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (request.method === 'PUT' && request.url.endsWith('/v1/timer/einstellung')) {
        const body = (await request.clone().json()) as {
          trainingSekunden: number;
          pauseSekunden: number;
        };
        putBodies.push(body);
        return new Response(JSON.stringify({ ...body, gespeichert: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 404 });
    });

    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <AuthProvider client={client} initialBenutzer={SYNC_BENUTZER} automatischLaden={false}>
        <TimerSeite timerOptionen={{ speicher }} />
      </AuthProvider>,
    );

    // Server-Werte (45/15) werden in Anzeige, Eingabefelder und lokalen Speicher übernommen
    await waitFor(() => {
      expect(screen.getByRole('timer')).toHaveTextContent('00:45');
    });
    expect(screen.getByLabelText('Training (Sekunden)')).toHaveValue(45);
    expect(screen.getByLabelText('Pause (Sekunden)')).toHaveValue(15);
    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 45, pauseSekunden: 15 });
    expect(putBodies).toHaveLength(0);

    // Änderung durch Nutzer speichert lokal und sendet PUT /v1/timer/einstellung
    const pauseFeld = screen.getByLabelText('Pause (Sekunden)');
    await user.clear(pauseFeld);
    await user.type(pauseFeld, '20');
    await user.tab();

    await waitFor(() => {
      expect(putBodies.at(-1)).toEqual({ trainingSekunden: 45, pauseSekunden: 20 });
    });
    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 45, pauseSekunden: 20 });
  });

  it('behaelt lokale Timer-Werte bei gespeichert=false und zeigt bei Offline-PUT einen dezenten Hinweis', async () => {
    const user = userEvent.setup();
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);
    speicher.speichereEinstellung({ trainingSekunden: 50, pauseSekunden: 12 });

    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.method === 'GET' && request.url.endsWith('/v1/timer/einstellung')) {
        return new Response(
          JSON.stringify({ trainingSekunden: 30, pauseSekunden: 10, gespeichert: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (request.method === 'PUT' && request.url.endsWith('/v1/timer/einstellung')) {
        throw new TypeError('Failed to fetch');
      }
      return new Response(null, { status: 404 });
    });

    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <AuthProvider client={client} initialBenutzer={SYNC_BENUTZER} automatischLaden={false}>
        <TimerSeite timerOptionen={{ speicher }} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    // Lokale Werte (50/12) bleiben bei gespeichert=false unangetastet
    expect(screen.getByRole('timer')).toHaveTextContent('00:50');
    expect(screen.getByLabelText('Training (Sekunden)')).toHaveValue(50);
    expect(screen.getByLabelText('Pause (Sekunden)')).toHaveValue(12);

    // Offline-PUT: lokal sofort gespeichert + dezenter Hinweis, Timer bleibt lokal voll nutzbar
    const trainingFeld = screen.getByLabelText('Training (Sekunden)');
    await user.clear(trainingFeld);
    await user.type(trainingFeld, '60');
    await user.tab();

    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 60, pauseSekunden: 12 });
    await waitFor(() => {
      expect(screen.getByText(/lokal gespeichert.*nicht mit dem Server synchronisiert/i)).toBeVisible();
    });

    // Timer startet trotz Offline-Fehler normal
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('status')).toHaveTextContent('Training – Runde 1');
  });

  it('sendet keine Timer-Sync-Anfragen, wenn kein Benutzer angemeldet ist', async () => {
    const user = userEvent.setup();
    const raw = erstelleMemoryStorage();
    const speicher = erstelleLokalenTimerSpeicher(() => raw);
    const mockFetch = vi.fn<typeof fetch>();
    const client = erzeugeApiClient({ baseUrl: 'http://localhost:4173', fetch: mockFetch });

    render(
      <AuthProvider client={client} initialStatus="abgemeldet" automatischLaden={false}>
        <TimerSeite timerOptionen={{ speicher }} />
      </AuthProvider>,
    );

    const trainingFeld = screen.getByLabelText('Training (Sekunden)');
    await user.clear(trainingFeld);
    await user.type(trainingFeld, '40');
    await user.tab();

    expect(speicher.ladeEinstellung()).toEqual({ trainingSekunden: 40, pauseSekunden: 10 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
