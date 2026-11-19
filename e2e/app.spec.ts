import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

test.describe('Trainingsapp Client-Grundgeruest (Produktions-Build)', () => {
  test('laedt die Startseite und navigiert durch alle Routen', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
    await expect(page.getByText('00:30', { exact: true })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });

    await nav.getByRole('link', { name: 'Workouts' }).click();
    await expect(page).toHaveURL(/\/workouts$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();

    await nav.getByRole('link', { name: 'Entdecken' }).click();
    await expect(page).toHaveURL(/\/entdecken$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Entdecken' })).toBeVisible();

    await nav.getByRole('link', { name: 'Konto' }).click();
    await expect(page).toHaveURL(/\/konto$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();

    await page.getByRole('link', { name: /Datenschutz & PoC-Hinweis/i }).click();
    await expect(page).toHaveURL(/\/datenschutz$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Datenschutz & PoC-Hinweis/i }),
    ).toBeVisible();

    await nav.getByRole('link', { name: 'Timer' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
  });

  test('vermeidet horizontales Scrollen auf 360 px Breite auf allen Routen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    for (const pfad of ['/', '/workouts', '/entdecken', '/konto', '/datenschutz']) {
      await page.goto(pfad);
      await expect(page.getByRole('main')).toBeVisible();

      const ueberlauf = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        ueberlauf.scrollWidth,
        `Horizontales Scrollen auf ${pfad}: scrollWidth=${ueberlauf.scrollWidth}, clientWidth=${ueberlauf.clientWidth}`,
      ).toBeLessThanOrEqual(ueberlauf.clientWidth);
    }
  });

  test('sendet keine Anfragen an fremde Hosts oder CDNs und laedt Roboto selbst gehostet', async ({
    page,
  }) => {
    const fremdeHosts: string[] = [];
    const fontUrls: string[] = [];

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
          fremdeHosts.push(req.url());
        }
        if (url.pathname.endsWith('.woff2')) {
          fontUrls.push(req.url());
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    for (const pfad of ['/workouts', '/entdecken', '/konto', '/datenschutz']) {
      await page.goto(pfad);
      await page.waitForLoadState('networkidle');
    }

    expect(fremdeHosts).toEqual([]);

    const geladeneRobotoSchriften = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((f) => f.status === 'loaded' && /roboto/i.test(f.family))
        .map((f) => f.family);
    });

    expect(geladeneRobotoSchriften.length).toBeGreaterThan(0);
    expect(fontUrls.length).toBeGreaterThan(0);
    for (const url of fontUrls) {
      expect(new URL(url).hostname).toBe('localhost');
    }
  });

  test('stellt PWA-Manifest und Service Worker bereit und schliesst /v1 strikt vom Cache aus', async ({
    page,
    request,
  }) => {
    await page.goto('/');

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifestAntwort = await request.get(manifestHref!);
    expect(manifestAntwort.status()).toBe(200);
    const manifest = (await manifestAntwort.json()) as {
      name: string;
      display: string;
      icons: Array<{ src: string }>;
    };
    expect(manifest.name).toBe('Trainingsapp');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    const swQuelltextAntwort = await request.get('/sw.js');
    expect(swQuelltextAntwort.status()).toBe(200);
    const swQuelltext = await swQuelltextAntwort.text();
    expect(swQuelltext).toMatch(/denylist.*\\\/v1|navigateFallbackDenylist.*\\\/v1/i);

    const swRegistrierung = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { unterstuetzt: false, aktivUrl: '' };
      }
      const reg = await navigator.serviceWorker.ready;
      return {
        unterstuetzt: true,
        aktivUrl: reg.active?.scriptURL ?? '',
      };
    });
    expect(swRegistrierung.unterstuetzt).toBe(true);
    expect(swRegistrierung.aktivUrl).toMatch(/\/sw\.js$/);

    // Reload, damit der Service Worker die Seite kontrolliert.
    await page.reload();

    // /v1-Aufrufe muessen am SW vorbei ins Netzwerk gehen und duerfen nie als index.html
    // oder im SW-Cache landen.
    await page.context().route('**/v1/info', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NICHT_ANGEMELDET', meldung: 'Anmeldung erforderlich.' }),
      });
    });

    const apiPruefung = await page.evaluate(async () => {
      const antwort = await fetch('/v1/info');
      const contentType = antwort.headers.get('content-type') ?? '';
      const text = await antwort.text();
      const cacheNamen = await caches.keys();
      const trefferInCaches: string[] = [];
      let anzahlStatischeCacheEintraege = 0;
      for (const name of cacheNamen) {
        const cache = await caches.open(name);
        const eintraege = await cache.keys();
        anzahlStatischeCacheEintraege += eintraege.length;
        if (await cache.match('/v1/info')) {
          trefferInCaches.push(name);
        }
      }
      return {
        status: antwort.status,
        contentType,
        istHtmlFallback: /<!doctype html>|<html/i.test(text),
        trefferInCaches,
        anzahlStatischeCacheEintraege,
      };
    });

    expect(apiPruefung.status).toBeGreaterThanOrEqual(400);
    expect(apiPruefung.contentType).not.toContain('text/html');
    expect(apiPruefung.istHtmlFallback).toBe(false);
    expect(apiPruefung.trefferInCaches).toEqual([]);
    expect(apiPruefung.anzahlStatischeCacheEintraege).toBeGreaterThan(0);

    // Produktions-Build darf keine galerie*-Dateien enthalten
    const distEintraege = readdirSync(join(process.cwd(), 'dist'));
    const galerieDateien = distEintraege.filter((name) => name.toLowerCase().includes('galerie'));
    expect(galerieDateien).toEqual([]);
  });
});
