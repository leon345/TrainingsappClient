import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * Zwei Builds, zwei Server (Entscheidung E24), dazu visuelle Tests nur in
 * Chromium (Nutzervorgabe: ein Browser reicht für Bildvergleiche).
 *
 * | Projekte                                   | Build, Server                    | Tests                          |
 * | `chromium`, `firefox`, `webkit`, `mobile`  | Produktion, `vite preview` 4173  | funktional, ohne `@galerie`/`@visuell` |
 * | `galerie-chromium`, `-firefox`, `-webkit`, `-mobile` | Test (`--mode test`), 4174 | funktional mit `@galerie` (nicht `@visuell`) |
 * | `visuell-chromium`                         | Test (`--mode test`), 4174       | nur `@visuell` (Bildvergleiche) |
 *
 * Das Aussehen wird außerhalb von Chromium nicht automatisch geprüft.
 * Tags stehen in e2e/visuell.spec.ts.
 */

const PORT_PRODUKTION = 4173;
const PORT_TEST = 4174;
const URL_PRODUKTION = `http://localhost:${PORT_PRODUKTION}`;
const URL_TEST = `http://localhost:${PORT_TEST}`;

const GALERIE = /@galerie/;
const VISUELL = /@visuell/;
const GALERIE_ODER_VISUELL = /@galerie|@visuell/;

const BROWSER = [
  { name: 'chromium', geraet: devices['Desktop Chrome'] },
  { name: 'firefox', geraet: devices['Desktop Firefox'] },
  { name: 'webkit', geraet: devices['Desktop Safari'] },
  // Mobil-Emulation: iPhone (WebKit), da iOS-Safari die strengste Zielplattform ist.
  { name: 'mobile', geraet: devices['iPhone 13'] },
] as const;

const projekte: NonNullable<PlaywrightTestConfig['projects']> = [
  // Produktions-Build: alle funktionalen Tests, die keine Galerie brauchen.
  ...BROWSER.map(({ name, geraet }) => ({
    name,
    grepInvert: GALERIE_ODER_VISUELL,
    use: { ...geraet, baseURL: URL_PRODUKTION },
  })),
  // Test-Build: funktionale Tests, die die Galerie brauchen.
  ...BROWSER.map(({ name, geraet }) => ({
    name: `galerie-${name}`,
    grep: GALERIE,
    grepInvert: VISUELL,
    use: { ...geraet, baseURL: URL_TEST },
  })),
  // Test-Build: Bildvergleiche nur in Chromium. Die Referenzbilder behalten
  // ihre bisherigen Namen (z. B. `buttons-light-chromium-linux.png`).
  {
    name: 'visuell-chromium',
    grep: VISUELL,
    use: { ...devices['Desktop Chrome'], baseURL: URL_TEST },
    snapshotPathTemplate:
      '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium{-snapshotSuffix}{ext}',
  },
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
