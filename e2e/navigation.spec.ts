import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Navigationsleiste Timer/Konto (C-03). Ohne Tag: alle vier Browser gegen den
 * Produktions-Build.
 *
 * Die Leiste steht fest am unteren Rand (sticky). Nach dem Scrollen ans
 * Seitenende darf sie kein Bedienelement verdecken: Jedes liegt vollständig
 * oberhalb der Leiste, und der Punkt in seiner Mitte trifft das Element selbst
 * (elementFromPoint), nicht die Leiste.
 */

test.use({ viewport: { width: 360, height: 640 } });

const leiste = (page: Page) => page.getByRole('navigation', { name: 'Ansicht' });

async function ansEnde(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() =>
      page.evaluate(
        () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight,
      ),
    )
    .toBe(true);
}

/** Element liegt ganz im Bildschirm, oberhalb der Leiste, und ist an seiner Mitte nicht verdeckt. */
async function erwarteUnverdeckt(element: Locator, name: string) {
  const ergebnis = await element.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Ansicht"]')!.getBoundingClientRect();
    const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      imBild: r.top >= 0 && r.bottom <= window.innerHeight,
      ueberLeiste: r.bottom <= nav.top + 0.5,
      getroffen: treffer !== null && (el === treffer || el.contains(treffer) || treffer.contains(el)),
    };
  });
  expect(ergebnis, name).toEqual({ imBild: true, ueberLeiste: true, getroffen: true });
}

test('Leiste steht nach dem Laden am unteren Rand im Bild', async ({ page }) => {
  await page.goto('/');
  await expect(leiste(page)).toBeInViewport();
  const box = (await leiste(page).boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(640);
});

test('Timer: nach dem Scrollen ans Seitenende verdeckt die Leiste kein Bedienelement', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('timer')).toHaveText('00:30');
  await ansEnde(page);

  const unten = [
    ['Training in Sekunden', page.getByRole('textbox', { name: 'Training in Sekunden' })],
    ['Pause in Sekunden', page.getByRole('textbox', { name: 'Pause in Sekunden' })],
    ['Ton', page.getByRole('switch', { name: 'Ton' })],
    ['Vibration', page.getByRole('switch', { name: 'Vibration' })],
    // Die Karte endet mit dem Hinweis zur Vibration (falls vorhanden): ganz sichtbar.
    ['Karte Einstellung', page.getByRole('region', { name: 'Einstellung' })],
  ] as const;
  for (const [name, element] of unten) {
    // Schalter: Das Eingabeelement ist unsichtbar, sichtbar und anklickbar ist das Label.
    const ziel = name === 'Ton' || name === 'Vibration' ? element.locator('xpath=ancestor::label[1]') : element;
    await erwarteUnverdeckt(ziel, name);
  }

  // Anklickbar ohne weiteres Scrollen: Ton aus- und wieder einschalten.
  const ton = page.getByRole('switch', { name: 'Ton' });
  await expect(ton).toBeChecked();
  await page.getByText('Ton', { exact: true }).click();
  await expect(ton).not.toBeChecked();
  await page.getByText('Ton', { exact: true }).click();
  await expect(ton).toBeChecked();

  // Pausenfeld: anklicken setzt den Fokus.
  await page.getByRole('textbox', { name: 'Pause in Sekunden' }).click();
  await expect(page.getByRole('textbox', { name: 'Pause in Sekunden' })).toBeFocused();
});
