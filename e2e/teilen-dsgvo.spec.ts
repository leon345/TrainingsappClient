import { expect, test } from '@playwright/test';
import { installiereV1Attrappe } from './support/v1Attrappe';

const EIGENES_WORKOUT = {
  id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000101',
  typ: 'CALISTHENICS' as const,
  titel: 'Handstand & Ringe',
  startZeit: '2026-11-19T17:00:00Z',
  dauerSekunden: 2700,
  sichtbarkeit: 'PRIVAT' as const,
  herkunft: 'MANUELL' as const,
  erstelltAm: '2026-11-19T17:00:00Z',
  geaendertAm: '2026-11-19T17:45:00Z',
  version: 1,
  uebungen: [
    {
      id: 'cccccccc-cccc-4aaa-8aaa-000000000101',
      position: 0,
      name: 'Handstand',
      variante: 'Frei',
      saetze: [
        {
          id: 'dddddddd-dddd-4aaa-8aaa-000000000101',
          position: 0,
          dauerSekunden: 30,
          pauseSekunden: 90,
        },
      ],
    },
  ],
};

const ANNA_ID = '44444444-4444-4444-8444-444444444441';

const GETEILTES_WORKOUT = {
  id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000201',
  ownerId: ANNA_ID,
  ownerBenutzername: 'anna.fit',
  typ: 'KRAFT' as const,
  titel: 'Annas Kraft-Einheit',
  startZeit: '2026-11-18T16:00:00Z',
  dauerSekunden: 3600,
  sichtbarkeit: 'PRIVAT' as const,
  herkunft: 'MANUELL' as const,
  erstelltAm: '2026-11-18T16:00:00Z',
  geaendertAm: '2026-11-18T17:00:00Z',
  version: 1,
  eingeladenAm: '2026-11-19T09:00:00Z',
  uebungen: [
    {
      id: 'cccccccc-cccc-4aaa-8aaa-000000000201',
      position: 0,
      name: 'Kreuzheben',
      saetze: [
        {
          id: 'dddddddd-dddd-4aaa-8aaa-000000000201',
          position: 0,
          wiederholungen: 5,
          gewichtKg: 95,
        },
      ],
    },
  ],
};

const OEFFENTLICHES_PROFIL_WORKOUT = {
  id: 'bbbbbbbb-bbbb-4aaa-8aaa-000000000301',
  typ: 'CALISTHENICS' as const,
  titel: 'Annas Öffentliches Mobility-Workout',
  startZeit: '2026-11-17T10:00:00Z',
  dauerSekunden: 1800,
  sichtbarkeit: 'OEFFENTLICH' as const,
  herkunft: 'MANUELL' as const,
  erstelltAm: '2026-11-17T10:00:00Z',
  geaendertAm: '2026-11-17T10:30:00Z',
  version: 1,
  uebungen: [],
};

