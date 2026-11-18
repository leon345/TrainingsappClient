import { expect, test, type Locator, type Page } from '@playwright/test';
import { halteUhrAn } from './uhr';

/*
 * Phasensignale (C-17, E33) in allen vier funktionalen Projekten gegen den
 * Produktions-Build. Web Audio und navigator.vibrate werden per Init-Skript
 * durch Attrappen ersetzt, die jeden Aufruf mitschreiben. Ob Ton und
 * Vibration auf echten Geräten hör- bzw. spürbar sind, prüfen diese Tests
 * NICHT (offen für C-01b). Die Uhr steht nach dem Laden (e2e/uhr.ts).
 */

const START = new Date('2026-11-18T10:00:00Z');

type AudioModus = 'ok' | 'abgelehnt' | 'fehlt';
type VibrationModus = 'ok' | 'wirft' | 'fehlt';

interface Protokoll {
  kontexte: number;
  resume: number;
  toene: number[];
  vibrationen: number[][];
}

async function attrappen(page: Page, audio: AudioModus, vibration: VibrationModus) {
  await page.addInitScript(
    ({ audio, vibration }) => {
      const protokoll = { kontexte: 0, resume: 0, toene: [] as number[], vibrationen: [] as number[][] };
      (window as unknown as { signalProtokoll: typeof protokoll }).signalProtokoll = protokoll;
      const fenster = window as unknown as Record<string, unknown>;

      if (audio === 'fehlt') {
        delete fenster.AudioContext;
        delete fenster.webkitAudioContext;
      } else {
        class AttrappeAudioContext {
          state = 'suspended';
          currentTime = 0;
          destination = {};
          constructor() {
            protokoll.kontexte++;
          }
          resume() {
            protokoll.resume++;
            if (audio === 'abgelehnt') return Promise.reject(new DOMException('nein', 'NotAllowedError'));
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
        fenster.AudioContext = AttrappeAudioContext;
        delete fenster.webkitAudioContext;
      }

      const ziel = Navigator.prototype as unknown as Record<string, unknown>;
      if (vibration === 'fehlt') {
        delete ziel.vibrate;
        delete (navigator as unknown as Record<string, unknown>).vibrate;
      } else {
        Object.defineProperty(ziel, 'vibrate', {
          configurable: true,
          writable: true,
          value: (muster: number[]) => {
            if (vibration === 'wirft') throw new TypeError('kaputt');
            protokoll.vibrationen.push([...muster]);
            return true;
          },
        });
      }
    },
    { audio, vibration },
  );
}

const protokoll = (page: Page) =>
  page.evaluate(() => (window as unknown as { signalProtokoll: Protokoll }).signalProtokoll);

async function oeffneTimer(page: Page, audio: AudioModus = 'ok', vibration: VibrationModus = 'ok') {
  await attrappen(page, audio, vibration);
  await page.clock.install({ time: START });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeVisible();
  await halteUhrAn(page, START);
}

/** Antippen auf Touch-Geräten, sonst Klick. */
async function bediene(locator: Locator) {
  const touch = await locator.page().evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) await locator.tap();
  else await locator.click();
}

/** Schalter über seine sichtbare Beschriftung bedienen (das Eingabeelement ist visuell versteckt). */
const beschriftung = (page: Page, name: 'Ton' | 'Vibration') => page.getByText(name, { exact: true });
const schalter = (page: Page, name: 'Ton' | 'Vibration') => page.getByRole('switch', { name });
const signal = (page: Page) => page.getByRole('status');
const zeit = (page: Page) => page.getByRole('timer');

async function stelleEin(page: Page, training: number, pause: number) {
  for (const [name, wert] of [
    ['Training in Sekunden', training],
    ['Pause in Sekunden', pause],
  ] as const) {
    const feld = page.getByRole('textbox', { name });
    await feld.fill(String(wert));
    await feld.press('Enter');
    await expect(feld).toHaveValue(String(wert));
  }
}

test.describe('Phasensignale mit Attrappen', () => {
  test('Pause: ein Ton 440 Hz und [100,100,100]; Training: zwei Töne 880 Hz und [200]; sichtbar mit Text', async ({
    page,
  }) => {
    await oeffneTimer(page);
    await stelleEin(page, 5, 3);
    await bediene(page.getByRole('button', { name: 'Start' }));
    await expect(signal(page)).toHaveText('Training, Runde 1');
    // Start ist kein Wechsel, entsperrt aber den Ton
    expect(await protokoll(page)).toEqual({ kontexte: 1, resume: 1, toene: [], vibrationen: [] });

    await page.clock.runFor(5000);
    await expect(signal(page)).toHaveText('Pause, Runde 1');
    await expect(signal(page)).toHaveAttribute('data-signal', 'pause');
    await expect(signal(page)).toHaveAttribute('aria-live', 'polite');
    expect(await protokoll(page)).toMatchObject({ toene: [440], vibrationen: [[100, 100, 100]] });

    await page.clock.runFor(3000);
    await expect(signal(page)).toHaveText('Training, Runde 2');
    await expect(signal(page)).toHaveAttribute('data-signal', 'training');
    expect(await protokoll(page)).toMatchObject({ toene: [440, 880, 880], vibrationen: [[100, 100, 100], [200]] });
  });

  test('genau ein Signal je Übergang, nach Zeitsprung nur für den letzten Wechsel', async ({ page }) => {
    await oeffneTimer(page);
    await stelleEin(page, 5, 3);
    await bediene(page.getByRole('button', { name: 'Start' }));

    // Drei Runden im Vordergrund, Takt für Takt: 6 Übergänge (Pause, Training, ...)
    await page.clock.runFor(24_000);
    await expect(signal(page)).toHaveText('Training, Runde 4');
    let p = await protokoll(page);
    expect(p.vibrationen).toEqual([[100, 100, 100], [200], [100, 100, 100], [200], [100, 100, 100], [200]]);
    expect(p.toene).toEqual([440, 880, 880, 440, 880, 880, 440, 880, 880]);

    // Weitere Takte in derselben Phase: nichts Neues
    await page.clock.runFor(4000);
    expect((await protokoll(page)).vibrationen).toHaveLength(6);

    // Tab im Hintergrund: von 28 s auf 61 s = Pause in Runde 8, dazwischen 7 Wechsel verpasst
    await page.clock.fastForward(33_000);
    await expect(signal(page)).toHaveText('Pause, Runde 8');
    p = await protokoll(page);
    expect(p.vibrationen).toHaveLength(7);
    expect(p.vibrationen.at(-1)).toEqual([100, 100, 100]);
    expect(p.toene.slice(9)).toEqual([440]);
  });

  test('Pause 0: nur Wechsel zu Training', async ({ page }) => {
    await oeffneTimer(page);
    await stelleEin(page, 4, 0);
    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.runFor(8000);
    await expect(signal(page)).toHaveText('Training, Runde 3');
    expect(await protokoll(page)).toMatchObject({ toene: [880, 880, 880, 880], vibrationen: [[200], [200]] });
  });

  test('Anhalten löst kein Signal aus', async ({ page }) => {
    await oeffneTimer(page);
    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.runFor(10_000);
    await bediene(page.getByRole('button', { name: 'Anhalten' }));
    await expect(signal(page)).toHaveText('Angehalten');
    await page.clock.runFor(60_000);
    expect(await protokoll(page)).toMatchObject({ toene: [], vibrationen: [] });
  });

  test('Ton aus: kein AudioContext, kein Ton; Vibration aus: kein vibrate', async ({ page }) => {
    await oeffneTimer(page);
    await stelleEin(page, 5, 3);
    await bediene(beschriftung(page, 'Ton'));
    await expect(schalter(page, 'Ton')).not.toBeChecked();
    await bediene(page.getByRole('button', { name: 'Start' }));
    await page.clock.runFor(8000);
    await expect(signal(page)).toHaveText('Training, Runde 2');
    expect(await protokoll(page)).toEqual({
      kontexte: 0,
      resume: 0,
      toene: [],
      vibrationen: [[100, 100, 100], [200]],
    });

    await bediene(page.getByRole('button', { name: 'Anhalten' }));
    await bediene(beschriftung(page, 'Vibration'));
    await expect(schalter(page, 'Vibration')).not.toBeChecked();
    await bediene(page.getByRole('button', { name: 'Fortsetzen' }));
    await page.clock.runFor(8000);
    await expect(signal(page)).toHaveText('Training, Runde 3');
    expect((await protokoll(page)).vibrationen).toEqual([[100, 100, 100], [200]]);
    expect((await protokoll(page)).toene).toEqual([]);
  });

  test('Zustand der Schalter bleibt nach Neuladen erhalten', async ({ page }) => {
    await oeffneTimer(page);
    await expect(schalter(page, 'Ton')).toBeChecked();
    await expect(schalter(page, 'Vibration')).toBeChecked();
    await bediene(beschriftung(page, 'Ton'));
    await expect(schalter(page, 'Ton')).not.toBeChecked();

    await page.reload();
    await expect(schalter(page, 'Ton')).not.toBeChecked();
    await expect(schalter(page, 'Vibration')).toBeChecked();

    await bediene(beschriftung(page, 'Ton'));
    await bediene(beschriftung(page, 'Vibration'));
    await page.reload();
    await expect(schalter(page, 'Ton')).toBeChecked();
    await expect(schalter(page, 'Vibration')).not.toBeChecked();
  });

  test('ohne navigator.vibrate: Schalter deaktiviert, aus, Hinweis zugänglich', async ({ page }) => {
    await oeffneTimer(page, 'ok', 'fehlt');
    expect(await page.evaluate(() => 'vibrate' in navigator)).toBe(false);
    const vibration = schalter(page, 'Vibration');
    await expect(vibration).toBeDisabled();
    await expect(vibration).not.toBeChecked();
    await expect(vibration).toHaveAccessibleDescription('Dieser Browser unterstützt keine Vibration.');
    await expect(page.getByText('Dieser Browser unterstützt keine Vibration.')).toBeVisible();
    await expect(schalter(page, 'Ton')).toBeEnabled();
  });

  const FEHLER = [
    { titel: 'AudioContext fehlt', audio: 'fehlt', vibration: 'ok' },
    { titel: 'resume() wird abgelehnt', audio: 'abgelehnt', vibration: 'ok' },
    { titel: 'vibrate wirft', audio: 'ok', vibration: 'wirft' },
    { titel: 'weder AudioContext noch vibrate', audio: 'fehlt', vibration: 'fehlt' },
  ] as const;

  for (const { titel, audio, vibration } of FEHLER) {
    test(`${titel}: Timer läuft korrekt, sichtbares Signal erscheint, kein Seitenfehler`, async ({ page }) => {
      const fehler: string[] = [];
      page.on('pageerror', (f) => fehler.push(f.message));
      await oeffneTimer(page, audio, vibration);
      await bediene(page.getByRole('button', { name: 'Start' }));
      await page.clock.runFor(31_000);
      await expect(signal(page)).toHaveText('Pause, Runde 1');
      await expect(signal(page)).toHaveAttribute('data-signal', 'pause');
      await expect(zeit(page)).toHaveText('00:09');
      await page.clock.runFor(10_000);
      await expect(signal(page)).toHaveText('Training, Runde 2');
      await expect(zeit(page)).toHaveText('00:29');
      if (audio === 'abgelehnt') expect((await protokoll(page)).resume).toBeGreaterThanOrEqual(1);
      expect(fehler).toEqual([]);
    });
  }
});

test('Feature-Detection ohne Attrappen (nur Information, keine Aussage über echte Geräte)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeVisible();
  // Eine echte Nutzeraktion: Klick erzeugt den AudioContext und ruft resume() auf.
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown> & { ergebnis?: Promise<string> };
    document.addEventListener(
      'click',
      () => {
        const Klasse = (w.AudioContext ?? w.webkitAudioContext) as (new () => AudioContext) | undefined;
        if (!Klasse) {
          w.ergebnis = Promise.resolve('kein AudioContext');
          return;
        }
        const kontext = new Klasse();
        w.ergebnis = Promise.race([
          kontext.resume().then(
            () => `resume gewährt (state ${kontext.state})`,
            (f: Error) => `resume abgelehnt (${f.name})`,
          ),
          new Promise<string>((fertig) => setTimeout(() => fertig(`resume offen (state ${kontext.state})`), 2000)),
        ]);
      },
      { once: true },
    );
  });
  await page.getByRole('heading', { level: 2, name: 'Intervalltimer' }).click();
  const audio = await page.evaluate(() => (window as unknown as { ergebnis: Promise<string> }).ergebnis);
  const vibration = await page.evaluate(() => {
    if (typeof navigator.vibrate !== 'function') return 'navigator.vibrate fehlt';
    try {
      return `navigator.vibrate vorhanden, Aufruf nach Klick ergibt ${String(navigator.vibrate([10]))}`;
    } catch (f) {
      return `navigator.vibrate wirft (${(f as Error).name})`;
    }
  });
  const schalterAktiv = await schalter(page, 'Vibration').isEnabled();
  test.info().annotations.push(
    { type: 'audio', description: audio },
    { type: 'vibration', description: vibration },
    { type: 'vibrationsschalter', description: schalterAktiv ? 'aktiv' : 'deaktiviert' },
  );
  // Der Schalter folgt der Feature-Detection.
  expect(schalterAktiv).toBe(!vibration.startsWith('navigator.vibrate fehlt'));
});
