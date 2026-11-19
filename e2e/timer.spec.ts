import { expect, test, type Page } from '@playwright/test';

interface SignalAufzeichnung {
  resumeAufrufe: number;
  toene: Array<{ type: string; frequenzHz: number | null; dauerSekunden: number }>;
  vibrationen: Array<number | number[]>;
}

async function installiereSignalMocks(page: Page) {
  await page.addInitScript(() => {
    const protokoll: SignalAufzeichnung = {
      resumeAufrufe: 0,
      toene: [],
      vibrationen: [],
    };
    (window as unknown as { __signalProtokoll?: SignalAufzeichnung }).__signalProtokoll = protokoll;

    class MockAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 1;
      destination = {};

      resume() {
        protokoll.resumeAufrufe += 1;
        this.state = 'running';
        return Promise.resolve();
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }

      createOscillator() {
        const ton = { type: 'sine', frequenzHz: null as number | null, dauerSekunden: 0 };
        let startZeit = 0;
        protokoll.toene.push(ton);
        return {
          get type() {
            return ton.type;
          },
          set type(wert: string) {
            ton.type = wert;
          },
          frequency: {
            setValueAtTime(hz: number) {
              ton.frequenzHz = hz;
            },
          },
          connect() {},
          start(zeit: number) {
            startZeit = zeit;
          },
          stop(zeit: number) {
            ton.dauerSekunden = Math.round((zeit - startZeit) * 1000) / 1000;
          },
        };
      }

      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            linearRampToValueAtTime() {},
          },
          connect() {},
        };
      }
    }

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: MockAudioContext,
    });

    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: (muster: number | number[]) => {
        protokoll.vibrationen.push(Array.isArray(muster) ? [...muster] : muster);
        return true;
      },
    });
  });
}

async function leseSignalProtokoll(page: Page): Promise<SignalAufzeichnung> {
  return page.evaluate(
    () => (window as unknown as { __signalProtokoll: SignalAufzeichnung }).__signalProtokoll,
  );
}