test.describe('Sichtbarkeit, Einladungen, Entdecken, Profile & DSGVO-UI (Produktions-Build)', () => {
  test('schaltet Sichtbarkeit um, sucht & laedt Benutzer ein und entfernt Einladung', async ({
    page,
  }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialWorkouts: [EIGENES_WORKOUT],
      initialSuchbareBenutzer: [{ id: ANNA_ID, benutzername: 'anna.fit' }],
    });

    await page.goto(`/workouts/${EIGENES_WORKOUT.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Handstand & Ringe' })).toBeVisible();

    // Sichtbarkeit auf Öffentlich umschalten
    await page.getByRole('button', { name: 'Öffentlich' }).click();
    await expect(page.getByText(/Sichtbarkeit wurde auf „Öffentlich“ geändert/i)).toBeVisible();

    // Benutzer suchen & einladen
    await page.getByRole('button', { name: 'Benutzer einladen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Benutzer einladen' });
    await dialog.getByLabel(/Benutzername \(exakt\)/i).fill('anna.fit');
    await dialog.getByRole('button', { name: 'Suchen' }).click();
    await expect(dialog.getByText('anna.fit', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Einladen' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('anna.fit', { exact: true })).toBeVisible();

    // Einladung entfernen
    await page.getByRole('button', { name: 'Einladung für anna.fit entfernen' }).click();
    await expect(page.getByText('anna.fit', { exact: true })).toBeHidden();
  });

  test('zeigt geteilte Workouts, sucht oeffentliches Profil und zeigt fremde Workouts schreibgeschuetzt', async ({
    page,
  }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialSuchbareBenutzer: [{ id: ANNA_ID, benutzername: 'anna.fit' }],
      initialGeteilteWorkouts: [GETEILTES_WORKOUT],
      initialProfilWorkouts: {
        [ANNA_ID]: [OEFFENTLICHES_PROFIL_WORKOUT],
      },
    });

    await page.goto('/entdecken');
    await expect(page.getByRole('heading', { level: 1, name: 'Entdecken' })).toBeVisible();
    await expect(page.getByText('Annas Kraft-Einheit')).toBeVisible();
    await expect(page.getByText('Von anna.fit')).toBeVisible();

    // Geteiltes Workout schreibgeschützt öffnen
    await page.getByRole('link', { name: /Annas Kraft-Einheit/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Annas Kraft-Einheit' })).toBeVisible();
    await expect(page.getByText('Schreibgeschützt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Löschen' })).toBeHidden();

    // Zurück zu Entdecken & öffentliches Profil suchen
    await page.getByRole('link', { name: 'Zurück zu Entdecken' }).click();
    await page.getByLabel(/Benutzername \(exakt\)/i).fill('anna.fit');
    await page.getByRole('button', { name: 'Profil suchen' }).click();
    await page.getByRole('link', { name: 'Öffentliches Profil ansehen' }).click();

    await expect(page).toHaveURL(new RegExp(`/profil/${ANNA_ID}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Profil: anna.fit' })).toBeVisible();
    await expect(page.getByText('Annas Öffentliches Mobility-Workout')).toBeVisible();
  });

  test('exportiert DSGVO-Daten als JSON und loescht Konto zweistufig', async ({ page }) => {
    const zustand = await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialPasskeys: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
          credentialId: 'cred-1',
          bezeichnung: 'Passkey 1',
          erstelltAm: '2026-11-19',
        },
      ],
      initialWorkouts: [EIGENES_WORKOUT],
    });

    await page.goto('/konto');
    await expect(page.getByRole('heading', { level: 2, name: 'max.muster' })).toBeVisible();

    // 1) JSON-Datenexport auslösen
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Meine Daten exportieren (JSON)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^trainingsapp-datenexport-\d{4}-\d{2}-\d{2}\.json$/,
    );
    await expect(page.getByText(/DSGVO-Datenexport wurde als JSON-Datei heruntergeladen/i)).toBeVisible();

    // 2) Zweistufige Kontolöschung
    await page.getByRole('button', { name: 'Konto dauerhaft löschen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Konto dauerhaft löschen?' });
    const endgueltigButton = dialog.getByRole('button', { name: 'Konto endgültig löschen' });
    await expect(endgueltigButton).toBeDisabled();

    await dialog.getByRole('checkbox').check();
    await expect(endgueltigButton).toBeDisabled();

    await dialog.getByLabel(/Benutzernamen zur Bestätigung eingeben/i).fill('max.muster');
    await expect(endgueltigButton).toBeEnabled();

    await endgueltigButton.click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText(/Dein Konto und alle zugehörigen Daten wurden dauerhaft gelöscht/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toBeVisible();
    expect(zustand.kontoGeloescht).toBe(true);
  });

  test('zeigt PoC-Hinweis (E31) an allen vier Stellen und vermeidet horizontales Scrollen auf 360 px', async ({
    page,
  }) => {
    await installiereV1Attrappe(page, {
      initialAngemeldet: true,
      initialWorkouts: [EIGENES_WORKOUT],
      initialSuchbareBenutzer: [{ id: ANNA_ID, benutzername: 'anna.fit' }],
      initialGeteilteWorkouts: [GETEILTES_WORKOUT],
      initialProfilWorkouts: {
        [ANNA_ID]: [OEFFENTLICHES_PROFIL_WORKOUT],
      },
    });

    await page.setViewportSize({ width: 360, height: 800 });

    const routen = ['/', `/workouts/${EIGENES_WORKOUT.id}`, '/entdecken', `/profil/${ANNA_ID}`, '/datenschutz'];
    for (const pfad of routen) {
      await page.goto(pfad);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toContainText(/vollständig KI-generiert/i);

      const ueberlauf = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        ueberlauf.scrollWidth,
        `Horizontales Scrollen auf ${pfad}: scrollWidth=${ueberlauf.scrollWidth}, clientWidth=${ueberlauf.clientWidth}`,
      ).toBeLessThanOrEqual(ueberlauf.clientWidth);
    }

    // PoC-Hinweis auf Datenschutzerklärung & Impressum-Platzhalter
    await page.goto('/datenschutz');
    await expect(page.getByText('[Verantwortlicher / Impressum vom Betreiber einzutragen]')).toBeVisible();
    await expect(page.getByRole('main')).toContainText(/Bitte keine sensiblen Angaben eintragen/i);
  });
});
