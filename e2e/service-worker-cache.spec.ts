import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { expect, test, type Page } from '@playwright/test';
import { halteUhrAn } from './uhr';

/*
 * Service-Worker-Cache des Produktions-Builds (C-16, Entscheidung E27).
 *
 * Ein Fehler in workbox-build oder in dessen Glob-Bibliothek (glob/minimatch)
 * zeigt sich nicht als Build-Fehler, sondern still als fehlende oder falsche
 * Einträge in der Precache-Liste von dist/sw.js. Die Prüfungen hier leiten die
 * Erwartung aus dem Build-Ergebnis ab (Inhalt von dist/ und den Verweisen ab
 * index.html), nicht aus einer gepflegten Liste von Dateinamen.
 *
 * Ohne Tag: läuft in chromium, firefox, webkit und mobile gegen den
 * Produktions-Build; dist/ erzeugt der Webserver der Playwright-Konfiguration
 * vorher mit `npm run build`.
 */

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

/** Dateien, die der Browser als Service-Worker-Skript lädt, nicht aus dem Precache. */
const SERVICE_WORKER_SKRIPT = /^(sw\.js|workbox-[\w-]+\.js)$/;

type PrecacheEintrag = { url: string; revision: string | null };

function alleDateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag.name);
    return eintrag.isDirectory()
      ? alleDateien(pfad)
      : [relative(DIST, pfad).split(sep).join(posix.sep)];
  });
}

/**
 * Führt dist/sw.js in einer Sandbox aus und liefert die Liste, die an
 * `precacheAndRoute` übergeben wird. So hängt der Test nicht an der
 * Schreibweise des minifizierten Codes.
 */
function precacheListe(): PrecacheEintrag[] {
  const listen: PrecacheEintrag[][] = [];
  const nichts = () => undefined;
  const workbox = new Proxy(
    {},
    {
      get: (_ziel, name) => {
        if (name === 'precacheAndRoute') {
          return (liste: PrecacheEintrag[]) => listen.push(liste);
        }
        // Konstruktoren (NavigationRoute) und Funktionen (clientsClaim, …)
        return function () {
          return {};
        };
      },
    },
  );
  const sandbox: Record<string, unknown> = {
    skipWaiting: nichts,
    addEventListener: nichts,
    define: (_abhaengigkeiten: string[], fabrik: (wb: unknown) => void) => fabrik(workbox),
  };
  sandbox.self = sandbox;
  runInNewContext(readFileSync(join(DIST, 'sw.js'), 'utf8'), sandbox);
  expect(listen, 'precacheAndRoute genau einmal aufgerufen').toHaveLength(1);
  return listen[0]!;
}