test.describe('Intervalltimer & Phasensignale (E2E gegen Produktions-Build)', () => {
  test('ändert Einstellungen per Tastatur, begrenzt ungültige Werte und speichert über Reload', async ({
    page,
  }) => {
    await page.goto('/');

    const trainingFeld = page.getByLabel('Training (Sekunden)');
    const pauseFeld = page.getByLabel('Pause (Sekunden)');
    const tonSchalter = page.getByRole('switch', { name: /Ton bei Phasenwechsel/i });

    // Ungültige Eingaben werden beim Verlassen auf Min begrenzt
    await trainingFeld.fill('0');
    await trainingFeld.press('Tab');
    await expect(trainingFeld).toHaveValue('1');
    await expect(page.getByRole('timer')).toHaveText('00:01');

    // Per Tastatur gültige Werte setzen
    await trainingFeld.fill('45');
    await trainingFeld.press('Enter');
    await pauseFeld.fill('15');
    await pauseFeld.press('Enter');

    await expect(page.getByRole('timer')).toHaveText('00:45');
    await expect(page.getByRole('timer')).toHaveAttribute('aria-label', '45 Sekunden');

    // Ton-Schalter ausschalten
    await expect(tonSchalter).toBeChecked();
    await tonSchalter.click();
    await expect(tonSchalter).not.toBeChecked();

    // Nach Reload bleiben Einstellungen und Signal-Schalter erhalten
    await page.reload();
    await expect(page.getByLabel('Training (Sekunden)')).toHaveValue('45');
    await expect(page.getByLabel('Pause (Sekunden)')).toHaveValue('15');
    await expect(page.getByRole('timer')).toHaveText('00:45');
    await expect(page.getByRole('switch', { name: /Ton bei Phasenwechsel/i })).not.toBeChecked();
  });

  test('durchläuft Training -> Pause -> Training mit Ton-, Vibrations- und aria-live-Signalen sowie Pause/Fortsetzen/Reset', async ({
    page,
  }) => {
    const startZeit = new Date('2026-11-19T12:00:00Z').getTime();
    await installiereSignalMocks(page);
    await page.clock.install({ time: startZeit });
    await page.goto('/');
    await page.clock.pauseAt(startZeit + 60_000);

    await page.getByLabel('Training (Sekunden)').fill('5');
    await page.getByLabel('Pause (Sekunden)').fill('3');

    const status = page.getByRole('status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toHaveText('Bereit');

    await page.getByRole('button', { name: 'Start' }).click();
    await expect(status).toHaveText('Training – Runde 1');
    await expect(page.getByRole('timer')).toHaveText('00:05');

    // AudioContext beim Start entsperrt, noch kein Phasensignal ausgelöst
    let protokoll = await leseSignalProtokoll(page);
    expect(protokoll.resumeAufrufe).toBeGreaterThanOrEqual(1);
    expect(protokoll.toene).toHaveLength(0);
    expect(protokoll.vibrationen).toHaveLength(0);

    // 5 s Training ablaufen lassen -> Übergang in Pause
    await page.clock.runFor(5_000);
    await expect(status).toHaveText('Pause – Runde 1');
    await expect(page.getByRole('timer')).toHaveText('00:03');

    protokoll = await leseSignalProtokoll(page);
    expect(protokoll.toene).toEqual([{ type: 'sine', frequenzHz: 440, dauerSekunden: 0.2 }]);
    expect(protokoll.vibrationen).toEqual([[100, 100, 100]]);

    // Weitere 1 s in der Pause -> kein doppeltes Signal
    await page.clock.runFor(1_000);
    await expect(page.getByRole('timer')).toHaveText('00:02');
    protokoll = await leseSignalProtokoll(page);
    expect(protokoll.toene).toHaveLength(1);
    expect(protokoll.vibrationen).toHaveLength(1);

    // Pausieren -> Zeit friert ein, kein Signal
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(status).toHaveText('Pausiert – Pause, Runde 1');
    await page.clock.runFor(10_000);
    await expect(page.getByRole('timer')).toHaveText('00:02');

    // Fortsetzen -> 2 s Restpause ablaufen -> Übergang zu Training Runde 2
    await page.getByRole('button', { name: 'Fortsetzen' }).click();
    await expect(status).toHaveText('Pause – Runde 1');
    await page.clock.runFor(2_000);
    await expect(status).toHaveText('Training – Runde 2');
    await expect(page.getByRole('timer')).toHaveText('00:05');

    protokoll = await leseSignalProtokoll(page);
    expect(protokoll.toene).toEqual([
      { type: 'sine', frequenzHz: 440, dauerSekunden: 0.2 },
      { type: 'sine', frequenzHz: 880, dauerSekunden: 0.12 },
      { type: 'sine', frequenzHz: 880, dauerSekunden: 0.12 },
    ]);
    expect(protokoll.vibrationen).toEqual([[100, 100, 100], [200]]);

    // Zurücksetzen -> Bereit ohne neues Signal
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(status).toHaveText('Bereit');
    await expect(page.getByRole('timer')).toHaveText('00:05');
    protokoll = await leseSignalProtokoll(page);
    expect(protokoll.toene).toHaveLength(3);
    expect(protokoll.vibrationen).toHaveLength(2);
  });

  test('überspringt Pause bei 0 s und signalisiert nach Hintergrund-Zeitsprung nur den letzten Wechsel', async ({
    page,
  }) => {
    const startZeit = new Date('2026-11-19T12:00:00Z').getTime();
    const basisZeit = startZeit + 60_000;
    await installiereSignalMocks(page);
    await page.clock.install({ time: startZeit });
    await page.goto('/');
    await page.clock.pauseAt(basisZeit);

    await page.getByLabel('Training (Sekunden)').fill('4');
    await page.getByLabel('Pause (Sekunden)').fill('0');
    await page.getByRole('button', { name: 'Start' }).click();

    // Nach 4 s sofort Runde 2 Training (ohne Pause)
    await page.clock.runFor(4_000);
    await expect(page.getByRole('status')).toHaveText('Training – Runde 2');
    await expect(page.getByRole('timer')).toHaveText('00:04');

    let protokoll = await leseSignalProtokoll(page);
    expect(protokoll.toene).toHaveLength(2);
    expect(protokoll.vibrationen).toEqual([[200]]);

    // Simulierter Hintergrund-Tab-Sprung um 21 s ohne Zwischentakte (t = +25 s -> Runde 7, 3 s Rest)
    await page.clock.setFixedTime(basisZeit + 25_000);
    await page.clock.runFor(250);

    await expect(page.getByRole('status')).toHaveText('Training – Runde 7');
    await expect(page.getByRole('timer')).toHaveText('00:03');

    // Nur EIN weiterer Phasenwechsel (2× 880 Hz + 1× [200]), keine Nachholung verpasster Runden
    protokoll = await leseSignalProtokoll(page);
    expect(protokoll.toene).toHaveLength(4);
    expect(protokoll.vibrationen).toEqual([[200], [200]]);
  });

  test('behält Restzeit bei Reload im Lauf und bei Routenwechsel exakt bei', async ({ page }) => {
    const startZeit = new Date('2026-11-19T12:00:00Z').getTime();
    const basisZeit = startZeit + 60_000;
    await page.clock.install({ time: startZeit });
    await page.goto('/');
    await page.clock.pauseAt(basisZeit);

    await page.getByLabel('Training (Sekunden)').fill('10');
    await page.getByLabel('Pause (Sekunden)').fill('5');
    await page.getByRole('button', { name: 'Start' }).click();

    await page.clock.runFor(3_000);
    await expect(page.getByRole('timer')).toHaveText('00:07');

    // Routenwechsel zu Workouts und Konto während der Timer läuft
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await nav.getByRole('link', { name: 'Workouts' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();
    await page.clock.runFor(4_000);

    await nav.getByRole('link', { name: 'Konto' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();
    await page.clock.runFor(4_000); // Gesamt 11 s -> in Pause Runde 1 mit 4 s Rest

    await nav.getByRole('link', { name: 'Timer' }).click();
    await expect(page.getByRole('status')).toHaveText('Pause – Runde 1');
    await expect(page.getByRole('timer')).toHaveText('00:04');

    // Reload im laufenden Betrieb nach weiteren 2 s -> exakt 2 s Pause verbleiben
    await page.clock.pauseAt(basisZeit + 13_000);
    await page.reload();
    await expect(page.getByRole('status')).toHaveText('Pause – Runde 1');
    await expect(page.getByRole('timer')).toHaveText('00:02');
  });

  test('funktioniert mit gesperrtem localStorage, fehlender Vibration und ohne horizontales Scrollen bei 360 px', async ({
    page,
  }) => {
    const seitenFehler: Error[] = [];
    page.on('pageerror', (err) => seitenFehler.push(err));

    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Speicher blockiert', 'SecurityError');
        },
      });
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: undefined,
      });
    });

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText('00:30');

    const vibrationSchalter = page.getByRole('switch', { name: /Vibration bei Phasenwechsel/i });
    await expect(vibrationSchalter).toBeDisabled();
    await expect(
      page.getByText(/Vibration wird von diesem Browser oder Gerät nicht unterstützt/i),
    ).toBeVisible();

    await page.getByLabel('Training (Sekunden)').fill('12');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('status')).toHaveText('Training – Runde 1');
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(page.getByRole('status')).toHaveText('Bereit');

    const ueberlauf = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(ueberlauf.scrollWidth).toBeLessThanOrEqual(ueberlauf.clientWidth);
    expect(seitenFehler).toEqual([]);
  });
});
