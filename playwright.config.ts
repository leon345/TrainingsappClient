import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * Zwei Builds, zwei Server (Entscheidung E24):
 *
 * - Produktions-Build (`npm run build`, `vite preview`, Port 4173):
 *   Projekte `chromium`, `firefox`, `webkit`, `mobile`. Hier laufen alle
 *   funktionalen E2E-Tests (Manifest, Service Worker, keine fremden Hosts),
 *   die Prüfung, dass der Build keine Galerie enthält, und die Tests aus
 *   e2e/visuell.spec.ts ohne Tag `@galerie` (Startseite, Farbschema).
 * - Test-Build (`npm run build:test`, `vite build --mode test` nach dist-test/,
 *   Port 4174): Projekte `galerie-chromium`, `galerie-firefox`,
 *   `galerie-webkit`, `galerie-mobile`. Hier laufen nur die Tests der
 *   Komponentengalerie (Tag `@galerie` in e2e/visuell.spec.ts).
 *
 * Die Galerie-Projekte legen ihre Referenzbilder unter demselben Namen ab wie
 * das gleichnamige Browser-Projekt (z. B. `buttons-light-chromium-linux.png`).
 */

const PORT_PRODUKTION = 4173;
const PORT_TEST = 4174;
const URL_PRODUKTION = `http://localhost:${PORT_PRODUKTION}`;
const URL_TEST = `http://localhost:${PORT_TEST}`;

const GALERIE = /@galerie/;

const BROWSER = [
  { name: 'chromium', geraet: devices['Desktop Chrome'] },
  { name: 'firefox', geraet: devices['Desktop Firefox'] },
  { name: 'webkit', geraet: devices['Desktop Safari'] },
  // Mobil-Emulation: iPhone (WebKit), da iOS-Safari die strengste Zielplattform ist.
  { name: 'mobile', geraet: devices['iPhone 13'] },
] as const;

const projekte: NonNullable<PlaywrightTestConfig['projects']> = [
  // Gegen den Produktions-Build: alles außer den Galerie-Tests.
  ...BROWSER.map(({ name, geraet }) => ({
    name,
    grepInvert: GALERIE,
    use: { ...geraet, baseURL: URL_PRODUKTION },
  })),
  // Gegen den Test-Build: nur die Galerie-Tests.
  ...BROWSER.map(({ name, geraet }) => ({
    name: `galerie-${name}`,
    testMatch: 'visuell.spec.ts',
    grep: GALERIE,
    use: { ...geraet, baseURL: URL_TEST },
    snapshotPathTemplate: `{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-${name}{-snapshotSuffix}{ext}`,
  })),
];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: projekte,
  webServer: [
    {
      command: `npm run build && npm run preview -- --port ${PORT_PRODUKTION} --strictPort`,
      url: URL_PRODUKTION,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npm run build:test && npm run preview:test -- --port ${PORT_TEST} --strictPort`,
      url: URL_TEST,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