/** Lokale Verweise in einer Datei des Builds, als Pfade relativ zu dist/. */
function verweise(datei: string): string[] {
  const inhalt = readFileSync(join(DIST, datei), 'utf8');
  const roh: string[] = [];
  if (datei.endsWith('.html')) {
    for (const t of inhalt.matchAll(/\s(?:src|href)="([^"]+)"/g)) roh.push(t[1]!);
  } else if (datei.endsWith('.css')) {
    for (const t of inhalt.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) roh.push(t[1]!);
  } else if (datei.endsWith('.webmanifest')) {
    const manifest = JSON.parse(inhalt) as { icons?: { src: string }[] };
    for (const icon of manifest.icons ?? []) roh.push(icon.src);
  } else if (datei.endsWith('.js')) {
    // Von Vite erzeugte Verweise auf weitere Bundles und Assets (Chunks,
    // dynamische Importe, importierte Dateien).
    for (const t of inhalt.matchAll(/["'`(]((?:\.{0,2}\/)*assets\/[\w.-]+\.\w+)/g)) roh.push(t[1]!);
  }
  const basis = posix.dirname(datei);
  return roh
    .filter((url) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url))
    .map((url) => url.split(/[?#]/)[0]!)
    .filter((url) => url !== '' && url !== '/')
    .map((url) => (url.startsWith('/') ? url.slice(1) : posix.normalize(posix.join(basis, url))));
}

/** Alle Dateien, die ab index.html erreichbar sind (HTML, JS, CSS, Schrift, Icons, Manifest). */
function vonIndexErreichbar(): string[] {
  const gefunden = new Set<string>(['index.html']);
  const offen = ['index.html'];
  while (offen.length > 0) {
    const datei = offen.pop()!;
    for (const ziel of verweise(datei)) {
      if (!gefunden.has(ziel)) {
        gefunden.add(ziel);
        if (existsSync(join(DIST, ziel))) offen.push(ziel);
      }
    }
  }
  return [...gefunden].sort();
}

test.describe('Precache-Liste des Service Workers (dist/sw.js)', () => {
  test('enthält genau die Dateien des Builds außer dem Service-Worker-Skript', () => {
    const erwartet = alleDateien(DIST)
      .filter((datei) => !SERVICE_WORKER_SKRIPT.test(datei))
      .sort();
    const imPrecache = [...new Set(precacheListe().map((e) => e.url))].sort();

    expect(erwartet).toContain('index.html');
    expect(imPrecache).toEqual(erwartet);
  });

  test('jede von index.html aus erreichbare Datei existiert und steht in der Liste', () => {
    const erreichbar = vonIndexErreichbar();
    const imPrecache = new Set(precacheListe().map((e) => e.url));

    // Gegenprobe, dass das Durchsuchen der Verweise greift: Start, Bundles,
    // Schrift, Icons und Manifest müssen dabei sein.
    for (const muster of [
      /^index\.html$/,
      /^registerSW\.js$/,
      /^manifest\.webmanifest$/,
      /^assets\/.+\.js$/,
      /^assets\/.+\.css$/,
      /^assets\/.+\.woff2$/,
      /^favicon\.svg$/,
      /^icons\/.+\.png$/,
    ]) {
      expect(erreichbar.some((datei) => muster.test(datei)), String(muster)).toBe(true);
    }

    const fehlenInDist = erreichbar.filter((datei) => !existsSync(join(DIST, datei)));
    expect(fehlenInDist, 'verwiesen, aber nicht in dist/').toEqual([]);
    const fehlenImPrecache = erreichbar.filter((datei) => !imPrecache.has(datei));
    expect(fehlenImPrecache, 'verwiesen, aber nicht im Precache').toEqual([]);
  });

  test('jeder Eintrag existiert in dist/ und hat die richtige Revision', () => {
    const liste = precacheListe();
    expect(liste.length).toBeGreaterThan(0);

    for (const { url, revision } of liste) {
      const pfad = join(DIST, url);
      expect(existsSync(pfad) && statSync(pfad).isFile(), `${url} existiert in dist/`).toBe(true);
      if (revision === null) {
        // Ohne Revision nur Dateien mit Inhalts-Hash im Namen (Vite: name-HASH.ext).
        expect(url, `${url} ohne Revision braucht Hash im Namen`).toMatch(
          /^assets\/.+-[\w-]{8}\.\w+$/,
        );
      } else {
        // workbox-build setzt als Revision den MD5 des Dateiinhalts.
        const md5 = createHash('md5').update(readFileSync(pfad)).digest('hex');
        expect(revision, `Revision von ${url}`).toBe(md5);
      }
    }

    // Mehrfach genannte URLs (includeAssets, Manifest-Icons und globPatterns)
    // müssen dieselbe Revision haben, sonst bricht Workbox die Installation ab.
    const revisionen = new Map<string, Set<string | null>>();
    for (const { url, revision } of liste) {
      revisionen.set(url, (revisionen.get(url) ?? new Set()).add(revision));
    }
    const widerspruechlich = [...revisionen].filter(([, r]) => r.size > 1).map(([url]) => url);
    expect(widerspruechlich).toEqual([]);
  });

  test('enthält nichts Unerwünschtes (Galerie, Source Maps, Service-Worker-Skript)', () => {
    const urls = precacheListe().map((e) => e.url);
    expect(urls.filter((url) => /galerie/i.test(url))).toEqual([]);
    expect(urls.filter((url) => /\.map$/.test(url))).toEqual([]);
    expect(urls.filter((url) => SERVICE_WORKER_SKRIPT.test(url))).toEqual([]);
    expect(urls.filter((url) => /^(\/|[a-z]+:)|\.\./i.test(url))).toEqual([]);
  });
});

/** Wartet, bis der Service Worker aktiv ist und die Seite kontrolliert. */
async function warteAufServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((fertig) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => fertig(), {
          once: true,
        }),
      );
    }
  });
}

