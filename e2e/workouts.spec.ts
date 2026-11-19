import { expect, test } from '@playwright/test';
import { installiereV1Attrappe, type MockWorkout } from './support/v1Attrappe';

const BEISPIEL_WORKOUT: MockWorkout = {
  id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000001',
  typ: 'KRAFT',
  titel: 'Ganzkörper Basis',
  startZeit: '2026-11-18T17:00:00Z',
  dauerSekunden: 3600,
  notiz: 'Gute Form bei Kniebeugen',
  sichtbarkeit: 'PRIVAT',
  herkunft: 'MANUELL',
  erstelltAm: '2026-11-18T17:00:00Z',
  geaendertAm: '2026-11-18T18:00:00Z',
  version: 1,
  uebungen: [
    {
      id: 'cccccccc-cccc-4aaa-8aaa-000000000001',
      position: 0,
      name: 'Kniebeugen',
      variante: 'High Bar',
      saetze: [
        {
          id: 'dddddddd-dddd-4aaa-8aaa-000000000001',
          position: 0,
          wiederholungen: 8,
          gewichtKg: 80,
          pauseSekunden: 120,
        },
      ],
    },
  ],
};

test.describe('Workout- & Calisthenics-Tracking (Produktions-Build)', () => {
  test.use({ serviceWorkers: 'block' });

  test('zeigt im abgemeldeten Zustand einen klaren Hinweis mit Link zum Konto', async ({ page }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: false });

    await page.goto('/workouts');
    await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();
    await expect(page.getByText(/Anmeldung erforderlich/i)).toBeVisible();
    await page.getByRole('link', { name: /Zum Konto & Anmelden/i }).click();
    await expect(page).toHaveURL(/\/konto$/);
  });

  test('erstellt Kraft- und Calisthenics-Workouts, filtert, bearbeitet mit 409-Konflikt und loescht', async ({
    page,
  }) => {
    const zustand = await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialWorkouts: [BEISPIEL_WORKOUT],
    });

    await page.goto('/workouts');
    await expect(page.getByText('Ganzkörper Basis')).toBeVisible();
    await expect(page.getByText('1:00:00')).toBeVisible();

    // Calisthenics-Workout neu anlegen
    await page.getByRole('link', { name: 'Neues Workout' }).click();
    await expect(page).toHaveURL(/\/workouts\/neu$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Neues Workout' })).toBeVisible();

    await page.getByRole('button', { name: 'Calisthenics' }).click();
    await page.getByLabel(/^Titel/i).fill('Statics & Pull');
    await page.getByLabel(/Dauer \(Sekunden, optional\)/i).fill('2700');
    await expect(page.getByText('45:00')).toBeVisible();
    await page.getByRole('button', { name: 'Öffentlich' }).click();
    await page.getByLabel(/Notiz/i).fill('Stabile Core-Spannung');

    await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
    await page.getByLabel(/^Übungsname/i).fill('Front Lever');
    await page.getByLabel(/Variante/i).fill('Tuck');
    await page.getByLabel(/Dauer \(Sek\.\)/i).fill('20');
    await page.getByLabel(/Pause \(Sek\.\)/i).fill('90');

    await page.getByRole('button', { name: 'Satz hinzufügen' }).click();
    await page.getByLabel(/^Wiederholungen/i).nth(1).fill('6');
    await page.getByLabel(/Gewicht \(kg\)/i).nth(1).fill('10');

    await page.getByRole('button', { name: 'Workout speichern' }).click();

    // Detailansicht prüfen
    await expect(page).toHaveURL(/\/workouts\/[0-9a-f-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Statics & Pull' })).toBeVisible();
    await expect(page.getByText('Tuck', { exact: true })).toBeVisible();
    await expect(page.getByText('45:00')).toBeVisible();
    await expect(page.getByText('00:20')).toBeVisible();
    await expect(page.getByText('10 kg')).toBeVisible();

    // Übersicht & Filter testen
    await page.getByRole('link', { name: 'Zurück zu Workouts' }).click();
    await expect(page).toHaveURL(/\/workouts$/);
    await expect(page.getByText('Statics & Pull')).toBeVisible();
    await expect(page.getByText('Ganzkörper Basis')).toBeVisible();

    await page.getByRole('button', { name: 'Calisthenics' }).click();
    await expect(page.getByText('Statics & Pull')).toBeVisible();
    await expect(page.getByText('Ganzkörper Basis')).toBeHidden();

    await page.getByRole('button', { name: 'Kraft' }).click();
    await expect(page.getByText('Ganzkörper Basis')).toBeVisible();
    await expect(page.getByText('Statics & Pull')).toBeHidden();

    await page.getByRole('button', { name: 'Alle' }).click();
    await page.getByText('Statics & Pull').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Statics & Pull' })).toBeVisible();

    // Bearbeiten + 409 Versionskonflikt simulieren -> Neu laden -> erfolgreich speichern
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    const aktuelles = zustand.workouts.find((w) => w.titel === 'Statics & Pull')!;
    aktuelles.version += 1;
    aktuelles.titel = 'Statics & Pull (Parallel geändert)';

    await page.getByLabel(/^Titel/i).fill('Eigene Änderung');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();

    const konfliktAlert = page.getByRole('alert');
    await expect(konfliktAlert).toContainText(/zwischenzeitlich geändert/i);
    await konfliktAlert.getByRole('button', { name: 'Neu laden' }).click();

    await expect(page.getByLabel(/^Titel/i)).toHaveValue('Statics & Pull (Parallel geändert)');
    await page.getByLabel(/^Titel/i).fill('Statics & Pull Final');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Statics & Pull Final' })).toBeVisible();
    await expect(page.getByText(/Änderungen wurden gespeichert/i)).toBeVisible();

    // Löschen per MUI-Dialog
    await page.getByRole('button', { name: 'Löschen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Workout löschen?' });
    await expect(dialog).toContainText('Statics & Pull Final');
    await dialog.getByRole('button', { name: 'Löschen' }).click();

    await expect(page).toHaveURL(/\/workouts$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();
    await expect(page.getByText('Statics & Pull Final')).toBeHidden();
    await expect(page.getByText('Ganzkörper Basis')).toBeVisible();
  });

  test('haelt den laufenden Timer beim Navigieren zu Workouts und Neues Workout aktiv', async ({
    page,
  }) => {
    await installiereV1Attrappe(page, { initialAngemeldet: true });

    await page.goto('/');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await nav.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL(/\/workouts$/);
    await page.getByRole('link', { name: 'Neues Workout', exact: true }).click();
    await expect(page).toHaveURL(/\/workouts\/neu$/);

    await page.waitForTimeout(1200);
    await nav.getByRole('link', { name: 'Timer' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    const anzeige = await page.getByRole('timer').textContent();
    expect(anzeige).not.toBe('00:30');
  });

  test('vermeidet horizontales Scrollen auf 360 px Breite auf allen Workout-Routen', async ({
    page,
  }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialWorkouts: [BEISPIEL_WORKOUT],
    });
    await page.setViewportSize({ width: 360, height: 800 });

    const pruefeKeinUeberlauf = async (kontext: string) => {
      const ueberlauf = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        ueberlauf.scrollWidth,
        `Horizontales Scrollen bei ${kontext}: scrollWidth=${ueberlauf.scrollWidth}, clientWidth=${ueberlauf.clientWidth}`,
      ).toBeLessThanOrEqual(ueberlauf.clientWidth);
    };

    await page.goto('/workouts');
    await expect(page.getByText('Ganzkörper Basis')).toBeVisible();
    await pruefeKeinUeberlauf('/workouts');

    await page.goto(`/workouts/${BEISPIEL_WORKOUT.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Ganzkörper Basis' })).toBeVisible();
    await pruefeKeinUeberlauf('/workouts/:id');

    await page.goto('/workouts/neu');
    await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
    await expect(page.getByLabel(/^Übungsname/i)).toBeVisible();
    await pruefeKeinUeberlauf('/workouts/neu');
  });
});
