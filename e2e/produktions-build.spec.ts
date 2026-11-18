import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/*
 * Der Produktions-Build (dist/) enthält keine Komponentengalerie (E24).
 * Die Galerie gibt es nur im Test-Build (`vite build --mode test`, dist-test/).
 * Läuft in den Projekten gegen den Produktions-Build; dist/ hat der Webserver
 * der Playwright-Konfiguration vorher mit `npm run build` erzeugt.
 */

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

function alleDateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag.name);
    return eintrag.isDirectory() ? alleDateien(pfad) : [relative(DIST, pfad)];
  });
}

test('Produktions-Build enthält keine galerie*-Dateien', () => {
  const dateien = alleDateien(DIST);
  expect(dateien).toContain('index.html');
  expect(dateien.filter((datei) => /galerie/i.test(datei))).toEqual([]);
});

test('Precache-Liste des Service Workers enthält keine Galerie', () => {
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((treffer) => treffer[1]);
  expect(urls).toContain('index.html');
  expect(urls.filter((url) => /galerie/i.test(url!))).toEqual([]);
});

test('Kein Galerie-Code im Produktions-Build', () => {
  const textdateien = alleDateien(DIST).filter((datei) => /\.(html|js|css|webmanifest)$/.test(datei));
  expect(textdateien.length).toBeGreaterThan(0);
  const mitGalerie = textdateien.filter((datei) =>
    /galerie/i.test(readFileSync(join(DIST, datei), 'utf8')),
  );
  expect(mitGalerie).toEqual([]);
});

test('/galerie.html liefert keine Galerie aus', async ({ page }) => {
  await page.goto('/galerie.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Trainingsapp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Komponentengalerie' })).toHaveCount(0);
});