test('App startet offline aus dem Service-Worker-Cache, Timer bedienbar', async ({
  page,
  context,
}) => {
  const uhrStart = new Date('2026-11-18T10:00:00Z');
  await page.clock.install({ time: uhrStart });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Trainingsapp' })).toBeVisible();
  // Aktiv heißt: Die Installation, in der Workbox den Precache füllt, ist abgeschlossen.
  await warteAufServiceWorker(page);

  // Der Browser hat jede Datei des Builds (außer dem Service-Worker-Skript)
  // tatsächlich im Cache Storage abgelegt.
  const imCacheStorage = await page.evaluate(async () => {
    const pfade = new Set<string>();
    for (const name of await caches.keys()) {
      if (!name.startsWith('workbox-precache')) continue;
      for (const anfrage of await (await caches.open(name)).keys()) {
        pfade.add(new URL(anfrage.url).pathname.slice(1));
      }
    }
    return [...pfade].sort();
  });
  expect(imCacheStorage).toEqual(
    alleDateien(DIST)
      .filter((datei) => !SERVICE_WORKER_SKRIPT.test(datei))
      .sort(),
  );

  await context.setOffline(true);

  // Gegenprobe: Das Netz ist wirklich getrennt (eine nicht vorgehaltene URL schlägt fehl).
  const ohneCache = await page.evaluate(async () => {
    try {
      await fetch(`/nicht-im-cache-${Date.now()}.txt`, { cache: 'no-store' });
      return 'erreichbar';
    } catch {
      return 'fehlgeschlagen';
    }
  });
  expect(ohneCache).toBe('fehlgeschlagen');

  const ausDemNetz: string[] = [];
  page.on('response', (r) => {
    if (!r.fromServiceWorker()) ausDemNetz.push(r.url());
  });
  const fehlgeschlagen: string[] = [];
  page.on('requestfailed', (r) => fehlgeschlagen.push(r.url()));

  const antwort = await page.reload();
  expect(antwort?.fromServiceWorker(), 'Seite kommt aus dem Service Worker').toBe(true);

  await expect(page.getByRole('heading', { level: 1, name: 'Trainingsapp' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Intervalltimer' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('00:30');

  // Ohne Schrift im Cache fiele der Browser still auf eine Systemschrift
  // zurück. Der Schnitt für den Titel (lateinisch) muss offline ladbar sein.
  // Hinweis Firefox: Bei Playwrights Offline-Emulation bedient Firefox
  // Anfragen weiter aus dem HTTP-/Speicher-Cache (auch ohne Service Worker
  // lädt dort ein Reload offline). Fehlende Precache-Einträge erkennt in
  // Firefox deshalb nur der Vergleich des Cache Storage oben, nicht dieser Teil.
  const schrift = await page.evaluate(async () => {
    try {
      const schnitte = await document.fonts.load('400 16px "Roboto Variable"', 'Trainingsapp');
      return schnitte.map((f) => f.status);
    } catch (fehler) {
      return [String(fehler)];
    }
  });
  expect(schrift, 'Roboto offline geladen').toEqual(['loaded']);

  // Uhr anhalten, damit bis zur Prüfung nur die 2 s aus runFor vergehen (e2e/uhr.ts).
  await halteUhrAn(page, uhrStart);
  const start = page.getByRole('button', { name: 'Start' });
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) await start.tap();
  else await start.click();

  await expect(page.getByRole('button', { name: 'Anhalten' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Training, Runde 1');
  await page.clock.runFor(2000);
  await expect(page.getByRole('timer')).toHaveText('00:28');

  expect(fehlgeschlagen, 'offline fehlgeschlagene Anfragen').toEqual([]);
  expect(ausDemNetz, 'Antworten nicht aus dem Service Worker').toEqual([]);
});
